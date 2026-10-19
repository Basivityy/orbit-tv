import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/theme.dart';
import '../../util/time_fmt.dart';

/// Card that reacts to mouse hover and keyboard/remote focus (glow + lift), activates on
/// click, Enter or Space.
class FocusTile extends StatefulWidget {
  const FocusTile({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.radius = 14,
    this.autofocus = false,
    this.focusNode,
    this.onFocus,
    this.scale = 1.04,
    this.padding = EdgeInsets.zero,
    this.color,
    this.selected = false,
    this.focusColor = OrbitColors.accent,
  });
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double radius;
  final bool autofocus;
  final FocusNode? focusNode;
  final ValueChanged<bool>? onFocus;
  final double scale;
  final EdgeInsets padding;
  final Color? color;
  final bool selected;
  final Color focusColor;

  @override
  State<FocusTile> createState() => _FocusTileState();
}

class _FocusTileState extends State<FocusTile> {
  bool _hover = false;
  bool _focus = false;

  @override
  Widget build(BuildContext context) {
    final active = _hover || _focus;
    return FocusableActionDetector(
      focusNode: widget.focusNode,
      autofocus: widget.autofocus,
      mouseCursor: widget.onTap != null ? SystemMouseCursors.click : MouseCursor.defer,
      onShowHoverHighlight: (v) => setState(() => _hover = v),
      onShowFocusHighlight: (v) {
        setState(() => _focus = v);
        widget.onFocus?.call(v);
        if (v) {
          Scrollable.ensureVisible(context, alignment: 0.5, duration: const Duration(milliseconds: 220), curve: Curves.easeOutCubic);
        }
      },
      shortcuts: const {
        SingleActivator(LogicalKeyboardKey.enter): ActivateIntent(),
        SingleActivator(LogicalKeyboardKey.numpadEnter): ActivateIntent(),
        SingleActivator(LogicalKeyboardKey.space): ActivateIntent(),
        SingleActivator(LogicalKeyboardKey.select): ActivateIntent(),
      },
      actions: {
        ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: (_) {
          widget.onTap?.call();
          return null;
        }),
      },
      child: GestureDetector(
        onTap: widget.onTap,
        onLongPress: widget.onLongPress,
        child: AnimatedScale(
          scale: active ? widget.scale : 1.0,
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOutCubic,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            padding: widget.padding,
            decoration: BoxDecoration(
              color: widget.color,
              borderRadius: BorderRadius.circular(widget.radius),
              border: Border.all(
                color: _focus ? widget.focusColor : (widget.selected ? OrbitColors.accent.o(0.85) : (_hover ? Colors.white.o(0.28) : Colors.transparent)),
                width: _focus ? 3 : 2,
              ),
              boxShadow: active ? [BoxShadow(color: Colors.black.o(0.55), blurRadius: 26, offset: const Offset(0, 10))] : const [],
            ),
            child: ClipRRect(borderRadius: BorderRadius.circular(widget.radius - 1), child: widget.child),
          ),
        ),
      ),
    );
  }
}

/// Network image with placeholder, fade-in and graceful failure.
class NetImage extends StatelessWidget {
  const NetImage(this.url, {super.key, this.fit = BoxFit.cover, this.width, this.height, this.cacheWidth, this.placeholder, this.alignment = Alignment.center});
  final String? url;
  final BoxFit fit;
  final double? width, height;
  final int? cacheWidth;
  final Widget? placeholder;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    final ph = placeholder ?? Container(color: OrbitColors.surface);
    final u = url?.trim() ?? '';
    if (u.isEmpty || !(u.startsWith('http://') || u.startsWith('https://'))) return SizedBox(width: width, height: height, child: ph);
    return Image.network(
      u,
      width: width,
      height: height,
      fit: fit,
      alignment: alignment,
      cacheWidth: cacheWidth,
      gaplessPlayback: true,
      filterQuality: FilterQuality.medium,
      headers: const {'User-Agent': 'OrbitPlayer/1.0 (Windows)'},
      frameBuilder: (context, child, frame, sync) {
        if (sync || frame != null) {
          return AnimatedOpacity(opacity: 1, duration: const Duration(milliseconds: 250), child: child);
        }
        return SizedBox(width: width, height: height, child: ph);
      },
      errorBuilder: (_, __, ___) => SizedBox(width: width, height: height, child: ph),
    );
  }
}

