import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../app/services.dart';
import '../app/theme.dart';
import '../data/catalog.dart';
import '../data/models.dart';
import '../util/time_fmt.dart';
import 'nav.dart';
import 'widgets/common.dart';
import 'widgets/tv_widgets.dart';

const double _pxPerMin = 6.0;
const double _rowH = 74.0;
const double _chanW = 132.0;
const double _headerH = 40.0;

/// TV vodič (EON style): the selected programme on top (picture, text, actions),
/// channels × time grid below with archive, live and upcoming programmes.
class EpgScreen extends StatefulWidget {
  const EpgScreen({super.key});
  @override
  State<EpgScreen> createState() => _EpgScreenState();
}

class _EpgScreenState extends State<EpgScreen> {
  final s = AppServices.I;
  String _cat = Cat.all;
  int _dayOffset = 0;
  final _vChannels = ScrollController();
  final _vRows = ScrollController();
  final _h = ScrollController();
  final _hHeader = ScrollController();
  bool _syncV = false, _syncH = false;

  (Channel, Program)? _sel;
  (Channel, Program)? _hover;
  Timer? _hoverT;

  @override
  void initState() {
    super.initState();
    if (s.prefs.favorites.isNotEmpty) _cat = Cat.favorites;
    _vRows.addListener(() => _sync(_vRows, _vChannels, true));
    _vChannels.addListener(() => _sync(_vChannels, _vRows, true));
    _h.addListener(() => _sync(_h, _hHeader, false));
    _hHeader.addListener(() => _sync(_hHeader, _h, false));
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToNow());
  }

  void _sync(ScrollController from, ScrollController to, bool vertical) {
    if (vertical ? _syncV : _syncH) return;
    if (!to.hasClients || !from.hasClients) return;
    if (vertical) {
      _syncV = true;
    } else {
      _syncH = true;
    }
    final target = from.offset.clamp(0.0, to.position.maxScrollExtent);
    if ((to.offset - target).abs() > 0.5) to.jumpTo(target);
    if (vertical) {
      _syncV = false;
    } else {
      _syncH = false;
    }
  }

  @override
  void dispose() {
    _hoverT?.cancel();
    _vChannels.dispose();
    _vRows.dispose();
    _h.dispose();
    _hHeader.dispose();
    super.dispose();
  }

  DateTime get _dayStart => TimeFmt.startOfDay(DateTime.now()).add(Duration(days: _dayOffset)).toUtc();
  DateTime get _dayEnd => _dayStart.add(const Duration(hours: 24));

  double _x(DateTime t) => t.difference(_dayStart).inSeconds / 60.0 * _pxPerMin;

  void _scrollToNow() {
    if (!_h.hasClients) return;
    final now = DateTime.now().toUtc();
    final x = _dayOffset == 0 ? _x(now.subtract(const Duration(minutes: 45))) : _x(_dayStart.add(const Duration(hours: 18)));
    _h.animateTo(x.clamp(0.0, _h.position.maxScrollExtent), duration: const Duration(milliseconds: 400), curve: Curves.easeOutCubic);
  }

  List<Channel> _channels() => s.catalog.channelsIn(_cat, favorites: s.prefs.favorites);

  void _onHover((Channel, Program)? v) {
    _hoverT?.cancel();
    _hoverT = Timer(const Duration(milliseconds: 140), () {
      if (mounted) setState(() => _hover = v);
    });
  }

  void _tap(Channel c, Program p) {
    final same = _sel != null && _sel!.$1.id == c.id && _sel!.$2.key == p.key;
    if (same) {
      _play(c, p);
    } else {
      setState(() => _sel = (c, p));
    }
  }

  void _play(Channel c, Program p) {
    final now = DateTime.now().toUtc();
    if (p.isLiveAt(now) || p.start.isAfter(now)) {
      playChannel(context, c, list: _channels());
    } else if (c.hasArchive) {
      playArchive(context, c, p.start, list: _channels());
    } else {
      playChannel(context, c, list: _channels());
    }
  }

  @override
  Widget build(BuildContext context) {
    const width = 24 * 60 * _pxPerMin;
    return ListenableBuilder(
      listenable: Listenable.merge([s.prefs, s.catalog]),
      builder: (context, _) {
        final channels = _channels();
        final days = <int>[for (var d = -7; d <= 1; d++) d];
        return LayoutBuilder(builder: (context, box) {
          final previewH = (box.maxHeight * 0.38).clamp(220.0, 340.0);
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            // Selected programme
            SizedBox(
              height: previewH,
              child: ListenableBuilder(
                listenable: s.epg,
                builder: (context, _) {
                  final now = DateTime.now().toUtc();
                  var shown = _hover ?? _sel;
                  if (shown == null && channels.isNotEmpty) {
                    final c = channels.first;
                    final p = s.epg.at(c.id, now);
                    if (p != null) shown = (c, p);
                  }
                  if (shown == null) return const SizedBox.shrink();
                  final (sc, sp) = shown;
                  return _GuidePreview(channel: sc, program: sp, onPlay: () => _play(sc, sp), onStartOver: () => playArchive(context, sc, sp.start, list: channels));
                },
              ),
            ),
            // Days, category, now
            Padding(
              padding: const EdgeInsets.fromLTRB(0, 6, Gap.page, 12),
              child: Row(children: [
                Expanded(
                  child: ChipBar(
                    items: [for (final d in days) ('$d', TimeFmt.dayLabel(DateTime.now().add(Duration(days: d))))],
                    selected: '$_dayOffset',
                    onSelect: (v) {
                      setState(() => _dayOffset = int.parse(v));
                      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToNow());
                    },
                  ),
                ),
                const SizedBox(width: 12),
                _CategoryMenu(value: _cat, onChanged: (v) => setState(() => _cat = v)),
                const SizedBox(width: 10),
                OutlinedButton.icon(
                  onPressed: () {
                    setState(() => _dayOffset = 0);
                    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToNow());
                  },
                  icon: const Icon(Icons.my_location_rounded, size: 18),
                  label: const Text('Sada'),
                ),
              ]),
            ),
            Expanded(
              child: channels.isEmpty
                  ? const MessageView(icon: Icons.view_timeline_rounded, title: 'Nema kanala u ovoj listi')
                  : ListenableBuilder(
                      listenable: s.epg,
                      builder: (context, _) => Ticker(
                        period: const Duration(seconds: 30),
                        builder: (_) {
                          final now = DateTime.now().toUtc();
                          final nowX = _x(now);
                          final showNow = now.isAfter(_dayStart) && now.isBefore(_dayEnd);
                          return Padding(
                            padding: const EdgeInsets.only(left: Gap.page - 12),
                            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                              // Channel column
                              SizedBox(
                                width: _chanW,
                                child: Column(children: [
                                  const SizedBox(height: _headerH),
                                  Expanded(
                                    child: ListView.builder(
                                      controller: _vChannels,
                                      itemExtent: _rowH,
                                      itemCount: channels.length,
                                      itemBuilder: (_, i) {
                                        final c = channels[i];
                                        return Padding(
                                          padding: const EdgeInsets.only(right: 8, bottom: 6),
                                          child: Tooltip(
                                            message: '${c.number}  ${c.name}',
                                            waitDuration: const Duration(milliseconds: 600),
                                            child: FocusTile(
                                              scale: 1.0,
                                              radius: 10,
                                              color: OrbitColors.surfaceHigh,
                                              onTap: () => playChannel(context, c, list: channels),
                                              child: Stack(children: [
                                                Positioned.fill(
                                                  child: Padding(
                                                    padding: const EdgeInsets.fromLTRB(22, 10, 22, 10),
                                                    child: NetImage(c.logo, fit: BoxFit.contain, cacheWidth: 200, placeholder: Center(child: Text(c.name, maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)))),
                                                  ),
                                                ),
                                                Positioned(left: 7, top: 5, child: Text('${c.number}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: OrbitColors.textMuted))),
                                                if (c.hasArchive) const Positioned(right: 6, bottom: 5, child: Icon(Icons.history_rounded, size: 13, color: OrbitColors.accent)),
                                              ]),
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                                ]),
                              ),
                              // Time grid
                              Expanded(
                                child: Column(children: [
                                  SizedBox(
                                    height: _headerH,
                                    child: SingleChildScrollView(
                                      controller: _hHeader,
                                      scrollDirection: Axis.horizontal,
                                      child: SizedBox(width: width, child: _TimeHeader(dayStart: _dayStart, nowX: showNow ? nowX : null)),
                                    ),
                                  ),
                                  Expanded(
                                    child: SingleChildScrollView(
                                      controller: _h,
                                      scrollDirection: Axis.horizontal,
                                      child: SizedBox(
                                        width: width,
                                        child: Stack(children: [
                                          Positioned.fill(
                                            child: ListView.builder(
                                              controller: _vRows,
                                              itemExtent: _rowH,
                                              itemCount: channels.length,
                                              itemBuilder: (_, i) {
                                                final c = channels[i];
                                                s.epg.ensureFull(c, urgent: false);
                                                return _EpgRow(
                                                  channel: c,
                                                  programs: s.epg.between(c.id, _dayStart, _dayEnd),
                                                  dayStart: _dayStart,
                                                  now: now,
                                                  selectedKey: _sel?.$1.id == c.id ? _sel?.$2.key : null,
                                                  onTap: (p) => _tap(c, p),
                                                  onHover: (p) => _onHover(p == null ? null : (c, p)),
                                                );
                                              },
                                            ),
                                          ),
                                          if (showNow)
                                            Positioned(
                                              left: nowX - 1,
                                              top: 0,
                                              bottom: 0,
                                              child: IgnorePointer(child: Container(width: 2, color: OrbitColors.accent)),
                                            ),
                                        ]),
                                      ),
                                    ),
                                  ),
                                ]),
                              ),
                            ]),
                          );
                        },
                      ),
                    ),
            ),
          ]);
        });
      },
    );
  }
}

