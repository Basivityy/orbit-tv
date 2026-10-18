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
const double _rowH = 82.0;
const double _chanW = 240.0;
const double _headerH = 44.0;

/// TV vodič: channels × time grid with archive, live and upcoming programmes.
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
    final x = _dayOffset == 0 ? _x(now.subtract(const Duration(minutes: 40))) : _x(_dayStart.add(const Duration(hours: 18)));
    _h.animateTo(x.clamp(0.0, _h.position.maxScrollExtent), duration: const Duration(milliseconds: 400), curve: Curves.easeOutCubic);
  }

  List<Channel> _channels() => s.catalog.channelsIn(_cat, favorites: s.prefs.favorites, recent: s.prefs.recentChannels);

  void _openProgram(Channel c, Program p) => showProgramDialog(context, c, p, list: _channels());

  @override
  Widget build(BuildContext context) {
    final width = 24 * 60 * _pxPerMin;
    return ListenableBuilder(
      listenable: Listenable.merge([s.prefs, s.catalog]),
      builder: (context, _) {
        final channels = _channels();
        final days = <int>[for (var d = -7; d <= 1; d++) d];
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          PageHeader(
            title: 'TV vodič',
            subtitle: 'Kanali sa ikonom ⟲ imaju arhivu — prošle emisije možeš gledati.',
            actions: [
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
            ],
          ),
          // Day chips
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: Gap.page),
              children: [
                for (final d in days)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FocusTile(
                      scale: 1.0,
                      radius: 10,
                      onTap: () {
                        setState(() => _dayOffset = d);
                        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToNow());
                      },
                      color: d == _dayOffset ? OrbitColors.violet.o(0.25) : OrbitColors.surface,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      child: Text(TimeFmt.dayLabel(DateTime.now().add(Duration(days: d))), style: TextStyle(fontWeight: d == _dayOffset ? FontWeight.w700 : FontWeight.w500)),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
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
                          padding: const EdgeInsets.only(left: Gap.page - 10),
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
                                        child: FocusTile(
                                          scale: 1.0,
                                          radius: 12,
                                          color: OrbitColors.surface,
                                          onTap: () => playChannel(context, c, list: channels),
                                          padding: const EdgeInsets.symmetric(horizontal: 10),
                                          child: Row(children: [
                                            ChannelLogo(name: c.name, url: c.logo, size: 46),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                                                Text(c.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                                                const SizedBox(height: 3),
                                                Row(children: [
                                                  Text('${c.number}', style: TextStyles.tiny),
                                                  if (c.hasArchive) ...[const SizedBox(width: 6), const Icon(Icons.history_rounded, size: 13, color: OrbitColors.cyan)],
                                                ]),
                                              ]),
                                            ),
                                          ]),
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
                                                onTap: (p) => _openProgram(c, p),
                                              );
                                            },
                                          ),
                                        ),
                                        if (showNow)
                                          Positioned(
                                            left: nowX - 1,
                                            top: 0,
                                            bottom: 0,
                                            child: IgnorePointer(child: Container(width: 2, color: OrbitColors.live)),
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
      },
    );
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
            padding: const EdgeInsets.only(left: 6, top: 12),
            decoration: const BoxDecoration(border: Border(left: BorderSide(color: OrbitColors.stroke))),
            child: Text(TimeFmt.hm(dayStart.add(Duration(minutes: m))), style: TextStyles.small.copyWith(fontWeight: FontWeight.w600)),
          ),
        ),
      if (nowX != null)
        Positioned(
          left: nowX! - 22,
          top: 8,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: BoxDecoration(color: OrbitColors.live, borderRadius: BorderRadius.circular(6)),
            child: Text(TimeFmt.hm(DateTime.now()), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
          ),
        ),
    ]);
  }
}

class _EpgRow extends StatelessWidget {
  const _EpgRow({required this.channel, required this.programs, required this.dayStart, required this.now, required this.onTap});
  final Channel channel;
  final List<Program> programs;
  final DateTime dayStart;
  final DateTime now;
  final void Function(Program) onTap;

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
            final w = math.max(4.0, end.difference(start).inSeconds / 60 * _pxPerMin - 3);
            final live = p.isLiveAt(now);
            final past = p.isPastAt(now);
            final playable = past && channel.hasArchive && (archiveFrom == null || p.start.isAfter(archiveFrom));
            return Positioned(
              left: left,
              top: 0,
              bottom: 0,
              width: w,
              child: _ProgramTile(channel: channel, program: p, live: live, past: past, playable: playable, width: w, now: now, onTap: () => onTap(p)),
            );
          }),
      ]),
    );
  }
}

