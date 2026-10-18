import 'package:flutter/material.dart';

import '../app/services.dart';
import '../app/theme.dart';
import '../data/catalog.dart';
import '../data/models.dart';
import '../util/time_fmt.dart';
import 'nav.dart';
import 'vod_screen.dart';
import 'widgets/common.dart';
import 'widgets/tv_widgets.dart';

class SeriesScreen extends StatefulWidget {
  const SeriesScreen({super.key});
  @override
  State<SeriesScreen> createState() => _SeriesScreenState();
}

class _SeriesScreenState extends State<SeriesScreen> {
  final s = AppServices.I;
  String? _cat;
  String _q = '';

  @override
  void initState() {
    super.initState();
    s.catalog.loadSeries();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: s.catalog,
      builder: (context, _) {
        final cat = s.catalog;
        Widget body;
        if (cat.seriesState == LoadState.loading || cat.seriesState == LoadState.idle) {
          body = const LoadingView(message: 'Učitavam serije…');
        } else if (cat.seriesState == LoadState.error) {
          body = MessageView(icon: Icons.cloud_off_rounded, title: 'Serije se nisu učitale', text: cat.seriesError, action: 'Pokušaj ponovo', onAction: () => cat.loadSeries(force: true));
        } else {
          var items = _cat == null ? cat.latestSeries(cat.series.length) : cat.series.where((v) => v.categoryId == _cat).toList();
          if (_q.isNotEmpty) {
            final f = Catalog.fold(_q);
            items = items.where((v) => Catalog.fold(v.name).contains(f)).toList();
          }
          body = CatalogGrid<Series>(
            categories: cat.seriesCategories,
            selected: _cat,
            onCategory: (v) => setState(() => _cat = v),
            items: items,
            itemBuilder: (c, v) => PosterCard(
              title: v.name,
              image: v.cover,
              rating: v.rating,
              subtitle: v.year.isEmpty ? null : v.year,
              onTap: () => Navigator.of(c).push(MaterialPageRoute<void>(builder: (_) => SeriesDetailScreen(series: v))),
            ),
          );
        }
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          PageHeader(
            title: 'Serije',
            subtitle: cat.seriesState == LoadState.ready ? '${cat.series.length} serija' : null,
            actions: [
              SizedBox(width: 280, child: TextField(decoration: const InputDecoration(hintText: 'Traži seriju', prefixIcon: Icon(Icons.search_rounded), isDense: true), onChanged: (v) => setState(() => _q = v.trim()))),
            ],
          ),
          Expanded(child: body),
        ]);
      },
    );
  }
}

class SeriesDetailScreen extends StatefulWidget {
  const SeriesDetailScreen({super.key, required this.series});
  final Series series;
  @override
  State<SeriesDetailScreen> createState() => _SeriesDetailScreenState();
}