/// Top of the guide: picture of the selected programme and what can be done with it.
class _GuidePreview extends StatelessWidget {
  const _GuidePreview({required this.channel, required this.program, required this.onPlay, required this.onStartOver});
  final Channel channel;
  final Program program;
  final VoidCallback onPlay;
  final VoidCallback onStartOver;

  @override
  Widget build(BuildContext context) {
    final p = program;
    final now = DateTime.now().toUtc();
    final live = p.isLiveAt(now);
    final past = p.isPastAt(now);
    final archiveFrom = channel.archiveStart(now);
    final playable = channel.hasArchive && (archiveFrom == null || p.start.isAfter(archiveFrom));
    final width = MediaQuery.sizeOf(context).width;
    Widget status;
    if (live) {
      status = const LiveBadge();
    } else if (past) {
      status = Pill(playable ? 'ARHIVA' : 'NIJE U ARHIVI', icon: Icons.history_rounded, color: playable ? OrbitColors.accent : OrbitColors.textMuted);
    } else {
      final mins = p.start.difference(now).inMinutes;
      status = Pill(mins < 60 ? 'POČINJE ZA $mins MIN' : 'USKORO', icon: Icons.schedule_rounded, color: OrbitColors.textMuted);
    }
    return Stack(fit: StackFit.expand, children: [
      // Picture on the right, melting into the background.
      Align(
        alignment: Alignment.centerRight,
        child: FractionallySizedBox(
          widthFactor: 0.6,
          heightFactor: 1,
          child: ShaderMask(
            blendMode: BlendMode.dstIn,
            shaderCallback: (r) => const LinearGradient(colors: [Color(0x00FFFFFF), Color(0xFFFFFFFF)], stops: [0.0, 0.45]).createShader(r),
            child: ShaderMask(
              blendMode: BlendMode.dstIn,
              shaderCallback: (r) => const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF), Color(0x00FFFFFF)], stops: [0, 0.7, 1]).createShader(r),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child: ProgramThumb(key: ValueKey(p.key), channel: channel, program: p, large: true),
              ),
            ),
          ),
        ),
      ),
      Positioned(
        left: Gap.page,
        top: 18,
        bottom: 12,
        width: (width * 0.5).clamp(380.0, 720.0),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
          Row(children: [
            LogoBadge(channel: channel, size: 34),
            const SizedBox(width: 12),
            status,
            const SizedBox(width: 10),
            Flexible(child: Text('${channel.number}  ${channel.name}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, color: OrbitColors.textMuted))),
          ]),
          const SizedBox(height: 12),
          Text(p.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyles.h1),
          const SizedBox(height: 8),
          Text('${TimeFmt.dayLabel(p.start)} · ${TimeFmt.range(p.start, p.end)} · ${TimeFmt.humanMinutes(p.duration)}', style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: OrbitColors.textMuted)),
          if (live) ...[const SizedBox(height: 10), SizedBox(width: 320, child: ProgressLine(p.progressAt(now), height: 4))],
          if (p.description.isNotEmpty) ...[
            const SizedBox(height: 10),
            Flexible(child: Text(p.description, maxLines: 3, overflow: TextOverflow.ellipsis, style: TextStyles.muted)),
          ],
          const SizedBox(height: 14),
          Wrap(spacing: 10, runSpacing: 10, children: [
            if (live) ElevatedButton.icon(onPressed: onPlay, icon: const Icon(Icons.play_arrow_rounded), label: const Text('Gledaj uživo')),
            if (live && playable) OutlinedButton.icon(onPressed: onStartOver, icon: const Icon(Icons.replay_rounded), label: const Text('Od početka')),
            if (past && playable) ElevatedButton.icon(onPressed: onPlay, icon: const Icon(Icons.history_rounded), label: const Text('Gledaj iz arhive')),
            if (!live && !(past && playable)) OutlinedButton.icon(onPressed: onPlay, icon: const Icon(Icons.live_tv_rounded), label: const Text('Gledaj kanal')),
          ]),
        ]),
      ),
    ]);
  }
}

