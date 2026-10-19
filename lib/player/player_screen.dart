import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../app/services.dart';
import '../app/theme.dart';
import '../data/models.dart';
import '../ui/widgets/common.dart';
import '../ui/widgets/tv_widgets.dart';
import '../util/time_fmt.dart';
import 'engine.dart';
import 'timeline.dart';
import 'widgets/seek_bar.dart';

/// Full-window player (EON style): info bar with the programme timeline and live edge,
/// start-over, rewinding a programme that is still running with frame previews,
/// the channel's mini guide (earlier/now/later with pictures) and the channel list.
class PlayerScreen extends StatefulWidget {
  const PlayerScreen({super.key});
  static bool isOpen = false;
  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

enum _Panel { none, channels, guide, tracks }

class _PlayerScreenState extends State<PlayerScreen> {
  final s = AppServices.I;
  PlayerEngine get e => s.engine;
  final _focus = FocusNode(debugLabel: 'player');
  DateTime _osdUntil = DateTime.now().add(const Duration(seconds: 5));
  Timer? _osdTimer;
  _Panel _panel = _Panel.none;
  bool _fullscreen = false;
  bool _mouseScrub = false;
  bool _lastOsd = true;

  int? _scrubMs;
  int _scrubRepeats = 0;
  Timer? _scrubCommit;

  String _digits = '';
  Timer? _digitsTimer;

  int _drawerIndex = 0;
  final _drawerScroll = ScrollController();
  static const _drawerItemH = 74.0;

  int _guideIndex = 0;
  final _guideScroll = ScrollController();
  static const _guideCardW = 268.0;
  static const _guideGap = 14.0;

  BoxFit _fit = BoxFit.contain;
  String _aspect = 'auto';

  @override
  void initState() {
    super.initState();
    PlayerScreen.isOpen = true;
    _osdTimer = Timer.periodic(const Duration(milliseconds: 400), (_) {
      final v = _osdVisible;
      if (v != _lastOsd && mounted) setState(() => _lastOsd = v);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  @override
  void dispose() {
    PlayerScreen.isOpen = false;
    _osdTimer?.cancel();
    _scrubCommit?.cancel();
    _digitsTimer?.cancel();
    _drawerScroll.dispose();
    _guideScroll.dispose();
    _focus.dispose();
    if (_fullscreen) defaultExitNativeFullscreen();
    if (s.signedIn) s.engine.stop();
    super.dispose();
  }

  bool get _osdVisible => _panel != _Panel.none || _mouseScrub || _scrubMs != null || !e.playing || DateTime.now().isBefore(_osdUntil);

  void _poke([int seconds = 4]) {
    _osdUntil = DateTime.now().add(Duration(seconds: seconds));
    if (!_lastOsd) setState(() => _lastOsd = true);
  }

  Future<void> _toggleFullscreen() async {
    if (_fullscreen) {
      await defaultExitNativeFullscreen();
    } else {
      await defaultEnterNativeFullscreen();
    }
    if (mounted) setState(() => _fullscreen = !_fullscreen);
  }

  void _setPanel(_Panel p) {
    setState(() => _panel = _panel == p ? _Panel.none : p);
    if (_panel == _Panel.channels) _prepareDrawer();
    if (_panel == _Panel.guide) _prepareGuide();
    _focus.requestFocus();
  }

  void _close() {
    if (_panel != _Panel.none) {
      setState(() => _panel = _Panel.none);
      return;
    }
    if (_fullscreen) {
      _toggleFullscreen();
      return;
    }
    Navigator.of(context).maybePop();
  }

  // ------------------------------------------------------------------ seek model

  SeekModel? _model() {
    if (!e.ready || e.kind == null) return null;
    if (e.isTv && e.channel != null) {
      final now = e.now;
      final head = e.playhead;
      final (ws, we) = Timeline.window(head, e.program, now);
      final earliest = Timeline.earliest(e.channel!, now, e.streamState) ?? head;
      return SeekModel(
        startMs: ws.millisecondsSinceEpoch,
        endMs: we.millisecondsSinceEpoch,
        positionMs: head.millisecondsSinceEpoch,
        minMs: earliest.millisecondsSinceEpoch,
        maxMs: now.millisecondsSinceEpoch,
        liveMs: now.millisecondsSinceEpoch,
      );
    }
    final st = e.player.state;
    final dur = st.duration.inMilliseconds;
    return SeekModel(startMs: 0, endMs: dur <= 0 ? 1 : dur, positionMs: st.position.inMilliseconds, minMs: 0, maxMs: dur <= 0 ? 0 : dur);
  }

  void _seekMs(int ms) {
    if (e.isTv) {
      e.seekTo(DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true));
    } else {
      e.player.seek(Duration(milliseconds: ms));
    }
    _poke();
  }

  /// Arrow-key scrubbing: moves a preview cursor with accelerating steps, seeks after a pause.
  void _scrubStep(int dir) {
    final m = _model();
    if (m == null) return;
    final skip = s.prefs.settings.skipSeconds;
    _scrubRepeats++;
    final stepSec = _scrubRepeats <= 3
        ? skip
        : _scrubRepeats <= 8
            ? 30
            : _scrubRepeats <= 14
                ? 60
                : 180;
    final base = _scrubMs ?? m.positionMs;
    var next = base + dir * stepSec * 1000;
    if (next < m.minMs) next = m.minMs;
    if (next > m.maxMs) next = m.maxMs;
    setState(() => _scrubMs = next);
    _scrubCommit?.cancel();
    _scrubCommit = Timer(const Duration(milliseconds: 850), _commitScrub);
    _poke(5);
  }

  void _commitScrub() {
    final ms = _scrubMs;
    setState(() {
      _scrubMs = null;
      _scrubRepeats = 0;
    });
    if (ms != null) _seekMs(ms);
  }

  // ------------------------------------------------------------------ channels

  List<Channel> get _list => e.zapList.isNotEmpty ? e.zapList : s.catalog.channels;

  void _prepareDrawer() {
    final list = _list;
    final i = e.channel == null ? 0 : list.indexWhere((c) => c.id == e.channel!.id);
    _drawerIndex = i < 0 ? 0 : i;
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollDrawer(jump: true));
    s.epg.prefetchNow(list.skip((_drawerIndex - 6).clamp(0, list.length)).take(16));
  }

  void _scrollDrawer({bool jump = false}) {
    if (!_drawerScroll.hasClients) return;
    final target = (_drawerIndex * _drawerItemH - 200).clamp(0.0, _drawerScroll.position.maxScrollExtent);
    if (jump) {
      _drawerScroll.jumpTo(target);
    } else {
      _drawerScroll.animateTo(target, duration: const Duration(milliseconds: 160), curve: Curves.easeOut);
    }
  }

  void _drawerMove(int d) {
    final list = _list;
    if (list.isEmpty) return;
    setState(() => _drawerIndex = (_drawerIndex + d).clamp(0, list.length - 1));
    _scrollDrawer();
    s.epg.ensureNow(list[_drawerIndex]);
  }

  void _playFromDrawer(Channel c) {
    e.playChannel(c, list: _list, immediate: true);
    setState(() => _panel = _Panel.none);
    _poke(5);
  }

  void _zap(int step) {
    e.zap(step);
    _poke(5);
  }

  void _digit(int d) {
    if (!e.isTv) return;
    _digitsTimer?.cancel();
    setState(() => _digits = _digits.length >= 4 ? '$d' : '$_digits$d');
    _digitsTimer = Timer(const Duration(milliseconds: 1500), () {
      final n = int.tryParse(_digits);
      setState(() => _digits = '');
      if (n == null) return;
      final c = s.catalog.byNumber(n);
      if (c == null) {
        e.showToast('Nema kanala broj $n');
        return;
      }
      e.playChannel(c, list: _list.any((x) => x.id == c.id) ? _list : s.catalog.channels, immediate: true);
      _poke(5);
    });
  }

  // ------------------------------------------------------------------ mini guide

  List<Program> _guidePrograms() {
    final c = e.channel;
    if (c == null) return const [];
    final now = e.now;
    final from = c.archiveStart(now) ?? now.subtract(const Duration(hours: 3));
    return s.epg.programs(c.id).where((p) => p.end.isAfter(from) && p.start.isBefore(now.add(const Duration(hours: 30)))).toList();
  }

  void _prepareGuide() {
    final c = e.channel;
    if (c == null) return;
    s.epg.ensureFull(c);
    final list = _guidePrograms();
    final head = e.playhead;
    final i = list.indexWhere((p) => p.isLiveAt(head));
    _guideIndex = i < 0 ? (list.isEmpty ? 0 : list.length - 1) : i;
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollGuide(jump: true));
  }

