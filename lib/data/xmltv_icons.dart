import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:xml/xml_events.dart';

import '../app/config.dart';
import 'models.dart';

/// Programme pictures from the panel's XMLTV export (xmltv.php), when the EPG source has them.
/// Streamed and parsed in the background; only the icon links are kept.
class XmltvIcons {
  final Map<String, String> _icons = {}; // "<epgId>|<unixStart>" → url
  bool _loading = false;
  DateTime? loadedAt;
  int get count => _icons.length;

  static String _key(String epgId, DateTime start) => '${epgId.toLowerCase()}|${start.millisecondsSinceEpoch ~/ 1000}';

  String? iconFor(Channel c, Program p) {
    if (c.epgId.isEmpty || _icons.isEmpty) return null;
    return _icons[_key(c.epgId, p.start)];
  }

  /// "20261019210000 +0200" → UTC
  static DateTime? parseXmltvTime(String? s) {
    if (s == null) return null;
    final m = RegExp(r'^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?').firstMatch(s.trim());
    if (m == null) return null;
    var t = DateTime.utc(int.parse(m[1]!), int.parse(m[2]!), int.parse(m[3]!), int.parse(m[4]!), int.parse(m[5]!), int.parse(m[6] ?? '0'));
    final tz = m[7];
    if (tz != null) {
      final sign = tz.startsWith('-') ? -1 : 1;
      final h = int.parse(tz.substring(1, 3));
      final mm = int.parse(tz.substring(3, 5));
      t = t.subtract(Duration(minutes: sign * (h * 60 + mm)));
    }
    return t;
  }

  Future<File> _cacheFile() async {
    final dir = await getApplicationSupportDirectory();
    return File('${dir.path}${Platform.pathSeparator}xmltv_icons.json');
  }

  /// Loads the cached map, then refreshes from [url] when older than 12 h. Never throws.
  Future<void> load(String url) async {
    if (_loading) return;
    _loading = true;
    try {
      final f = await _cacheFile();
      if (await f.exists()) {
        try {
          final j = jsonDecode(await f.readAsString());
          if (j is Map) {
            final at = DateTime.tryParse(asStr(j['at']));
            final icons = j['icons'];
            if (icons is Map) {
              _icons
                ..clear()
                ..addAll(icons.map((k, v) => MapEntry(k.toString(), v.toString())));
            }
            loadedAt = at;
            if (at != null && DateTime.now().difference(at) < const Duration(hours: 12)) return;
          }
        } catch (_) {}
      }
      await _download(url);
      await f.writeAsString(jsonEncode({'at': DateTime.now().toIso8601String(), 'icons': _icons}));
      loadedAt = DateTime.now();
    } catch (_) {
      // Optional feature.
    } finally {
      _loading = false;
    }
  }

  Future<void> _download(String url) async {
    final client = http.Client();
    try {
      final req = http.Request('GET', Uri.parse(url))..headers['User-Agent'] = AppConfig.userAgent;
      final res = await client.send(req).timeout(const Duration(seconds: 40));
      if (res.statusCode != 200) return;
      final now = DateTime.now().toUtc();
      final from = now.subtract(const Duration(days: 8));
      final to = now.add(const Duration(days: 3));
      final found = <String, String>{};
      String? channel;
      DateTime? start;
      String? icon;
      var bytes = 0;
      const maxBytes = 400 * 1024 * 1024;
      final limited = res.stream.map((chunk) {
        bytes += chunk.length;
        if (bytes > maxBytes) throw const FormatException('xmltv too large');
        return chunk;
      });
      await for (final events in limited.transform(utf8.decoder).toXmlEvents()) {
        for (final e in events) {
          if (e is XmlStartElementEvent) {
            if (e.name == 'programme') {
              channel = null;
              start = null;
              icon = null;
              for (final a in e.attributes) {
                if (a.name == 'channel') channel = a.value;
                if (a.name == 'start') start = parseXmltvTime(a.value);
              }
              if (e.isSelfClosing) channel = null;
            } else if (e.name == 'icon' && channel != null) {
              for (final a in e.attributes) {
                if (a.name == 'src' && a.value.startsWith('http')) icon = a.value;
              }
            }
          } else if (e is XmlEndElementEvent && e.name == 'programme') {
            final s = start;
            if (channel != null && s != null && icon != null && s.isAfter(from) && s.isBefore(to)) {
              found[_key(channel, s)] = icon;
            }
            channel = null;
          }
        }
      }
      if (found.isNotEmpty) {
        _icons
          ..clear()
          ..addAll(found);
      }
    } finally {
      client.close();
    }
  }
}
