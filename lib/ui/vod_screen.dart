import 'package:flutter/material.dart';

import '../app/services.dart';
import '../app/theme.dart';
import '../data/catalog.dart';
import '../data/models.dart';
import '../util/time_fmt.dart';
import 'nav.dart';
import 'widgets/common.dart';
import 'widgets/tv_widgets.dart';

/// Shared grid with category chips for movies and series.
class CatalogGrid<T> extends StatelessWidget {
  const CatalogGrid({super.key, required this.categories, required this.selected, required this.onCategory, required this.items, required this.itemBuilder});
  final List<Category> categories;
  final String? selected;
  final ValueChanged<String?> onCategory;
  final List<T> items;
  final Widget Function(BuildContext, T) itemBuilder;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SizedBox(
        height: 46,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: Gap.page),
          children: [
            _Chip(label: 'Sve', active: selected == null, onTap: () => onCategory(null)),
            for (final c in categories) _Chip(label: c.name, active: selected == c.id, onTap: () => onCategory(c.id)),
          ],
        ),
      ),
      const SizedBox(height: 14),
      Expanded(
        child: items.isEmpty
            ? const MessageView(icon: Icons.search_off_rounded, title: 'Ništa nije pronađeno')
            : GridView.builder(
                padding: const EdgeInsets.fromLTRB(Gap.page, 8, Gap.page, 40),
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 190, mainAxisSpacing: 22, crossAxisSpacing: 18, childAspectRatio: 0.56),
                itemCount: items.length,
                itemBuilder: (c, i) => itemBuilder(c, items[i]),
              ),
      ),
    ]);
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FocusTile(
        onTap: onTap,
        scale: 1.0,
        radius: 22,
        color: active ? OrbitColors.violet.o(0.28) : OrbitColors.surface,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
        child: Text(label, style: TextStyle(fontWeight: active ? FontWeight.w700 : FontWeight.w500, fontSize: 13.5)),
      ),
    );
  }
}

class VodScreen extends StatefulWidget {
  const VodScreen({super.key});
  @override
  State<VodScreen> createState() => _VodScreenState();
}

class _VodScreenState extends State<VodScreen> {
  final s = AppServices.I;
  String? _cat;
  String _q = '';

  @override
  void initState() {
    super.initState();
    s.catalog.loadVod();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([s.catalog, s.prefs]),
      builder: (context, _) {
        final cat = s.catalog;
        Widget body;
        if (cat.vodState == LoadState.loading || cat.vodState == LoadState.idle) {
          body = const LoadingView(message: 'Učitavam filmove…');
        } else if (cat.vodState == LoadState.error) {
          body = MessageView(icon: Icons.cloud_off_rounded, title: 'Filmovi se nisu učitali', text: cat.vodError, action: 'Pokušaj ponovo', onAction: () => cat.loadVod(force: true));
        } else {
          var items = _cat == null ? cat.latestVod(cat.vod.length) : cat.vod.where((v) => v.categoryId == _cat).toList();
          if (_q.isNotEmpty) {
            final f = Catalog.fold(_q);
            items = items.where((v) => Catalog.fold(v.name).contains(f)).toList();
          }
          body = CatalogGrid<VodItem>(
            categories: cat.vodCategories,
            selected: _cat,
            onCategory: (v) => setState(() => _cat = v),
            items: items,
            itemBuilder: (c, v) {
              final r = s.prefs.resume['vod:${v.id}'];
              return PosterCard(
                title: v.name,
                image: v.poster,
                rating: v.rating,
                progress: r?.progress,
                onTap: () => Navigator.of(c).push(MaterialPageRoute<void>(builder: (_) => VodDetailScreen(item: v))),
              );
            },
          );
        }
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          PageHeader(
            title: 'Filmovi',
            subtitle: cat.vodState == LoadState.ready ? '${cat.vod.length} filmova' : null,
            actions: [
              SizedBox(width: 280, child: TextField(decoration: const InputDecoration(hintText: 'Traži film', prefixIcon: Icon(Icons.search_rounded), isDense: true), onChanged: (v) => setState(() => _q = v.trim()))),
            ],
          ),
          Expanded(child: body),
        ]);
      },
    );
  }
}