  void _scrollGuide({bool jump = false}) {
    if (!_guideScroll.hasClients) return;
    final viewport = _guideScroll.position.viewportDimension;
    final target = (_guideIndex * (_guideCardW + _guideGap) - (viewport - _guideCardW) / 2).clamp(0.0, _guideScroll.position.maxScrollExtent);
    if (jump) {
      _guideScroll.jumpTo(target);
    } else {
      _guideScroll.animateTo(target, duration: const Duration(milliseconds: 220), curve: Curves.easeOutCubic);
    }
  }

  void _guideMove(int d) {
    final list = _guidePrograms();
    if (list.isEmpty) return;
    setState(() => _guideIndex = (_guideIndex + d).clamp(0, list.length - 1));
    _scrollGuide();
  }

  void _playFromGuide(Program p) {
    final c = e.channel;
    if (c == null) return;
    final now = e.now;
    if (p.start.isAfter(now)) {
      e.showToast('Počinje ${TimeFmt.dayLabel(p.start).toLowerCase()} u ${TimeFmt.hm(p.start)}');
      return;
    }
    if (p.isLiveAt(now)) {
      final current = e.program;
      if (current != null && current.key == p.key && !e.atLiveEdge) {
        e.goLive();
      } else if (current == null || current.key != p.key) {
        e.goLive();
      }
    } else if (c.hasArchive) {
      e.playArchive(c, p.start, list: _list);
    } else {
      e.showToast('Ovaj kanal nema arhivu.');
      return;
    }
    setState(() => _panel = _Panel.none);
    _poke(5);
  }

  // ------------------------------------------------------------------ keys

