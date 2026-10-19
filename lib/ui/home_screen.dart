import 'dart:async';
import 'dart:ui' as ui;

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

/// Početna (EON style): big rotating banner of what is on now, then rows.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.onNavigate});
  final ValueChanged<int> onNavigate;
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final s = AppServices.I;
  Timer? _later;
  final Set<int> _fullRequested = {};

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

  List<Channel> _favorites() => s.catalog.channelsIn(Cat.favorites, favorites: s.prefs.favorites);

  /// "Uživo sada": the first category (what the provider puts first), without favourites.
  List<Channel> _nowOnTv() {
    final cats = s.catalog.liveCategories;
    final fav = s.prefs.favorites;
    final base = cats.isEmpty ? s.catalog.channels : s.catalog.channelsIn(cats.first.id);
    final list = base.where((c) => !fav.contains(c.id)).take(24).toList();
    return list.isEmpty ? s.catalog.channels.take(24).toList() : list;
  }

  /// Channels for the banner: favourites first, then the first channels.
  List<Channel> _heroChannels() {
    final out = <Channel>[..._favorites().take(3)];
    for (final c in s.catalog.channels) {
      if (out.length >= 6) break;
      if (!out.any((x) => x.id == c.id)) out.add(c);
    }
    return out;
  }

  /// "Propustili ste": programmes of the last 12 h on archive channels.
  List<(Channel, Program)> _missed(DateTime now) {
    final chans = [..._favorites(), ..._nowOnTv()].where((c) => c.hasArchive).take(8).toList();
    for (final c in chans) {
      if (_fullRequested.add(c.id)) s.epg.ensureFull(c, urgent: false);
    }
    final out = <(Channel, Program)>[];
    for (final c in chans) {
      final list = s.epg.programs(c.id).where((p) => p.isPastAt(now) && p.end.isAfter(now.subtract(const Duration(hours: 12))) && p.duration >= const Duration(minutes: 15)).toList();
      out.addAll(list.reversed.take(3).map((p) => (c, p)));
    }
    out.sort((a, b) => b.$2.end.compareTo(a.$2.end));
    return out.take(20).toList();
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
        final favs = _favorites();
        final nowTv = _nowOnTv();
        final heroCh = _heroChannels();
        s.epg.prefetchNow([...heroCh, ...favs.take(16), ...nowTv]);
        final resume = s.prefs.continueWatching();
        return Ticker(
          period: const Duration(seconds: 30),
          builder: (_) {
            final now = DateTime.now().toUtc();
            final hero = [
              for (final c in heroCh)
                if (s.epg.at(c.id, now) != null) (c, s.epg.at(c.id, now)!),
            ];
            final missed = _missed(now);
            final screenH = MediaQuery.sizeOf(context).height;
            return CustomScrollView(slivers: [
              SliverToBoxAdapter(
                child: SizedBox(
                  height: (screenH * 0.7).clamp(470.0, 760.0),
                  child: hero.isEmpty
                      ? (heroCh.isEmpty ? const SizedBox.shrink() : _HeroBanner(channel: heroCh.first, program: null, onGuide: () => widget.onNavigate(2)))
                      : _HeroCarousel(items: hero, onGuide: () => widget.onNavigate(2)),
                ),
              ),
              SliverToBoxAdapter(
                child: _cardRow(
                  s.catalog.liveCategories.isEmpty ? 'Uživo sada' : 'Uživo sada · ${s.catalog.liveCategories.first.name}',
                  nowTv,
                  now,
                  trailing: TextButton(onPressed: () => widget.onNavigate(1), child: const Text('Svi kanali  ›')),
                ),
              ),
              SliverToBoxAdapter(
                child: SectionRow(
                  title: 'Nastavi gledanje',
                  itemCount: resume.length,
                  height: 252,
                  itemWidth: 320,
                  itemBuilder: (_, i) => _ResumeCard(r: resume[i], onTap: () => _resume(resume[i])),
                ),
              ),
              SliverToBoxAdapter(child: _cardRow('Omiljeni kanali', favs, now)),
              SliverToBoxAdapter(
                child: SectionRow(
                  title: 'Propustili ste',
                  itemCount: missed.length,
                  height: 252,
                  itemWidth: 320,
                  trailing: TextButton(onPressed: () => widget.onNavigate(2), child: const Text('TV vodič  ›')),
                  itemBuilder: (c, i) {
                    final (ch, p) = missed[i];
                    return ProgramCard(
                      channel: ch,
                      program: p,
                      width: 320,
                      subtitle: '${ch.name} · ${TimeFmt.dayLabel(p.start)} ${TimeFmt.hm(p.start)}',
                      onTap: () => playArchive(c, ch, p.start),
                    );
                  },
                ),
              ),
              SliverToBoxAdapter(
                child: SectionRow(
                  title: 'Kanali',
                  itemCount: s.catalog.channels.length.clamp(0, 40),
                  height: 118,
                  itemWidth: 172,
                  trailing: TextButton(onPressed: () => widget.onNavigate(1), child: const Text('Svi  ›')),
                  itemBuilder: (c, i) => _ChannelLogoTile(channel: s.catalog.channels[i], onTap: () => playChannel(c, s.catalog.channels[i], list: s.catalog.channels)),
                ),
              ),
              SliverToBoxAdapter(
                child: SectionRow(
                  title: 'Novi filmovi',
                  itemCount: s.catalog.vod.isEmpty ? 0 : s.catalog.vod.length.clamp(0, 20),
                  height: 318,
                  itemWidth: 180,
                  trailing: TextButton(onPressed: () => widget.onNavigate(3), child: const Text('Svi filmovi  ›')),
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
                  itemCount: s.catalog.series.isEmpty ? 0 : s.catalog.series.length.clamp(0, 20),
                  height: 318,
                  itemWidth: 180,
                  trailing: TextButton(onPressed: () => widget.onNavigate(4), child: const Text('Sve serije  ›')),
                  itemBuilder: (c, i) {
                    final list = s.catalog.latestSeries(20);
                    if (i >= list.length) return const SizedBox.shrink();
                    final v = list[i];
                    return PosterCard(title: v.name, image: v.cover, rating: v.rating, subtitle: v.year.isEmpty ? null : v.year, onTap: () => Navigator.of(c).push(MaterialPageRoute<void>(builder: (_) => SeriesDetailScreen(series: v))));
                  },
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 40)),
            ]);
          },
        );
      },
    );
  }

  Widget _cardRow(String title, List<Channel> list, DateTime now, {Widget? trailing}) {
    return SectionRow(
      title: title,
      itemCount: list.length,
      height: 252,
      itemWidth: 320,
      trailing: trailing,
      itemBuilder: (c, i) {
        final ch = list[i];
        return ProgramCard(channel: ch, program: s.epg.at(ch.id, now), width: 320, onTap: () => playChannel(c, ch, list: list));
      },
    );
  }
}