class _TimeHeader extends StatelessWidget {
  const _TimeHeader({required this.dayStart, required this.nowX});
  final DateTime dayStart;
  final double? nowX;
  @override
  Widget build(BuildContext context) {
    return Stack(children: [
      for (var m = 0; m < 24 * 60; m += 30)
        Positioned(
          left: m * _pxPerMin,
          top: 0,
          bottom: 0,
          child: Container(
            padding: const EdgeInsets.only(left: 8, top: 10),
            decoration: BoxDecoration(border: Border(left: BorderSide(color: m % 60 == 0 ? OrbitColors.stroke : OrbitColors.stroke.o(0.5)))),
            child: Text(TimeFmt.hm(dayStart.add(Duration(minutes: m))), style: TextStyle(fontSize: 13, fontWeight: m % 60 == 0 ? FontWeight.w800 : FontWeight.w600, color: m % 60 == 0 ? OrbitColors.text : OrbitColors.textMuted)),
          ),
        ),
      if (nowX != null)
        Positioned(
          left: nowX! - 26,
          top: 6,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
            decoration: BoxDecoration(color: OrbitColors.accent, borderRadius: BorderRadius.circular(6)),
            child: Text(TimeFmt.hm(DateTime.now()), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: OrbitColors.onAccent)),
          ),
        ),
    ]);
  }
}

