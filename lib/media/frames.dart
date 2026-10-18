import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:crypto/crypto.dart';
import 'package:path_provider/path_provider.dart';

import '../util/debouncer.dart';

/// Thumbnail size used everywhere (16:9).
const int kThumbW = 320;
const int kThumbH = 180;

/// Downscales a raw BGRA frame (mpv screenshot-raw) to [kThumbW]x[kThumbH] RGBA.
/// [w]/[h] are the display size reported by the player; the frame itself may be narrower
/// (anamorphic SD) and rows may be padded, so the row length is derived from the data.
Uint8List? downscaleBgra(Uint8List bgra, int displayW, int h) {
  if (displayW < 2 || h < 2 || bgra.isEmpty) return null;
  final stride = bgra.length ~/ h;
  final w = math.min(displayW, stride ~/ 4);
  if (w < 2) return null;
  final out = Uint8List(kThumbW * kThumbH * 4);
  // Box-ish sampling: average 2x2 source pixels around each target point (cheap, avoids shimmer).
  for (var y = 0; y < kThumbH; y++) {
    final sy = ((y + 0.5) * h / kThumbH).floor().clamp(0, h - 2);
    final row0 = sy * stride;
    final row1 = row0 + stride;
    for (var x = 0; x < kThumbW; x++) {
      final sx = ((x + 0.5) * w / kThumbW).floor().clamp(0, w - 2);
      final i0 = row0 + sx * 4;
      final i1 = row1 + sx * 4;
      final o = (y * kThumbW + x) * 4;
      out[o] = (bgra[i0 + 2] + bgra[i0 + 6] + bgra[i1 + 2] + bgra[i1 + 6]) >> 2; // R
      out[o + 1] = (bgra[i0 + 1] + bgra[i0 + 5] + bgra[i1 + 1] + bgra[i1 + 5]) >> 2; // G
      out[o + 2] = (bgra[i0] + bgra[i0 + 4] + bgra[i1] + bgra[i1 + 4]) >> 2; // B
      out[o + 3] = 255;
    }
  }
  return out;
}

/// True when the frame is (almost) completely black — e.g. grabbed before the first picture.
bool isBlankRgba(Uint8List rgba) {
  var sum = 0;
  var n = 0;
  for (var i = 0; i < rgba.length; i += 4 * 97) {
    sum += rgba[i] + rgba[i + 1] + rgba[i + 2];
    n++;
  }
  return n == 0 || sum / (n * 3) < 6;
}

Future<ui.Image> rgbaToImage(Uint8List rgba, {int w = kThumbW, int h = kThumbH}) {
  final c = Completer<ui.Image>();
  ui.decodeImageFromPixels(rgba, w, h, ui.PixelFormat.rgba8888, c.complete);
  return c.future;
}

Future<Uint8List?> imageToPng(ui.Image img) async {
  final bd = await img.toByteData(format: ui.ImageByteFormat.png);
  return bd?.buffer.asUint8List();
}

/// Recent frames of what is being watched, keyed by absolute time (ms since epoch for TV,
/// position ms for movies). Used for instant seek previews without extra connections.
class FrameRing {
  FrameRing({this.capacity = 160});
  final int capacity;
  final Map<String, List<_Frame>> _bySource = {};

  void add(String source, int atMs, ui.Image image) {
    final list = _bySource.putIfAbsent(source, () => []);
    // Replace a frame that is too close (keeps spacing even after seeking around).
    // (Images are not disposed here: a seek preview may still be showing one; GC frees them.)
    list.removeWhere((f) => (f.atMs - atMs).abs() < 3000);
    list.add(_Frame(atMs, image));
    list.sort((a, b) => a.atMs.compareTo(b.atMs));
    var total = _bySource.values.fold<int>(0, (s, l) => s + l.length);
    while (total > capacity) {
      // Drop the oldest-captured frame of the largest source.
      final biggest = _bySource.values.reduce((a, b) => a.length >= b.length ? a : b);
      biggest.sort((a, b) => a.captured.compareTo(b.captured));
      biggest.removeAt(0);
      biggest.sort((a, b) => a.atMs.compareTo(b.atMs));
      total--;
    }
  }

  /// Nearest frame within [toleranceMs].
  ui.Image? nearest(String source, int atMs, {int toleranceMs = 15000}) {
    final list = _bySource[source];
    if (list == null || list.isEmpty) return null;
    _Frame? best;
    var bestD = toleranceMs + 1;
    for (final f in list) {
      final d = (f.atMs - atMs).abs();
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best?.image;
  }

  void clearSource(String source) => _bySource.remove(source);
}

class _Frame {
  _Frame(this.atMs, this.image) : captured = DateTime.now().millisecondsSinceEpoch;
  final int atMs;
  final ui.Image image;
  final int captured;
}

/// Program thumbnails on disk (PNG), e.g. a frame captured while the programme was watched
/// or grabbed from the archive. Key: Program.key.
class ThumbDiskCache {
  Directory? _dir;
  final _memory = Lru<String, Uint8List>(240);
  final _missing = <String>{};

  Future<Directory> _folder() async {
    if (_dir != null) return _dir!;
    final base = await getApplicationSupportDirectory();
    final d = Directory('${base.path}${Platform.pathSeparator}thumbs');
    if (!await d.exists()) await d.create(recursive: true);
    _dir = d;
    unawaited(_prune(d));
    return d;
  }

  String _name(String key) => md5.convert(utf8.encode(key)).toString();

  Future<Uint8List?> get(String key) async {
    final m = _memory.get(key);
    if (m != null) return m;
    if (_missing.contains(key)) return null;
    try {
      final f = File('${(await _folder()).path}${Platform.pathSeparator}${_name(key)}.png');
      if (await f.exists()) {
        final b = await f.readAsBytes();
        _memory.put(key, b);
        return b;
      }
    } catch (_) {}
    _missing.add(key);
    return null;
  }

  Uint8List? peek(String key) => _memory.get(key);
  bool has(String key) => _memory.containsKey(key);

  Future<void> put(String key, Uint8List png) async {
    _memory.put(key, png);
    _missing.remove(key);
    try {
      final f = File('${(await _folder()).path}${Platform.pathSeparator}${_name(key)}.png');
      await f.writeAsBytes(png, flush: false);
    } catch (_) {}
  }

  /// Keeps the folder under ~3000 files / 21 days.
  Future<void> _prune(Directory d) async {
    try {
      final files = <File>[];
      await for (final e in d.list()) {
        if (e is File) files.add(e);
      }
      final cutoff = DateTime.now().subtract(const Duration(days: 21));
      final stats = <File, DateTime>{};
      for (final f in files) {
        stats[f] = (await f.stat()).modified;
      }
      for (final f in files) {
        if (stats[f]!.isBefore(cutoff)) await f.delete();
      }
      final rest = files.where((f) => !stats[f]!.isBefore(cutoff)).toList()..sort((a, b) => stats[a]!.compareTo(stats[b]!));
      if (rest.length > 3000) {
        for (final f in rest.take(rest.length - 3000)) {
          await f.delete();
        }
      }
    } catch (_) {}
  }
}