/// Rotating banner (every 9 s, paused while the mouse is over it).
class _HeroCarousel extends StatefulWidget {
  const _HeroCarousel({required this.items, required this.onGuide});
  final List<(Channel, Program)> items;
  final VoidCallback onGuide;
  @override
  State<_HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<_HeroCarousel> {
  int _i = 0;
  bool _hover = false;
  Timer? _t;
  // The buttons stay while the banner changes, so keyboard focus is never lost.
  final _playFocus = FocusNode(debugLabel: 'hero-play');

  @override
  void initState() {
    super.initState();
    _t = Timer.periodic(const Duration(seconds: 9), (_) {
      if (!_hover && mounted && widget.items.length > 1) setState(() => _i = (_i + 1) % widget.items.length);
    });
  }

  @override
  void dispose() {
    _t?.cancel();
    _playFocus.dispose();
    super.dispose();
  }

  void _go(int d) => setState(() => _i = (_i + d) % widget.items.length); // Dart's % is never negative here

  @override
  Widget build(BuildContext context) {
    final n = widget.items.length;
    final idx = _i.clamp(0, n - 1);
    final (c, p) = widget.items[idx];
    return MouseRegion(
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: Stack(fit: StackFit.expand, children: [
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 700),
          switchInCurve: Curves.easeOut,
          child: _HeroBanner(key: ValueKey('${c.id}@${p.key}'), channel: c, program: p, onGuide: widget.onGuide, withActions: false),
        ),
        Positioned(left: Gap.page, bottom: 56, child: _HeroActions(channel: c, program: p, onGuide: widget.onGuide, playFocus: _playFocus)),
        if (n > 1)
          Positioned(
            right: Gap.page,
            bottom: 60,
            child: Row(children: [
              _ArrowButton(icon: Icons.chevron_left_rounded, onTap: () => _go(-1)),
              const SizedBox(width: 6),
              for (var k = 0; k < n; k++)
                GestureDetector(
                  onTap: () => setState(() => _i = k),
                  child: MouseRegion(
                    cursor: SystemMouseCursors.click,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      margin: const EdgeInsets.only(left: 6),
                      width: k == idx ? 28 : 8,
                      height: 8,
                      decoration: BoxDecoration(color: k == idx ? OrbitColors.accent : Colors.white.o(0.35), borderRadius: BorderRadius.circular(4)),
                    ),
                  ),
                ),
              const SizedBox(width: 12),
              _ArrowButton(icon: Icons.chevron_right_rounded, onTap: () => _go(1)),
            ]),
          ),
      ]),
    );
  }
}

