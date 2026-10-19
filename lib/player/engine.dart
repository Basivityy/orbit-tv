import 'dart:async';
import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../app/config.dart';
import '../data/models.dart';
import '../data/prefs.dart';
import '../media/frames.dart';
import '../media/mpv.dart';
import '../data/server_clock.dart';
import '../util/debouncer.dart';
import '../util/log.dart';
import 'timeline.dart';

enum PlayKind { live, archive, vod, episode }

/// Hooks to the rest of the app (EPG, URLs, thumbnails, settings).
class EngineHost {
  EngineHost({
    required this.settings,
    required this.liveUrl,
    required this.archiveUrl,
    required this.vodUrl,
    required this.episodeUrl,
    required this.programAt,
    required this.ensureEpg,
    required this.onChannelStarted,
    required this.onProgramFrame,
    required this.onResume,
    required this.grabPreview,
    required this.beforeOpen,
  });
  final AppSettings Function() settings;
  final String Function(Channel) liveUrl;
  final String Function(Channel, DateTime start, Duration length) archiveUrl;
  final String Function(VodItem) vodUrl;
  final String Function(Episode) episodeUrl;
  final Program? Function(Channel, DateTime) programAt;
  final Future<void> Function(Channel) ensureEpg;
  final void Function(Channel) onChannelStarted;
  final void Function(Program, Uint8List png, Uint8List? largePng) onProgramFrame;
  final void Function(ResumePoint) onResume;
  /// Frame for a seek preview from a separate connection (null when not allowed).
  final Future<ui.Image?> Function(String url, Duration seek) grabPreview;
  /// Called before the main player opens a stream (e.g. to stop preview connections).
  final Future<void> Function() beforeOpen;
}

/// The one and only main player: live TV, archive (catch-up / timeshift), movies and episodes.
class PlayerEngine extends ChangeNotifier {
  PlayerEngine(this.host);
  final EngineHost host;

  late final Player player;
  late final VideoController video;
  final FrameRing frames = FrameRing();
  final List<StreamSubscription<dynamic>> _subs = [];

  // ---------------------------------------------------------------- what is playing
  PlayKind? kind;
  Channel? channel;
  List<Channel> zapList = const [];
  VodItem? vod;
  VodInfo? vodInfo;
  Series? series;
  Episode? episode;
  List<Episode> episodes = const [];

  /// Absolute time of stream position 0 (TV) — see [StreamState.origin].
  DateTime? _origin;
  Duration _minPlayed = Duration.zero;
  Duration? _pendingSeek;
  DateTime? _pendingSeekUntil;

  bool connecting = false;
  String? error;
  String? toast;
  DateTime? _toastAt;
  int _failures = 0;
  int _seq = 0;
  DateTime? _pausedAt;
  bool _userPaused = false;

  Duration _lastPos = Duration.zero;
  DateTime _lastPosChange = DateTime.now();
  DateTime? _bufferingSince;
  DateTime? _openedAt;
  DateTime _lastNotify = DateTime.fromMillisecondsSinceEpoch(0);
  Timer? _watchdog;
  Timer? _capture;
  Timer? _reconnect;
  final Debouncer _zap = Debouncer(const Duration(milliseconds: 280));
  final Lru<String, ui.Image> _previews = Lru<String, ui.Image>(90);
  final Set<String> _previewPending = {};
  Program? _savedThumbFor;
  List<(Duration, Duration)> _ranges = const [];

  bool _ready = false;
  bool get ready => _ready;

