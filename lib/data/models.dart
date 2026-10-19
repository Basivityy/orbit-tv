import 'dart:convert';

/// Xtream Codes servers return numbers as strings, ints, bools or null — read them leniently.
int? asInt(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is double) return v.round();
  if (v is bool) return v ? 1 : 0;
  final s = v.toString().trim();
  if (s.isEmpty) return null;
  return int.tryParse(s) ?? double.tryParse(s)?.round();
}

double? asDouble(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString().trim());
}

String asStr(dynamic v, [String fallback = '']) {
  if (v == null) return fallback;
  final s = v.toString();
  return s == 'null' ? fallback : s;
}

bool asBool(dynamic v) {
  if (v == null) return false;
  if (v is bool) return v;
  final s = v.toString().trim().toLowerCase();
  return s == '1' || s == 'true' || s == 'yes';
}

/// EPG titles/descriptions are base64 on most panels, plain text on some.
String decodeMaybeBase64(String? raw) {
  if (raw == null || raw.isEmpty) return '';
  final s = raw.trim();
  final looksB64 = s.length % 4 == 0 && RegExp(r'^[A-Za-z0-9+/]+={0,2}$').hasMatch(s);
  if (!looksB64) return s;
  try {
    final decoded = utf8.decode(base64.decode(s), allowMalformed: false);
    // Real text has letters/spaces; random base64-looking words decode to garbage.
    if (decoded.runes.any((r) => r < 9 || (r > 13 && r < 32))) return s;
    return decoded.trim();
  } catch (_) {
    return s;
  }
}

DateTime? fromUnix(dynamic v) {
  final n = asInt(v);
  if (n == null || n <= 0) return null;
  return DateTime.fromMillisecondsSinceEpoch(n * 1000, isUtc: true);
}

class Account {
  Account({required this.server, required this.username, required this.password, this.loginCode});
  final String server; // e.g. http://line.example.com:80 (no trailing slash)
  final String username;
  final String password;
  final String? loginCode; // set when signed in with an OrbitModul code

  Map<String, dynamic> toJson() => {'server': server, 'username': username, 'password': password, if (loginCode != null) 'loginCode': loginCode};
  static Account? fromJson(Map<String, dynamic>? j) {
    if (j == null) return null;
    final s = asStr(j['server']);
    final u = asStr(j['username']);
    final p = asStr(j['password']);
    if (s.isEmpty || u.isEmpty) return null;
    final code = asStr(j['loginCode']);
    return Account(server: s, username: u, password: p, loginCode: code.isEmpty ? null : code);
  }
}

class UserInfo {
  UserInfo({required this.status, this.expiresAt, required this.maxConnections, required this.activeConnections, required this.isTrial, required this.formats});
  final String status;
  final DateTime? expiresAt;
  final int maxConnections;
  final int activeConnections;
  final bool isTrial;
  final List<String> formats;

  factory UserInfo.fromJson(Map<String, dynamic> j) => UserInfo(
        status: asStr(j['status'], 'Active'),
        expiresAt: fromUnix(j['exp_date']),
        maxConnections: asInt(j['max_connections']) ?? 1,
        activeConnections: asInt(j['active_cons']) ?? 0,
        isTrial: asBool(j['is_trial']),
        formats: (j['allowed_output_formats'] is List) ? (j['allowed_output_formats'] as List).map((e) => e.toString()).toList() : const [],
      );
}

class Category {
  Category(this.id, this.name);
  final String id;
  final String name;
  factory Category.fromJson(Map<String, dynamic> j) => Category(asStr(j['category_id']), asStr(j['category_name'], 'Kategorija'));
}

class Channel {
  Channel({
    required this.id,
    required this.number,
    required this.name,
    required this.logo,
    required this.categoryId,
    required this.epgId,
    required this.hasArchive,
    required this.archiveDays,
  });
  final int id; // stream_id
  final int number;
  final String name;
  final String logo;
  final String categoryId;
  final String epgId;
  final bool hasArchive;
  final int archiveDays;

