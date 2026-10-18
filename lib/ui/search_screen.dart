import 'package:flutter/material.dart';

import '../app/services.dart';
import '../app/theme.dart';
import '../data/catalog.dart';
import '../data/models.dart';
import 'epg_screen.dart';
import 'nav.dart';
import 'series_screen.dart';
import 'vod_screen.dart';
import 'widgets/common.dart';
import 'widgets/tv_widgets.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});
  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final s = AppServices.I;
  String _q = '';

  @override
  void initState() {
    super.initState();
    s.catalog.loadVod();
    s.catalog.loadSeries();
  }

  /// Programmes (already loaded EPG) whose title matches — running or upcoming today, or in the archive.
  List<(Channel, Program)> _programs() {
    final f = Catalog.fold(_q);
    if (f.length < 3) return const [];
    final now = DateTime.now().toUtc();
    final out = <(Channel, Program)>[];
    for (final c in s.catalog.channels) {
      for (final p in s.epg.programs(c.id)) {
        if (p.end.isBefore(now.subtract(const Duration(days: 7))) || p.start.isAfter(now.add(const Duration(days: 1)))) continue;
        if (Catalog.fold(p.title).contains(f)) out.add((c, p));
      }
      if (out.length > 60) break;
    }
    out.sort((a, b) => (a.$2.start.difference(now).abs()).compareTo(b.$2.start.difference(now).abs()));
    return out.take(30).toList();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([s.catalog, s.epg]),
      builder: (context, _) {
        final channels = s.catalog.searchChannels(_q, limit: 30);
        final programs = _programs();
        final vod = s.catalog.searchVod(_q, limit: 30);
        final series = s.catalog.searchSeries(_q, limit: 30);
        final now = DateTime.now().toUtc();
        final empty = _q.isNotEmpty && channels.isEmpty && programs.isEmpty && vod.isEmpty && series.isEmpty;
        return CustomScrollView(slivers: [
          const SliverToBoxAdapter(child: PageHeader(title: 'Pretraga')),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Gap.page, 0, Gap.page, 26),
              child: TextField(
                autofocus: true,
                style: const TextStyle(fontSize: 20),
                decoration: const InputDecoration(hintText: 'Kanal, emisija, film ili serija…', prefixIcon: Icon(Icons.search_rounded, size: 26)),
                onChanged: (v) => setState(() => _q = v.trim()),
              ),
            ),
          ),
          if (_q.isEmpty)
            const SliverFillRemaining(hasScrollBody: false, child: MessageView(icon: Icons.manage_search_rounded, title: 'Šta želiš gledati?', text: 'Upiši naziv kanala, emisije, filma ili serije.'))
          else if (empty)
            const SliverFillRemaining(hasScrollBody: false, child: MessageView(icon: Icons.search_off_rounded, title: 'Ništa nije pronađeno'))
          else ...[
            SliverToBoxAdapter(
              child: SectionRow(
                title: 'Kanali',
                itemCount: channels.length,
                height: 248,
                itemWidth: 300,
                itemBuilder: (c, i) {
                  final ch = channels[i];
                  s.epg.ensureNow(ch);
                  return ProgramCard(channel: ch, program: s.epg.at(ch.id, now), onTap: () => playChannel(c, ch));
                },
              ),
            ),
            SliverToBoxAdapter(
              child: SectionRow(
                title: 'Emisije',
                itemCount: programs.length,
                height: 248,
                itemWidth: 300,
                itemBuilder: (c, i) {
                  final (ch, p) = programs[i];
                  return ProgramCard(channel: ch, program: p, onTap: () => showProgramDialog(c, ch, p));
                },
              ),
            ),
            SliverToBoxAdapter(
              child: SectionRow(
                title: 'Filmovi',
                itemCount: vod.length,
                height: 300,
                itemWidth: 170,
                itemBuilder: (c, i) {
                  final v = vod[i];
                  return PosterCard(title: v.name, image: v.poster, rating: v.rating, onTap: () => Navigator.of(c).push(MaterialPageRoute<void>(builder: (_) => VodDetailScreen(item: v))));
                },
              ),
            ),
            SliverToBoxAdapter(
              child: SectionRow(
                title: 'Serije',
                itemCount: series.length,
                height: 300,
                itemWidth: 170,
                itemBuilder: (c, i) {
                  final v = series[i];
                  return PosterCard(title: v.name, image: v.cover, rating: v.rating, onTap: () => Navigator.of(c).push(MaterialPageRoute<void>(builder: (_) => SeriesDetailScreen(series: v))));
                },
              ),
            ),
          ],
        ]);
      },
    );
  }
}
