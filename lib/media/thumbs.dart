import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/models.dart';
import '../data/xmltv_icons.dart';
import '../data/xtream_client.dart';
import 'frame_grabber.dart';
import 'frames.dart';

/// Picture for an EPG programme tile.
class ProgramPicture {
  const ProgramPicture({this.bytes, this.url});
  final Uint8List? bytes; // a real frame (captured or from the archive)
  final String? url; // EPG picture (XMLTV)
  bool get isEmpty => bytes == null && (url == null || url!.isEmpty);
}

/// Thumbnails for programmes: real frames first (saved while watching, or taken from the
/// archive when allowed), then the EPG picture, then the channel logo (drawn by the widget).
class ThumbService {
  ThumbService({required this.disk, required this.icons, required this.grabber, required this.api, required this.canGrab});
  final ThumbDiskCache disk;
  final XmltvIcons icons;
  final FrameGrabber grabber;
  final XtreamClient Function() api;
  final bool Function() canGrab;

  final Map<String, ValueNotifier<ProgramPicture>> _watch = {};
  final Set<String> _requested = {};

  ValueNotifier<ProgramPicture> watch(Channel c, Program p) {
    final key = p.key;
    final n = _watch.putIfAbsent(key, () => ValueNotifier<ProgramPicture>(ProgramPicture(bytes: disk.peek(key), url: p.icon ?? icons.iconFor(c, p))));
    if (n.value.bytes == null) _load(c, p, n);
    return n;
  }

  Future<void> _load(Channel c, Program p, ValueNotifier<ProgramPicture> n) async {
    final key = p.key;
    if (_requested.contains(key)) return;
    _requested.add(key);
    final cached = await disk.get(key);
    if (cached != null) {
      n.value = ProgramPicture(bytes: cached, url: n.value.url);
      return;
    }
    // Real frame from the archive (past or running programme on an archive channel).
    final now = DateTime.now().toUtc();
    if (!c.hasArchive || p.start.isAfter(now.subtract(const Duration(minutes: 3))) || !canGrab()) {
      _requested.remove(key); // may become possible later
      return;
    }
    final archiveStart = c.archiveStart(now);
    if (archiveStart != null && p.start.isBefore(archiveStart)) return;
    // A moment a few minutes in (skips intros/ads at the very start).
    var at = p.start.add(Duration(seconds: (p.duration.inSeconds * 0.2).clamp(60, 480).round()));
    final latest = now.subtract(const Duration(minutes: 2));
    if (at.isAfter(latest)) at = latest;
    final url = api().timeshiftUrl(c.id, at, const Duration(minutes: 2));
    final img = await grabber.grab(url);
    if (img == null) {
      _requested.remove(key);
      return;
    }
    final png = await imageToPng(img);
    if (png == null) return;
    await disk.put(key, png);
    n.value = ProgramPicture(bytes: png, url: n.value.url);
  }

  /// Stores a frame captured by the main player as the programme's thumbnail.
  Future<void> saveCaptured(Program p, Uint8List png) async {
    if (disk.has(p.key)) return;
    await disk.put(p.key, png);
    final n = _watch[p.key];
    if (n != null) n.value = ProgramPicture(bytes: png, url: n.value.url);
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
  }
}
