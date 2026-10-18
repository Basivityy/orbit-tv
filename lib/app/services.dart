import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';

import '../data/catalog.dart';
import '../data/epg_repository.dart';
import '../data/models.dart';
import '../data/orbit_api.dart';
import '../data/prefs.dart';
import '../data/xmltv_icons.dart';
import '../data/xtream_client.dart';
import '../media/frame_grabber.dart';
import '../media/frames.dart';
import '../media/thumbs.dart';
import '../player/engine.dart';

/// App-wide services (one signed-in account at a time).
class AppServices extends ChangeNotifier {
  AppServices._();
  static final AppServices I = AppServices._();

  final Prefs prefs = Prefs();
  final XmltvIcons icons = XmltvIcons();
  final ThumbDiskCache disk = ThumbDiskCache();

  XtreamClient? _api;
  Catalog? _catalog;
  EpgRepository? _epg;
  PlayerEngine? _engine;
  FrameGrabber? _grabber;
  ThumbService? _thumbs;

  XtreamClient get api => _api!;
  Catalog get catalog => _catalog!;
  EpgRepository get epg => _epg!;
  PlayerEngine get engine => _engine!;
  ThumbService get thumbs => _thumbs!;
  bool get signedIn => _api != null && _catalog != null;
  UserInfo? get user => _api?.userInfo;

  /// Shown on the login screen after an automatic sign-out (expired, wrong password…).
  String? signOutReason;

  Future<void> boot() async {
    await prefs.load();
  }

  OrbitApi orbitApi() => OrbitApi(platformUrl: prefs.settings.platformUrl, store: prefs.settings.store);

  /// Archive frames (extra connection) only when the account allows a second connection,
  /// or when the user forced it on — and never while the main player needs the only one.
  bool get canGrabFrames {
    final mode = prefs.settings.archiveThumbs;
    if (mode == 'off') return false;
    final maxCons = user?.maxConnections ?? 1;
    if (mode == 'on') return maxCons >= 2 || !(_engine?.ready == true && _engine?.kind != null);
    return maxCons >= 2;
  }

  /// Signs in with server/username/password (validates against the server, loads channels).
  Future<void> signIn(Account account, {void Function(String)? progress}) async {
    await signOut(keepAccount: true);
    progress?.call('Povezujem se sa serverom…');
    final api = XtreamClient(account);
    await api.authenticate();
    progress?.call('Učitavam kanale…');
    final catalog = Catalog(api);
    await catalog.loadLive();
    final epg = EpgRepository(api);
    _api = api;
    _catalog = catalog;
    _epg = epg;
    _grabber = FrameGrabber(allowed: () => canGrabFrames, precheck: _hasFreeConnection);
    _thumbs = ThumbService(disk: disk, icons: icons, grabber: _grabber!, api: () => this.api, canGrab: () => canGrabFrames);
    epg.onLoaded = (c, list) {
      for (final p in list) {
        p.icon ??= icons.iconFor(c, p);
      }
    };
    _engine = PlayerEngine(_host());
    await _engine!.init();
    await prefs.saveAccount(account);
    signOutReason = null;
    notifyListeners();
    // Programme pictures from XMLTV in the background (optional).
    unawaited(icons.load(api.xmltvUrl()));
  }

  /// Signs in with an OrbitModul code (creates the line on first use).
  Future<void> signInWithCode(String code, {void Function(String)? progress}) async {
    progress?.call('Provjeravam kod…');
    final r = await orbitApi().activateAndWait(code, prefs.deviceId, 'Windows PC', onProgress: progress);
    await signIn(r.account!, progress: progress);
  }

  /// On start: a code login refreshes server/username/password first (they can change).
  Future<void> resume({void Function(String)? progress}) async {
    final a = prefs.account;
    if (a == null) throw StateError('no account');
    var account = a;
    if (a.loginCode != null) {
      try {
        final r = await orbitApi().status(a.loginCode!, prefs.deviceId);
        if (r.account != null) account = r.account!;
        if (r.status == 'expired') throw XtreamException('Pretplata je istekla. Produži je novim kodom.', auth: true);
      } on OrbitApiException catch (e) {
        if (e.code == 'unknown_code' || e.code == 'unknown_device' || e.code == 'device_limit') {
          throw XtreamException(e.message, auth: true);
        }
        // Platform unreachable: try the saved credentials.
      }
    }
    await signIn(account, progress: progress);
  }

  Future<void> signOut({bool keepAccount = false}) async {
    final e = _engine;
    _engine = null;
    if (e != null) {
      await e.stop();
      e.dispose();
    }
    await _grabber?.dispose();
    _grabber = null;
    _thumbs = null;
    _epg?.clear();
    _epg = null;
    _catalog = null;
    _api?.close();
    _api = null;
    if (!keepAccount) await prefs.saveAccount(null);
    notifyListeners();
  }

  EngineHost _host() => EngineHost(
        settings: () => prefs.settings,
        liveUrl: (c) => api.liveUrl(c.id, format: prefs.settings.liveFormat),
        archiveUrl: (c, start, len) => api.timeshiftUrl(c.id, start, len),
        vodUrl: (v) => api.vodUrl(v),
        episodeUrl: (e) => api.episodeUrl(e),
        programAt: (c, t) => epg.at(c.id, t),
        ensureEpg: (c) => epg.ensureFull(c),
        onChannelStarted: (c) => prefs.markWatched(c.id),
        onProgramFrame: (p, png) => thumbs.saveCaptured(p, png),
        onResume: (r) => prefs.saveResume(r),
        grabPreview: (url, seek) => _grabPreview(url, seek),
        beforeOpen: () async {
          // One connection only: preview grabs must stop before the main stream opens.
          if ((user?.maxConnections ?? 1) < 2) await _grabber?.suspend();
        },
      );

  DateTime? _consCheckedAt;
  bool _consFree = false;

  /// Many panels drop the *oldest* connection when a line goes over its limit — that would cut
  /// the stream being watched. So before an extra (thumbnail) connection the server is asked
  /// how many are open; the answer is reused for 45 s.
  Future<bool> _hasFreeConnection() async {
    final max = user?.maxConnections ?? 1;
    final watching = _engine?.kind != null;
    if (max < 2) return !watching;
    final t = _consCheckedAt;
    if (t != null && DateTime.now().difference(t) < const Duration(seconds: 45)) return _consFree;
    final api = _api;
    if (api == null) return false;
    try {
      final active = await api.activeConnections();
      _consFree = active != null && active < max;
    } catch (_) {
      _consFree = false;
    }
    _consCheckedAt = DateTime.now();
    return _consFree;
  }

  Future<ui.Image?> _grabPreview(String url, Duration seek) async {
    final g = _grabber;
    if (g == null || (user?.maxConnections ?? 1) < 2 || prefs.settings.archiveThumbs == 'off') return null;
    return g.grab(url, seek: seek);
  }
}