  Future<void> init() async {
    if (_ready) return;
    final s = host.settings();
    player = Player(configuration: PlayerConfiguration(title: AppConfig.appName, bufferSize: 32 * 1024 * 1024, logLevel: MPVLogLevel.warn));
    // GPU rendering always on; "hardware decoding" only switches mpv's hwdec.
    video = VideoController(player, configuration: VideoControllerConfiguration(enableHardwareAcceleration: true, hwdec: s.hardwareDecoding ? 'auto-safe' : 'no'));
    await applySettings();
    _subs.addAll([
      player.stream.position.listen(_onPosition),
      player.stream.playing.listen((_) => _notify(force: true)),
      player.stream.buffering.listen((b) {
        _bufferingSince = b ? (_bufferingSince ?? DateTime.now()) : null;
        _notify(force: true);
      }),
      player.stream.completed.listen((done) {
        if (done) _onCompleted();
      }),
      player.stream.tracks.listen((_) => _notify(force: true)),
      player.stream.track.listen((_) => _notify(force: true)),
      player.stream.duration.listen((d) {
        if (_pendingSeek != null && (kind == PlayKind.vod || kind == PlayKind.episode) && d > Duration.zero) {
          final target = _pendingSeek!;
          _pendingSeek = null;
          player.seek(target);
        }
        _notify();
      }),
      player.stream.width.listen((_) => _notify(force: true)),
      player.stream.log.listen(_onLog),
    ]);
    await _observeCache();
    _watchdog = Timer.periodic(const Duration(seconds: 2), (_) => _tick());
    _capture = Timer.periodic(const Duration(seconds: 8), (_) => _captureFrame());
    _ready = true;
  }

  /// mpv reports exactly which parts of the stream are in its cache → instant, safe rewinds.
  Future<void> _observeCache() async {
    try {
      final dynamic native = player.platform;
      await native.observeProperty('demuxer-cache-state', (String v) async {
        _ranges = parseSeekableRanges(v);
      });
    } catch (_) {}
  }

  Future<void> applySettings() async {
    final s = host.settings();
    await configureMpvForIptv(player, bufferMb: s.bufferMb);
    await mpvSet(player, 'hwdec', s.hardwareDecoding ? 'auto-safe' : 'no');
    // Deinterlacing is switched per stream by [_updateDeinterlace] (only interlaced channels).
    _deintOn = false;
    _progressiveReads = 0;
    await mpvSet(player, 'deinterlace', 'no');
  }

  bool _deintOn = false;
  int _progressiveReads = 0;

  /// mpv in this build deinterlaces on the GPU (d3d11vpp), which would also soften progressive
  /// channels — so it is enabled only while the decoded frames are flagged interlaced
  /// (1080i/576i TV), and disabled again after ~10 s of progressive frames.
  Future<void> _updateDeinterlace() async {
    final s = host.settings();
    if (!s.deinterlace || !s.hardwareDecoding) {
      if (_deintOn) {
        _deintOn = false;
        await mpvSet(player, 'deinterlace', 'no');
      }
      return;
    }
    final v = await mpvGet(player, 'video-frame-info/interlaced');
    if (v == null) return;
    final interlaced = v == 'yes' || v == 'true' || v == '1';
    if (interlaced) {
      _progressiveReads = 0;
      if (!_deintOn) {
        _deintOn = true;
        Log.i('interlaced video → deinterlace on');
        await mpvSet(player, 'deinterlace', 'yes');
      }
    } else if (_deintOn && ++_progressiveReads >= 5) {
      _deintOn = false;
      _progressiveReads = 0;
      Log.i('progressive video → deinterlace off');
      await mpvSet(player, 'deinterlace', 'no');
    }
  }

  // ---------------------------------------------------------------- state helpers

  bool get isTv => kind == PlayKind.live || kind == PlayKind.archive;
  bool get isLive => kind == PlayKind.live;
  bool get playing => _ready && player.state.playing;
  bool get buffering => _ready && (player.state.buffering || connecting);
  DateTime get now => DateTime.now().toUtc();

  StreamState? get streamState {
    if (!isTv || _origin == null) return null;
    final st = player.state;
    final played = st.position - _minPlayed;
    // Without exact ranges from mpv assume only a short part behind us is still cached.
    final back = played > const Duration(seconds: 20) ? const Duration(seconds: 20) : played;
    return StreamState(
      mode: kind == PlayKind.live ? ChannelMode.live : ChannelMode.archive,
      origin: _origin!,
      position: st.position,
      bufferedEnd: st.buffer > st.position ? st.buffer : st.position,
      backCache: back.isNegative ? Duration.zero : back,
      ranges: _ranges,
    );
  }

