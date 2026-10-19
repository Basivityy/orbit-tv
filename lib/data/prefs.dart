import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app/config.dart';
import 'models.dart';

/// Player & app settings the user can change.
class AppSettings {
  AppSettings({
    this.liveFormat = 'ts',
    this.hardwareDecoding = true,
    this.bufferMb = 64,
    this.archiveThumbs = 'auto',
    this.platformUrl = AppConfig.defaultPlatformUrl,
    this.store = AppConfig.defaultStore,
    this.skipSeconds = 10,
    this.deinterlace = true,
    this.epgImagesUrl = '',
  });

  String liveFormat; // ts | m3u8
  bool hardwareDecoding;
  int bufferMb;
  /// Frames from the archive for EPG tiles and seek previews: auto (only when the line allows
  /// 2+ connections, so playback is never cut), on, off.
  String archiveThumbs;
  String platformUrl;
  String store;
  int skipSeconds;
  bool deinterlace;
  /// Optional XMLTV link with programme pictures (when the panel's EPG export has none).
  String epgImagesUrl;

  Map<String, dynamic> toJson() => {
        'liveFormat': liveFormat,
        'hardwareDecoding': hardwareDecoding,
        'bufferMb': bufferMb,
        'archiveThumbs': archiveThumbs,
        'platformUrl': platformUrl,
        'store': store,
        'skipSeconds': skipSeconds,
        'deinterlace': deinterlace,
        'epgImagesUrl': epgImagesUrl,
      };

  static AppSettings fromJson(Map<String, dynamic>? j) {
    final s = AppSettings();
    if (j == null) return s;
    s.liveFormat = asStr(j['liveFormat'], 'ts') == 'm3u8' ? 'm3u8' : 'ts';
    s.hardwareDecoding = j['hardwareDecoding'] is bool ? j['hardwareDecoding'] as bool : true;
    s.bufferMb = (asInt(j['bufferMb']) ?? 64).clamp(16, 512);
    final at = asStr(j['archiveThumbs'], 'auto');
    s.archiveThumbs = const ['auto', 'on', 'off'].contains(at) ? at : 'auto';
    s.platformUrl = asStr(j['platformUrl'], AppConfig.defaultPlatformUrl).ifEmpty(AppConfig.defaultPlatformUrl);
    s.store = asStr(j['store']);
    s.skipSeconds = (asInt(j['skipSeconds']) ?? 10).clamp(5, 120);
    s.deinterlace = j['deinterlace'] is bool ? j['deinterlace'] as bool : true;
    final eu = asStr(j['epgImagesUrl']).trim();
    s.epgImagesUrl = eu.startsWith('http://') || eu.startsWith('https://') ? eu : '';
    return s;
  }
}

/// Saved playback position (movies, episodes, catch-up programmes).
class ResumePoint {
  ResumePoint({required this.key, required this.title, required this.subtitle, required this.image, required this.position, required this.duration, required this.updated, required this.kind, required this.payload});
  final String key; // vod:123 | ep:456 | cu:<channel>@<start>
  final String title, subtitle, image, kind; // kind: vod | episode | catchup
  final Duration position, duration;
  final DateTime updated;
  final Map<String, dynamic> payload; // what is needed to start playback again

  double get progress => duration.inMilliseconds <= 0 ? 0 : (position.inMilliseconds / duration.inMilliseconds).clamp(0.0, 1.0);

  Map<String, dynamic> toJson() => {
        'key': key,
        'title': title,
        'subtitle': subtitle,
        'image': image,
        'pos': position.inSeconds,
        'dur': duration.inSeconds,
        'updated': updated.millisecondsSinceEpoch,
        'kind': kind,
        'payload': payload,
      };

  static ResumePoint? fromJson(Map<String, dynamic> j) {
    final key = asStr(j['key']);
    if (key.isEmpty) return null;
    return ResumePoint(
      key: key,
      title: asStr(j['title']),
      subtitle: asStr(j['subtitle']),
      image: asStr(j['image']),
      position: Duration(seconds: asInt(j['pos']) ?? 0),
      duration: Duration(seconds: asInt(j['dur']) ?? 0),
      updated: DateTime.fromMillisecondsSinceEpoch(asInt(j['updated']) ?? 0),
      kind: asStr(j['kind'], 'vod'),
      payload: j['payload'] is Map ? Map<String, dynamic>.from(j['payload'] as Map) : const {},
    );
  }
}

