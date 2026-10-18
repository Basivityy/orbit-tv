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
import '../util/time_fmt.dart';
import 'engine.dart';
import 'timeline.dart';
import 'widgets/seek_bar.dart';

/// Full-window player with EON-style controls: programme timeline with live edge, start-over,
/// rewind of a programme that is still running, skip with frame previews, channel list.
class PlayerScreen extends StatefulWidget {
  const PlayerScreen({super.key});
  static bool isOpen = false;
  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  final s = AppServices.I;
  PlayerEngine get e => s.engine;
  final _focus = FocusNode(debugLabel: 'player');
  DateTime _osdUntil = DateTime.now().add(const Duration(seconds: 5));
  Timer? _osdTimer;
  bool _drawer = false;
  bool _tracks = false;
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
  static const _drawerItemH = 72.0;

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
    _focus.dispose();
    if (_fullscreen) defaultExitNativeFullscreen();
    if (s.signedIn) s.engine.stop();
    super.dispose();
  }

  bool get _osdVisible => _drawer || _tracks || _mouseScrub || _scrubMs != null || !e.playing || DateTime.now().isBefore(_osdUntil);

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

  void _close() {
    if (_drawer || _tracks) {
      setState(() {
        _drawer = false;
        _tracks = false;
      });
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

  void _openDrawer() {
    final list = _list;
    final i = e.channel == null ? 0 : list.indexWhere((c) => c.id == e.channel!.id);
    setState(() {
      _drawer = true;
      _tracks = false;
      _drawerIndex = i < 0 ? 0 : i;
    });
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
    setState(() => _drawer = false);
    _poke();
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
      _poke();
    });
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
    if (_drawer) {
      if (k == LogicalKeyboardKey.arrowUp) {
        _drawerMove(-1);
      } else if (k == LogicalKeyboardKey.arrowDown) {
        _drawerMove(1);
      } else if (k == LogicalKeyboardKey.pageUp) {
        _drawerMove(-8);
      } else if (k == LogicalKeyboardKey.pageDown) {
        _drawerMove(8);
      } else if (k == LogicalKeyboardKey.enter || k == LogicalKeyboardKey.numpadEnter || k == LogicalKeyboardKey.select) {
        final list = _list;
        if (list.isNotEmpty) _playFromDrawer(list[_drawerIndex.clamp(0, list.length - 1)]);
      } else if (k == LogicalKeyboardKey.arrowLeft || k == LogicalKeyboardKey.arrowRight) {
        setState(() => _drawer = false);
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
        e.zap(1);
        return KeyEventResult.handled;
      }
      if (k == LogicalKeyboardKey.arrowDown || k == LogicalKeyboardKey.pageDown || k == LogicalKeyboardKey.channelDown) {
        e.zap(-1);
        return KeyEventResult.handled;
      }
      if (k == LogicalKeyboardKey.enter || k == LogicalKeyboardKey.numpadEnter || k == LogicalKeyboardKey.select || k == LogicalKeyboardKey.keyL) {
        if (!repeat) _openDrawer();
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
      if (k == LogicalKeyboardKey.enter || k == LogicalKeyboardKey.numpadEnter || k == LogicalKeyboardKey.select) {
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
      if (!repeat) setState(() => _tracks = !_tracks);
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
            return MouseRegion(
              cursor: osd ? SystemMouseCursors.basic : SystemMouseCursors.none,
              onHover: (_) => _poke(),
              child: Listener(
                onPointerSignal: (sig) {
                  if (sig is PointerScrollEvent) {
                    e.setVolume(e.player.state.volume + (sig.scrollDelta.dy < 0 ? 5 : -5));
                    _poke();
                  }
                },
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    if (_drawer || _tracks) {
                      setState(() {
                        _drawer = false;
                        _tracks = false;
                      });
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
                    // Top bar
                    Positioned(left: 0, right: 0, top: 0, child: _fade(osd, _topBar())),
                    // Bottom panel
                    Positioned(left: 0, right: 0, bottom: 0, child: _fade(osd, _bottomPanel())),
                    if (e.visibleToast != null)
                      Positioned(
                        top: 110,
                        left: 0,
                        right: 0,
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                            decoration: BoxDecoration(color: Colors.black.o(0.72), borderRadius: BorderRadius.circular(30)),
                            child: Text(e.visibleToast!, style: const TextStyle(fontWeight: FontWeight.w600)),
                          ),
                        ),
                      ),
                    if (_digits.isNotEmpty)
                      Positioned(
                        top: 40,
                        right: 50,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                          decoration: BoxDecoration(color: Colors.black.o(0.75), borderRadius: BorderRadius.circular(14), border: Border.all(color: OrbitColors.cyan)),
                          child: Text(_digits, style: const TextStyle(fontSize: 44, fontWeight: FontWeight.w800, letterSpacing: 4)),
                        ),
                      ),
                    // Channel list drawer
                    AnimatedPositioned(
                      duration: const Duration(milliseconds: 220),
                      curve: Curves.easeOutCubic,
                      left: _drawer ? 0 : -460,
                      top: 0,
                      bottom: 0,
                      width: 440,
                      child: _drawerPanel(),
                    ),
                    // Audio / subtitles / picture
                    AnimatedPositioned(
                      duration: const Duration(milliseconds: 220),
                      curve: Curves.easeOutCubic,
                      right: _tracks ? 0 : -400,
                      top: 0,
                      bottom: 0,
                      width: 380,
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
      color: Colors.black.o(0.7),
      child: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.portable_wifi_off_rounded, size: 54, color: OrbitColors.textMuted),
          const SizedBox(height: 14),
          const Text('Program se ne može učitati', style: TextStyles.h2),
          const SizedBox(height: 8),
          ConstrainedBox(constraints: const BoxConstraints(maxWidth: 460), child: Text(e.error ?? '', textAlign: TextAlign.center, style: TextStyles.muted)),
          const SizedBox(height: 20),
          Row(mainAxisSize: MainAxisSize.min, children: [
            ElevatedButton.icon(onPressed: e.retryAfterError, icon: const Icon(Icons.refresh_rounded), label: const Text('Pokušaj ponovo')),
            const SizedBox(width: 12),
            if (e.isTv) OutlinedButton.icon(onPressed: _openDrawer, icon: const Icon(Icons.list_rounded), label: const Text('Drugi kanal')),
            const SizedBox(width: 12),
            OutlinedButton(onPressed: () => Navigator.of(context).maybePop(), child: const Text('Nazad')),
          ]),
        ]),
      ),
    );
  }

  Widget _topBar() {
    final c = e.channel;
    final p = e.program;
    final now = e.now;
    return Container(
      padding: const EdgeInsets.fromLTRB(28, 22, 28, 60),
      decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xCC000000), Color(0x00000000)])),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        _RoundButton(icon: Icons.arrow_back_rounded, tooltip: 'Nazad (Esc)', onTap: () => Navigator.of(context).maybePop()),
        const SizedBox(width: 18),
        if (e.isTv && c != null) ...[
          ChannelLogo(name: c.name, url: c.logo, size: 56),
          const SizedBox(width: 16),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text('${c.number}  ', style: const TextStyle(fontWeight: FontWeight.w800, color: OrbitColors.textMuted)),
                Flexible(child: Text(c.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: OrbitColors.textMuted))),
                const SizedBox(width: 12),
                if (e.atLiveEdge) const LiveBadge() else Pill(e.kind == PlayKind.archive && p != null && p.isPastAt(now) ? 'ARHIVA' : 'UNAZAD ${TimeFmt.clock(e.behindLive)}', icon: Icons.history_rounded, color: OrbitColors.cyan),
              ]),
              const SizedBox(height: 4),
              Text(p?.title ?? 'Nema podataka o programu', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
              if (p != null) Text('${TimeFmt.dayLabel(p.start)} · ${TimeFmt.range(p.start, p.end)}', style: TextStyles.muted),
            ]),
          ),
        ] else
          Expanded(
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
        const SizedBox(width: 16),
        const ClockText(style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
      ]),
    );
  }

  Widget _bottomPanel() {
    final m = _model();
    final now = e.now;
    final c = e.channel;
    final p = e.program;
    final playing = e.playing;
    final skip = s.prefs.settings.skipSeconds;
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
    return Container(
      padding: const EdgeInsets.fromLTRB(36, 80, 36, 26),
      decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x00000000), Color(0xE6000000)])),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (m != null) ...[
          Row(children: [
            Text(leftLabel, style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: [ui.FontFeature.tabularFigures()])),
            const Spacer(),
            if (headLabel.isNotEmpty) Text(headLabel, style: const TextStyle(fontWeight: FontWeight.w700, color: OrbitColors.cyan, fontFeatures: [ui.FontFeature.tabularFigures()])),
            const Spacer(),
            Text(rightLabel, style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: [ui.FontFeature.tabularFigures()])),
          ]),
          const SizedBox(height: 4),
          SeekBar(
            model: m,
            scrubMs: _scrubMs,
            onSeek: _seekMs,
            onScrubbing: (v) => setState(() => _mouseScrub = v),
            previewBuilder: _preview,
          ),
          const SizedBox(height: 10),
        ],
        ExcludeFocus(
          child: Row(children: [
            if (e.isTv) ...[
              _RoundButton(icon: Icons.skip_previous_rounded, tooltip: 'Prethodna emisija', onTap: e.previousProgram),
              const SizedBox(width: 10),
              _RoundButton(icon: Icons.replay_rounded, tooltip: 'Od početka (Home)', onTap: e.restartProgram, enabled: c?.hasArchive ?? false),
              const SizedBox(width: 10),
            ],
            _RoundButton(icon: Icons.replay_10_rounded, tooltip: '−$skip s (←)', onTap: () => e.skip(Duration(seconds: -skip))),
            const SizedBox(width: 10),
            _RoundButton(icon: playing ? Icons.pause_rounded : Icons.play_arrow_rounded, tooltip: playing ? 'Pauza (Space)' : 'Nastavi (Space)', onTap: e.togglePlay, big: true),
            const SizedBox(width: 10),
            _RoundButton(icon: Icons.forward_10_rounded, tooltip: '+$skip s (→)', onTap: () => e.skip(Duration(seconds: skip))),
            if (e.isTv) ...[
              const SizedBox(width: 10),
              _RoundButton(icon: Icons.skip_next_rounded, tooltip: 'Sljedeća emisija', onTap: e.nextProgram),
            ],
            if (e.kind == PlayKind.episode && e.nextEpisode != null) ...[
              const SizedBox(width: 10),
              _RoundButton(icon: Icons.skip_next_rounded, tooltip: 'Sljedeća epizoda', onTap: () => e.playEpisode(e.series!, e.nextEpisode!, e.episodes)),
            ],
            const SizedBox(width: 18),
            if (e.isTv && !e.atLiveEdge)
              _PillButton(label: 'UŽIVO', icon: Icons.fiber_manual_record_rounded, color: OrbitColors.live, onTap: e.goLive),
            if (e.isTv && p != null && e.atLiveEdge && (c?.hasArchive ?? false))
              _PillButton(label: 'Od početka', icon: Icons.replay_rounded, onTap: e.restartProgram),
            const Spacer(),
            _VolumeControl(engine: e),
            const SizedBox(width: 10),
            if (e.isTv) ...[
              _RoundButton(icon: Icons.list_rounded, tooltip: 'Kanali (Enter)', onTap: _openDrawer),
              const SizedBox(width: 10),
              _RoundButton(
                icon: (c != null && s.prefs.isFavorite(c.id)) ? Icons.star_rounded : Icons.star_outline_rounded,
                tooltip: 'Omiljeni',
                onTap: () {
                  if (c != null) s.prefs.toggleFavorite(c.id);
                  setState(() {});
                },
              ),
              const SizedBox(width: 10),
            ],
            _RoundButton(icon: Icons.tune_rounded, tooltip: 'Zvuk, titlovi i slika (A)', onTap: () => setState(() => _tracks = !_tracks)),
            const SizedBox(width: 10),
            _RoundButton(icon: _fullscreen ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded, tooltip: 'Cijeli ekran (F)', onTap: _toggleFullscreen),
          ]),
        ),
        if (e.isTv && now.difference(e.playhead) > const Duration(minutes: 1) && p != null)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text('Gledaš sa zakašnjenjem ${TimeFmt.clock(e.behindLive)} · ← → premotavanje · End = uživo', style: TextStyles.tiny),
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
        border: Border.all(color: Colors.white.o(0.85), width: 2),
        boxShadow: [BoxShadow(color: Colors.black.o(0.6), blurRadius: 20)],
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
                    child: Center(
                      child: c != null ? ChannelLogo(name: c.name, url: c.logo, size: 64, background: false) : const Icon(Icons.movie_rounded, color: OrbitColors.textDim, size: 40),
                    ),
                  ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 7, 10, 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
            if (title != null) Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.small),
          ]),
        ),
      ]),
    );
  }

  Widget _drawerPanel() {
    final list = _list;
    final now = DateTime.now().toUtc();
    final title = e.zapList.isNotEmpty && list.isNotEmpty ? s.catalog.categoryName(list.first.categoryId) : 'Svi kanali';
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [Colors.black.o(0.92), Colors.black.o(0.78)]),
        border: const Border(right: BorderSide(color: OrbitColors.stroke)),
      ),
      child: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 22, 12, 10),
            child: Row(children: [
              Expanded(child: Text(title, style: TextStyles.h2, maxLines: 1, overflow: TextOverflow.ellipsis)),
              IconButton(onPressed: () => setState(() => _drawer = false), icon: const Icon(Icons.close_rounded)),
            ]),
          ),
          Expanded(
            child: ListView.builder(
              controller: _drawerScroll,
              itemExtent: _drawerItemH,
              padding: const EdgeInsets.fromLTRB(10, 0, 10, 20),
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
                        color: sel ? OrbitColors.violet.o(0.30) : (current ? Colors.white.o(0.06) : Colors.transparent),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: sel ? OrbitColors.cyan : Colors.transparent, width: 2),
                      ),
                      child: Row(children: [
                        SizedBox(width: 34, child: Text('${ch.number}', textAlign: TextAlign.right, style: TextStyles.small.copyWith(fontWeight: FontWeight.w700))),
                        const SizedBox(width: 10),
                        ChannelLogo(name: ch.name, url: ch.logo, size: 44),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Flexible(child: Text(ch.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700))),
                              if (current) const Padding(padding: EdgeInsets.only(left: 8), child: Icon(Icons.graphic_eq_rounded, size: 16, color: OrbitColors.cyan)),
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
          const Padding(padding: EdgeInsets.fromLTRB(22, 4, 22, 16), child: Text('↑ ↓ biraj · Enter gledaj · Esc zatvori', style: TextStyles.tiny)),
        ]),
      ),
    );
  }

  Widget _tracksPanel() {
    final tracks = e.player.state.tracks;
    final sel = e.player.state.track;
    final audio = tracks.audio.where((t) => t.id != 'no' && t.id != 'auto').toList();
    final subs = tracks.subtitle.where((t) => t.id != 'no' && t.id != 'auto').toList();
    String name(String id, String? title, String? lang, int i) {
      final parts = [if (title != null && title.isNotEmpty) title, if (lang != null && lang.isNotEmpty) lang.toUpperCase()];
      return parts.isEmpty ? 'Zapis ${i + 1}' : parts.join(' · ');
    }

    Widget option(String label, bool active, VoidCallback onTap) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          child: Row(children: [
            Icon(active ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded, size: 18, color: active ? OrbitColors.cyan : OrbitColors.textDim),
            const SizedBox(width: 12),
            Expanded(child: Text(label, style: TextStyle(fontWeight: active ? FontWeight.w700 : FontWeight.w500))),
          ]),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [Colors.black.o(0.78), Colors.black.o(0.92)]),
        border: const Border(left: BorderSide(color: OrbitColors.stroke)),
      ),
      child: SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 22, 16, 24), children: [
          Row(children: [
            const Expanded(child: Text('Zvuk i slika', style: TextStyles.h2)),
            IconButton(onPressed: () => setState(() => _tracks = false), icon: const Icon(Icons.close_rounded)),
          ]),
          const SizedBox(height: 10),
          const Text('ZVUK', style: TextStyles.label),
          if (audio.isEmpty) const Padding(padding: EdgeInsets.all(12), child: Text('Samo jedan zvučni zapis', style: TextStyles.small)),
          for (var i = 0; i < audio.length; i++) option(name(audio[i].id, audio[i].title, audio[i].language, i), sel.audio.id == audio[i].id, () => e.setAudio(audio[i])),
          const SizedBox(height: 16),
          const Text('TITLOVI', style: TextStyles.label),
          option('Bez titlova', sel.subtitle.id == 'no' || subs.isEmpty, () => e.setSubtitle(SubtitleTrack.no())),
          for (var i = 0; i < subs.length; i++) option(name(subs[i].id, subs[i].title, subs[i].language, i), sel.subtitle.id == subs[i].id, () => e.setSubtitle(subs[i])),
          const SizedBox(height: 16),
          const Text('FORMAT SLIKE', style: TextStyles.label),
          for (final a in const [('auto', 'Automatski'), ('16:9', '16:9'), ('4:3', '4:3'), ('zoom', 'Popuni ekran (zoom)'), ('stretch', 'Razvuci')])
            option(a.$2, _aspect == a.$1, () => _setAspect(a.$1)),
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
      decoration: BoxDecoration(color: Colors.black.o(0.45), shape: BoxShape.circle),
      child: const SizedBox(width: 40, height: 40, child: CircularProgressIndicator(strokeWidth: 3.5, color: OrbitColors.cyan)),
    );
  }
}

