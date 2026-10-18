import 'package:flutter/material.dart';

import '../app/services.dart';
import '../app/theme.dart';
import '../data/catalog.dart';
import '../data/models.dart';
import '../util/time_fmt.dart';
import 'nav.dart';
import 'widgets/common.dart';
import 'widgets/tv_widgets.dart';

/// TV uživo: categories | channels | details of the selected channel (now, next, earlier today).
class LiveScreen extends StatefulWidget {
  const LiveScreen({super.key});
  @override
  State<LiveScreen> createState() => _LiveScreenState();
}

class _LiveScreenState extends State<LiveScreen> {
  final s = AppServices.I;
  String _cat = Cat.all;
  Channel? _selected;
  String _filter = '';
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    if (s.prefs.favorites.isNotEmpty) _cat = Cat.favorites;
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  List<Channel> _channels() {
    var list = s.catalog.channelsIn(_cat, favorites: s.prefs.favorites, recent: s.prefs.recentChannels);
    if (_filter.isNotEmpty) {
      final f = Catalog.fold(_filter);
      list = list.where((c) => Catalog.fold(c.name).contains(f) || '${c.number}' == f).toList();
    }
    return list;
  }

  void _select(Channel c) {
    if (_selected?.id == c.id) return;
    setState(() => _selected = c);
    s.epg.ensureFull(c);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([s.prefs, s.catalog]),
      builder: (context, _) {
        final channels = _channels();
        final sel = _selected ?? (channels.isNotEmpty ? channels.first : null);
        if (_selected == null && sel != null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted && _selected == null) _select(sel);
          });
        }
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          PageHeader(title: 'TV uživo', subtitle: '${s.catalog.channels.length} kanala'),
          Expanded(
            child: LayoutBuilder(builder: (context, box) {
              // Narrow windows: slimmer lists so the details column keeps its room.
              final narrow = box.maxWidth < 1150;
              return Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              // Categories
              SizedBox(
                width: narrow ? 210 : 250,
                child: FocusTraversalGroup(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(Gap.page - 8, 0, 8, 24),
                    children: [
                      _CatTile(label: 'Omiljeni', icon: Icons.star_rounded, active: _cat == Cat.favorites, count: s.prefs.favorites.length, onTap: () => setState(() => _cat = Cat.favorites)),
                      _CatTile(label: 'Nedavno gledano', icon: Icons.history_toggle_off_rounded, active: _cat == Cat.recent, count: s.prefs.recentChannels.length, onTap: () => setState(() => _cat = Cat.recent)),
                      _CatTile(label: 'Svi kanali', icon: Icons.apps_rounded, active: _cat == Cat.all, count: s.catalog.channels.length, onTap: () => setState(() => _cat = Cat.all)),
                      const Padding(padding: EdgeInsets.fromLTRB(12, 18, 12, 8), child: Text('KATEGORIJE', style: TextStyles.label)),
                      for (final c in s.catalog.liveCategories)
                        _CatTile(label: c.name, active: _cat == c.id, count: s.catalog.channelsIn(c.id).length, onTap: () => setState(() => _cat = c.id)),
                    ],
                  ),
                ),
              ),
              // Channels
              SizedBox(
                width: narrow ? 340 : 420,
                child: Column(children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(8, 0, 16, 10),
                    child: TextField(
                      decoration: const InputDecoration(hintText: 'Traži kanal ili broj', prefixIcon: Icon(Icons.search_rounded), isDense: true),
                      onChanged: (v) => setState(() => _filter = v.trim()),
                    ),
                  ),
                  Expanded(
                    child: channels.isEmpty
                        ? MessageView(
                            icon: _cat == Cat.favorites ? Icons.star_outline_rounded : Icons.tv_off_rounded,
                            title: _cat == Cat.favorites ? 'Još nema omiljenih' : 'Nema kanala',
                            text: _cat == Cat.favorites ? 'Otvori kanal i klikni zvjezdicu da ga dodaš ovdje.' : null,
                          )
                        : ListenableBuilder(
                            listenable: s.epg,
                            builder: (context, _) => Ticker(
                              builder: (_) {
                                final now = DateTime.now().toUtc();
                                return Scrollbar(
                                  controller: _scroll,
                                  child: ListView.builder(
                                    controller: _scroll,
                                    padding: const EdgeInsets.fromLTRB(8, 0, 16, 24),
                                    itemCount: channels.length,
                                    itemExtent: 76,
                                    itemBuilder: (c, i) {
                                      final ch = channels[i];
                                      s.epg.ensureNow(ch);
                                      return Padding(
                                        padding: const EdgeInsets.only(bottom: 4),
                                        child: ChannelRow(
                                          channel: ch,
                                          now: s.epg.at(ch.id, now),
                                          selected: sel?.id == ch.id,
                                          favorite: s.prefs.isFavorite(ch.id),
                                          onFocus: (v) {
                                            if (v) _select(ch);
                                          },
                                          onTap: () {
                                            if (sel?.id == ch.id) {
                                              playChannel(c, ch, list: channels);
                                            } else {
                                              _select(ch);
                                            }
                                          },
                                          onDoubleTap: () => playChannel(c, ch, list: channels),
                                        ),
                                      );
                                    },
                                  ),
                                );
                              },
                            ),
                          ),
                  ),
                ]),
              ),
              // Details
              Expanded(
                child: sel == null ? const SizedBox.shrink() : _ChannelDetails(channel: sel, list: channels),
              ),
            ]);
            }),
          ),
        ]);
      },
    );
  }
}