  /// Absolute moment being watched on a channel (UTC).
  DateTime get playhead {
    final s = streamState;
    if (s != null) return s.playhead;
    return now;
  }

  /// How far behind live the viewer is (TV only).
  Duration get behindLive {
    if (!isTv) return Duration.zero;
    final d = now.difference(playhead);
    return d.isNegative ? Duration.zero : d;
  }

  bool get atLiveEdge => kind == PlayKind.live && behindLive < Timeline.liveTolerance;

  Program? get program => channel == null ? null : host.programAt(channel!, playhead);

  String get title {
    switch (kind) {
      case PlayKind.vod:
        return vod?.name ?? '';
      case PlayKind.episode:
        return episode == null ? (series?.name ?? '') : (episode!.title.isNotEmpty ? episode!.title : 'Epizoda ${episode!.number}');
      default:
        return channel?.name ?? '';
    }
  }

  void showToast(String msg) {
    toast = msg;
    _toastAt = DateTime.now();
    _notify(force: true);
  }

  String? get visibleToast {
    if (toast == null || _toastAt == null) return null;
    if (DateTime.now().difference(_toastAt!) > const Duration(seconds: 3)) return null;
    return toast;
  }

  void _notify({bool force = false}) {
    final t = DateTime.now();
    if (!force && t.difference(_lastNotify) < const Duration(milliseconds: 240)) return;
    _lastNotify = t;
    notifyListeners();
  }

  // ---------------------------------------------------------------- opening streams

  Future<void> _open(String url, {required PlayKind k, DateTime? origin, Duration? skip}) async {
    final seq = ++_seq;
    _reconnect?.cancel();
    connecting = true;
    error = null;
    kind = k;
    _origin = origin;
    _minPlayed = Duration.zero;
    _ranges = const [];
    _lastPos = Duration.zero;
    _lastPosChange = DateTime.now();
    _bufferingSince = DateTime.now();
    _pendingSeek = (skip != null && skip > const Duration(seconds: 2)) ? skip : null;
    _pendingSeekUntil = DateTime.now().add(const Duration(seconds: 12));
    _pausedAt = null;
    _userPaused = false;
    _openedAt = DateTime.now();
    _notify(force: true);
    Log.i('open ${k.name} $url${skip != null ? ' skip=${skip.inSeconds}s' : ''}');
    try {
      await host.beforeOpen();
      if (seq != _seq) return;
      await player.open(Media(url, httpHeaders: const {'User-Agent': AppConfig.userAgent}), play: true);
    } catch (e) {
      if (seq != _seq) return;
      Log.i('open failed: $e');
      _scheduleReconnect('Ne mogu otvoriti stream.');
    }
  }

  // ---- TV

  /// Switches to [c] live (debounced, so holding a key while zapping does not hammer the server).
  void playChannel(Channel c, {List<Channel>? list, bool immediate = false}) {
    final changed = channel?.id != c.id;
    if (list != null) zapList = list;
    // Same channel already playing live and healthy: keep the stream (no reconnect).
    if (!changed && kind == PlayKind.live && error == null && _origin != null && !connecting) {
      _zap.cancel();
      if (!player.state.playing) resume();
      _notify(force: true);
      return;
    }
    channel = c;
    vod = null;
    vodInfo = null;
    series = null;
    episode = null;
    kind = PlayKind.live;
    if (changed) frames.clearSource('ch:${c.id}');
    _savedThumbFor = null;
    connecting = true;
    error = null;
    _failures = 0;
    _notify(force: true);
    void go() {
      host.onChannelStarted(c);
      host.ensureEpg(c);
      _origin = null;
      _open(host.liveUrl(c), k: PlayKind.live);
    }

    if (immediate) {
      _zap.cancel();
      go();
    } else {
      _zap(go);
    }
  }