class _RoundButton extends StatefulWidget {
  const _RoundButton({required this.icon, required this.tooltip, required this.onTap, this.big = false, this.enabled = true});
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final bool big;
  final bool enabled;
  @override
  State<_RoundButton> createState() => _RoundButtonState();
}

class _RoundButtonState extends State<_RoundButton> {
  bool _hover = false;
  @override
  Widget build(BuildContext context) {
    final size = widget.big ? 64.0 : 48.0;
    return Tooltip(
      message: widget.tooltip,
      child: MouseRegion(
        cursor: widget.enabled ? SystemMouseCursors.click : SystemMouseCursors.basic,
        onEnter: (_) => setState(() => _hover = true),
        onExit: (_) => setState(() => _hover = false),
        child: GestureDetector(
          onTap: widget.enabled ? widget.onTap : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 140),
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: widget.big ? OrbitColors.accentGradient : null,
              color: widget.big ? null : Colors.white.o(_hover ? 0.22 : 0.12),
            ),
            child: Icon(widget.icon, size: widget.big ? 36 : 26, color: widget.enabled ? Colors.white : Colors.white38),
          ),
        ),
      ),
    );
  }
}

class _PillButton extends StatelessWidget {
  const _PillButton({required this.label, required this.icon, required this.onTap, this.color});
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final Color? color;
  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
          decoration: BoxDecoration(color: (color ?? Colors.white).o(0.18), borderRadius: BorderRadius.circular(30), border: Border.all(color: (color ?? Colors.white).o(0.6))),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 16, color: color ?? Colors.white),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.6)),
          ]),
        ),
      ),
    );
  }
}

class _VolumeControl extends StatelessWidget {
  const _VolumeControl({required this.engine});
  final PlayerEngine engine;
  @override
  Widget build(BuildContext context) {
    final v = engine.player.state.volume;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      IconButton(
        onPressed: () => engine.setVolume(v > 0 ? 0 : 100),
        icon: Icon(v <= 0 ? Icons.volume_off_rounded : (v < 50 ? Icons.volume_down_rounded : Icons.volume_up_rounded)),
      ),
      SizedBox(
        width: 120,
        child: SliderTheme(
          data: SliderTheme.of(context).copyWith(trackHeight: 3, thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7), overlayShape: SliderComponentShape.noOverlay),
          child: Slider(value: v.clamp(0, 100).toDouble(), min: 0, max: 100, activeColor: OrbitColors.cyan, onChanged: (x) => engine.setVolume(x)),
        ),
      ),
    ]);
  }
}
