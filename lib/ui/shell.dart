import 'dart:ui' as ui;

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
import 'widgets/common.dart';

/// Height of the top navigation bar; pages leave this much room at the top.
const double kTopBarH = 76;

class _NavItem {
  const _NavItem(this.label, this.index);
  final String label;
  final int index;
}

/// Sections: 0 home, 1 live, 2 guide, 3 movies, 4 series, 5 search, 6 settings.
const _menu = [
  _NavItem('Početna', 0),
  _NavItem('TV uživo', 1),
  _NavItem('TV vodič', 2),
  _NavItem('Filmovi', 3),
  _NavItem('Serije', 4),
];

/// Main layout (EON style): navigation bar on top, the selected section below/behind it.
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
      body: Stack(children: [
        // Home runs under the (transparent) bar; the other sections start below it.
        Positioned.fill(
          child: IndexedStack(
            index: _index,
            children: [
              for (var i = 0; i < 7; i++)
                Padding(padding: EdgeInsets.only(top: i == 0 ? 0 : kTopBarH), child: _page(i)),
            ],
          ),
        ),
        Positioned(left: 0, right: 0, top: 0, child: _TopBar(index: _index, onSelect: go)),
      ]),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.index, required this.onSelect});
  final int index;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final overHero = index == 0;
    final bar = Container(
      height: kTopBarH,
      padding: const EdgeInsets.symmetric(horizontal: Gap.page - 8),
      decoration: BoxDecoration(
        gradient: overHero
            ? const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xE6050505), Color(0x00050505)])
            : null,
        color: overHero ? null : OrbitColors.bg.o(0.82),
        border: overHero ? null : Border(bottom: BorderSide(color: Colors.white.o(0.06))),
      ),
      child: FocusTraversalGroup(
        child: Row(children: [
          const Padding(padding: EdgeInsets.only(left: 8, right: 28), child: OrbitLogo(size: 30)),
          for (final m in _menu) _MenuButton(label: m.label, active: index == m.index, onTap: () => onSelect(m.index)),
          const Spacer(),
          _IconNav(icon: Icons.search_rounded, tooltip: 'Pretraga', active: index == 5, onTap: () => onSelect(5)),
          const SizedBox(width: 6),
          _IconNav(icon: Icons.settings_rounded, tooltip: 'Postavke', active: index == 6, onTap: () => onSelect(6)),
          const SizedBox(width: 18),
          const ClockText(style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: OrbitColors.text, fontFeatures: [ui.FontFeature.tabularFigures()])),
          const SizedBox(width: 8),
        ]),
      ),
    );
    if (overHero) return bar;
    return ClipRect(child: BackdropFilter(filter: ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18), child: bar));
  }
}

class _MenuButton extends StatefulWidget {
  const _MenuButton({required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;
  @override
  State<_MenuButton> createState() => _MenuButtonState();
}

class _MenuButtonState extends State<_MenuButton> {
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
          margin: const EdgeInsets.symmetric(horizontal: 3),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: _focus ? OrbitColors.accent : (_hover && !on ? Colors.white.o(0.07) : Colors.transparent),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(
              widget.label,
              style: TextStyle(
                fontSize: 15.5,
                fontWeight: on ? FontWeight.w800 : FontWeight.w600,
                color: _focus ? OrbitColors.onAccent : (on || _hover ? OrbitColors.text : OrbitColors.textMuted),
              ),
            ),
            const SizedBox(height: 5),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: on ? 22 : 0,
              height: 3,
              decoration: BoxDecoration(color: _focus ? OrbitColors.onAccent : OrbitColors.accent, borderRadius: BorderRadius.circular(2)),
            ),
          ]),
        ),
      ),
    );
  }
}

class _IconNav extends StatefulWidget {
  const _IconNav({required this.icon, required this.tooltip, required this.active, required this.onTap});
  final IconData icon;
  final String tooltip;
  final bool active;
  final VoidCallback onTap;
  @override
  State<_IconNav> createState() => _IconNavState();
}

class _IconNavState extends State<_IconNav> {
  bool _hover = false;
  bool _focus = false;
  @override
  Widget build(BuildContext context) {
    final on = widget.active;
    return Tooltip(
      message: widget.tooltip,
      child: FocusableActionDetector(
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
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _focus || on ? OrbitColors.accent : (_hover ? Colors.white.o(0.14) : Colors.white.o(0.07)),
            ),
            child: Icon(widget.icon, size: 23, color: _focus || on ? OrbitColors.onAccent : OrbitColors.text),
          ),
        ),
      ),
    );
  }
}