/// Channel logo on a soft tile, or the first letters when there is no logo.
class ChannelLogo extends StatelessWidget {
  const ChannelLogo({super.key, required this.name, required this.url, this.size = 48, this.radius = 10, this.background = true});
  final String name;
  final String url;
  final double size;
  final double radius;
  final bool background;

  @override
  Widget build(BuildContext context) {
    final initials = name.trim().isEmpty
        ? '?'
        : name.trim().split(RegExp(r'\s+')).take(2).map((w) => w.isEmpty ? '' : w.characters.first.toUpperCase()).join();
    final fallback = Center(
      child: Text(initials, style: TextStyle(fontSize: size * 0.32, fontWeight: FontWeight.w800, color: OrbitColors.textMuted)),
    );
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: background ? OrbitColors.surfaceHigh : null,
        borderRadius: BorderRadius.circular(radius),
      ),
      padding: EdgeInsets.all(size * 0.12),
      child: NetImage(url, fit: BoxFit.contain, cacheWidth: (size * 2).round(), placeholder: fallback),
    );
  }
}

/// Thin progress line (violet → cyan).
class ProgressLine extends StatelessWidget {
  const ProgressLine(this.value, {super.key, this.height = 3, this.background});
  final double value;
  final double height;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: SizedBox(
        height: height,
        child: Stack(children: [
          Positioned.fill(child: ColoredBox(color: background ?? Colors.white.o(0.12))),
          FractionallySizedBox(
            widthFactor: value.clamp(0.0, 1.0),
            child: Container(decoration: const BoxDecoration(gradient: OrbitColors.accentGradient)),
          ),
        ]),
      ),
    );
  }
}

class LiveBadge extends StatelessWidget {
  const LiveBadge({super.key, this.label = 'UŽIVO', this.small = false});
  final String label;
  final bool small;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 7 : 9, vertical: small ? 3 : 4),
      decoration: BoxDecoration(color: OrbitColors.live, borderRadius: BorderRadius.circular(6)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: small ? 5 : 6, height: small ? 5 : 6, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle)),
        SizedBox(width: small ? 4 : 5),
        Text(label, style: TextStyle(fontSize: small ? 9.5 : 11, fontWeight: FontWeight.w800, letterSpacing: 0.8, color: Colors.white, height: 1.1)),
      ]),
    );
  }
}

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.icon, this.color});
  final String text;
  final IconData? icon;
  final Color? color;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: (color ?? Colors.white).o(0.10), borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 14, color: color ?? OrbitColors.textMuted), const SizedBox(width: 5)],
        Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color ?? OrbitColors.textMuted)),
      ]),
    );
  }
}

/// Live clock (HH:mm).
class ClockText extends StatefulWidget {
  const ClockText({super.key, this.style});
  final TextStyle? style;
  @override
  State<ClockText> createState() => _ClockTextState();
}

class _ClockTextState extends State<ClockText> {
  Timer? _t;
  @override
  void initState() {
    super.initState();
    _t = Timer.periodic(const Duration(seconds: 15), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Text(TimeFmt.hm(DateTime.now()), style: widget.style ?? TextStyles.h3);
}

/// Rebuilds every [period] (for "now" indicators and progress bars).
class Ticker extends StatefulWidget {
  const Ticker({super.key, required this.builder, this.period = const Duration(seconds: 30)});
  final WidgetBuilder builder;
  final Duration period;
  @override
  State<Ticker> createState() => _TickerState();
}

class _TickerState extends State<Ticker> {
  Timer? _t;
  @override
  void initState() {
    super.initState();
    _t = Timer.periodic(widget.period, (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context);
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.message});
  final String? message;
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const SizedBox(width: 34, height: 34, child: CircularProgressIndicator(strokeWidth: 3, color: OrbitColors.accent)),
        if (message != null) ...[const SizedBox(height: 16), Text(message!, style: TextStyles.muted)],
      ]),
    );
  }
}