  KeyEventResult _onKey(FocusNode node, KeyEvent ev) {
    if (ev is KeyUpEvent) return KeyEventResult.ignored;
    final k = ev.logicalKey;
    final shift = HardwareKeyboard.instance.isShiftPressed;
    final repeat = ev is KeyRepeatEvent;
    _poke();

    if (k == LogicalKeyboardKey.escape || k == LogicalKeyboardKey.backspace || k == LogicalKeyboardKey.browserBack || k == LogicalKeyboardKey.goBack) {
      if (!repeat) _close();
      return KeyEventResult.handled;
    }
    final isEnter = k == LogicalKeyboardKey.enter || k == LogicalKeyboardKey.numpadEnter || k == LogicalKeyboardKey.select;
    if (_panel == _Panel.channels) {
      if (k == LogicalKeyboardKey.arrowUp) {
        _drawerMove(-1);
      } else if (k == LogicalKeyboardKey.arrowDown) {
        _drawerMove(1);
      } else if (k == LogicalKeyboardKey.pageUp) {
        _drawerMove(-8);
      } else if (k == LogicalKeyboardKey.pageDown) {
        _drawerMove(8);
      } else if (isEnter) {
        final list = _list;
        if (list.isNotEmpty) _playFromDrawer(list[_drawerIndex.clamp(0, list.length - 1)]);
      } else if (k == LogicalKeyboardKey.arrowLeft || k == LogicalKeyboardKey.arrowRight) {
        setState(() => _panel = _Panel.none);
      }
      return KeyEventResult.handled;
    }
    if (_panel == _Panel.guide) {
      if (k == LogicalKeyboardKey.arrowLeft) {
        _guideMove(-1);
      } else if (k == LogicalKeyboardKey.arrowRight) {
        _guideMove(1);
      } else if (isEnter) {
        final list = _guidePrograms();
        if (list.isNotEmpty) _playFromGuide(list[_guideIndex.clamp(0, list.length - 1)]);
      } else if (k == LogicalKeyboardKey.arrowUp || k == LogicalKeyboardKey.arrowDown || k == LogicalKeyboardKey.keyG) {
        setState(() => _panel = _Panel.none);
      }
      return KeyEventResult.handled;
    }

    if (k == LogicalKeyboardKey.space || k == LogicalKeyboardKey.mediaPlayPause || k == LogicalKeyboardKey.keyK) {
      if (!repeat) e.togglePlay();
      setState(() {});
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.mediaPlay) {
      e.resume();
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.mediaPause) {
      e.pause();
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.arrowLeft || k == LogicalKeyboardKey.mediaRewind) {
      if (shift) {
        e.skip(const Duration(seconds: -60));
      } else {
        _scrubStep(-1);
      }
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.arrowRight || k == LogicalKeyboardKey.mediaFastForward) {
      if (shift) {
        e.skip(const Duration(seconds: 60));
      } else {
        _scrubStep(1);
      }
      return KeyEventResult.handled;
    }
    if (e.isTv) {
      if (k == LogicalKeyboardKey.arrowUp || k == LogicalKeyboardKey.pageUp || k == LogicalKeyboardKey.channelUp) {
        _zap(1);
        return KeyEventResult.handled;
      }
      if (k == LogicalKeyboardKey.arrowDown || k == LogicalKeyboardKey.pageDown || k == LogicalKeyboardKey.channelDown) {
        _zap(-1);
        return KeyEventResult.handled;
      }
      if (isEnter || k == LogicalKeyboardKey.keyL) {
        if (!repeat) _setPanel(_Panel.channels);
        return KeyEventResult.handled;
      }
      if (k == LogicalKeyboardKey.keyG || k == LogicalKeyboardKey.tab) {
        if (!repeat) _setPanel(_Panel.guide);
        return KeyEventResult.handled;
      }
      if (k == LogicalKeyboardKey.home) {
        e.restartProgram();
        return KeyEventResult.handled;
      }
      if (k == LogicalKeyboardKey.end || k == LogicalKeyboardKey.keyU) {
        e.goLive();
        return KeyEventResult.handled;
      }
      final digit = _digitOf(k);
      if (digit != null) {
        _digit(digit);
        return KeyEventResult.handled;
      }
    } else {
      if (k == LogicalKeyboardKey.arrowUp) {
        e.setVolume(e.player.state.volume + 5);
        return KeyEventResult.handled;
      }
      if (k == LogicalKeyboardKey.arrowDown) {
        e.setVolume(e.player.state.volume - 5);
        return KeyEventResult.handled;
      }
      if (isEnter) {
        if (!repeat) e.togglePlay();
        return KeyEventResult.handled;
      }
    }
    if (k == LogicalKeyboardKey.keyF || k == LogicalKeyboardKey.f11) {
      if (!repeat) _toggleFullscreen();
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.keyM || k == LogicalKeyboardKey.audioVolumeMute) {
      if (!repeat) e.setVolume(e.player.state.volume > 0 ? 0 : 100);
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.equal || k == LogicalKeyboardKey.add || k == LogicalKeyboardKey.numpadAdd || k == LogicalKeyboardKey.audioVolumeUp) {
      e.setVolume(e.player.state.volume + 5);
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.minus || k == LogicalKeyboardKey.numpadSubtract || k == LogicalKeyboardKey.audioVolumeDown) {
      e.setVolume(e.player.state.volume - 5);
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.keyA) {
      if (!repeat) _setPanel(_Panel.tracks);
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  int? _digitOf(LogicalKeyboardKey k) {
    const keys = [
      LogicalKeyboardKey.digit0,
      LogicalKeyboardKey.digit1,
      LogicalKeyboardKey.digit2,
      LogicalKeyboardKey.digit3,
      LogicalKeyboardKey.digit4,
      LogicalKeyboardKey.digit5,
      LogicalKeyboardKey.digit6,
      LogicalKeyboardKey.digit7,
      LogicalKeyboardKey.digit8,
      LogicalKeyboardKey.digit9,
    ];
    const pad = [
      LogicalKeyboardKey.numpad0,
      LogicalKeyboardKey.numpad1,
      LogicalKeyboardKey.numpad2,
      LogicalKeyboardKey.numpad3,
      LogicalKeyboardKey.numpad4,
      LogicalKeyboardKey.numpad5,
      LogicalKeyboardKey.numpad6,
      LogicalKeyboardKey.numpad7,
      LogicalKeyboardKey.numpad8,
      LogicalKeyboardKey.numpad9,
    ];
    final a = keys.indexOf(k);
    if (a >= 0) return a;
    final b = pad.indexOf(k);
    return b >= 0 ? b : null;
  }

  // ------------------------------------------------------------------ aspect

  Future<void> _setAspect(String a) async {
    setState(() {
      _aspect = a;
      _fit = a == 'zoom' ? BoxFit.cover : (a == 'stretch' ? BoxFit.fill : BoxFit.contain);
    });
    final dynamic native = e.player.platform;
    try {
      await native.setProperty('video-aspect-override', a == '16:9' ? '16:9' : (a == '4:3' ? '4:3' : '-1'));
    } catch (_) {}
  }

  // ------------------------------------------------------------------ build

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Focus(
        focusNode: _focus,
        autofocus: true,
        onKeyEvent: _onKey,
        child: ListenableBuilder(
          listenable: Listenable.merge([e, s.epg]),
          builder: (context, _) {
            final osd = _osdVisible;
            final guideOpen = _panel == _Panel.guide;
            return MouseRegion(
              cursor: osd ? SystemMouseCursors.basic : SystemMouseCursors.none,
              onHover: (_) => _poke(),
              child: Listener(
                onPointerSignal: (sig) {
                  if (sig is PointerScrollEvent && _panel == _Panel.none) {
                    e.setVolume(e.player.state.volume + (sig.scrollDelta.dy < 0 ? 5 : -5));
                    _poke();
                  }
                },
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    if (_panel != _Panel.none) {
                      setState(() => _panel = _Panel.none);
                    } else {
                      osd ? setState(() => _osdUntil = DateTime.now()) : _poke();
                    }
                    _focus.requestFocus();
                  },
                  onDoubleTap: _toggleFullscreen,
                  child: Stack(fit: StackFit.expand, children: [
                    Video(controller: e.video, controls: NoVideoControls, fit: _fit, fill: Colors.black, wakelock: true),
                    if (e.buffering && e.error == null) const Center(child: _Spinner()),
                    if (e.error != null) _errorOverlay(),
                    Positioned(left: 0, right: 0, top: 0, child: _fade(osd, _topBar())),
                    Positioned(left: 0, right: 0, bottom: 0, child: _fade(osd && !guideOpen, _bottomPanel())),
                    // Mini guide (programmes of this channel)
                    AnimatedPositioned(
                      duration: const Duration(milliseconds: 240),
                      curve: Curves.easeOutCubic,
                      left: 0,
                      right: 0,
                      bottom: guideOpen ? 0 : -360,
                      height: 340,
                      child: _guidePanel(),
                    ),
                    if (e.visibleToast != null)
                      Positioned(
                        top: 120,
                        left: 0,
                        right: 0,
                        child: Center(
                          child: GlassPanel(
                            radius: 30,
                            opacity: 0.75,
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
                            child: Text(e.visibleToast!, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                          ),
                        ),
                      ),
                    if (_digits.isNotEmpty)
                      Positioned(
                        top: 40,
                        right: 50,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 10),
                          decoration: BoxDecoration(color: Colors.black.o(0.8), borderRadius: BorderRadius.circular(14), border: Border.all(color: OrbitColors.accent, width: 2)),
                          child: Text(_digits, style: const TextStyle(fontSize: 46, fontWeight: FontWeight.w900, letterSpacing: 4, color: OrbitColors.accent)),
                        ),
                      ),
                    // Channel list
                    AnimatedPositioned(
                      duration: const Duration(milliseconds: 220),
                      curve: Curves.easeOutCubic,
                      left: _panel == _Panel.channels ? 0 : -480,
                      top: 0,
                      bottom: 0,
                      width: 460,
                      child: _drawerPanel(),
                    ),
                    // Audio / subtitles / picture
                    AnimatedPositioned(
                      duration: const Duration(milliseconds: 220),
                      curve: Curves.easeOutCubic,
                      right: _panel == _Panel.tracks ? 0 : -420,
                      top: 0,
                      bottom: 0,
                      width: 400,
                      child: _tracksPanel(),
                    ),
                  ]),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _fade(bool visible, Widget child) => IgnorePointer(
        ignoring: !visible,
        child: AnimatedOpacity(opacity: visible ? 1 : 0, duration: const Duration(milliseconds: 220), child: child),
      );

  Widget _errorOverlay() {
    return Container(
      color: Colors.black.o(0.72),
      child: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.portable_wifi_off_rounded, size: 56, color: OrbitColors.accent),
          const SizedBox(height: 14),
          const Text('Program se ne može učitati', style: TextStyles.h2),
          const SizedBox(height: 8),
          ConstrainedBox(constraints: const BoxConstraints(maxWidth: 480), child: Text(e.error ?? '', textAlign: TextAlign.center, style: TextStyles.muted)),
          const SizedBox(height: 22),
          Row(mainAxisSize: MainAxisSize.min, children: [
            ElevatedButton.icon(onPressed: e.retryAfterError, icon: const Icon(Icons.refresh_rounded), label: const Text('Pokušaj ponovo')),
            const SizedBox(width: 12),
            if (e.isTv) ...[
              OutlinedButton.icon(onPressed: () => _setPanel(_Panel.channels), icon: const Icon(Icons.list_rounded), label: const Text('Drugi kanal')),
              const SizedBox(width: 12),
            ],
            OutlinedButton(onPressed: () => Navigator.of(context).maybePop(), child: const Text('Nazad')),
          ]),
        ]),
      ),
    );
  }

  Widget _statusBadge() {
    final p = e.program;
    final now = e.now;
    if (!e.isTv) return const SizedBox.shrink();
    if (e.atLiveEdge) return const LiveBadge();
    final archive = e.kind == PlayKind.archive && p != null && p.isPastAt(now);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: OrbitColors.accent, borderRadius: BorderRadius.circular(6)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.history_rounded, size: 13, color: OrbitColors.onAccent),
        const SizedBox(width: 5),
        Text(archive ? 'ARHIVA' : '−${TimeFmt.clock(e.behindLive)}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: OrbitColors.onAccent, letterSpacing: 0.6, fontFeatures: [ui.FontFeature.tabularFigures()])),
      ]),
    );
  }

  Widget _topBar() {
    final c = e.channel;
    return Container(
      padding: const EdgeInsets.fromLTRB(28, 22, 32, 70),
      decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xD9000000), Color(0x00000000)])),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        _RoundButton(icon: Icons.arrow_back_rounded, tooltip: 'Nazad (Esc)', onTap: () => Navigator.of(context).maybePop()),
        const SizedBox(width: 18),
        if (e.isTv && c != null) ...[
          LogoBadge(channel: c, size: 46),
          const SizedBox(width: 14),
          Text('${c.number}', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: OrbitColors.accent, fontFeatures: [ui.FontFeature.tabularFigures()])),
          const SizedBox(width: 12),
          Flexible(child: Text(c.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800))),
          const SizedBox(width: 14),
          _statusBadge(),
        ] else
          Flexible(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (e.kind == PlayKind.episode && e.series != null) Text(e.series!.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: OrbitColors.textMuted)),
              Text(
                e.kind == PlayKind.episode && e.episode != null ? 'S${e.episode!.season} E${e.episode!.number} · ${e.title}' : e.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
              ),
            ]),
          ),
        const Spacer(),
        const ClockText(style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, fontFeatures: [ui.FontFeature.tabularFigures()])),
      ]),
    );
  }

  Widget _bottomPanel() {
    final m = _model();
    final c = e.channel;
    final p = e.program;
    final playing = e.playing;
    final skip = s.prefs.settings.skipSeconds;
    final next = (c != null && p != null) ? s.epg.nextOf(c.id, p) : null;
    String leftLabel = '', rightLabel = '', headLabel = '';
    if (m != null) {
      if (e.isTv) {
        leftLabel = TimeFmt.hm(DateTime.fromMillisecondsSinceEpoch(m.startMs, isUtc: true));
        rightLabel = TimeFmt.hm(DateTime.fromMillisecondsSinceEpoch(m.endMs, isUtc: true));
        headLabel = TimeFmt.hms(DateTime.fromMillisecondsSinceEpoch(_scrubMs ?? m.positionMs, isUtc: true));
      } else {
        leftLabel = TimeFmt.clock(Duration(milliseconds: _scrubMs ?? m.positionMs));
        rightLabel = m.endMs > 1 ? '-${TimeFmt.clock(Duration(milliseconds: m.endMs - (_scrubMs ?? m.positionMs)))}' : '';
      }
    }
    const tab = [ui.FontFeature.tabularFigures()];
    return Container(
      padding: const EdgeInsets.fromLTRB(40, 90, 40, 26),
      decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x00000000), Color(0xB3000000), Color(0xF2000000)], stops: [0, 0.4, 1])),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (e.isTv) ...[
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(p?.title ?? 'Nema podataka o programu', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, letterSpacing: -0.4)),
                const SizedBox(height: 4),
                Text(p == null ? (c?.name ?? '') : '${TimeFmt.dayLabel(p.start)} · ${TimeFmt.range(p.start, p.end)} · ${TimeFmt.humanMinutes(p.duration)}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: OrbitColors.textMuted)),
              ]),
            ),
            if (next != null)
              Padding(
                padding: const EdgeInsets.only(left: 20),
                child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  const Text('SLIJEDI', style: TextStyles.label),
                  const SizedBox(height: 4),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 320),
                    child: Text('${TimeFmt.hm(next.start)}  ${next.title}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  ),
                ]),
              ),
          ]),
          const SizedBox(height: 14),
        ],
        if (m != null) ...[
          Row(children: [
            Text(leftLabel, style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: tab)),
            const Spacer(),
            if (headLabel.isNotEmpty) Text(headLabel, style: const TextStyle(fontWeight: FontWeight.w800, color: OrbitColors.accent, fontFeatures: tab)),
            const Spacer(),
            Text(rightLabel, style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: tab)),
          ]),
          const SizedBox(height: 4),
          SeekBar(model: m, scrubMs: _scrubMs, onSeek: _seekMs, onScrubbing: (v) => setState(() => _mouseScrub = v), previewBuilder: _preview),
          const SizedBox(height: 12),
        ],
        ExcludeFocus(
          child: LayoutBuilder(builder: (context, box) {
            // Narrow windows: icon-only buttons and no volume slider, so nothing overflows.
            final narrow = box.maxWidth < 1120;
            return Row(children: [
            if (e.isTv) ...[
              narrow
                  ? _RoundButton(icon: Icons.replay_rounded, tooltip: 'Od početka (Home)', onTap: e.restartProgram)
                  : _PillButton(label: 'Od početka', icon: Icons.replay_rounded, onTap: e.restartProgram),
              const SizedBox(width: 10),
              _RoundButton(icon: Icons.skip_previous_rounded, tooltip: 'Prethodna emisija', onTap: e.previousProgram),
              const SizedBox(width: 8),
            ],
            _RoundButton(icon: Icons.replay_10_rounded, tooltip: '−$skip s (←)', onTap: () => e.skip(Duration(seconds: -skip))),
            const SizedBox(width: 8),
            _RoundButton(icon: playing ? Icons.pause_rounded : Icons.play_arrow_rounded, tooltip: playing ? 'Pauza (Space)' : 'Nastavi (Space)', onTap: e.togglePlay, big: true),
            const SizedBox(width: 8),
            _RoundButton(icon: Icons.forward_10_rounded, tooltip: '+$skip s (→)', onTap: () => e.skip(Duration(seconds: skip))),
            if (e.isTv) ...[
              const SizedBox(width: 8),
              _RoundButton(icon: Icons.skip_next_rounded, tooltip: 'Sljedeća emisija', onTap: e.nextProgram),
            ],
            if (e.kind == PlayKind.episode && e.nextEpisode != null) ...[
              const SizedBox(width: 8),
              narrow
                  ? _RoundButton(icon: Icons.skip_next_rounded, tooltip: 'Sljedeća epizoda', onTap: () => e.playEpisode(e.series!, e.nextEpisode!, e.episodes))
                  : _PillButton(label: 'Sljedeća epizoda', icon: Icons.skip_next_rounded, onTap: () => e.playEpisode(e.series!, e.nextEpisode!, e.episodes)),
            ],
            if (e.isTv && !e.atLiveEdge) ...[
              const SizedBox(width: 10),
              _PillButton(label: 'UŽIVO', icon: Icons.fiber_manual_record_rounded, color: OrbitColors.live, onTap: e.goLive),
            ],
            const Spacer(),
            _VolumeControl(engine: e, compact: narrow),
            const SizedBox(width: 8),
            if (e.isTv) ...[
              _RoundButton(icon: Icons.view_carousel_rounded, tooltip: 'Vodič kanala (G)', onTap: () => _setPanel(_Panel.guide)),
              const SizedBox(width: 8),
              _RoundButton(icon: Icons.format_list_bulleted_rounded, tooltip: 'Kanali (Enter)', onTap: () => _setPanel(_Panel.channels)),
              const SizedBox(width: 8),
              _RoundButton(
                icon: (c != null && s.prefs.isFavorite(c.id)) ? Icons.star_rounded : Icons.star_outline_rounded,
                tooltip: 'Omiljeni',
                active: c != null && s.prefs.isFavorite(c.id),
                onTap: () {
                  if (c != null) s.prefs.toggleFavorite(c.id);
                  setState(() {});
                },
              ),
              const SizedBox(width: 8),
            ],
            _RoundButton(icon: Icons.tune_rounded, tooltip: 'Zvuk, titlovi i slika (A)', onTap: () => _setPanel(_Panel.tracks)),
            const SizedBox(width: 8),
            _RoundButton(icon: _fullscreen ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded, tooltip: 'Cijeli ekran (F)', onTap: _toggleFullscreen),
            ]);
          }),
        ),
        if (e.isTv)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              e.behindLive > const Duration(minutes: 1)
                  ? 'Gledaš sa zakašnjenjem ${TimeFmt.clock(e.behindLive)} · ← → premotavanje · End = uživo · G = vodič kanala'
                  : '← → premotavanje · ↑ ↓ kanali · Enter lista kanala · G vodič kanala · Home od početka',
              style: TextStyles.tiny,
            ),
          ),
      ]),
    );
  }

  Widget _preview(int ms) {
    final img = e.previewFrame(ms);
    final c = e.channel;
    String label;
    String? title;
    if (e.isTv) {
      final t = DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true);
      label = TimeFmt.hm(t);
      final behind = e.now.difference(t);
      if (behind > const Duration(seconds: 30)) label = '$label  ·  −${TimeFmt.clock(behind)}';
      if (c != null) title = s.epg.at(c.id, t)?.title;
    } else {
      label = TimeFmt.clock(Duration(milliseconds: ms));
    }
    return Container(
      decoration: BoxDecoration(
        color: OrbitColors.bgElevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: OrbitColors.accent, width: 2),
        boxShadow: [BoxShadow(color: Colors.black.o(0.65), blurRadius: 22)],
      ),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: img != null
                ? RawImage(image: img, fit: BoxFit.cover)
                : Container(
                    color: OrbitColors.surface,
                    child: Center(child: c != null ? LogoBadge(channel: c, size: 44) : const Icon(Icons.movie_rounded, color: OrbitColors.textDim, size: 40)),
                  ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 7, 10, 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: OrbitColors.accent)),
            if (title != null) Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
          ]),
        ),
      ]),
    );
  }

  Widget _guidePanel() {
    final c = e.channel;
    final list = _guidePrograms();
    final now = e.now;
    final head = e.playhead;
    final sel = list.isEmpty ? null : list[_guideIndex.clamp(0, list.length - 1)];
    return GlassPanel(
      opacity: 0.82,
      border: false,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(40, 18, 30, 12),
          child: Row(children: [
            if (c != null) ...[LogoBadge(channel: c, size: 30), const SizedBox(width: 12)],
            Text(c == null ? 'Vodič' : 'Vodič · ${c.name}', style: TextStyles.h2),
            if (sel != null) ...[
              const SizedBox(width: 14),
              Text(TimeFmt.dayLabel(sel.start), style: const TextStyle(fontWeight: FontWeight.w800, color: OrbitColors.accent)),
            ],
            const Spacer(),
            const Text('← → biraj · Enter gledaj · Esc zatvori', style: TextStyles.tiny),
            const SizedBox(width: 10),
            IconButton(onPressed: () => setState(() => _panel = _Panel.none), icon: const Icon(Icons.close_rounded)),
          ]),
        ),
        Expanded(
          child: list.isEmpty
              ? const Center(child: Text('Učitavam program…', style: TextStyles.muted))
              : ListView.separated(
                  controller: _guideScroll,
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(40, 4, 40, 22),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const SizedBox(width: _guideGap),
                  itemBuilder: (_, i) {
                    final p = list[i];
                    final live = p.isLiveAt(now);
                    final past = p.isPastAt(now);
                    final watching = p.isLiveAt(head);
                    final selected = i == _guideIndex;
                    return SizedBox(
                      width: _guideCardW,
                      child: MouseRegion(
                        cursor: SystemMouseCursors.click,
                        onEnter: (_) => setState(() => _guideIndex = i),
                        child: GestureDetector(
                          onTap: () => _playFromGuide(p),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            decoration: BoxDecoration(
                              color: selected ? OrbitColors.surfaceHigher : OrbitColors.surface.o(0.8),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: selected ? OrbitColors.accent : Colors.transparent, width: 3),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              AspectRatio(
                                aspectRatio: 16 / 9,
                                child: Stack(fit: StackFit.expand, children: [
                                  if (c != null) Opacity(opacity: past || live ? 1 : 0.55, child: ProgramThumb(channel: c, program: p)),
                                  if (live) const Positioned(left: 8, top: 8, child: LiveBadge(small: true)),
                                  if (past && (c?.hasArchive ?? false))
                                    Positioned(
                                      left: 8,
                                      top: 8,
                                      child: Container(
                                        padding: const EdgeInsets.all(4),
                                        decoration: BoxDecoration(color: Colors.black.o(0.7), borderRadius: BorderRadius.circular(6)),
                                        child: const Icon(Icons.history_rounded, size: 14, color: OrbitColors.accent),
                                      ),
                                    ),
                                  if (watching)
                                    Positioned(
                                      right: 8,
                                      top: 8,
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                        decoration: BoxDecoration(color: OrbitColors.accent, borderRadius: BorderRadius.circular(6)),
                                        child: const Text('GLEDAŠ', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: OrbitColors.onAccent, letterSpacing: 0.6)),
                                      ),
                                    ),
                                  if (live) Positioned(left: 0, right: 0, bottom: 0, child: ProgressLine(p.progressAt(now), height: 4)),
                                ]),
                              ),
                              Padding(
                                padding: const EdgeInsets.fromLTRB(11, 9, 11, 0),
                                child: Text(TimeFmt.range(p.start, p.end), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: live ? OrbitColors.accent : OrbitColors.textMuted)),
                              ),
                              Padding(
                                padding: const EdgeInsets.fromLTRB(11, 3, 11, 0),
                                child: Text(p.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700)),
                              ),
                            ]),
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ]),
    );
  }

  Widget _drawerPanel() {
    final list = _list;
    final now = DateTime.now().toUtc();
    final title = e.zapList.isNotEmpty && list.isNotEmpty ? s.catalog.categoryName(list.first.categoryId) : 'Svi kanali';
    return GlassPanel(
      opacity: 0.86,
      border: false,
      child: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 12, 12),
            child: Row(children: [
              Container(width: 4, height: 22, decoration: BoxDecoration(color: OrbitColors.accent, borderRadius: BorderRadius.circular(2))),
              const SizedBox(width: 12),
              Expanded(child: Text(title.isEmpty ? 'Kanali' : title, style: TextStyles.h2, maxLines: 1, overflow: TextOverflow.ellipsis)),
              IconButton(onPressed: () => setState(() => _panel = _Panel.none), icon: const Icon(Icons.close_rounded)),
            ]),
          ),
          Expanded(
            child: ListView.builder(
              controller: _drawerScroll,
              itemExtent: _drawerItemH,
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
              itemCount: list.length,
              itemBuilder: (_, i) {
                final ch = list[i];
                s.epg.ensureNow(ch);
                final p = s.epg.at(ch.id, now);
                final current = ch.id == e.channel?.id;
                final sel = i == _drawerIndex;
                return GestureDetector(
                  onTap: () => _playFromDrawer(ch),
                  child: MouseRegion(
                    cursor: SystemMouseCursors.click,
                    onEnter: (_) => setState(() => _drawerIndex = i),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: sel ? OrbitColors.accent.o(0.16) : (current ? Colors.white.o(0.06) : Colors.transparent),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: sel ? OrbitColors.accent : Colors.transparent, width: 2),
                      ),
                      child: Row(children: [
                        SizedBox(width: 36, child: Text('${ch.number}', textAlign: TextAlign.right, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: current ? OrbitColors.accent : OrbitColors.textMuted))),
                        const SizedBox(width: 12),
                        ChannelLogo(name: ch.name, url: ch.logo, size: 46),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Flexible(child: Text(ch.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800))),
                              if (current) const Padding(padding: EdgeInsets.only(left: 8), child: Icon(Icons.graphic_eq_rounded, size: 16, color: OrbitColors.accent)),
                            ]),
                            const SizedBox(height: 2),
                            Text(p?.title ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.small),
                            if (p != null) ...[const SizedBox(height: 5), ProgressLine(p.progressAt(now), height: 2.5)],
                          ]),
                        ),
                      ]),
                    ),
                  ),
                );
              },
            ),
          ),
          const Padding(padding: EdgeInsets.fromLTRB(24, 4, 24, 16), child: Text('↑ ↓ biraj · Enter gledaj · Esc zatvori', style: TextStyles.tiny)),
        ]),
      ),
    );
  }

  Widget _tracksPanel() {
    final tracks = e.player.state.tracks;
    final sel = e.player.state.track;
    final audio = tracks.audio.where((t) => t.id != 'no' && t.id != 'auto').toList();
    final subs = tracks.subtitle.where((t) => t.id != 'no' && t.id != 'auto').toList();
    String name(String? title, String? lang, int i) {
      final parts = [if (title != null && title.isNotEmpty) title, if (lang != null && lang.isNotEmpty) lang.toUpperCase()];
      return parts.isEmpty ? 'Zapis ${i + 1}' : parts.join(' · ');
    }

    Widget option(String label, bool active, VoidCallback onTap) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          margin: const EdgeInsets.only(bottom: 4),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(color: active ? OrbitColors.accent.o(0.14) : Colors.transparent, borderRadius: BorderRadius.circular(10)),
          child: Row(children: [
            Icon(active ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded, size: 19, color: active ? OrbitColors.accent : OrbitColors.textDim),
            const SizedBox(width: 12),
            Expanded(child: Text(label, style: TextStyle(fontWeight: active ? FontWeight.w800 : FontWeight.w500))),
          ]),
        ),
      );
    }

    return GlassPanel(
      opacity: 0.86,
      border: false,
      child: SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(18, 24, 18, 24), children: [
          Row(children: [
            const Expanded(child: Text('Zvuk i slika', style: TextStyles.h2)),
            IconButton(onPressed: () => setState(() => _panel = _Panel.none), icon: const Icon(Icons.close_rounded)),
          ]),
          const SizedBox(height: 12),
          const Text('ZVUK', style: TextStyles.label),
          const SizedBox(height: 6),
          if (audio.isEmpty) const Padding(padding: EdgeInsets.all(12), child: Text('Samo jedan zvučni zapis', style: TextStyles.small)),
          for (var i = 0; i < audio.length; i++) option(name(audio[i].title, audio[i].language, i), sel.audio.id == audio[i].id, () => e.setAudio(audio[i])),
          const SizedBox(height: 16),
          const Text('TITLOVI', style: TextStyles.label),
          const SizedBox(height: 6),
          option('Bez titlova', sel.subtitle.id == 'no' || subs.isEmpty, () => e.setSubtitle(SubtitleTrack.no())),
          for (var i = 0; i < subs.length; i++) option(name(subs[i].title, subs[i].language, i), sel.subtitle.id == subs[i].id, () => e.setSubtitle(subs[i])),
          const SizedBox(height: 16),
          const Text('FORMAT SLIKE', style: TextStyles.label),
          const SizedBox(height: 6),
          for (final a in const [('auto', 'Automatski'), ('16:9', '16:9'), ('4:3', '4:3'), ('zoom', 'Popuni ekran (zoom)'), ('stretch', 'Razvuci')]) option(a.$2, _aspect == a.$1, () => _setAspect(a.$1)),
        ]),
      ),
    );
  }
}

