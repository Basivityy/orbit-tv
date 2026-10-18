import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

/// Small diagnostic log: memory ring + file "orbit_tv.log" in the app data folder
/// (%APPDATA%\Orbitex FZE LLC\Orbit TV). Credentials in stream URLs are masked.
class Log {
  static final List<String> _lines = [];
  static IOSink? _sink;
  static bool _opening = false;
  static final List<String> _pending = [];

  static List<String> get lines => List.unmodifiable(_lines);

  static Future<void> init() async {
    if (_sink != null || _opening) return;
    _opening = true;
    try {
      final dir = await getApplicationSupportDirectory();
      final f = File('${dir.path}${Platform.pathSeparator}orbit_tv.log');
      // Keep the file small: start over when it gets big.
      if (await f.exists() && await f.length() > 2 * 1024 * 1024) await f.delete();
      _sink = f.openWrite(mode: FileMode.append);
      _sink!.writeln('---- start ${DateTime.now().toIso8601String()} ----');
      for (final l in _pending) {
        _sink!.writeln(l);
      }
      _pending.clear();
    } catch (_) {
      // Logging must never break the app.
    } finally {
      _opening = false;
    }
  }

  /// Hides username/password in Xtream URLs (/live/u/p/…, ?username=…&password=…).
  static String mask(String s) {
    return s
        .replaceAllMapped(RegExp(r'/(live|movie|series|timeshift)/[^/]+/[^/]+/'), (m) => '/${m[1]}/***/***/')
        .replaceAllMapped(RegExp(r'(username|password)=[^&\s]+'), (m) => '${m[1]}=***');
  }

  static void i(String msg) {
    final t = DateTime.now();
    String two(int n) => n.toString().padLeft(2, '0');
    final line = '${two(t.hour)}:${two(t.minute)}:${two(t.second)}.${t.millisecond.toString().padLeft(3, '0')} ${mask(msg)}';
    _lines.add(line);
    if (_lines.length > 400) _lines.removeRange(0, _lines.length - 400);
    if (kDebugMode) debugPrint(line);
    final s = _sink;
    if (s != null) {
      s.writeln(line);
    } else {
      _pending.add(line);
      if (_pending.length > 200) _pending.removeAt(0);
    }
  }

  static Future<void> flush() async {
    try {
      await _sink?.flush();
    } catch (_) {}
  }
}