  void zap(int step) {
    final c = channel;
    if (c == null || zapList.isEmpty) return;
    var i = zapList.indexWhere((x) => x.id == c.id);
    if (i < 0) i = 0;
    i = (i + step) % zapList.length;
    if (i < 0) i += zapList.length;
    playChannel(zapList[i]);
  }

  /// Plays [c] from [at] (catch-up / start-over). Falls back to live when [at] is "now".
  void playArchive(Channel c, DateTime at, {List<Channel>? list}) {
    // Same channel already open: the moment may still be in the player's cache.
    final stream = channel?.id == c.id ? streamState : null;
    _zap.cancel();
    channel = c;
    if (list != null) zapList = list;
    vod = null;
    vodInfo = null;
    series = null;
    episode = null;
    _failures = 0;
    error = null;
    host.onChannelStarted(c);
    host.ensureEpg(c);
    final plan = Timeline.plan(channel: c, target: at, now: now, stream: stream);
    if (plan is NotAvailable && kind == null) {
      // Nothing is playing yet: show the channel live instead of an empty player.
      showToast(plan.reason);
      _execute(c, const GoLive());
      return;
    }
    _execute(c, plan);
  }

  void _openArchive(Channel c, DateTime minute, Duration offset) {
    final len = Timeline.archiveLength(minute, now);
    _open(host.archiveUrl(c, minute, len), k: PlayKind.archive, origin: minute, skip: offset);
  }

  void _execute(Channel c, SeekPlan plan) {
    Log.i('plan ${plan.runtimeType} on ${c.name}');
    switch (plan) {
      case StayLive():
        if (!player.state.playing) player.play();
        break;
      case GoLive():
        kind = PlayKind.live;
        _origin = null;
        _open(host.liveUrl(c), k: PlayKind.live);
        showToast('Uživo');
        break;
      case SeekInStream(position: final p):
        player.seek(p);
        if (!player.state.playing && !_userPaused) player.play();
        _notify(force: true);
        break;
      case OpenArchive(minute: final m, offset: final o):
        _openArchive(c, m, o);
        break;
      case NotAvailable(reason: final r):
        showToast(r);
        break;
    }
  }

  /// Jumps to the absolute moment [target] on the current channel.
  void seekTo(DateTime target) {
    final c = channel;
    if (c == null || !isTv) return;
    final plan = Timeline.plan(channel: c, target: target, now: now, stream: streamState);
    _execute(c, plan);
  }

  void skip(Duration delta) {
    if (isTv) {
      seekTo(playhead.add(delta));
    } else if (kind != null) {
      final st = player.state;
      var t = st.position + delta;
      if (t.isNegative) t = Duration.zero;
      if (st.duration > Duration.zero && t > st.duration - const Duration(seconds: 2)) t = st.duration - const Duration(seconds: 2);
      player.seek(t);
    }
  }

  /// "Od početka": the running/selected programme from its start.
  void restartProgram() {
    final c = channel;
    final p = program;
    if (c == null) return;
    if (p == null) {
      showToast('Nema podataka o emisiji (EPG).');
      return;
    }
    // Without archive this still works for the part already in the player's cache.
    seekTo(p.start);
  }

  void goLive() {
    final c = channel;
    if (c == null) return;
    _execute(c, atLiveEdge ? const StayLive() : const GoLive());
  }

  void previousProgram() {
    final c = channel;
    final p = program;
    if (c == null || p == null) return;
    // Within the first 30 s of a programme go to the previous one, otherwise to its start.
    if (playhead.difference(p.start) > const Duration(seconds: 30)) {
      seekTo(p.start);
      return;
    }
    final before = p.start.subtract(const Duration(seconds: 1));
    final prev = host.programAt(c, before);
    seekTo(prev?.start ?? before.subtract(const Duration(minutes: 30)));
  }

