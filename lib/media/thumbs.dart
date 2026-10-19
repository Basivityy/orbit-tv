import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/models.dart';
import '../data/xmltv_icons.dart';
import '../data/xtream_client.dart';
import 'frame_grabber.dart';
import 'frames.dart';

/// Picture for an EPG programme tile.
class ProgramPicture {
  const ProgramPicture({this.bytes, this.url, this.large = false});
  final Uint8List? bytes; // a real frame (captured or from the archive)
  final String? url; // EPG picture (XMLTV)
  final bool large; // [bytes] is the big (960x540) frame
  bool get isEmpty => bytes == null && (url == null || url!.isEmpty);
}

/// Thumbnails for programmes: real frames first (saved while watching, or taken from the
/// archive when allowed), then the EPG picture, then the channel logo (drawn by the widget).
/// Small frames (320x180) are for cards and the guide; large ones (960x540) for hero banners.
class ThumbService {
  ThumbService({required this.disk, required this.icons, required this.grabber, required this.api, required this.canGrab});
  final ThumbDiskCache disk;
  final XmltvIcons icons;
  final FrameGrabber grabber;
  final XtreamClient Function() api;
  final bool Function() canGrab;

  final Map<String, ValueNotifier<ProgramPicture>> _watch = {};
  final Map<String, ValueNotifier<ProgramPicture>> _watchLarge = {};
  final Set<String> _requested = {};

  static String largeKey(Program p) => 'L:${p.key}';

  ValueNotifier<ProgramPicture> watch(Channel c, Program p) {
    final key = p.key;
    final n = _watch.putIfAbsent(key, () => ValueNotifier<ProgramPicture>(ProgramPicture(bytes: disk.peek(key), url: p.icon ?? icons.iconFor(c, p))));
    if (n.value.bytes == null) _load(c, p, n, large: false);
    return n;
  }

  /// Big picture; shows the small one (or the EPG picture) until the big frame exists.
  ValueNotifier<ProgramPicture> watchLarge(Channel c, Program p) {
    final key = largeKey(p);
    final existing = _watchLarge[key];
    if (existing != null) {
      if (!existing.value.large) _load(c, p, existing, large: true);
      return existing;
    }
    final small = watch(c, p);
    final big = disk.peek(key);
    final n = ValueNotifier<ProgramPicture>(big != null ? ProgramPicture(bytes: big, url: small.value.url, large: true) : small.value);
    _watchLarge[key] = n;
    if (big == null) {
      // Mirror the small picture until the large one arrives.
      void mirror() {
        if (!n.value.large) n.value = small.value;
      }

      small.addListener(mirror);
      _load(c, p, n, large: true);
    }
    return n;
  }

  Future<void> _load(Channel c, Program p, ValueNotifier<ProgramPicture> n, {required bool large}) async {
    final key = large ? largeKey(p) : p.key;
    if (_requested.contains(key)) return;
    _requested.add(key);
    final cached = await disk.get(key);
    if (cached != null) {
      n.value = ProgramPicture(bytes: cached, url: n.value.url, large: large);
      return;
    }
    // Real frame: from the archive (a few minutes into the programme), or — for a programme
    // that has just started / a channel without archive — from the live stream right now.
    final now = DateTime.now().toUtc();
    if (!canGrab()) {
      _requested.remove(key); // may become possible later
      return;
    }
    String url;
    final fromArchive = c.hasArchive && !p.start.isAfter(now.subtract(const Duration(minutes: 3)));
    if (fromArchive) {
      final archiveStart = c.archiveStart(now);
      if (archiveStart != null && p.start.isBefore(archiveStart)) return;
      // A moment a few minutes in (skips intros/ads at the very start).
      var at = p.start.add(Duration(seconds: (p.duration.inSeconds * 0.2).clamp(60, 480).round()));
      final latest = now.subtract(const Duration(minutes: 2));
      if (at.isAfter(latest)) at = latest;
      url = api().timeshiftUrl(c.id, at, const Duration(minutes: 2));
    } else if (p.isLiveAt(now)) {
      url = api().liveUrl(c.id);
    } else {
      _requested.remove(key);
      return;
    }
    final img = await grabber.grab(url, large: large);
    if (img == null) {
      _requested.remove(key);
      return;
    }
    final png = await imageToPng(img);
    if (png == null) return;
    await disk.put(key, png);
    n.value = ProgramPicture(bytes: png, url: n.value.url, large: large);
  }

  /// Stores frames captured by the main player as the programme's pictures.
  Future<void> saveCaptured(Program p, Uint8List png, Uint8List? largePng) async {
    if (!disk.has(p.key)) {
      await disk.put(p.key, png);
      final n = _watch[p.key];
      if (n != null) n.value = ProgramPicture(bytes: png, url: n.value.url);
    }
    final lk = largeKey(p);
    if (largePng != null && !disk.has(lk)) {
      await disk.put(lk, largePng);
      final n = _watchLarge[lk];
      if (n != null) n.value = ProgramPicture(bytes: largePng, url: n.value.url, large: true);
    }
  }

  bool hasThumb(Program p) => disk.has(p.key);

  /// Forget notifiers nobody needs any more (called when leaving big lists).
  void trim() {
    if (_watch.length > 600) {
      final keys = _watch.keys.take(_watch.length - 400).toList();
      for (final k in keys) {
        _watch.remove(k);
      }
    }
    if (_watchLarge.length > 60) {
      final keys = _watchLarge.keys.take(_watchLarge.length - 40).toList();
      for (final k in keys) {
        _watchLarge.remove(k);
      }
    }
  }
}