class _ArrowButton extends StatelessWidget {
  const _ArrowButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(color: Colors.black.o(0.5), shape: BoxShape.circle, border: Border.all(color: Colors.white.o(0.18))),
          child: Icon(icon, size: 26),
        ),
      ),
    );
  }
}

class _HeroActions extends StatelessWidget {
  const _HeroActions({required this.channel, required this.program, required this.onGuide, this.playFocus});
  final Channel channel;
  final Program? program;
  final VoidCallback onGuide;
  final FocusNode? playFocus;
  @override
  Widget build(BuildContext context) {
    final p = program;
    return Wrap(spacing: 12, runSpacing: 12, children: [
      ElevatedButton.icon(
        focusNode: playFocus,
        autofocus: true,
        onPressed: () => playChannel(context, channel),
        icon: const Icon(Icons.play_arrow_rounded, size: 24),
        label: const Text('Gledaj uživo'),
      ),
      if (p != null && channel.hasArchive)
        OutlinedButton.icon(
          onPressed: () => playArchive(context, channel, p.start),
          icon: const Icon(Icons.replay_rounded),
          label: const Text('Od početka'),
        ),
      OutlinedButton.icon(onPressed: onGuide, icon: const Icon(Icons.view_timeline_rounded), label: const Text('TV vodič')),
    ]);
  }
}

class _HeroBanner extends StatelessWidget {
  const _HeroBanner({super.key, required this.channel, required this.program, required this.onGuide, this.withActions = true});
  final Channel channel;
  final Program? program;
  final VoidCallback onGuide;
  final bool withActions;

  @override
  Widget build(BuildContext context) {
    final p = program;
    final now = DateTime.now().toUtc();
    final width = MediaQuery.sizeOf(context).width;
    return Stack(fit: StackFit.expand, children: [
      // Picture: full-bleed, slightly blurred and darkened when only a small frame exists.
      _HeroPicture(channel: channel, program: p),
      const DecoratedBox(decoration: BoxDecoration(gradient: OrbitColors.heroFade)),
      const DecoratedBox(decoration: BoxDecoration(gradient: OrbitColors.pageFade)),
      Positioned(
        left: Gap.page,
        bottom: withActions ? 56 : 132,
        width: (width * 0.48).clamp(420.0, 680.0),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            LogoBadge(channel: channel, size: 40),
            const SizedBox(width: 12),
            const LiveBadge(),
            const SizedBox(width: 10),
            Flexible(child: Text('${channel.number}  ${channel.name}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: OrbitColors.textMuted))),
          ]),
          const SizedBox(height: 16),
          Text(p?.title ?? channel.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyles.display),
          if (p != null) ...[
            const SizedBox(height: 12),
            Row(children: [
              Text(TimeFmt.range(p.start, p.end), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              const SizedBox(width: 10),
              Text('još ${TimeFmt.humanMinutes(p.end.difference(now))}', style: TextStyles.muted),
            ]),
            const SizedBox(height: 10),
            SizedBox(width: 380, child: ProgressLine(p.progressAt(now), height: 4)),
            if (p.description.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(p.description, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyles.body.copyWith(color: OrbitColors.textMuted, fontSize: 15)),
            ],
          ],
          if (withActions) ...[
            const SizedBox(height: 24),
            _HeroActions(channel: channel, program: p, onGuide: onGuide),
          ],
        ]),
      ),
    ]);
  }
}