  void nextProgram() {
    final c = channel;
    final p = program;
    if (c == null) return;
    if (p == null || !p.end.isBefore(now.subtract(Timeline.liveTolerance))) {
      goLive();
      return;
    }
    seekTo(p.end);
  }

  // ---- Movies & series

  void playVod(VodItem v, {VodInfo? info, Duration? from}) {
    channel = null;
    series = null;
    episode = null;
    vod = v;
    vodInfo = info;
    _failures = 0;
    frames.clearSource('vod:${v.id}');
    _open(host.vodUrl(v), k: PlayKind.vod, skip: from);
  }

  void playEpisode(Series s, Episode e, List<Episode> all, {Duration? from}) {
    channel = null;
    vod = null;
    series = s;
    episode = e;
    episodes = all;
    _failures = 0;
    frames.clearSource('ep:${e.id}');
    _open(host.episodeUrl(e), k: PlayKind.episode, skip: from);
  }

  Episode? get nextEpisode {
    final e = episode;
    if (e == null) return null;
    final i = episodes.indexWhere((x) => x.id == e.id);
    return i >= 0 && i + 1 < episodes.length ? episodes[i + 1] : null;
  }

  // ---------------------------------------------------------------- transport

  void togglePlay() {
    if (player.state.playing) {
      pause();
    } else {
      resume();
    }
  }

  void pause() {
    _userPaused = true;
    _pausedAt = DateTime.now();
    player.pause();
    _notify(force: true);
  }

  void resume() {
    _userPaused = false;
    final c = channel;
    final pausedFor = _pausedAt == null ? Duration.zero : DateTime.now().difference(_pausedAt!);
    _pausedAt = null;
    // After a long pause on live TV the server has usually dropped the connection:
    // continue from the paused moment out of the archive (or live when there is none).
    if (c != null && isTv && pausedFor > const Duration(seconds: 50)) {
      final at = playhead;
      if (c.hasArchive && now.difference(at) > Timeline.liveTolerance) {
        final minute = ServerClock.floorMinute(at);
        _openArchive(c, minute, at.difference(minute));
      } else {
        _execute(c, const GoLive());
      }
      return;
    }
    player.play();
    _notify(force: true);
  }

  Future<void> setVolume(double v) async {
    await player.setVolume(v.clamp(0, 100).toDouble());
    _notify(force: true);
  }

  Future<void> stop() async {
    _seq++;
    _zap.cancel();
    _reconnect?.cancel();
    saveResume();
    connecting = false;
    error = null;
    kind = null;
    try {
      await player.stop();
    } catch (_) {}
    _notify(force: true);
  }

  void saveResume() {
    if (!_ready) return;
    final st = player.state;
    if (kind == PlayKind.vod && vod != null) {
      final v = vod!;
      host.onResume(ResumePoint(
        key: 'vod:${v.id}',
        title: v.name,
        subtitle: vodInfo?.genre ?? 'Film',
        image: v.poster,
        position: st.position,
        duration: st.duration,
        updated: DateTime.now(),
        kind: 'vod',
        payload: {'id': v.id},
      ));
    } else if (kind == PlayKind.episode && episode != null && series != null) {
      final e = episode!;
      host.onResume(ResumePoint(
        key: 'ep:${series!.id}',
        title: series!.name,
        subtitle: 'S${e.season} E${e.number}${e.title.isNotEmpty ? ' · ${e.title}' : ''}',
        image: e.image.isNotEmpty ? e.image : series!.cover,
        position: st.position,
        duration: st.duration,
        updated: DateTime.now(),
        kind: 'episode',
        payload: {'series': series!.id, 'episode': e.id},
      ));
    } else if (kind == PlayKind.archive && channel != null) {
      final p = program;
      if (p != null && p.end.isBefore(now)) {
        host.onResume(ResumePoint(
          key: 'cu:${p.key}',
          title: p.title,
          subtitle: channel!.name,
          image: channel!.logo,
          position: playhead.difference(p.start),
          duration: p.duration,
          updated: DateTime.now(),
          kind: 'catchup',
          payload: {'channel': channel!.id, 'start': p.start.millisecondsSinceEpoch},
        ));
      }
    }
  }