class _EpgRow extends StatelessWidget {
  const _EpgRow({required this.channel, required this.programs, required this.dayStart, required this.now, required this.onTap, required this.onHover, this.selectedKey});
  final Channel channel;
  final List<Program> programs;
  final DateTime dayStart;
  final DateTime now;
  final void Function(Program) onTap;
  final void Function(Program?) onHover;
  final String? selectedKey;

  @override
  Widget build(BuildContext context) {
    final dayEnd = dayStart.add(const Duration(hours: 24));
    final archiveFrom = channel.archiveStart(now);
    if (programs.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Container(
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.only(left: 16),
          decoration: BoxDecoration(color: OrbitColors.surface.o(0.5), borderRadius: BorderRadius.circular(10)),
          child: const Text('Nema programa', style: TextStyles.small),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Stack(children: [
        for (final p in programs)
          Builder(builder: (context) {
            final start = p.start.isBefore(dayStart) ? dayStart : p.start;
            final end = p.end.isAfter(dayEnd) ? dayEnd : p.end;
            final left = start.difference(dayStart).inSeconds / 60 * _pxPerMin;
            final w = math.max(4.0, end.difference(start).inSeconds / 60 * _pxPerMin - 4);
            final live = p.isLiveAt(now);
            final past = p.isPastAt(now);
            final playable = past && channel.hasArchive && (archiveFrom == null || p.start.isAfter(archiveFrom));
            return Positioned(
              left: left,
              top: 0,
              bottom: 0,
              width: w,
              child: MouseRegion(
                onEnter: (_) => onHover(p),
                onExit: (_) => onHover(null),
                child: _ProgramTile(program: p, live: live, past: past, playable: playable, selected: p.key == selectedKey, now: now, onTap: () => onTap(p), onFocus: (v) => onHover(v ? p : null)),
              ),
            );
          }),
      ]),
    );
  }
}

class _ProgramTile extends StatelessWidget {
  const _ProgramTile({required this.program, required this.live, required this.past, required this.playable, required this.selected, required this.now, required this.onTap, required this.onFocus});
  final Program program;
  final bool live, past, playable, selected;
  final DateTime now;
  final VoidCallback onTap;
  final ValueChanged<bool> onFocus;