class _HeroPicture extends StatelessWidget {
  const _HeroPicture({required this.channel, required this.program});
  final Channel channel;
  final Program? program;
  @override
  Widget build(BuildContext context) {
    final p = program;
    if (p == null || !AppServices.I.signedIn) return ProgramThumb(channel: channel, program: p);
    final n = AppServices.I.thumbs.watchLarge(channel, p);
    return ValueListenableBuilder(
      valueListenable: n,
      builder: (_, pic, __) {
        final big = pic.large || (pic.url?.isNotEmpty ?? false);
        // Picture on the right ~3/4, its left edge melting into the background.
        final img = Align(
          alignment: Alignment.centerRight,
          child: FractionallySizedBox(
            widthFactor: 0.78,
            heightFactor: 1,
            child: ShaderMask(
              blendMode: BlendMode.dstIn,
              shaderCallback: (r) => const LinearGradient(colors: [Color(0x00FFFFFF), Color(0xFFFFFFFF)], stops: [0.0, 0.38]).createShader(r),
              child: ProgramThumb(channel: channel, program: p, large: true),
            ),
          ),
        );
        if (big) return img;
        // Small frame only: soft blur so the upscaled picture looks intentional.
        return ImageFiltered(imageFilter: ui.ImageFilter.blur(sigmaX: 6, sigmaY: 6, tileMode: TileMode.decal), child: img);
      },
    );
  }
}

class _ChannelLogoTile extends StatelessWidget {
  const _ChannelLogoTile({required this.channel, required this.onTap});
  final Channel channel;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return FocusTile(
      onTap: onTap,
      radius: 14,
      color: OrbitColors.surfaceHigh,
      child: Stack(children: [
        Positioned.fill(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(26, 18, 26, 18),
            child: NetImage(channel.logo, fit: BoxFit.contain, cacheWidth: 240, placeholder: Center(child: Text(channel.name, textAlign: TextAlign.center, maxLines: 2, style: const TextStyle(fontWeight: FontWeight.w800)))),
          ),
        ),
        Positioned(left: 10, top: 8, child: Text('${channel.number}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: OrbitColors.textMuted))),
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
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      FocusTile(
        onTap: onTap,
        radius: 12,
        color: OrbitColors.surfaceHigh,
        child: AspectRatio(
          aspectRatio: 16 / 9,
          child: Stack(fit: StackFit.expand, children: [
            Padding(
              padding: EdgeInsets.all(r.kind == 'catchup' ? 34 : 0),
              child: NetImage(r.image, fit: r.kind == 'catchup' ? BoxFit.contain : BoxFit.cover, cacheWidth: 480),
            ),
            const DecoratedBox(decoration: BoxDecoration(gradient: OrbitColors.bottomFade)),
            Center(
              child: Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(color: OrbitColors.accent.o(0.92), shape: BoxShape.circle),
                child: const Icon(Icons.play_arrow_rounded, size: 34, color: OrbitColors.onAccent),
              ),
            ),
            Positioned(left: 0, right: 0, bottom: 0, child: ProgressLine(r.progress, height: 4, background: Colors.white.o(0.18))),
          ]),
        ),
      ),
      const SizedBox(height: 10),
      Text(r.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
      const SizedBox(height: 3),
      Text('${r.subtitle} · još ${TimeFmt.humanMinutes(left.isNegative ? Duration.zero : left)}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.small),
    ]);
  }
}
