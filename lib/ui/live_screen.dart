import 'package:flutter/material.dart';

import '../app/services.dart';
import '../app/theme.dart';
import '../data/catalog.dart';
import '../data/models.dart';
import 'epg_screen.dart';
import 'nav.dart';
import 'widgets/common.dart';
import 'widgets/tv_widgets.dart';

/// TV uživo (EON style): category chips and a grid of channels with what is on right now.
class LiveScreen extends StatefulWidget {
  const LiveScreen({super.key});
  @override
  State<LiveScreen> createState() => _LiveScreenState();
}

class _LiveScreenState extends State<LiveScreen> {
  final s = AppServices.I;
  String _cat = Cat.all;
  String _filter = '';
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  List<Channel> _channels() {
    var list = s.catalog.channelsIn(_cat, favorites: s.prefs.favorites);
    if (_filter.isNotEmpty) {
      final f = Catalog.fold(_filter);
      list = list.where((c) => Catalog.fold(c.name).contains(f) || '${c.number}' == f).toList();
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([s.prefs, s.catalog]),
      builder: (context, _) {
        final channels = _channels();
        final chips = <(String, String)>[
          (Cat.all, 'Svi kanali'),
          (Cat.favorites, 'Omiljeni'),
          for (final c in s.catalog.liveCategories) (c.id, c.name),
        ];
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          PageHeader(
            title: 'TV uživo',
            subtitle: '${s.catalog.channels.length} kanala · ${s.catalog.channels.where((c) => c.hasArchive).length} sa arhivom',
            actions: [
              SizedBox(
                width: 320,
                child: TextField(
                  decoration: const InputDecoration(hintText: 'Traži kanal ili broj', prefixIcon: Icon(Icons.search_rounded), isDense: true),
                  onChanged: (v) => setState(() => _filter = v.trim()),
                ),
              ),
            ],
          ),
          ChipBar(items: chips, selected: _cat, onSelect: (v) => setState(() => _cat = v)),
          const SizedBox(height: 18),
          Expanded(
            child: channels.isEmpty
                ? MessageView(
                    icon: _cat == Cat.favorites ? Icons.star_outline_rounded : Icons.tv_off_rounded,
                    title: _cat == Cat.favorites ? 'Još nema omiljenih' : 'Nema kanala',
                    text: _cat == Cat.favorites ? 'U plejeru klikni zvjezdicu da dodaš kanal ovdje.' : null,
                  )
                : ListenableBuilder(
                    listenable: s.epg,
                    builder: (context, _) => Ticker(
                      builder: (_) {
                        final now = DateTime.now().toUtc();
                        return LayoutBuilder(builder: (context, box) {
                          const gap = 22.0;
                          final avail = box.maxWidth - Gap.page * 2;
                          final cols = ((avail + gap) / (290 + gap)).floor().clamp(2, 8);
                          final tileW = (avail - gap * (cols - 1)) / cols;
                          final tileH = tileW * 9 / 16 + 56;
                          return Scrollbar(
                            controller: _scroll,
                            child: GridView.builder(
                              controller: _scroll,
                              padding: const EdgeInsets.fromLTRB(Gap.page, 4, Gap.page, 40),
                              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: cols, mainAxisExtent: tileH, crossAxisSpacing: gap, mainAxisSpacing: 26),
                              itemCount: channels.length,
                              itemBuilder: (c, i) {
                                final ch = channels[i];
                                s.epg.ensureNow(ch);
                                final p = s.epg.at(ch.id, now);
                                return ChannelTile(
                                  channel: ch,
                                  program: p,
                                  favorite: s.prefs.isFavorite(ch.id),
                                  onTap: () => playChannel(c, ch, list: channels),
                                  onSecondary: p == null ? null : () => showProgramDialog(c, ch, p, list: channels),
                                );
                              },
                            ),
                          );
                        });
                      },
                    ),
                  ),
          ),
        ]);
      },
    );
  }
}
