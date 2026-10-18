import 'dart:async';

import 'package:flutter/material.dart';

import '../app/services.dart';
import '../app/theme.dart';
import '../data/catalog.dart';
import '../data/models.dart';
import '../data/prefs.dart';
import '../util/time_fmt.dart';
import 'nav.dart';
import 'series_screen.dart';
import 'vod_screen.dart';
import 'widgets/common.dart';
import 'widgets/tv_widgets.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.onNavigate});
  final ValueChanged<int> onNavigate;
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final s = AppServices.I;
  Timer? _later;

  @override
  void initState() {
    super.initState();
    // Movies/series lists are big: load them a moment after the home screen is up.
    _later = Timer(const Duration(seconds: 3), () {
      if (!s.signedIn) return;
      s.catalog.loadVod();
      s.catalog.loadSeries();
    });
  }

  @override
  void dispose() {
    _later?.cancel();
    super.dispose();
  }

  List<Channel> _recent() => s.catalog.channelsIn(Cat.recent, recent: s.prefs.recentChannels);
  List<Channel> _favorites() => s.catalog.channelsIn(Cat.favorites, favorites: s.prefs.favorites);

  List<Channel> _nowOnTv() {
    final cats = s.catalog.liveCategories;
    final list = cats.isEmpty ? s.catalog.channels : s.catalog.channelsIn(cats.first.id);
    return list.take(24).toList();
  }

  Future<void> _resume(ResumePoint r) async {
    final cat = s.catalog;
    switch (r.kind) {
      case 'catchup':
        final ch = cat.channel(asInt(r.payload['channel']) ?? -1);
        final start = asInt(r.payload['start']);
        if (ch != null && start != null) {
          await playArchive(context, ch, DateTime.fromMillisecondsSinceEpoch(start, isUtc: true).add(r.position));
        }
        break;
      case 'vod':
        await cat.loadVod();
        final id = asInt(r.payload['id']);
        final v = cat.vod.where((x) => x.id == id).firstOrNull;
        if (v != null && mounted) await playVod(context, v, from: r.position);
        break;
      case 'episode':
        await cat.loadSeries();
        final sid = asInt(r.payload['series']);
        final eid = asInt(r.payload['episode']);
        final series = cat.series.where((x) => x.id == sid).firstOrNull;
        if (series == null) return;
        final info = await s.api.seriesInfo(series.id);
        if (info == null || !mounted) return;
        final all = info.seasons.expand((x) => info.episodes[x] ?? const <Episode>[]).toList();
        final e = all.where((x) => x.id == eid).firstOrNull;
        if (e != null) await playEpisode(context, series, e, all, from: r.position);
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([s.prefs, s.epg, s.catalog]),
      builder: (context, _) {
        final recent = _recent();
        final favs = _favorites();
        final nowTv = _nowOnTv();
        s.epg.prefetchNow([...recent.take(12), ...favs.take(12), ...nowTv]);
        final now = DateTime.now().toUtc();
        final heroChannel = recent.isNotEmpty ? recent.first : (nowTv.isNotEmpty ? nowTv.first : null);
        final resume = s.prefs.continueWatching();
        return Ticker(
          period: const Duration(seconds: 30),
          builder: (_) => CustomScrollView(slivers: [
            SliverToBoxAdapter(
              child: heroChannel == null ? const PageHeader(title: 'Početna') : _Hero(channel: heroChannel, program: s.epg.at(heroChannel.id, now)),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 26)),
            SliverToBoxAdapter(
              child: SectionRow(
                title: 'Nastavi gledanje',
                itemCount: resume.length,
                height: 248,
                itemWidth: 300,
                itemBuilder: (_, i) => _ResumeCard(r: resume[i], onTap: () => _resume(resume[i])),
              ),
            ),
            SliverToBoxAdapter(child: _channelRow('Nedavno gledani kanali', recent, now)),
            SliverToBoxAdapter(child: _channelRow('Omiljeni kanali', favs, now)),
            SliverToBoxAdapter(
              child: _channelRow(
                s.catalog.liveCategories.isEmpty ? 'Sada na TV-u' : 'Sada na TV-u · ${s.catalog.liveCategories.first.name}',
                nowTv,
                now,
                trailing: TextButton(onPressed: () => widget.onNavigate(1), child: const Text('Svi kanali')),
              ),
            ),
            SliverToBoxAdapter(
              child: SectionRow(
                title: 'Novi filmovi',
                itemCount: s.catalog.vod.isEmpty ? 0 : 20,
                height: 300,
                itemWidth: 170,
                trailing: TextButton(onPressed: () => widget.onNavigate(3), child: const Text('Svi filmovi')),
                itemBuilder: (c, i) {
                  final list = s.catalog.latestVod(20);
                  if (i >= list.length) return const SizedBox.shrink();
                  final v = list[i];
                  return PosterCard(title: v.name, image: v.poster, rating: v.rating, onTap: () => Navigator.of(c).push(MaterialPageRoute<void>(builder: (_) => VodDetailScreen(item: v))));
                },
              ),
            ),
            SliverToBoxAdapter(
              child: SectionRow(
                title: 'Serije',
                itemCount: s.catalog.series.isEmpty ? 0 : 20,
                height: 300,
                itemWidth: 170,
                trailing: TextButton(onPressed: () => widget.onNavigate(4), child: const Text('Sve serije')),
                itemBuilder: (c, i) {
                  final list = s.catalog.latestSeries(20);
                  if (i >= list.length) return const SizedBox.shrink();
                  final v = list[i];
                  return PosterCard(title: v.name, image: v.cover, rating: v.rating, subtitle: v.year.isEmpty ? null : v.year, onTap: () => Navigator.of(c).push(MaterialPageRoute<void>(builder: (_) => SeriesDetailScreen(series: v))));
                },
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ]),
        );
      },
    );
  }

  Widget _channelRow(String title, List<Channel> list, DateTime now, {Widget? trailing}) {
    return SectionRow(
      title: title,
      itemCount: list.length,
      height: 248,
      itemWidth: 300,
      trailing: trailing,
      itemBuilder: (c, i) {
        final ch = list[i];
        return ProgramCard(channel: ch, program: s.epg.at(ch.id, now), onTap: () => playChannel(c, ch, list: list));
      },
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.channel, required this.program});
  final Channel channel;
  final Program? program;

  @override
  Widget build(BuildContext context) {
    final p = program;
    final now = DateTime.now().toUtc();
    return SizedBox(
      height: 430,
      child: Stack(fit: StackFit.expand, children: [
        ProgramThumb(channel: channel, program: p),
        const DecoratedBox(decoration: BoxDecoration(gradient: OrbitColors.heroFade)),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x0007080F), Color(0x0007080F), OrbitColors.bg], stops: [0, 0.6, 1]),
          ),
        ),
        Positioned(
          left: Gap.page,
          right: Gap.page,
          top: 26,
          child: Row(children: [
            const Text('Početna', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: OrbitColors.textMuted)),
            const Spacer(),
            const ClockText(style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: OrbitColors.textMuted)),
          ]),
        ),
        Positioned(
          left: Gap.page,
          bottom: 40,
          width: 640,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              ChannelLogo(name: channel.name, url: channel.logo, size: 52),
              const SizedBox(width: 14),
              Flexible(child: Text(channel.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: OrbitColors.textMuted))),
              const SizedBox(width: 12),
              const LiveBadge(),
            ]),
            const SizedBox(height: 16),
            Text(p?.title ?? channel.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyles.display),
            if (p != null) ...[
              const SizedBox(height: 10),
              Text('${TimeFmt.range(p.start, p.end)} · još ${TimeFmt.humanMinutes(p.end.difference(now))}', style: TextStyles.muted),
              const SizedBox(height: 10),
              SizedBox(width: 360, child: ProgressLine(p.progressAt(now), height: 4)),
              if (p.description.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(p.description, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyles.body.copyWith(color: OrbitColors.textMuted)),
              ],
            ],
            const SizedBox(height: 22),
            Row(children: [
              ElevatedButton.icon(
                autofocus: true,
                onPressed: () => playChannel(context, channel),
                icon: const Icon(Icons.play_arrow_rounded),
                label: const Text('Gledaj uživo'),
              ),
              const SizedBox(width: 12),
              if (p != null && channel.hasArchive)
                OutlinedButton.icon(
                  onPressed: () => playArchive(context, channel, p.start),
                  icon: const Icon(Icons.replay_rounded),
                  label: const Text('Od početka'),
                ),
            ]),
          ]),
        ),
      ]),
    );
  }
}

class _ResumeCard extends StatelessWidget {
  const _ResumeCard({required this.r, required this.onTap});
  final ResumePoint r;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final left = r.duration - r.position;
    return FocusTile(
      onTap: onTap,
      color: OrbitColors.surface,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        AspectRatio(
          aspectRatio: 16 / 9,
          child: Stack(fit: StackFit.expand, children: [
            Container(color: OrbitColors.surfaceHigh, child: NetImage(r.image, fit: r.kind == 'catchup' ? BoxFit.contain : BoxFit.cover, cacheWidth: 480)),
            const DecoratedBox(decoration: BoxDecoration(gradient: OrbitColors.bottomFade)),
            const Center(child: Icon(Icons.play_circle_fill_rounded, size: 46, color: Colors.white70)),
            Positioned(left: 0, right: 0, bottom: 0, child: ProgressLine(r.progress, height: 4, background: Colors.black54)),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(r.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.h3),
            const SizedBox(height: 3),
            Text('${r.subtitle} · još ${TimeFmt.humanMinutes(left.isNegative ? Duration.zero : left)}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.small),
          ]),
        ),
      ]),
    );
  }
}