  factory Channel.fromJson(Map<String, dynamic> j, int index) {
    final days = asInt(j['tv_archive_duration']) ?? 0;
    return Channel(
      id: asInt(j['stream_id']) ?? 0,
      number: asInt(j['num']) ?? index + 1,
      name: asStr(j['name']).trim(),
      logo: asStr(j['stream_icon']).trim(),
      categoryId: asStr(j['category_id']),
      epgId: asStr(j['epg_channel_id']).trim(),
      hasArchive: asBool(j['tv_archive']) && days > 0,
      archiveDays: days,
    );
  }

  /// Oldest moment that can be played back from the archive.
  DateTime? archiveStart(DateTime now) => hasArchive ? now.subtract(Duration(days: archiveDays)) : null;
}

class Program {
  Program({required this.channelId, required this.start, required this.end, required this.title, required this.description, required this.hasArchiveFlag, this.serverStart, this.icon});
  final int channelId;
  final DateTime start; // UTC
  final DateTime end; // UTC
  final String title;
  final String description;
  final bool hasArchiveFlag;
  /// Start time as the server wrote it ("2026-10-19 21:00:00", server local time).
  final String? serverStart;
  String? icon; // filled from XMLTV when available

  Duration get duration => end.difference(start);
  bool isLiveAt(DateTime t) => !t.isBefore(start) && t.isBefore(end);
  bool isPastAt(DateTime t) => !end.isAfter(t);
  double progressAt(DateTime t) {
    final total = duration.inMilliseconds;
    if (total <= 0) return 0;
    return (t.difference(start).inMilliseconds / total).clamp(0.0, 1.0);
  }

  String get key => '$channelId@${start.millisecondsSinceEpoch ~/ 1000}';

  static Program? fromJson(Map<String, dynamic> j, int channelId) {
    var start = fromUnix(j['start_timestamp']);
    var end = fromUnix(j['stop_timestamp']) ?? fromUnix(j['end_timestamp']);
    if (start == null || end == null || !end.isAfter(start)) return null;
    return Program(
      channelId: channelId,
      start: start,
      end: end,
      title: decodeMaybeBase64(asStr(j['title'])).ifEmpty('Bez naziva'),
      description: decodeMaybeBase64(asStr(j['description'])),
      hasArchiveFlag: asBool(j['has_archive']),
      serverStart: asStr(j['start']).isEmpty ? null : asStr(j['start']),
      icon: pictureOf(j),
    );
  }

  /// Programme picture when the panel sends one with the EPG (keys differ between panels).
  static String? pictureOf(Map<String, dynamic> j) {
    for (final k in const ['image', 'icon', 'img', 'poster', 'thumbnail', 'thumb', 'picture', 'image_url', 'cover', 'banner']) {
      final v = j[k];
      String? u;
      if (v is String) {
        u = v.trim();
      } else if (v is List && v.isNotEmpty) {
        final first = v.first;
        u = first is String ? first.trim() : first is Map ? asStr(first['url'] ?? first['src']).trim() : null;
      } else if (v is Map) {
        u = asStr(v['url'] ?? v['src']).trim();
      }
      if (u != null && (u.startsWith('http://') || u.startsWith('https://'))) return u;
    }
    return null;
  }
}

extension StringX on String {
  String ifEmpty(String other) => trim().isEmpty ? other : this;
}

class VodItem {
  VodItem({required this.id, required this.name, required this.poster, required this.categoryId, required this.rating, required this.added, required this.ext});
  final int id;
  final String name;
  final String poster;
  final String categoryId;
  final double? rating;
  final DateTime? added;
  final String ext;

  factory VodItem.fromJson(Map<String, dynamic> j) => VodItem(
        id: asInt(j['stream_id']) ?? 0,
        name: asStr(j['name']).trim(),
        poster: asStr(j['stream_icon']).trim(),
        categoryId: asStr(j['category_id']),
        rating: asDouble(j['rating']),
        added: fromUnix(j['added']),
        ext: asStr(j['container_extension'], 'mp4').ifEmpty('mp4'),
      );
}

class VodInfo {
  VodInfo({required this.plot, required this.genre, required this.cast, required this.director, required this.year, required this.duration, required this.backdrop, required this.poster, required this.rating});
  final String plot, genre, cast, director, year;
  final Duration? duration;
  final String backdrop, poster;
  final double? rating;