  Future<void> setAudio(AudioTrack t) => player.setAudioTrack(t);
  Future<void> setSubtitle(SubtitleTrack t) => player.setSubtitleTrack(t);

  // ---------------------------------------------------------------- events

  void _onPosition(Duration pos) {
    if (pos != _lastPos) {
      _lastPos = pos;
      _lastPosChange = DateTime.now();
    }
    if (connecting && pos > Duration.zero) {
      connecting = false;
      _failures = 0;
      _bufferingSince = null;
      if (kind == PlayKind.live && _origin == null) {
        // Live stream: position 0 is "when we joined".
        _origin = now.subtract(pos);
        _minPlayed = pos;
      }
      _notify(force: true);
    }
    if (_minPlayed > pos) _minPlayed = pos;
    // Archive opened at a whole minute: skip the remaining seconds as soon as they are downloaded.
    final ps = _pendingSeek;
    if (ps != null && kind == PlayKind.archive) {
      if (player.state.buffer >= ps) {
        _pendingSeek = null;
        player.seek(ps);
      } else if (_pendingSeekUntil != null && DateTime.now().isAfter(_pendingSeekUntil!)) {
        _pendingSeek = null;
      }
    }
    _notify();
  }

  void _onCompleted() {
    Log.i('completed (${kind?.name})');
    final c = channel;
    if (c != null && isTv) {
      if (kind == PlayKind.live) {
        _scheduleReconnect('Veza sa kanalom je prekinuta.');
        return;
      }
      // Archive chunk ended: continue where it stopped, or join live when we caught up.
      final at = playhead;
      if (now.difference(at) < const Duration(minutes: 2)) {
        _execute(c, const GoLive());
      } else {
        final minute = DateTime.utc(at.year, at.month, at.day, at.hour, at.minute);
        _openArchive(c, minute, at.difference(minute));
      }
      return;
    }
    if (kind == PlayKind.episode) {
      final n = nextEpisode;
      saveResume();
      if (n != null && series != null) {
        playEpisode(series!, n, episodes);
        showToast('Sljedeća epizoda');
        return;
      }
    }
    if (kind == PlayKind.vod) saveResume();
    _notify(force: true);
  }

  String _lastLog = '';
  int _lastLogRepeats = 0;

  /// mpv log (warnings and errors). Most "errors" are harmless (hardware decoder probing, no audio
  /// device, a damaged frame when joining a live stream mid-GOP) — only a failed *open* of the
  /// stream reconnects at once; everything else is left to the watchdog.
  void _onLog(PlayerLog l) {
    final text = l.text.trim();
    final key = '${l.prefix}|$text';
    final decoderNoise = l.prefix.startsWith('ffmpeg/video') || l.prefix.startsWith('ffmpeg/audio');
    if (key == _lastLog || decoderNoise) {
      _lastLogRepeats++;
    } else {
      if (_lastLogRepeats > 0) Log.i('[mpv] … $_lastLogRepeats similar/decoder messages');
      _lastLogRepeats = 0;
      _lastLog = key;
      Log.i('[mpv ${l.level}] ${l.prefix}: $text');
    }
    if (kind == null || !connecting) return;
    if (l.level != 'error' && l.level != 'fatal') return;
    final openFailed = l.prefix == 'stream' ||
        (l.prefix == 'ffmpeg' && RegExp(r'^(tcp|http|https|tls)\b').hasMatch(text)) ||
        (l.prefix == 'cplayer' && text.contains('recognize file format'));
    if (openFailed) _scheduleReconnect('Stream se ne učitava.');
  }

  int _reconnectForSeq = -1;