class _Spinner extends StatelessWidget {
  const _Spinner();
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: Colors.black.o(0.5), shape: BoxShape.circle),
      child: const SizedBox(width: 42, height: 42, child: CircularProgressIndicator(strokeWidth: 4, color: OrbitColors.accent)),
    );
  }
}

class _RoundButton extends StatefulWidget {
  const _RoundButton({required this.icon, required this.tooltip, required this.onTap, this.big = false, this.active = false});
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final bool big;
  final bool active;
  @override
  State<_RoundButton> createState() => _RoundButtonState();
}

class _RoundButtonState extends State<_RoundButton> {
  bool _hover = false;
  @override
  Widget build(BuildContext context) {
    final size = widget.big ? 66.0 : 48.0;
    final yellow = widget.big || widget.active;
    return Tooltip(
      message: widget.tooltip,
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        onEnter: (_) => setState(() => _hover = true),
        onExit: (_) => setState(() => _hover = false),
        child: GestureDetector(
          onTap: widget.onTap,
          child: AnimatedScale(
            scale: _hover ? 1.08 : 1.0,
            duration: const Duration(milliseconds: 140),
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: yellow ? OrbitColors.accent : Colors.white.o(_hover ? 0.24 : 0.13),
                border: yellow ? null : Border.all(color: Colors.white.o(0.10)),
              ),
              child: Icon(widget.icon, size: widget.big ? 38 : 25, color: yellow ? OrbitColors.onAccent : Colors.white),
            ),
          ),
        ),
      ),
    );
  }
}

