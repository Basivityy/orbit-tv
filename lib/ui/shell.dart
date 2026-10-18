import 'package:flutter/material.dart';

import '../app/theme.dart';
import 'epg_screen.dart';
import 'gate.dart';
import 'home_screen.dart';
import 'live_screen.dart';
import 'search_screen.dart';
import 'series_screen.dart';
import 'settings_screen.dart';
import 'vod_screen.dart';

class _NavItem {
  const _NavItem(this.icon, this.label);
  final IconData icon;
  final String label;
}

const _items = [
  _NavItem(Icons.home_rounded, 'Početna'),
  _NavItem(Icons.live_tv_rounded, 'TV uživo'),
  _NavItem(Icons.view_timeline_rounded, 'TV vodič'),
  _NavItem(Icons.movie_rounded, 'Filmovi'),
  _NavItem(Icons.video_library_rounded, 'Serije'),
  _NavItem(Icons.search_rounded, 'Pretraga'),
  _NavItem(Icons.settings_rounded, 'Postavke'),
];

/// Main layout: navigation on the left, the selected section on the right.
class Shell extends StatefulWidget {
  const Shell({super.key});
  static _ShellState? of(BuildContext context) => context.findAncestorStateOfType<_ShellState>();
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _index = 0;
  final Set<int> _built = {0};

  void go(int i) => setState(() {
        _index = i;
        _built.add(i);
      });

  Widget _page(int i) {
    if (!_built.contains(i)) return const SizedBox.shrink();
    switch (i) {
      case 0:
        return HomeScreen(onNavigate: go);
      case 1:
        return const LiveScreen();
      case 2:
        return const EpgScreen();
      case 3:
        return const VodScreen();
      case 4:
        return const SeriesScreen();
      case 5:
        return const SearchScreen();
      default:
        return const SettingsScreen();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(children: [
        _Sidebar(index: _index, onSelect: go),
        Expanded(
          child: IndexedStack(index: _index, children: List.generate(_items.length, _page)),
        ),
      ]),
    );
  }
}

class _Sidebar extends StatelessWidget {
  const _Sidebar({required this.index, required this.onSelect});
  final int index;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 104,
      decoration: const BoxDecoration(
        color: OrbitColors.bgElevated,
        border: Border(right: BorderSide(color: OrbitColors.stroke, width: 1)),
      ),
      child: FocusTraversalGroup(
        // Scrolls only on very small windows; otherwise "Postavke" sits at the bottom.
        child: LayoutBuilder(
          builder: (context, box) => SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: box.maxHeight),
              child: IntrinsicHeight(
                child: Column(children: [
                  const SizedBox(height: 20),
                  const OrbitLogo(size: 36, showText: false),
                  const SizedBox(height: 22),
                  for (var i = 0; i < _items.length; i++) ...[
                    if (i == _items.length - 1) const Spacer(),
                    _SideButton(item: _items[i], active: i == index, onTap: () => onSelect(i)),
                    const SizedBox(height: 4),
                  ],
                  const SizedBox(height: 14),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SideButton extends StatefulWidget {
  const _SideButton({required this.item, required this.active, required this.onTap});
  final _NavItem item;
  final bool active;
  final VoidCallback onTap;
  @override
  State<_SideButton> createState() => _SideButtonState();
}

class _SideButtonState extends State<_SideButton> {
  bool _hover = false;
  bool _focus = false;

  @override
  Widget build(BuildContext context) {
    final on = widget.active;
    return FocusableActionDetector(
      onShowHoverHighlight: (v) => setState(() => _hover = v),
      onShowFocusHighlight: (v) => setState(() => _focus = v),
      mouseCursor: SystemMouseCursors.click,
      actions: {
        ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: (_) {
          widget.onTap();
          return null;
        }),
      },
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          width: 84,
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: on ? OrbitColors.violet.o(0.18) : (_hover ? Colors.white.o(0.05) : Colors.transparent),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _focus ? OrbitColors.cyan : Colors.transparent, width: 2),
          ),
          child: Column(children: [
            ShaderMask(
              shaderCallback: (r) => (on ? OrbitColors.accentGradient : const LinearGradient(colors: [OrbitColors.textMuted, OrbitColors.textMuted])).createShader(r),
              child: Icon(widget.item.icon, size: 26, color: Colors.white),
            ),
            const SizedBox(height: 5),
            Text(
              widget.item.label,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11.5, fontWeight: on ? FontWeight.w700 : FontWeight.w500, color: on ? OrbitColors.text : OrbitColors.textMuted),
            ),
          ]),
        ),
      ),
    );
  }
}