  void _scheduleReconnect(String why) {
    if (kind == null) return;
    // One retry per opened stream (several errors of one failed open count once).
    if (_reconnectForSeq == _seq && (_reconnect?.isActive ?? false)) return;
    _reconnectForSeq = _seq;
    _reconnect?.cancel();
    _failures++;
    Log.i('reconnect #$_failures: $why');
    if (_failures > 6) {
      connecting = false;
      error = '$why Provjeri internet ili pokušaj drugi kanal.';
      _notify(force: true);
      return;
    }
    connecting = true;
    _notify(force: true);
    final wait = Duration(milliseconds: (800 * (1 << (_failures - 1))).clamp(800, 10000));
    _reconnect = Timer(wait, reconnect);
  }

  /// Opens the same thing again (same moment for archive/VOD).
  void reconnect() {
    final c = channel;
    switch (kind) {
      case PlayKind.live:
        if (c != null) _open(host.liveUrl(c), k: PlayKind.live);
        break;
      case PlayKind.archive:
        if (c != null) {
          final at = playhead;
          final minute = DateTime.utc(at.year, at.month, at.day, at.hour, at.minute);
          _openArchive(c, minute, at.difference(minute));
        }
        break;
      case PlayKind.vod:
        if (vod != null) _open(host.vodUrl(vod!), k: PlayKind.vod, skip: player.state.position);
        break;
      case PlayKind.episode:
        if (episode != null) _open(host.episodeUrl(episode!), k: PlayKind.episode, skip: player.state.position);
        break;
      case null:
        break;
    }
  }

  void retryAfterError() {
    _failures = 0;
    error = null;
    reconnect();
  }

  void _tick() {
    if (kind == null || _userPaused || error != null) {
      _notify(force: true);
      return;
    }
    final t = DateTime.now();
    final st = player.state;
    // Stuck while "playing": no position change for 12 s → reconnect.
    if (!connecting && st.playing && !st.buffering && t.difference(_lastPosChange) > const Duration(seconds: 12)) {
      _scheduleReconnect('Slika je stala.');
      return;
    }
    // Opening failed and mpv went idle (e.g. HTTP 403/404, server closed at once) → retry soon.
    if (connecting && _openedAt != null && t.difference(_openedAt!) > const Duration(milliseconds: 2500)) {
      final seq = _seq;
      mpvGet(player, 'idle-active').then((v) {
        if (seq == _seq && connecting && v == 'yes') _scheduleReconnect('Stream se ne učitava.');
      });
    }
    // Buffering/connecting forever → reconnect.
    final since = _bufferingSince;
    if (since != null && (st.buffering || connecting) && t.difference(since) > const Duration(seconds: 22)) {
      _bufferingSince = t;
      _scheduleReconnect('Stream ne odgovara.');
      return;
    }
    // Archive caught up with live → switch to the live stream (lower latency, no gaps).
    if (kind == PlayKind.archive && channel != null && behindLive < const Duration(seconds: 12) && !connecting) {
      _execute(channel!, const GoLive());
      return;
    }
    if (!connecting && st.playing) _updateDeinterlace();
    _notify(force: true);
  }

  // ---------------------------------------------------------------- frames & previews

  String? get _frameSource {
    switch (kind) {
      case PlayKind.live:
      case PlayKind.archive:
        return channel == null ? null : 'ch:${channel!.id}';
      case PlayKind.vod:
        return vod == null ? null : 'vod:${vod!.id}';
      case PlayKind.episode:
        return episode == null ? null : 'ep:${episode!.id}';
      case null:
        return null;
    }
  }

  /// Timeline key of the current moment: epoch ms (TV) or position ms (movies).
  int get _frameAtMs => isTv ? playhead.millisecondsSinceEpoch : player.state.position.inMilliseconds;

