import 'dart:async';
import 'dart:ui' as ui;

import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../app/config.dart';
import 'frames.dart';
import 'mpv.dart';

class _Job {
  _Job(this.url, this.seek, this.done, this.large);
  final String url;
  final Duration seek;
  final Completer<ui.Image?> done;
  final bool large;
}

/// A second, muted mpv instance that opens a stream for a moment and takes one frame.
/// Used for archive/EPG thumbnails and seek previews — only when the account's connection
/// limit allows it (it opens its own connection to the server).
class FrameGrabber {
  FrameGrabber({required this.allowed, this.precheck});

  /// Asked before every grab (settings + connection limit + what the main player is doing).
  final bool Function() allowed;

  /// Slower check right before a connection is opened (e.g. asks the server how many
  /// connections are in use, so a grab never pushes the line over its limit).
  final Future<bool> Function()? precheck;

  Player? _player;
  VideoController? _video;
  final List<_Job> _queue = [];
  bool _busy = false;
  int _generation = 0;

  Future<void> _ensure() async {
    if (_player != null) return;
    final p = Player(configuration: const PlayerConfiguration(muted: true, title: '${AppConfig.appName} preview', bufferSize: 4 * 1024 * 1024));
    // A video output is needed for screenshots; small render size keeps it light.
    _video = VideoController(p, configuration: const VideoControllerConfiguration(width: 320, height: 180, enableHardwareAcceleration: false, hwdec: 'no'));
    await configureMpvForIptv(p, bufferMb: 16, preview: true);
    _player = p;
  }

  /// Queues a frame grab. Newest requests are served first; old ones are dropped when many wait.
  Future<ui.Image?> grab(String url, {Duration seek = Duration.zero, bool large = false}) {
    if (!allowed()) return Future.value(null);
    final c = Completer<ui.Image?>();
    _queue.add(_Job(url, seek, c, large));
    while (_queue.length > 6) {
      _queue.removeAt(0).done.complete(null);
    }
    _pump();
    return c.future;
  }

  void _pump() {
    if (_busy || _queue.isEmpty) return;
    final job = _queue.removeLast();
    _busy = true;
    final gen = _generation;
    _run(job, gen).then((img) {
      if (!job.done.isCompleted) job.done.complete(gen == _generation ? img : null);
    }).catchError((Object _) {
      if (!job.done.isCompleted) job.done.complete(null);
    }).whenComplete(() {
      _busy = false;
      _pump();
    });
  }

  Future<ui.Image?> _run(_Job job, int gen) async {
    if (!allowed()) return null;
    final pre = precheck;
    if (pre != null && !await pre()) return null;
    if (gen != _generation || !allowed()) return null;
    await _ensure();
    final p = _player!;
    try {
      await p.open(Media(job.url, httpHeaders: const {'User-Agent': AppConfig.userAgent}), play: true);
      final deadline = DateTime.now().add(const Duration(seconds: 9));
      var seeked = job.seek == Duration.zero;
      while (DateTime.now().isBefore(deadline)) {
        await Future<void>.delayed(const Duration(milliseconds: 200));
        if (gen != _generation || !allowed()) return null;
        final st = p.state;
        if (!seeked && st.duration > Duration.zero) {
          await p.seek(job.seek);
          seeked = true;
          continue;
        }
        if (seeked && (st.width ?? 0) > 0 && st.position > (job.seek + const Duration(milliseconds: 300))) {
          break;
        }
      }
      if (gen != _generation) return null;
      for (var attempt = 0; attempt < 3; attempt++) {
        final st = p.state;
        final w = st.width ?? 0;
        final h = st.height ?? 0;
        if (w > 1 && h > 1) {
          final raw = await p.screenshot(format: null);
          if (raw != null) {
            final ow = job.large ? kLargeW : kThumbW;
            final oh = job.large ? kLargeH : kThumbH;
            final rgba = downscaleBgra(raw, w, h, outW: ow, outH: oh);
            if (rgba != null && !isBlankRgba(rgba)) return rgbaToImage(rgba, w: ow, h: oh);
          }
        }
        await Future<void>.delayed(const Duration(milliseconds: 500));
      }
      return null;
    } finally {
      // Always give the connection back to the server.
      try {
        await p.stop();
      } catch (_) {}
    }
  }

  /// Drops everything and closes the preview stream at once (e.g. the main player starts and the
  /// account allows a single connection).
  Future<void> suspend() async {
    _generation++;
    for (final j in _queue) {
      if (!j.done.isCompleted) j.done.complete(null);
    }
    _queue.clear();
    final p = _player;
    if (p != null) {
      try {
        await p.stop();
      } catch (_) {}
    }
  }

  Future<void> dispose() async {
    await suspend();
    await _player?.dispose();
    _player = null;
    _video = null;
  }

  // Keeps the analyzer quiet about the controller that only has to exist.
  bool get hasVideo => _video != null;
}