/// Everything stored on this PC (shared_preferences → %APPDATA% on Windows).
class Prefs extends ChangeNotifier {
  late SharedPreferences _sp;
  AppSettings settings = AppSettings();
  Account? account;
  String deviceId = '';
  final Set<int> favorites = <int>{};
  final List<int> recentChannels = <int>[];
  final Map<String, ResumePoint> resume = <String, ResumePoint>{};
  int? lastChannel;

  Future<void> load() async {
    _sp = await SharedPreferences.getInstance();
    settings = AppSettings.fromJson(_json('settings'));
    account = Account.fromJson(_json('account'));
    deviceId = _sp.getString('deviceId') ?? '';
    if (deviceId.isEmpty) {
      final r = Random.secure();
      deviceId = 'win-${List.generate(16, (_) => r.nextInt(16).toRadixString(16)).join()}';
      await _sp.setString('deviceId', deviceId);
    }
    favorites
      ..clear()
      ..addAll((_sp.getStringList('favorites') ?? const []).map(int.tryParse).whereType<int>());
    recentChannels
      ..clear()
      ..addAll((_sp.getStringList('recentChannels') ?? const []).map(int.tryParse).whereType<int>());
    lastChannel = _sp.getInt('lastChannel');
    resume.clear();
    final raw = _sp.getString('resume');
    if (raw != null) {
      try {
        final list = jsonDecode(raw);
        if (list is List) {
          for (final e in list.whereType<Map>()) {
            final r = ResumePoint.fromJson(Map<String, dynamic>.from(e));
            if (r != null) resume[r.key] = r;
          }
        }
      } catch (_) {}
    }
  }

  Map<String, dynamic>? _json(String key) {
    final raw = _sp.getString(key);
    if (raw == null) return null;
    try {
      final j = jsonDecode(raw);
      return j is Map ? Map<String, dynamic>.from(j) : null;
    } catch (_) {
      return null;
    }
  }

  Future<void> saveSettings() async {
    await _sp.setString('settings', jsonEncode(settings.toJson()));
    notifyListeners();
  }

  Future<void> saveAccount(Account? a) async {
    account = a;
    if (a == null) {
      await _sp.remove('account');
    } else {
      await _sp.setString('account', jsonEncode(a.toJson()));
    }
    notifyListeners();
  }

  bool isFavorite(int channelId) => favorites.contains(channelId);

  Future<void> toggleFavorite(int channelId) async {
    if (!favorites.remove(channelId)) favorites.add(channelId);
    await _sp.setStringList('favorites', favorites.map((e) => '$e').toList());
    notifyListeners();
  }

  Future<void> markWatched(int channelId) async {
    recentChannels.remove(channelId);
    recentChannels.insert(0, channelId);
    if (recentChannels.length > 20) recentChannels.removeRange(20, recentChannels.length);
    lastChannel = channelId;
    await _sp.setStringList('recentChannels', recentChannels.map((e) => '$e').toList());
    await _sp.setInt('lastChannel', channelId);
    notifyListeners();
  }

  Future<void> saveResume(ResumePoint p) async {
    // Almost finished → treat as watched.
    if (p.duration.inSeconds > 0 && p.position.inSeconds > p.duration.inSeconds - 90) {
      resume.remove(p.key);
    } else if (p.position.inSeconds < 20) {
      return;
    } else {
      resume[p.key] = p;
    }
    // Keep the 60 most recent.
    final list = resume.values.toList()..sort((a, b) => b.updated.compareTo(a.updated));
    if (list.length > 60) {
      for (final r in list.sublist(60)) {
        resume.remove(r.key);
      }
    }
    await _sp.setString('resume', jsonEncode(resume.values.map((e) => e.toJson()).toList()));
    notifyListeners();
  }

  /// Last time the platform said this username/password line may use Orbit Player
  /// (lets the app start without internet to the platform for a few days).
  String _licKey(Account a) => 'lic:${a.loginCode ?? '${a.server}|${a.username}'}';
  Future<void> markLicenseOk(Account a) async => _sp.setInt(_licKey(a), DateTime.now().millisecondsSinceEpoch);
  bool licenseOkRecently(Account a, {Duration within = const Duration(days: 7)}) {
    final t = _sp.getInt(_licKey(a));
    return t != null && DateTime.now().difference(DateTime.fromMillisecondsSinceEpoch(t)) < within;
  }

  List<ResumePoint> continueWatching() => resume.values.toList()..sort((a, b) => b.updated.compareTo(a.updated));

  Future<void> clearAll() async {
    // Keep the device id: code logins count devices, a new id would use up another slot.
    final keep = deviceId;
    await _sp.clear();
    if (keep.isNotEmpty) await _sp.setString('deviceId', keep);
    await load();
    notifyListeners();
  }
}