  Future<void> _captureFrame() async {
    if (!_ready || kind == null || connecting || !player.state.playing || player.state.buffering) return;
    final src = _frameSource;
    final w = player.state.width ?? 0;
    final h = player.state.height ?? 0;
    if (src == null || w < 2 || h < 2) return;
    final at = _frameAtMs;
    try {
      final raw = await player.screenshot(format: null);
      if (raw == null) return;
      final rgba = downscaleBgra(raw, w, h);
      if (rgba == null || isBlankRgba(rgba)) return;
      final img = await rgbaToImage(rgba);
      frames.add(src, at, img);
      // First good frame 2+ minutes into a programme becomes its EPG thumbnail.
      final p = program;
      if (isTv && p != null && _savedThumbFor?.key != p.key && playhead.difference(p.start) > const Duration(minutes: 2)) {
        _savedThumbFor = p;
        final png = await imageToPng(img);
        Uint8List? largePng;
        final big = downscaleBgra(raw, w, h, outW: kLargeW, outH: kLargeH);
        if (big != null) {
          final bigImg = await rgbaToImage(big, w: kLargeW, h: kLargeH);
          largePng = await imageToPng(bigImg);
          bigImg.dispose();
        }
        if (png != null) host.onProgramFrame(p, png, largePng);
      }
    } catch (_) {}
  }

  /// Frame to show above the seek bar for [atMs] (same key space as [_frameAtMs]).
  ui.Image? previewFrame(int atMs) {
    final src = _frameSource;
    if (src == null) return null;
    final own = frames.nearest(src, atMs, toleranceMs: isTv ? 20000 : 15000);
    if (own != null) return own;
    final bucket = isTv ? (atMs ~/ 30000) : (atMs ~/ 20000);
    final key = '$src#$bucket';
    final cached = _previews.get(key);
    if (cached != null) return cached;
    // Each moment is requested once (a failed grab is not retried on every repaint).
    if (!_previewPending.contains(key)) _requestPreview(key, atMs);
    return null;
  }

  void _requestPreview(String key, int atMs) {
    String? url;
    var seek = Duration.zero;
    final c = channel;
    if (isTv && c != null && c.hasArchive) {
      final at = DateTime.fromMillisecondsSinceEpoch(atMs, isUtc: true);
      if (now.difference(at) < const Duration(minutes: 2)) return;
      final minute = DateTime.utc(at.year, at.month, at.day, at.hour, at.minute);
      url = host.archiveUrl(c, minute, const Duration(minutes: 2));
    } else if (kind == PlayKind.vod && vod != null) {
      url = host.vodUrl(vod!);
      seek = Duration(milliseconds: atMs);
    } else if (kind == PlayKind.episode && episode != null) {
      url = host.episodeUrl(episode!);
      seek = Duration(milliseconds: atMs);
    }
    if (url == null) return;
    if (_previewPending.length > 600) _previewPending.clear();
    _previewPending.add(key);
    host.grabPreview(url, seek).then((img) {
      if (img != null) {
        _previews.put(key, img);
        _notify(force: true);
      } else {
        // Not allowed now (e.g. 1 connection): may be retried later.
        Future<void>.delayed(const Duration(seconds: 20), () => _previewPending.remove(key));
      }
    }, onError: (Object _) => null);
  }

  @override
  void dispose() {
    _watchdog?.cancel();
    _capture?.cancel();
    _reconnect?.cancel();
    _zap.cancel();
    for (final s in _subs) {
      s.cancel();
    }
    if (_ready) player.dispose();
    super.dispose();
  }
}

/// Parses mpv's demuxer-cache-state (JSON string) into seekable ranges.
List<(Duration, Duration)> parseSeekableRanges(String json) {
  try {
    final j = jsonDecode(json);
    if (j is! Map) return const [];
    final r = j['seekable-ranges'];
    if (r is! List) return const [];
    final out = <(Duration, Duration)>[];
    for (final e in r) {
      if (e is Map) {
        final a = e['start'];
        final b = e['end'];
        if (a is num && b is num && b > a) {
          out.add((Duration(milliseconds: (a * 1000).round()), Duration(milliseconds: (b * 1000).round())));
        }
      }
    }
    return out;
  } catch (_) {
    return const [];
  }
}