class _CatTile extends StatelessWidget {
  const _CatTile({required this.label, required this.active, required this.onTap, this.icon, this.count});
  final String label;
  final bool active;
  final VoidCallback onTap;
  final IconData? icon;
  final int? count;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: FocusTile(
        onTap: onTap,
        scale: 1.0,
        radius: 10,
        color: active ? OrbitColors.violet.o(0.2) : Colors.transparent,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(children: [
          if (icon != null) ...[Icon(icon, size: 18, color: active ? OrbitColors.cyan : OrbitColors.textMuted), const SizedBox(width: 10)],
          Expanded(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, fontWeight: active ? FontWeight.w700 : FontWeight.w500, color: active ? OrbitColors.text : OrbitColors.textMuted))),
          if (count != null) Text('$count', style: TextStyles.tiny),
        ]),
      ),
    );
  }
}

class _ChannelDetails extends StatelessWidget {
  const _ChannelDetails({required this.channel, required this.list});
  final Channel channel;
  final List<Channel> list;

  @override
  Widget build(BuildContext context) {
    final s = AppServices.I;
    return ListenableBuilder(
      listenable: Listenable.merge([s.epg, s.prefs]),
      builder: (context, _) => Ticker(
        builder: (_) {
          final now = DateTime.now().toUtc();
          final cur = s.epg.at(channel.id, now);
          final upcoming = s.epg.programs(channel.id).where((p) => p.start.isAfter(now)).take(5).toList();
          final dayStart = TimeFmt.startOfDay(DateTime.now()).toUtc();
          final earlier = channel.hasArchive ? s.epg.programs(channel.id).where((p) => p.end.isBefore(now) && p.end.isAfter(dayStart)).toList().reversed.take(8).toList() : <Program>[];
          final fav = s.prefs.isFavorite(channel.id);
          return ListView(
            padding: const EdgeInsets.fromLTRB(8, 0, Gap.page, 32),
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Stack(fit: StackFit.expand, children: [
                    ProgramThumb(channel: channel, program: cur),
                    const DecoratedBox(decoration: BoxDecoration(gradient: OrbitColors.bottomFade)),
                    Positioned(
                      left: 18,
                      bottom: 16,
                      right: 18,
                      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                        ChannelLogo(name: channel.name, url: channel.logo, size: 58),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Text('${channel.number}  ', style: TextStyles.small.copyWith(fontWeight: FontWeight.w700)),
                              Flexible(child: Text(channel.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.h3)),
                              const SizedBox(width: 10),
                              const LiveBadge(small: true),
                            ]),
                            const SizedBox(height: 4),
                            Text(cur?.title ?? 'Nema programa', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.h2),
                          ]),
                        ),
                      ]),
                    ),
                    if (cur != null) Positioned(left: 0, right: 0, bottom: 0, child: ProgressLine(cur.progressAt(now), height: 4, background: Colors.black45)),
                  ]),
                ),
              ),
              const SizedBox(height: 16),
              if (cur != null) ...[
                Text('${TimeFmt.range(cur.start, cur.end)} · još ${TimeFmt.humanMinutes(cur.end.difference(now))}', style: TextStyles.muted),
                if (cur.description.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(cur.description, maxLines: 4, overflow: TextOverflow.ellipsis, style: TextStyles.body.copyWith(color: OrbitColors.textMuted)),
                ],
                const SizedBox(height: 16),
              ],
              Wrap(spacing: 10, runSpacing: 10, children: [
                ElevatedButton.icon(onPressed: () => playChannel(context, channel, list: list), icon: const Icon(Icons.play_arrow_rounded), label: const Text('Gledaj')),
                if (cur != null && channel.hasArchive)
                  OutlinedButton.icon(onPressed: () => playArchive(context, channel, cur.start, list: list), icon: const Icon(Icons.replay_rounded), label: const Text('Od početka')),
                OutlinedButton.icon(
                  onPressed: () => s.prefs.toggleFavorite(channel.id),
                  icon: Icon(fav ? Icons.star_rounded : Icons.star_outline_rounded, color: fav ? OrbitColors.warning : null),
                  label: Text(fav ? 'U omiljenim' : 'Dodaj u omiljene'),
                ),
              ]),
              if (upcoming.isNotEmpty) ...[
                const SizedBox(height: 26),
                const Text('SLIJEDI', style: TextStyles.label),
                const SizedBox(height: 8),
                for (final p in upcoming) _ProgramLine(program: p, onTap: null),
              ],
              if (earlier.isNotEmpty) ...[
                const SizedBox(height: 22),
                const Text('RANIJE DANAS · GLEDAJ IZ ARHIVE', style: TextStyles.label),
                const SizedBox(height: 8),
                for (final p in earlier) _ProgramLine(program: p, archive: true, onTap: () => playArchive(context, channel, p.start, list: list)),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _ProgramLine extends StatelessWidget {
  const _ProgramLine({required this.program, required this.onTap, this.archive = false});
  final Program program;
  final VoidCallback? onTap;
  final bool archive;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: FocusTile(
        onTap: onTap,
        scale: 1.0,
        radius: 10,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        child: Row(children: [
          SizedBox(width: 54, child: Text(TimeFmt.hm(program.start), style: const TextStyle(fontWeight: FontWeight.w700, color: OrbitColors.textMuted))),
          Expanded(child: Text(program.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14))),
          if (archive) const Icon(Icons.play_circle_outline_rounded, size: 20, color: OrbitColors.cyan),
        ]),
      ),
    );
  }
}