  factory VodInfo.fromJson(Map<String, dynamic> j) {
    final info = (j['info'] is Map) ? Map<String, dynamic>.from(j['info'] as Map) : <String, dynamic>{};
    final secs = asInt(info['duration_secs']);
    final bd = info['backdrop_path'];
    final backdrop = bd is List && bd.isNotEmpty ? asStr(bd.first) : asStr(bd);
    final release = asStr(info['releasedate']).ifEmpty(asStr(info['release_date']));
    return VodInfo(
      plot: asStr(info['plot']).ifEmpty(asStr(info['description'])),
      genre: asStr(info['genre']),
      cast: asStr(info['cast']).ifEmpty(asStr(info['actors'])),
      director: asStr(info['director']),
      year: release.length >= 4 ? release.substring(0, 4) : release,
      duration: secs != null && secs > 0 ? Duration(seconds: secs) : null,
      backdrop: backdrop,
      poster: asStr(info['movie_image']).ifEmpty(asStr(info['cover_big'])),
      rating: asDouble(info['rating']),
    );
  }
}

class Series {
  Series({required this.id, required this.name, required this.cover, required this.categoryId, required this.plot, required this.genre, required this.rating, required this.year, required this.backdrop, required this.updated});
  final int id;
  final String name, cover, categoryId, plot, genre, year, backdrop;
  final double? rating;
  final DateTime? updated;

  factory Series.fromJson(Map<String, dynamic> j) {
    final bd = j['backdrop_path'];
    final release = asStr(j['releaseDate']).ifEmpty(asStr(j['release_date']));
    return Series(
      id: asInt(j['series_id']) ?? 0,
      name: asStr(j['name']).trim(),
      cover: asStr(j['cover']).trim(),
      categoryId: asStr(j['category_id']),
      plot: asStr(j['plot']),
      genre: asStr(j['genre']),
      rating: asDouble(j['rating']),
      year: release.length >= 4 ? release.substring(0, 4) : '',
      backdrop: bd is List && bd.isNotEmpty ? asStr(bd.first) : asStr(bd),
      updated: fromUnix(j['last_modified']),
    );
  }
}

class Episode {
  Episode({required this.id, required this.season, required this.number, required this.title, required this.plot, required this.image, required this.duration, required this.ext});
  final int id;
  final int season;
  final int number;
  final String title, plot, image, ext;
  final Duration? duration;

  factory Episode.fromJson(Map<String, dynamic> j, int season) {
    final info = (j['info'] is Map) ? Map<String, dynamic>.from(j['info'] as Map) : <String, dynamic>{};
    final secs = asInt(info['duration_secs']);
    return Episode(
      id: asInt(j['id']) ?? 0,
      season: asInt(j['season']) ?? season,
      number: asInt(j['episode_num']) ?? 0,
      title: asStr(j['title']).trim(),
      plot: asStr(info['plot']),
      image: asStr(info['movie_image']).ifEmpty(asStr(info['cover_big'])),
      duration: secs != null && secs > 0 ? Duration(seconds: secs) : null,
      ext: asStr(j['container_extension'], 'mp4').ifEmpty('mp4'),
    );
  }
}

class SeriesInfo {
  SeriesInfo({required this.seasons, required this.episodes});
  final List<int> seasons;
  final Map<int, List<Episode>> episodes;

  factory SeriesInfo.fromJson(Map<String, dynamic> j) {
    final eps = <int, List<Episode>>{};
    final raw = j['episodes'];
    if (raw is Map) {
      raw.forEach((k, v) {
        final s = asInt(k) ?? 0;
        if (v is List) {
          eps[s] = v.whereType<Map>().map((e) => Episode.fromJson(Map<String, dynamic>.from(e), s)).toList()
            ..sort((a, b) => a.number.compareTo(b.number));
        }
      });
    } else if (raw is List) {
      // Some panels send a list of season lists.
      for (var i = 0; i < raw.length; i++) {
        final v = raw[i];
        if (v is List) {
          final list = v.whereType<Map>().map((e) => Episode.fromJson(Map<String, dynamic>.from(e), i + 1)).toList();
          if (list.isNotEmpty) eps[list.first.season] = list..sort((a, b) => a.number.compareTo(b.number));
        }
      }
    }
    final seasons = eps.keys.toList()..sort();
    return SeriesInfo(seasons: seasons, episodes: eps);
  }
}