  @override
  Widget build(BuildContext context) {
    final textColor = past && !playable ? OrbitColors.textDim : OrbitColors.text;
    final bg = selected ? OrbitColors.accent.o(0.16) : (live ? OrbitColors.surfaceHigher : (past ? OrbitColors.surface.o(0.7) : OrbitColors.surfaceHigh));
    return FocusTile(
      onTap: onTap,
      onFocus: onFocus,
      scale: 1.0,
      radius: 10,
      color: bg,
      selected: selected,
      child: Stack(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(11, 8, 8, 8),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(program.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, fontWeight: live ? FontWeight.w800 : FontWeight.w600, color: textColor)),
            const SizedBox(height: 4),
            Row(children: [
              if (playable) const Padding(padding: EdgeInsets.only(right: 4), child: Icon(Icons.history_rounded, size: 13, color: OrbitColors.accent)),
              if (live) const Padding(padding: EdgeInsets.only(right: 5), child: Icon(Icons.circle, size: 8, color: OrbitColors.live)),
              Flexible(child: Text(TimeFmt.range(program.start, program.end), maxLines: 1, overflow: TextOverflow.clip, style: TextStyles.tiny.copyWith(color: OrbitColors.textMuted))),
            ]),
          ]),
        ),
        if (live) Positioned(left: 0, right: 0, bottom: 0, child: ProgressLine(program.progressAt(now), height: 3)),
      ]),
    );
  }
}

