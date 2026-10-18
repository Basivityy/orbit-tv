import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../app/config.dart';
import 'models.dart';
import 'server_clock.dart';

class XtreamException implements Exception {
  XtreamException(this.message, {this.auth = false});
  final String message;
  final bool auth; // wrong username/password or expired line
  @override
  String toString() => message;
}

/// Xtream Codes "player_api.php" client (XUI.ONE compatible).
class XtreamClient {
  XtreamClient(this.account, {http.Client? client}) : _http = client ?? http.Client();

  final Account account;
  final http.Client _http;
  final clock = ServerClock();
  UserInfo? userInfo;

  String get base => normalizeServer(account.server);
  String get _u => Uri.encodeComponent(account.username);
  String get _p => Uri.encodeComponent(account.password);

  static String normalizeServer(String raw) {
    var s = raw.trim();
    if (s.isEmpty) return s;
    if (!s.startsWith('http://') && !s.startsWith('https://')) s = 'http://$s';
    while (s.endsWith('/')) {
      s = s.substring(0, s.length - 1);
    }
    // People paste full links (…/player_api.php?…, …/get.php?…): keep scheme://host:port only.
    final uri = Uri.tryParse(s);
    if (uri != null && uri.host.isNotEmpty) {
      return '${uri.scheme}://${uri.host}${uri.hasPort ? ':${uri.port}' : ''}';
    }
    return s;
  }

  Uri _api([Map<String, String> extra = const {}]) {
    return Uri.parse('$base/player_api.php').replace(queryParameters: {
      'username': account.username,
      'password': account.password,
      ...extra,
    });
  }

  Future<dynamic> _getJson(Uri uri, {Duration timeout = const Duration(seconds: 25), int retries = 2}) async {
    Object? last;
    for (var attempt = 0; attempt <= retries; attempt++) {
      try {
        final res = await _http.get(uri, headers: {'User-Agent': AppConfig.userAgent, 'Accept': 'application/json'}).timeout(timeout);
        if (res.statusCode == 401 || res.statusCode == 403) {
          throw XtreamException('Server je odbio prijavu (HTTP ${res.statusCode}).', auth: true);
        }
        if (res.statusCode >= 500) throw XtreamException('Server trenutno ne odgovara (HTTP ${res.statusCode}).');
        if (res.statusCode != 200) throw XtreamException('Greška servera (HTTP ${res.statusCode}).');
        final body = utf8.decode(res.bodyBytes, allowMalformed: true).trim();
        if (body.isEmpty) return null;
        return jsonDecode(body);
      } on XtreamException catch (e) {
        if (e.auth) rethrow;
        last = e;
      } on TimeoutException {
        last = XtreamException('Server se ne javlja (isteklo vrijeme).');
      } on SocketException {
        last = XtreamException('Nema veze sa serverom. Provjeri internet.');
      } on http.ClientException {
        last = XtreamException('Nema veze sa serverom.');
      } on FormatException {
        last = XtreamException('Server je poslao neispravan odgovor.');
        break;
      }
      if (attempt < retries) await Future<void>.delayed(Duration(milliseconds: 600 * (attempt + 1)));
    }
    throw last ?? XtreamException('Nepoznata greška.');
  }