class _PillButton extends StatefulWidget {
  const _PillButton({required this.label, required this.icon, required this.onTap, this.color});
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final Color? color;
  @override
  State<_PillButton> createState() => _PillButtonState();
}

class _PillButtonState extends State<_PillButton> {
  bool _hover = false;
  @override
  Widget build(BuildContext context) {
    final c = widget.color;
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 18),
          decoration: BoxDecoration(
            color: c != null ? c.o(_hover ? 0.32 : 0.2) : Colors.white.o(_hover ? 0.24 : 0.13),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: (c ?? Colors.white).o(c != null ? 0.7 : 0.12)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(widget.icon, size: 18, color: c ?? Colors.white),
            const SizedBox(width: 8),
            Text(widget.label, style: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.3)),
          ]),
        ),
      ),
    );
  }
}

class _VolumeControl extends StatelessWidget {
  const _VolumeControl({required this.engine, this.compact = false});
  final PlayerEngine engine;
  final bool compact;
  @override
  Widget build(BuildContext context) {
    final v = engine.player.state.volume;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      IconButton(
        tooltip: 'Zvuk (M, + / −, točkić miša)',
        onPressed: () => engine.setVolume(v > 0 ? 0 : 100),
        icon: Icon(v <= 0 ? Icons.volume_off_rounded : (v < 50 ? Icons.volume_down_rounded : Icons.volume_up_rounded)),
      ),
      if (!compact)
      SizedBox(
        width: 110,
        child: SliderTheme(
          data: SliderTheme.of(context).copyWith(trackHeight: 3, thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7), overlayShape: SliderComponentShape.noOverlay),
          child: Slider(value: v.clamp(0, 100).toDouble(), min: 0, max: 100, activeColor: OrbitColors.accent, onChanged: (x) => engine.setVolume(x)),
        ),
      ),
    ]);
  }
}
