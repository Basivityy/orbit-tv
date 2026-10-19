import 'dart:async';
import 'dart:io';
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
import '../util/log.dart';

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

  /// Shown to the store next to the line ("Windows · DESKTOP-1A2B").
  String deviceLabel() {
    var host = '';
    try {
      host = Platform.localHostname;
    } catch (_) {}
    final label = host.isEmpty ? 'Windows PC' : 'Windows · $host';
    return label.length > 60 ? label.substring(0, 60) : label;
  }

  /// EPG pictures: the panel's xmltv.php (and the optional source from Settings).
  Future<void> loadEpgPictures({bool force = false}) async {
    final a = _api;
    if (a == null) return;
    final extra = prefs.settings.epgImagesUrl;
    if (force) {
      await icons.load(a.xmltvUrl(), extraUrl: extra, force: true);
    } else {
      await icons.load(a.xmltvUrl(), extraUrl: extra);
    }
  }

  bool _iconsHooked = false;
  void _listenIcons() {
    if (_iconsHooked) return;
    _iconsHooked = true;
    icons.addListener(_applyIcons);
  }

  /// Pictures arrived after programmes were loaded: attach them and refresh the tiles.
  void _applyIcons() {
    final epg = _epg, cat = _catalog, th = _thumbs;
    if (epg == null || cat == null) return;
    var n = 0;
    for (final e in epg.loaded) {
      final c = cat.channel(e.key);
      if (c == null) continue;
      for (final p in e.value) {
        if (p.icon == null) {
          final u = icons.iconFor(c, p);
          if (u != null) {
            p.icon = u;
            n++;
          }
        }
      }
    }
    th?.refreshUrls();
    if (n > 0) epg.touch();
  }

  /// Platform answers that mean "this line may not use Orbit Player".
  static const _denied = {'no_seats', 'player_inactive', 'not_licensed', 'unknown_code', 'unknown_device', 'device_limit'};

  /// Answers after which the viewer has to sign in again (the others: try again later).
  static const _signInAgain = {'not_licensed', 'unknown_code', 'unknown_device', 'device_limit'};

  /// Platform could not be asked: fine for a few days after the last "yes".
  XtreamException? _offlineVerdict(Account a, OrbitApiException e) {
    if (prefs.licenseOkRecently(a)) return null;
    return XtreamException('Ne mogu provjeriti Orbit Player licencu (${e.message}). Provjeri internet pa pokušaj ponovo.');
  }

  /// Username/password sign-in: the store must have an Orbit Player place for this line.
  Future<void> _checkLicense(Account a, void Function(String)? progress) async {
    progress?.call('Provjeravam Orbit Player…');
    try {
      await orbitApi().playerCheck(server: a.server, username: a.username, password: a.password, deviceId: prefs.deviceId, deviceName: deviceLabel());
      await prefs.markLicenseOk(a);
      Log.i('player check ok');
    } on OrbitApiException catch (e) {
      Log.i('player check: ${e.code ?? 'network'} ${e.message}');
      if (e.transient) {
        final v = _offlineVerdict(a, e);
        if (v != null) throw v;
        return; // platform unreachable for a moment
      }
      throw XtreamException(e.message, auth: _signInAgain.contains(e.code));
    }
  }

  /// While the app runs: ask the platform again now and then (keeps the place, notices a stop).
  Timer? _licenseTimer;
  static const _licenseEvery = Duration(hours: 6);

  void _startLicenseTimer() {
    _licenseTimer?.cancel();
    _licenseTimer = Timer.periodic(_licenseEvery, (_) => unawaited(_recheckLicense()));
  }

  Future<void> _recheckLicense() async {
    final a = prefs.account;
    if (a == null || !signedIn) return;
    try {
      if (a.loginCode != null) {
        await orbitApi().status(a.loginCode!, prefs.deviceId);
      } else {
        await orbitApi().playerCheck(server: a.server, username: a.username, password: a.password, deviceId: prefs.deviceId, deviceName: deviceLabel());
      }
      await prefs.markLicenseOk(a);
      Log.i('license recheck ok');
    } on OrbitApiException catch (e) {
      Log.i('license recheck: ${e.code ?? 'network'} ${e.message}');
      String? reason;
      if (e.transient) {
        reason = _offlineVerdict(a, e)?.message;
      } else if (_denied.contains(e.code)) {
        reason = e.message;
      }
      if (reason != null && signedIn) {
        signOutReason = reason;
        await signOut(keepAccount: true);
      }
    } catch (e) {
      Log.i('license recheck failed: $e');
    }
  }

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
    Log.i('sign in ${account.server}${account.loginCode != null ? ' (code)' : ''}');
    final api = XtreamClient(account);
    final info = await api.authenticate(); // wrong password / expired line first
    if (account.loginCode == null) await _checkLicense(account, progress);
    Log.i('account ${info.status}, max connections ${info.maxConnections}, server clock offset ${api.clock.offset.inMinutes} min');
    progress?.call('Učitavam kanale…');
    final catalog = Catalog(api);
    await catalog.loadLive();
    Log.i('${catalog.channels.length} channels in ${catalog.liveCategories.length} categories');
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
    _startLicenseTimer();
    notifyListeners();
    // Programme pictures from XMLTV in the background (optional).
    _listenIcons();
    unawaited(loadEpgPictures());
  }

  /// Signs in with an OrbitModul code (creates the line on first use).
  Future<void> signInWithCode(String code, {void Function(String)? progress}) async {
    progress?.call('Provjeravam kod…');
    final r = await orbitApi().activateAndWait(code, prefs.deviceId, deviceLabel(), onProgress: progress);
    await prefs.markLicenseOk(r.account!);
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
        await prefs.markLicenseOk(a);
        if (r.status == 'expired') throw XtreamException('Pretplata je istekla. Produži je novim kodom.', auth: true);
      } on OrbitApiException catch (e) {
        Log.i('code status: ${e.code ?? 'network'} ${e.message}');
        if (_denied.contains(e.code)) throw XtreamException(e.message, auth: _signInAgain.contains(e.code));
        if (e.transient) {
          final v = _offlineVerdict(a, e);
          if (v != null) throw v;
        }
        // Platform unreachable for a moment: try the saved credentials.
      }
    }
    await signIn(account, progress: progress);
  }

  Future<void> signOut({bool keepAccount = false}) async {
    _licenseTimer?.cancel();
    _licenseTimer = null;
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
        onProgramFrame: (p, png, large) => thumbs.saveCaptured(p, png, large),
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
