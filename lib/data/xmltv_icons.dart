import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:xml/xml_events.dart';

import '../app/config.dart';
import '../util/log.dart';
import 'models.dart';

/// One programme picture from XMLTV.
class _Pic {
  const _Pic(this.s, this.e, this.url, this.th);
  final int s, e; // unix seconds (UTC)
  final String url;
  final int th; // title hash (0 = no title)
  List<Object> toJson() => [s, e, url, th];
}

/// Programme pictures from the panel's XMLTV export (xmltv.php) and/or another XMLTV source
/// the user set. Streamed and parsed in the background; only picture links are kept.
///
/// Matching is tolerant: the programme with the same title within ±3 h, or the one starting
/// within ±10 min (EPG sources often differ by a few minutes or by a time zone).
class XmltvIcons extends ChangeNotifier {
  XmltvIcons({Future<Directory> Function()? cacheDir}) : _cacheDir = cacheDir ?? getApplicationSupportDirectory;
  final Future<Directory> Function() _cacheDir;

  final Map<String, List<_Pic>> _byChannel = {}; // epg id (lower case) → pictures sorted by start
  final Map<String, String> _nameToId = {}; // normalised display-name → epg id
  bool _loading = false;
  DateTime? loadedAt;
  String? lastError;
  String _src = '';
  int _count = 0;

  /// Programmes with a picture.
  int get count => _count;
  int get channels => _byChannel.length;
  bool get loading => _loading;

  static const _cacheVersion = 2;
  static const _maxAge = Duration(hours: 12);

  // ---- matching -------------------------------------------------------------------------

  static final _nonAlnum = RegExp(r'[^\p{L}\p{N}]+', unicode: true);
  static final _quality = RegExp(r'\b(fhd|uhd|hd|sd|4k|hevc|h265|raw|backup|\d{3,4}p)\b');
  static final _prefix = RegExp(r'^\s*[\p{L}]{2,4}\s*[:|]\s*', unicode: true);

  /// "BA: Nova BH HD" → "novabh" (for sources whose channel ids differ from the panel's).
  static String normName(String n) {
    var s = n.toLowerCase().replaceAll(RegExp(r'\([^)]*\)|\[[^\]]*\]'), ' ');
    s = s.replaceFirst(_prefix, '');
    s = s.replaceAll(_quality, ' ');
    return s.replaceAll(_nonAlnum, '');
  }

  /// Stable 32-bit FNV-1a hash of a normalised title (0 when there is no usable title).
  static int titleHash(String t) {
    final s = t.toLowerCase().replaceAll(_nonAlnum, '');
    if (s.isEmpty || s == 'beznaziva') return 0;
    var h = 0x811c9dc5;
    for (final c in s.codeUnits) {
      h ^= c;
      h = (h * 0x01000193) & 0xffffffff;
    }
    return h == 0 ? 1 : h;
  }

  List<_Pic>? _listFor(Channel c) {
    if (c.epgId.isNotEmpty) {
      final l = _byChannel[c.epgId.toLowerCase()];
      if (l != null) return l;
    }
    final id = _nameToId[normName(c.name)];
    return id == null ? null : _byChannel[id];
  }

  String? iconFor(Channel c, Program p) {
    if (_byChannel.isEmpty) return null;
    final list = _listFor(c);
    if (list == null || list.isEmpty) return null;
    return _best(list, p.start.millisecondsSinceEpoch ~/ 1000, titleHash(p.title));
  }

  /// For tests: entries are (start unix s, url, title hash), sorted by start.
  @visibleForTesting
  static String? matchForTest(List<(int, String, int)> entries, int start, int th) =>
      _best([for (final e in entries) _Pic(e.$1, e.$1 + 1800, e.$2, e.$3)], start, th);