class _SeriesDetailScreenState extends State<SeriesDetailScreen> {
  final s = AppServices.I;
  SeriesInfo? _info;
  String? _error;
  int? _season;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final info = await s.api.seriesInfo(widget.series.id);
      if (!mounted) return;
      setState(() {
        _info = info;
        _season = info?.seasons.isNotEmpty == true ? info!.seasons.first : null;
        // Continue in the season of the saved episode.
        final r = s.prefs.resume['ep:${widget.series.id}'];
        final eid = r == null ? null : asInt(r.payload['episode']);
        if (info != null && eid != null) {
          for (final se in info.seasons) {
            if ((info.episodes[se] ?? const []).any((e) => e.id == eid)) _season = se;
          }
        }
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  List<Episode> get _all => _info == null ? const [] : _info!.seasons.expand((x) => _info!.episodes[x] ?? const <Episode>[]).toList();

  @override
  Widget build(BuildContext context) {
    final sr = widget.series;
    final info = _info;
    final eps = info == null || _season == null ? const <Episode>[] : (info.episodes[_season] ?? const <Episode>[]);
    return Scaffold(
      body: ListenableBuilder(
        listenable: s.prefs,
        builder: (context, _) {
          final r = s.prefs.resume['ep:${sr.id}'];
          final resumeId = r == null ? null : asInt(r.payload['episode']);
          final resumeEp = resumeId == null ? null : _all.where((e) => e.id == resumeId).firstOrNull;
          return CustomScrollView(slivers: [
            SliverToBoxAdapter(
              child: SizedBox(
                height: 420,
                child: Stack(fit: StackFit.expand, children: [
                  NetImage(sr.backdrop.isNotEmpty ? sr.backdrop : sr.cover, fit: BoxFit.cover, alignment: Alignment.topCenter),
                  const DecoratedBox(decoration: BoxDecoration(gradient: OrbitColors.heroFade)),
                  const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x6607080F), Color(0x0007080F), OrbitColors.bg], stops: [0, 0.45, 1]))),
                  Positioned(left: Gap.page, top: 26, child: IconButton.filledTonal(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.arrow_back_rounded))),
                  Positioned(
                    left: Gap.page,
                    right: Gap.page,
                    bottom: 20,
                    child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      ClipRRect(borderRadius: BorderRadius.circular(14), child: SizedBox(width: 170, height: 255, child: NetImage(sr.cover, fit: BoxFit.cover, cacheWidth: 340))),
                      const SizedBox(width: 28),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(sr.name, style: TextStyles.display, maxLines: 2, overflow: TextOverflow.ellipsis),
                          const SizedBox(height: 10),
                          Wrap(spacing: 8, children: [
                            if (sr.year.isNotEmpty) Pill(sr.year),
                            if ((sr.rating ?? 0) > 0) Pill(sr.rating!.toStringAsFixed(1), icon: Icons.star_rounded, color: OrbitColors.warning),
                            if (sr.genre.isNotEmpty) Pill(sr.genre),
                            if (info != null) Pill('${info.seasons.length} sezon${info.seasons.length == 1 ? 'a' : 'e'}'),
                          ]),
                          if (sr.plot.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            ConstrainedBox(constraints: const BoxConstraints(maxWidth: 760), child: Text(sr.plot, maxLines: 3, overflow: TextOverflow.ellipsis, style: TextStyles.body.copyWith(color: OrbitColors.textMuted))),
                          ],
                          const SizedBox(height: 18),
                          if (resumeEp != null)
                            ElevatedButton.icon(
                              autofocus: true,
                              onPressed: () => playEpisode(context, sr, resumeEp, _all, from: r!.position),
                              icon: const Icon(Icons.play_arrow_rounded),
                              label: Text('Nastavi S${resumeEp.season} E${resumeEp.number}'),
                            )
                          else if (_all.isNotEmpty)
                            ElevatedButton.icon(
                              autofocus: true,
                              onPressed: () => playEpisode(context, sr, _all.first, _all),
                              icon: const Icon(Icons.play_arrow_rounded),
                              label: const Text('Gledaj prvu epizodu'),
                            ),
                        ]),
                      ),
                    ]),
                  ),
                ]),
              ),
            ),
            if (_error != null)
              SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.all(40), child: MessageView(icon: Icons.cloud_off_rounded, title: 'Epizode se nisu učitale', text: _error, action: 'Pokušaj ponovo', onAction: _load)))
            else if (info == null)
              const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.all(40), child: LoadingView()))
            else ...[
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 50,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: Gap.page),
                    children: [
                      for (final se in info.seasons)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FocusTile(
                            onTap: () => setState(() => _season = se),
                            scale: 1.0,
                            radius: 22,
                            color: se == _season ? OrbitColors.violet.o(0.28) : OrbitColors.surface,
                            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                            child: Text('Sezona $se', style: TextStyle(fontWeight: se == _season ? FontWeight.w700 : FontWeight.w500)),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(Gap.page, 16, Gap.page, 40),
                sliver: SliverList.separated(
                  itemCount: eps.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (c, i) {
                    final e = eps[i];
                    final isResume = resumeId == e.id;
                    return FocusTile(
                      onTap: () => playEpisode(c, sr, e, _all, from: isResume ? r!.position : null),
                      scale: 1.01,
                      color: OrbitColors.surface,
                      padding: const EdgeInsets.all(10),
                      child: Row(children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(9),
                          child: SizedBox(
                            width: 220,
                            height: 124,
                            child: Stack(fit: StackFit.expand, children: [
                              NetImage(e.image.isNotEmpty ? e.image : sr.cover, fit: BoxFit.cover, cacheWidth: 440),
                              const Center(child: Icon(Icons.play_circle_fill_rounded, color: Colors.white70, size: 40)),
                              if (isResume) Positioned(left: 0, right: 0, bottom: 0, child: ProgressLine(r!.progress, height: 4, background: Colors.black54)),
                            ]),
                          ),
                        ),
                        const SizedBox(width: 18),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${e.number}. ${e.title.isNotEmpty ? e.title : 'Epizoda ${e.number}'}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.h3),
                            if (e.duration != null) ...[const SizedBox(height: 4), Text(TimeFmt.humanMinutes(e.duration!), style: TextStyles.small)],
                            if (e.plot.isNotEmpty) ...[const SizedBox(height: 6), Text(e.plot, maxLines: 3, overflow: TextOverflow.ellipsis, style: TextStyles.muted)],
                          ]),
                        ),
                      ]),
                    );
                  },
                ),
              ),
            ],
          ]);
        },
      ),
    );
  }
}