class _CategoryMenu extends StatelessWidget {
  const _CategoryMenu({required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) {
    final s = AppServices.I;
    final items = <MapEntry<String, String>>[
      const MapEntry(Cat.all, 'Svi kanali'),
      const MapEntry(Cat.favorites, 'Omiljeni'),
      ...s.catalog.liveCategories.map((c) => MapEntry(c.id, c.name)),
    ];
    return PopupMenuButton<String>(
      tooltip: 'Kategorija',
      onSelected: onChanged,
      itemBuilder: (_) => [for (final e in items) PopupMenuItem(value: e.key, child: Text(e.value))],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(color: Colors.white.o(0.08), border: Border.all(color: Colors.white.o(0.14)), borderRadius: BorderRadius.circular(12)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.filter_list_rounded, size: 18),
          const SizedBox(width: 8),
          ConstrainedBox(constraints: const BoxConstraints(maxWidth: 200), child: Text(s.catalog.categoryName(value), overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700))),
          const Icon(Icons.expand_more_rounded),
        ]),
      ),
    );
  }
}

/// Shows [ProgramDialog] and starts what the viewer picked.
Future<void> showProgramDialog(BuildContext context, Channel c, Program p, {List<Channel>? list}) async {
  final action = await showDialog<String>(context: context, builder: (_) => ProgramDialog(channel: c, program: p));
  if (!context.mounted) return;
  if (action == 'live') await playChannel(context, c, list: list);
  if (action == 'archive') await playArchive(context, c, p.start, list: list);
}

/// Details of a programme with the right actions (live / start over / archive / upcoming).
class ProgramDialog extends StatelessWidget {
  const ProgramDialog({super.key, required this.channel, required this.program});
  final Channel channel;
  final Program program;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now().toUtc();
    final live = program.isLiveAt(now);
    final past = program.isPastAt(now);
    final archiveFrom = channel.archiveStart(now);
    final playable = channel.hasArchive && (archiveFrom == null || program.start.isAfter(archiveFrom));
    return Dialog(
      backgroundColor: OrbitColors.bgElevated,
      insetPadding: const EdgeInsets.all(40),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      clipBehavior: Clip.antiAlias,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            AspectRatio(
              aspectRatio: 21 / 9,
              child: Stack(fit: StackFit.expand, children: [
                ProgramThumb(channel: channel, program: program, large: true),
                const DecoratedBox(decoration: BoxDecoration(gradient: OrbitColors.bottomFade)),
                Positioned(left: 20, bottom: 16, child: LogoBadge(channel: channel, size: 40)),
                if (live) const Positioned(right: 18, top: 16, child: LiveBadge()),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 18, 24, 24),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(program.title, style: TextStyles.h1),
                const SizedBox(height: 6),
                Text('${channel.name} · ${TimeFmt.dayLabel(program.start)} ${TimeFmt.range(program.start, program.end)} · ${TimeFmt.humanMinutes(program.duration)}', style: TextStyles.muted),
                if (live) ...[const SizedBox(height: 10), ProgressLine(program.progressAt(now), height: 4)],
                if (program.description.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  ConstrainedBox(constraints: const BoxConstraints(maxHeight: 160), child: SingleChildScrollView(child: Text(program.description, style: TextStyles.body.copyWith(color: OrbitColors.textMuted)))),
                ],
                const SizedBox(height: 22),
                Wrap(spacing: 10, runSpacing: 10, children: [
                  if (live) ElevatedButton.icon(autofocus: true, onPressed: () => Navigator.pop(context, 'live'), icon: const Icon(Icons.play_arrow_rounded), label: const Text('Gledaj uživo')),
                  if (live && playable) OutlinedButton.icon(onPressed: () => Navigator.pop(context, 'archive'), icon: const Icon(Icons.replay_rounded), label: const Text('Od početka')),
                  if (past && playable) ElevatedButton.icon(autofocus: true, onPressed: () => Navigator.pop(context, 'archive'), icon: const Icon(Icons.history_rounded), label: const Text('Gledaj iz arhive')),
                  if (past && !playable) const Pill('Ova emisija nije u arhivi', icon: Icons.info_outline_rounded),
                  if (!live && !past) Pill('Počinje ${TimeFmt.dayLabel(program.start)} u ${TimeFmt.hm(program.start)}', icon: Icons.schedule_rounded),
                  TextButton(onPressed: () => Navigator.pop(context), child: const Text('Zatvori')),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