/// Movie details: backdrop, plot, play / continue.
class VodDetailScreen extends StatefulWidget {
  const VodDetailScreen({super.key, required this.item});
  final VodItem item;
  @override
  State<VodDetailScreen> createState() => _VodDetailScreenState();
}

class _VodDetailScreenState extends State<VodDetailScreen> {
  final s = AppServices.I;
  VodInfo? _info;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    s.api.vodInfo(widget.item.id).then((i) {
      if (mounted) setState(() => _info = i);
    }).catchError((Object _) {}).whenComplete(() {
      if (mounted) setState(() => _loading = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final v = widget.item;
    final i = _info;
    final backdrop = (i?.backdrop.isNotEmpty ?? false) ? i!.backdrop : ((i?.poster.isNotEmpty ?? false) ? i!.poster : v.poster);
    return Scaffold(
      body: ListenableBuilder(
        listenable: s.prefs,
        builder: (context, _) {
          final r = s.prefs.resume['vod:${v.id}'];
          return Stack(fit: StackFit.expand, children: [
            NetImage(backdrop, fit: BoxFit.cover, alignment: Alignment.topCenter),
            const DecoratedBox(decoration: BoxDecoration(gradient: OrbitColors.heroFade)),
            const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x6607080F), Color(0x0007080F), OrbitColors.bg], stops: [0, 0.4, 1]))),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(Gap.page),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  IconButton.filledTonal(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.arrow_back_rounded)),
                  const Spacer(),
                  Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: SizedBox(width: 210, height: 315, child: NetImage(v.poster, fit: BoxFit.cover, cacheWidth: 420)),
                    ),
                    const SizedBox(width: 32),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(v.name, style: TextStyles.display, maxLines: 2, overflow: TextOverflow.ellipsis),
                        const SizedBox(height: 12),
                        Wrap(spacing: 8, runSpacing: 8, children: [
                          if (i?.year.isNotEmpty ?? false) Pill(i!.year),
                          if (i?.duration != null) Pill(TimeFmt.humanMinutes(i!.duration!), icon: Icons.schedule_rounded),
                          if ((i?.rating ?? v.rating ?? 0) > 0) Pill((i?.rating ?? v.rating!).toStringAsFixed(1), icon: Icons.star_rounded, color: OrbitColors.warning),
                          if (i?.genre.isNotEmpty ?? false) Pill(i!.genre),
                        ]),
                        const SizedBox(height: 16),
                        if (_loading) const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2)),
                        if (i != null && i.plot.isNotEmpty)
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 760),
                            child: Text(i.plot, maxLines: 5, overflow: TextOverflow.ellipsis, style: TextStyles.body.copyWith(color: OrbitColors.textMuted, fontSize: 15)),
                          ),
                        if (i != null && (i.director.isNotEmpty || i.cast.isNotEmpty)) ...[
                          const SizedBox(height: 12),
                          if (i.director.isNotEmpty) Text('Režija: ${i.director}', style: TextStyles.small),
                          if (i.cast.isNotEmpty) Text('Uloge: ${i.cast}', maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyles.small),
                        ],
                        const SizedBox(height: 24),
                        Row(children: [
                          ElevatedButton.icon(
                            autofocus: true,
                            onPressed: () => playVod(context, v, info: i, from: r?.position),
                            icon: const Icon(Icons.play_arrow_rounded),
                            label: Text(r == null ? 'Gledaj' : 'Nastavi (${TimeFmt.clock(r.position)})'),
                          ),
                          if (r != null) ...[
                            const SizedBox(width: 12),
                            OutlinedButton.icon(onPressed: () => playVod(context, v, info: i), icon: const Icon(Icons.replay_rounded), label: const Text('Od početka')),
                          ],
                        ]),
                        if (r != null) ...[const SizedBox(height: 12), SizedBox(width: 320, child: ProgressLine(r.progress, height: 4))],
                      ]),
                    ),
                  ]),
                ]),
              ),
            ),
          ]);
        },
      ),
    );
  }
}