  /// Same title within ±3 h (closest), else the programme starting within ±10 min;
  /// a start within 2 min wins over a title match.
  static String? _best(List<_Pic> list, int start, int th) {
    const window = 3 * 3600;
    const near = 600;
    const exact = 120;
    var lo = 0, hi = list.length;
    final from = start - window;
    while (lo < hi) {
      final mid = (lo + hi) >> 1;
      if (list[mid].s < from) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    String? byTitle, byTime;
    var bestTitle = 1 << 30, bestTime = 1 << 30;
    for (var i = lo; i < list.length; i++) {
      final x = list[i];
      if (x.s > start + window) break;
      final d = (x.s - start).abs();
      if (th != 0 && x.th == th && d < bestTitle) {
        byTitle = x.url;
        bestTitle = d;
      }
      if (d <= near && d < bestTime) {
        byTime = x.url;
        bestTime = d;
      }
    }
    if (byTime != null && bestTime <= exact) return byTime;
    return byTitle ?? byTime;
  }

  // ---- time -----------------------------------------------------------------------------

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

  // ---- loading --------------------------------------------------------------------------

  Future<File> _cacheFile() async {
    final dir = await _cacheDir();
    final old = File('${dir.path}${Platform.pathSeparator}xmltv_icons.json'); // format of 1.1
    if (await old.exists()) {
      try {
        await old.delete();
      } catch (_) {}
    }
    return File('${dir.path}${Platform.pathSeparator}xmltv_pictures.json');
  }

  String _panelUrl = '';
  String _extraUrl = '';

  /// Loads the cached pictures, then refreshes from the sources when older than 12 h
  /// (or when [force]). [extraUrl] is an optional XMLTV link with pictures set by the user;
  /// the panel's xmltv.php is used too unless the extra source already has pictures. Never throws.
  Future<void> load(String panelUrl, {String extraUrl = '', bool force = false}) async {
    _panelUrl = panelUrl;
    _extraUrl = extraUrl.trim();
    if (_loading) {
      _again = _again || force || '$_extraUrl|$_panelUrl' != _loadingSrc;
      return;
    }
    _loadingSrc = '$_extraUrl|$_panelUrl';
    _loading = true;
    lastError = null;
    notifyListeners();
    final src = '$_extraUrl|$_panelUrl';
    try {
      final f = await _cacheFile();
      if (!force && _src != src && await f.exists()) {
        try {
          final j = jsonDecode(await f.readAsString());
          if (j is Map && j['v'] == _cacheVersion && j['src'] == src) {
            _fromCache(j);
            _src = src;
            loadedAt = DateTime.tryParse(asStr(j['at']));
            notifyListeners();
          }
        } catch (_) {}
      }
      final at = loadedAt;
      if (!force && _src == src && at != null && DateTime.now().difference(at) < _maxAge) return;

      final pics = <String, List<_Pic>>{};
      final names = <String, String>{};
      var ok = false;
      if (_extraUrl.startsWith('http')) {
        ok = await _download(_extraUrl, pics, names);
      }
      if (pics.isEmpty && panelUrl.startsWith('http')) {
        ok = await _download(panelUrl, pics, names) || ok;
      }
      if (!ok) {
        lastError ??= 'EPG izvor nije dostupan';
        notifyListeners();
        return; // keep what we had
      }
      for (final l in pics.values) {
        l.sort((a, b) => a.s.compareTo(b.s));
      }
      _byChannel
        ..clear()
        ..addAll(pics);
      _nameToId
        ..clear()
        ..addAll(names);
      _count = pics.values.fold(0, (n, l) => n + l.length);
      _src = src;
      loadedAt = DateTime.now();
      Log.i('xmltv pictures: $_count programmes on ${pics.length} channels');
      await f.writeAsString(jsonEncode({
        'v': _cacheVersion,
        'at': loadedAt!.toIso8601String(),
        'src': src,
        'names': _nameToId,
        'ch': pics.map((k, v) => MapEntry(k, v.map((p) => p.toJson()).toList())),
      }));
      notifyListeners();
    } catch (e) {
      lastError = e.toString();
      Log.i('xmltv pictures failed: $e');
      notifyListeners();
    } finally {
      _loading = false;
      if (_again) {
        _again = false;
        unawaited(load(_panelUrl, extraUrl: _extraUrl, force: true));
      }
    }
  }

  bool _again = false;
  String _loadingSrc = '';

  /// Downloads again now (Settings → "Osvježi").
  Future<void> refresh() => load(_panelUrl, extraUrl: _extraUrl, force: true);

  void _fromCache(Map j) {
    final ch = j['ch'];
    final names = j['names'];
    _byChannel.clear();
    _nameToId.clear();
    _count = 0;
    if (ch is Map) {
      ch.forEach((k, v) {
        if (v is! List) return;
        final list = <_Pic>[];
        for (final e in v) {
          if (e is List && e.length >= 4) {
            final s = asInt(e[0]), en = asInt(e[1]), th = asInt(e[3]);
            final url = asStr(e[2]);
            if (s != null && en != null && url.isNotEmpty) list.add(_Pic(s, en, url, th ?? 0));
          }
        }
        list.sort((a, b) => a.s.compareTo(b.s));
        if (list.isNotEmpty) {
          _byChannel[k.toString()] = list;
          _count += list.length;
        }
      });
    }
    if (names is Map) {
      names.forEach((k, v) => _nameToId[k.toString()] = v.toString());
    }
  }

  /// Gunzips the stream when it starts with the gzip magic bytes (*.xml.gz sources).
  static Stream<List<int>> _maybeGunzip(Stream<List<int>> src) async* {
    final it = StreamIterator(src);
    if (!await it.moveNext()) return;
    final first = it.current;
    Stream<List<int>> all() async* {
      yield first;
      while (await it.moveNext()) {
        yield it.current;
      }
    }

    if (first.length >= 2 && first[0] == 0x1f && first[1] == 0x8b) {
      yield* all().transform(gzip.decoder);
    } else {
      yield* all();
    }
  }

  static int _imageScore(Map<String, String> attrs) {
    final type = (attrs['type'] ?? '').toLowerCase();
    final orient = (attrs['orient'] ?? '').toUpperCase();
    var score = 2;
    if (type == 'still' || type == 'backdrop' || orient == 'L') score = 4;
    if (type == 'poster' || orient == 'P') score = 1;
    return score + (int.tryParse(attrs['size'] ?? '') ?? 0);
  }

  /// Parses one XMLTV source into [out]; false when it could not be read.
  Future<bool> _download(String url, Map<String, List<_Pic>> out, Map<String, String> names) async {
    final client = http.Client();
    try {
      final req = http.Request('GET', Uri.parse(url))..headers['User-Agent'] = AppConfig.userAgent;
      final res = await client.send(req).timeout(const Duration(seconds: 60));
      if (res.statusCode != 200) {
        Log.i('xmltv ${Log.mask(url)}: HTTP ${res.statusCode}');
        lastError = 'HTTP ${res.statusCode}';
        return false;
      }
      final now = DateTime.now().toUtc();
      final from = now.subtract(const Duration(days: 8)).millisecondsSinceEpoch ~/ 1000;
      final to = now.add(const Duration(days: 3)).millisecondsSinceEpoch ~/ 1000;
      var bytes = 0;
      const maxBytes = 600 * 1024 * 1024;
      final limited = res.stream.map((chunk) {
        bytes += chunk.length;
        if (bytes > maxBytes) throw const FormatException('xmltv too large');
        return chunk;
      });

      // <channel id> … <display-name>
      String? chanId;
      // <programme channel start stop> … <title> <icon src> <image>
      String? progChan;
      int? start, stop;
      String? title, pic;
      var picScore = -1;
      String? textFor; // 'name' | 'title' | 'image'
      final text = StringBuffer();
      Map<String, String> imageAttrs = const {};
      var added = 0;

      void flushText(String what) {
        final t = text.toString().trim();
        text.clear();
        textFor = null;
        if (t.isEmpty) return;
        if (what == 'name' && chanId != null) {
          final n = normName(t);
          if (n.isNotEmpty) names.putIfAbsent(n, () => chanId!);
        } else if (what == 'title' && progChan != null) {
          title ??= t;
        } else if (what == 'image' && progChan != null && t.startsWith('http')) {
          final sc = _imageScore(imageAttrs);
          if (sc > picScore) {
            pic = t;
            picScore = sc;
          }
        }
      }

      final stream = _maybeGunzip(limited).transform(const Utf8Decoder(allowMalformed: true)).toXmlEvents();
      await for (final events in stream) {
        for (final e in events) {
          if (e is XmlStartElementEvent) {
            switch (e.name) {
              case 'channel':
                chanId = null;
                for (final a in e.attributes) {
                  if (a.name == 'id') chanId = a.value.trim().toLowerCase();
                }
                if (e.isSelfClosing) chanId = null;
              case 'display-name':
                if (chanId != null && !e.isSelfClosing) {
                  textFor = 'name';
                  text.clear();
                }
              case 'programme':
                progChan = null;
                start = stop = null;
                title = pic = null;
                picScore = -1;
                for (final a in e.attributes) {
                  if (a.name == 'channel') progChan = a.value.trim().toLowerCase();
                  if (a.name == 'start') start = parseXmltvTime(a.value)?.millisecondsSinceEpoch;
                  if (a.name == 'stop') stop = parseXmltvTime(a.value)?.millisecondsSinceEpoch;
                }
                if (e.isSelfClosing) progChan = null;
              case 'title':
                if (progChan != null && title == null && !e.isSelfClosing) {
                  textFor = 'title';
                  text.clear();
                }
              case 'icon':
                if (progChan != null) {
                  for (final a in e.attributes) {
                    final v = a.value.trim();
                    if (a.name == 'src' && v.startsWith('http')) {
                      var w = 0;
                      for (final x in e.attributes) {
                        if (x.name == 'width') w = int.tryParse(x.value) ?? 0;
                      }
                      final sc = 3 + (w >= 600 ? 1 : 0);
                      if (sc > picScore) {
                        pic = v;
                        picScore = sc;
                      }
                    }
                  }
                }
              case 'image':
                if (progChan != null && !e.isSelfClosing) {
                  imageAttrs = {for (final a in e.attributes) a.name: a.value};
                  textFor = 'image';
                  text.clear();
                }
            }
          } else if (e is XmlTextEvent) {
            if (textFor != null) text.write(e.value);
          } else if (e is XmlCDATAEvent) {
            if (textFor != null) text.write(e.value);
          } else if (e is XmlEndElementEvent) {
            switch (e.name) {
              case 'display-name':
                if (textFor == 'name') flushText('name');
              case 'title':
                if (textFor == 'title') flushText('title');
              case 'image':
                if (textFor == 'image') flushText('image');
              case 'channel':
                chanId = null;
              case 'programme':
                {
                  final ch = progChan, ms = start, u = pic;
                  if (ch != null && ms != null && u != null) {
                    final ss = ms ~/ 1000;
                    if (ss > from && ss < to) {
                      final en = (stop ?? (ms + 3600 * 1000)) ~/ 1000;
                      (out[ch] ??= []).add(_Pic(ss, en, u, titleHash(title ?? '')));
                      added++;
                    }
                  }
                  progChan = null;
                }
            }
          }
        }
      }
      Log.i('xmltv ${Log.mask(url)}: $added programme pictures, ${names.length} channel names');
      return true;
    } catch (e) {
      Log.i('xmltv ${Log.mask(url)}: $e');
      lastError = e.toString();
      return false;
    } finally {
      client.close();
    }
  }
}
