import 'dart:async';
import 'dart:collection';

import 'package:flutter/foundation.dart';

import 'models.dart';
import 'xtream_client.dart';

/// EPG per channel, fetched on demand with a small request pool so the panel is never flooded.
class EpgRepository extends ChangeNotifier {
  EpgRepository(this.api);
  final XtreamClient api;

  final Map<int, List<Program>> _programs = {};
  final Map<int, DateTime> _fullAt = {};
  final Map<int, DateTime> _shortAt = {};
  final Map<String, Future<void>> _inflight = {};
  final Queue<_Job> _queue = Queue<_Job>();
  int _running = 0;
  static const _maxParallel = 4;
  Timer? _notify;

  /// Called when programmes of a channel were (re)loaded — e.g. to attach XMLTV icons.
  void Function(Channel channel, List<Program> programs)? onLoaded;

  List<Program> programs(int channelId) => _programs[channelId] ?? const [];

  /// Every channel whose programmes are loaded (channel id → programmes).
  Iterable<MapEntry<int, List<Program>>> get loaded => _programs.entries;

  /// Something about the programmes changed (e.g. pictures arrived): redraw.
  void touch() => _changed();
  bool hasFull(int channelId) => _fullAt.containsKey(channelId);

  Program? at(int channelId, DateTime t) {
    final list = _programs[channelId];
    if (list == null || list.isEmpty) return null;
    // Binary search for the programme containing t.
    var lo = 0, hi = list.length - 1;
    while (lo <= hi) {
      final mid = (lo + hi) >> 1;
      final p = list[mid];
      if (t.isBefore(p.start)) {
        hi = mid - 1;
      } else if (!t.isBefore(p.end)) {
        lo = mid + 1;
      } else {
        return p;
      }
    }
    return null;
  }

  Program? after(int channelId, DateTime t) {
    for (final p in programs(channelId)) {
      if (!p.start.isBefore(t)) return p;
    }
    return null;
  }

  Program? before(int channelId, Program p) {
    final list = programs(channelId);
    final i = list.indexWhere((x) => x.start == p.start);
    return i > 0 ? list[i - 1] : null;
  }

  Program? nextOf(int channelId, Program p) {
    final list = programs(channelId);
    final i = list.indexWhere((x) => x.start == p.start);
    return i >= 0 && i + 1 < list.length ? list[i + 1] : null;
  }

  List<Program> between(int channelId, DateTime from, DateTime to) =>
      programs(channelId).where((p) => p.end.isAfter(from) && p.start.isBefore(to)).toList();

  void _changed() {
    _notify ??= Timer(const Duration(milliseconds: 180), () {
      _notify = null;
      notifyListeners();
    });
  }

  void _merge(Channel c, List<Program> fresh) {
    if (fresh.isEmpty) {
      _programs.putIfAbsent(c.id, () => []);
      return;
    }
    final existing = _programs[c.id] ?? const <Program>[];
    final byStart = <int, Program>{for (final p in existing) p.start.millisecondsSinceEpoch: p};
    for (final p in fresh) {
      final old = byStart[p.start.millisecondsSinceEpoch];
      if (old?.icon != null && p.icon == null) p.icon = old!.icon;
      byStart[p.start.millisecondsSinceEpoch] = p;
    }
    final merged = byStart.values.toList()..sort((a, b) => a.start.compareTo(b.start));
    // Remove programmes overlapped by a fresher entry.
    final clean = <Program>[];
    for (final p in merged) {
      if (clean.isNotEmpty && p.start.isBefore(clean.last.end) && p.start != clean.last.start) {
        if (!clean.last.end.isAfter(p.end)) {
          clean.removeLast();
        } else {
          continue;
        }
      }
      clean.add(p);
    }
    _programs[c.id] = clean;
    onLoaded?.call(c, clean);
  }

  Future<void> _enqueue(Channel c, bool full, {bool urgent = false}) {
    final key = '${c.id}-$full';
    final existing = _inflight[key];
    if (existing != null) return existing;
    final job = _Job(c, full);
    if (urgent) {
      _queue.addFirst(job);
    } else {
      _queue.addLast(job);
    }
    final f = job.done.future.whenComplete(() => _inflight.remove(key));
    _inflight[key] = f;
    _pump();
    return f;
  }

  void _pump() {
    while (_running < _maxParallel && _queue.isNotEmpty) {
      final job = _queue.removeFirst();
      _running++;
      () async {
        try {
          final list = job.full ? await api.fullEpg(job.channel.id) : await api.shortEpg(job.channel.id, limit: 8);
          _merge(job.channel, list);
          (job.full ? _fullAt : _shortAt)[job.channel.id] = DateTime.now();
          _changed();
        } catch (_) {
          // EPG is optional: keep what we have, try again later.
          (job.full ? _fullAt : _shortAt)[job.channel.id] = DateTime.now().subtract(const Duration(minutes: 25));
        } finally {
          _running--;
          job.done.complete();
          _pump();
        }
      }();
    }
  }

  /// Ensures "now/next" is known for [c] (cheap call).
  Future<void> ensureNow(Channel c, {bool urgent = false}) {
    final now = DateTime.now().toUtc();
    final cur = at(c.id, now);
    if (cur != null && after(c.id, cur.end) != null) return Future.value();
    final t = _shortAt[c.id] ?? _fullAt[c.id];
    if (t != null && DateTime.now().difference(t) < const Duration(minutes: 10)) return Future.value();
    return _enqueue(c, false, urgent: urgent);
  }

  /// Ensures the full EPG (archive days + upcoming) of [c].
  Future<void> ensureFull(Channel c, {bool urgent = true}) {
    final t = _fullAt[c.id];
    if (t != null && DateTime.now().difference(t) < const Duration(minutes: 30)) return Future.value();
    return _enqueue(c, true, urgent: urgent);
  }

  /// For lists: fetch now/next for the given channels, nearest first.
  void prefetchNow(Iterable<Channel> channels) {
    for (final c in channels) {
      ensureNow(c);
    }
  }

  void clear() {
    _programs.clear();
    _fullAt.clear();
    _shortAt.clear();
    _queue.clear();
    notifyListeners();
  }
}

class _Job {
  _Job(this.channel, this.full);
  final Channel channel;
  final bool full;
  final done = Completer<void>();
}