class MessageView extends StatelessWidget {
  const MessageView({super.key, required this.icon, required this.title, this.text, this.action, this.onAction});
  final IconData icon;
  final String title;
  final String? text;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 46, color: OrbitColors.textDim),
          const SizedBox(height: 14),
          Text(title, style: TextStyles.h2, textAlign: TextAlign.center),
          if (text != null) ...[const SizedBox(height: 8), Text(text!, style: TextStyles.muted, textAlign: TextAlign.center)],
          if (action != null) ...[const SizedBox(height: 20), ElevatedButton(onPressed: onAction, child: Text(action!))],
        ]),
      ),
    );
  }
}

/// Section title + horizontally scrolling row.
class SectionRow extends StatelessWidget {
  const SectionRow({super.key, required this.title, required this.itemCount, required this.itemBuilder, required this.height, this.itemWidth, this.trailing, this.spacing = 14});
  final String title;
  final int itemCount;
  final IndexedWidgetBuilder itemBuilder;
  final double height;
  final double? itemWidth;
  final Widget? trailing;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    if (itemCount == 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 30),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.page),
          child: Row(children: [
            Container(width: 4, height: 20, decoration: BoxDecoration(color: OrbitColors.accent, borderRadius: BorderRadius.circular(2))),
            const SizedBox(width: 12),
            Text(title, style: TextStyles.h2),
            const Spacer(),
            if (trailing != null) trailing!,
          ]),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: height,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: Gap.page, vertical: 6),
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            itemCount: itemCount,
            separatorBuilder: (_, __) => SizedBox(width: spacing),
            itemBuilder: (c, i) => itemWidth == null ? itemBuilder(c, i) : SizedBox(width: itemWidth, child: itemBuilder(c, i)),
          ),
        ),
      ]),
    );
  }
}

/// Page header used on top-level screens.
class PageHeader extends StatelessWidget {
  const PageHeader({super.key, required this.title, this.subtitle, this.actions = const []});
  final String title;
  final String? subtitle;
  final List<Widget> actions;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.page, 26, Gap.page, 18),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: TextStyles.h1),
            if (subtitle != null) ...[const SizedBox(height: 5), Text(subtitle!, style: TextStyles.muted)],
          ]),
        ),
        ...actions,
      ]),
    );
  }
}


/// Frosted dark panel (player bars, drawers).
class GlassPanel extends StatelessWidget {
  const GlassPanel({super.key, required this.child, this.radius = 0, this.opacity = 0.62, this.padding = EdgeInsets.zero, this.border = true});
  final Widget child;
  final double radius;
  final double opacity;
  final EdgeInsets padding;
  final bool border;
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 22, sigmaY: 22),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: const Color(0xFF0A0A09).o(opacity),
            borderRadius: BorderRadius.circular(radius),
            border: border ? Border.all(color: Colors.white.o(0.07)) : null,
          ),
          child: child,
        ),
      ),
    );
  }
}

/// Horizontal category chips (EON style): "Svi", "Omiljeni", categories…
class ChipBar extends StatelessWidget {
  const ChipBar({super.key, required this.items, required this.selected, required this.onSelect, this.padding = const EdgeInsets.symmetric(horizontal: Gap.page)});
  final List<(String, String)> items; // (id, label)
  final String selected;
  final ValueChanged<String> onSelect;
  final EdgeInsets padding;
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 46,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: padding,
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final (id, label) = items[i];
          final on = id == selected;
          return FocusTile(
            onTap: () => onSelect(id),
            scale: 1.0,
            radius: 23,
            color: on ? OrbitColors.accent : OrbitColors.surfaceHigh,
            focusColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            child: Text(label, style: TextStyle(fontSize: 14, fontWeight: on ? FontWeight.w800 : FontWeight.w600, color: on ? OrbitColors.onAccent : OrbitColors.text)),
          );
        },
      ),
    );
  }
}