  List<Map<String, dynamic>> _list(dynamic j) {
    if (j is List) return j.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    if (j is Map) {
      // Some panels wrap lists or key them by id.
      final inner = j['data'] ?? j['items'];
      if (inner is List) return _list(inner);
      final values = j.values.whereType<Map>().toList();
      if (values.isNotEmpty && values.length == j.length) return values.map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return const [];
  }

  /// Signs in and reads account + server info. Throws [XtreamException] with a message for the user.
  Future<UserInfo> authenticate() async {
    final j = await _getJson(_api(), retries: 1);
    if (j is! Map || j['user_info'] is! Map) {
      throw XtreamException('Ovo nije IPTV server ili je adresa pogrešna.');
    }
    final ui = Map<String, dynamic>.from(j['user_info'] as Map);
    if (asInt(ui['auth']) == 0) throw XtreamException('Pogrešan username ili lozinka.', auth: true);
    final info = UserInfo.fromJson(ui);
    final st = info.status.toLowerCase();
    if (st == 'expired' || (info.expiresAt != null && info.expiresAt!.isBefore(DateTime.now().toUtc()))) {
      throw XtreamException('Pretplata je istekla. Produži je kod svog prodavca.', auth: true);
    }
    if (st == 'banned' || st == 'disabled') throw XtreamException('Nalog je blokiran. Javi se prodavcu.', auth: true);
    if (j['server_info'] is Map) {
      final si = Map<String, dynamic>.from(j['server_info'] as Map);
      clock.learnFromServerInfo(asStr(si['time_now']), asInt(si['timestamp_now']));
    }
    userInfo = info;
    return info;
  }

  /// Connections currently open on this line (to see whether a free one is left).
  Future<int?> activeConnections() async {
    final j = await _getJson(_api(), timeout: const Duration(seconds: 10), retries: 0);
    if (j is Map && j['user_info'] is Map) return asInt((j['user_info'] as Map)['active_cons']);
    return null;
  }

  Future<List<Category>> liveCategories() async => _list(await _getJson(_api({'action': 'get_live_categories'}))).map(Category.fromJson).toList();
  Future<List<Category>> vodCategories() async => _list(await _getJson(_api({'action': 'get_vod_categories'}))).map(Category.fromJson).toList();
  Future<List<Category>> seriesCategories() async => _list(await _getJson(_api({'action': 'get_series_categories'}))).map(Category.fromJson).toList();

  Future<List<Channel>> liveStreams() async {
    final rows = _list(await _getJson(_api({'action': 'get_live_streams'}), timeout: const Duration(seconds: 45)));
    final out = <Channel>[];
    for (var i = 0; i < rows.length; i++) {
      final c = Channel.fromJson(rows[i], i);
      if (c.id > 0) out.add(c);
    }
    return out;
  }

  Future<List<VodItem>> vodStreams() async =>
      _list(await _getJson(_api({'action': 'get_vod_streams'}), timeout: const Duration(seconds: 60))).map(VodItem.fromJson).where((v) => v.id > 0).toList();

  Future<List<Series>> series() async =>
      _list(await _getJson(_api({'action': 'get_series'}), timeout: const Duration(seconds: 60))).map(Series.fromJson).where((s) => s.id > 0).toList();

  Future<VodInfo?> vodInfo(int id) async {
    final j = await _getJson(_api({'action': 'get_vod_info', 'vod_id': '$id'}));
    return j is Map ? VodInfo.fromJson(Map<String, dynamic>.from(j)) : null;
  }

  Future<SeriesInfo?> seriesInfo(int id) async {
    final j = await _getJson(_api({'action': 'get_series_info', 'series_id': '$id'}));
    return j is Map ? SeriesInfo.fromJson(Map<String, dynamic>.from(j)) : null;
  }

  List<Program> _programs(dynamic j, int streamId) {
    final rows = j is Map ? _list(j['epg_listings']) : _list(j);
    final out = <Program>[];
    for (final r in rows) {
      final p = Program.fromJson(r, streamId);
      if (p == null) continue;
      out.add(p);
    }
    if (out.isNotEmpty) clock.learnFromEpg(out.first.serverStart, out.first.start);
    out.sort((a, b) => a.start.compareTo(b.start));
    // Drop overlaps/duplicates that some EPG sources produce.
    final clean = <Program>[];
    for (final p in out) {
      if (clean.isNotEmpty && p.start.isBefore(clean.last.end)) {
        if (p.start == clean.last.start) continue;
        clean[clean.length - 1] = Program(
          channelId: clean.last.channelId,
          start: clean.last.start,
          end: p.start,
          title: clean.last.title,
          description: clean.last.description,
          hasArchiveFlag: clean.last.hasArchiveFlag,
          serverStart: clean.last.serverStart,
        );
      }
      clean.add(p);
    }
    return clean;
  }

  /// Full EPG incl. the archive days (get_simple_data_table).
  Future<List<Program>> fullEpg(int streamId) async {
    final j = await _getJson(_api({'action': 'get_simple_data_table', 'stream_id': '$streamId'}), timeout: const Duration(seconds: 30), retries: 1);
    return _programs(j, streamId);
  }

  /// Now + next few programmes (lighter call).
  Future<List<Program>> shortEpg(int streamId, {int limit = 6}) async {
    final j = await _getJson(_api({'action': 'get_short_epg', 'stream_id': '$streamId', 'limit': '$limit'}), retries: 1);
    return _programs(j, streamId);
  }

  // ------------------------------------------------------------------ stream URLs

  String liveUrl(int streamId, {String format = 'ts'}) => '$base/live/$_u/$_p/$streamId.${format == 'm3u8' ? 'm3u8' : 'ts'}';

  /// Archive playback from [start] (UTC) for [duration]. XUI takes minutes and the server's local wall time.
  String timeshiftUrl(int streamId, DateTime start, Duration duration) {
    final minutes = duration.inMinutes.clamp(1, 24 * 60);
    return '$base/timeshift/$_u/$_p/$minutes/${clock.archiveStamp(start)}/$streamId.ts';
  }

  String vodUrl(VodItem v) => '$base/movie/$_u/$_p/${v.id}.${v.ext}';
  String episodeUrl(Episode e) => '$base/series/$_u/$_p/${e.id}.${e.ext}';
  String xmltvUrl() => '$base/xmltv.php?username=$_u&password=$_p';

  void close() => _http.close();
}