class _ProgramTile extends StatelessWidget {
  const _ProgramTile({required this.channel, required this.program, required this.live, required this.past, required this.playable, required this.width, required this.now, required this.onTap});
  final Channel channel;
  final Program program;
  final bool live, past, playable;
  final double width;
  final DateTime now;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final showThumb = width >= 230;
    final textColor = past && !playable ? OrbitColors.textDim : OrbitColors.text;
    return Tooltip(
      message: '${program.title}\n${TimeFmt.range(program.start, program.end)}',
      waitDuration: const Duration(milliseconds: 700),
      child: FocusTile(
        onTap: onTap,
        scale: 1.0,
        radius: 10,
        color: live ? OrbitColors.surfaceHigh : (past ? OrbitColors.surface.o(0.55) : OrbitColors.surface),
        selected: live,
        child: Stack(children: [
          Row(children: [
            if (showThumb)
              Padding(
                padding: const EdgeInsets.all(6),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(7),
                  child: SizedBox(width: (_rowH - 18) * 16 / 9, child: Opacity(opacity: past && !playable ? 0.45 : 1, child: ProgramThumb(channel: channel, program: program))),
                ),
              ),
            Expanded(
              child: Padding(
                padding: EdgeInsets.fromLTRB(showThumb ? 4 : 10, 8, 8, 8),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(program.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: textColor, height: 1.2)),
                  const SizedBox(height: 4),
                  Row(children: [
                    if (playable) const Padding(padding: EdgeInsets.only(right: 4), child: Icon(Icons.history_rounded, size: 13, color: OrbitColors.cyan)),
                    Flexible(child: Text(TimeFmt.range(program.start, program.end), maxLines: 1, overflow: TextOverflow.clip, style: TextStyles.tiny)),
                  ]),
                ]),
              ),
            ),
          ]),
          if (live) Positioned(left: 0, right: 0, bottom: 0, child: ProgressLine(program.progressAt(now), height: 3)),
        ]),
      ),
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
      const MapEntry(Cat.favorites, 'Omiljeni'),
      const MapEntry(Cat.recent, 'Nedavno gledano'),
      const MapEntry(Cat.all, 'Svi kanali'),
      ...s.catalog.liveCategories.map((c) => MapEntry(c.id, c.name)),
    ];
    return PopupMenuButton<String>(
      tooltip: 'Kategorija',
      color: OrbitColors.surfaceHigh,
      onSelected: onChanged,
      itemBuilder: (_) => [for (final e in items) PopupMenuItem(value: e.key, child: Text(e.value))],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(border: Border.all(color: OrbitColors.stroke), borderRadius: BorderRadius.circular(12)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.filter_list_rounded, size: 18),
          const SizedBox(width: 8),
          ConstrainedBox(constraints: const BoxConstraints(maxWidth: 220), child: Text(s.catalog.categoryName(value), overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600))),
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
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            child: AspectRatio(
              aspectRatio: 21 / 9,
              child: Stack(fit: StackFit.expand, children: [
                ProgramThumb(channel: channel, program: program),
                const DecoratedBox(decoration: BoxDecoration(gradient: OrbitColors.bottomFade)),
                Positioned(left: 20, bottom: 16, child: ChannelLogo(name: channel.name, url: channel.logo, size: 56)),
                if (live) const Positioned(right: 18, top: 16, child: LiveBadge()),
              ]),
            ),
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
                if (live)
                  ElevatedButton.icon(
                    autofocus: true,
                    onPressed: () => Navigator.pop(context, 'live'),
                    icon: const Icon(Icons.play_arrow_rounded),
                    label: const Text('Gledaj uživo'),
                  ),
                if (live && playable)
                  OutlinedButton.icon(
                    onPressed: () => Navigator.pop(context, 'archive'),
                    icon: const Icon(Icons.replay_rounded),
                    label: const Text('Od početka'),
                  ),
                if (past && playable)
                  ElevatedButton.icon(
                    autofocus: true,
                    onPressed: () => Navigator.pop(context, 'archive'),
                    icon: const Icon(Icons.history_rounded),
                    label: const Text('Gledaj iz arhive'),
                  ),
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
