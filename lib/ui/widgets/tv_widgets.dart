import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../app/services.dart';
import '../../app/theme.dart';
import '../../data/models.dart';
import '../../media/thumbs.dart';
import '../../util/time_fmt.dart';
import 'common.dart';

/// Picture of a programme: real frame → EPG picture → channel logo on a dark gradient.
/// [large] asks for a big frame (hero banners); until it exists the small one is shown.
class ProgramThumb extends StatelessWidget {
  const ProgramThumb({super.key, required this.channel, required this.program, this.large = false, this.fit = BoxFit.cover});
  final Channel channel;
  final Program? program;
  final bool large;
  final BoxFit fit;

  Widget _fallback() {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [OrbitColors.surfaceHigher, OrbitColors.surface, const Color(0xFF0B0B0A), OrbitColors.accent.o(0.10)],
          stops: const [0, 0.45, 0.8, 1],
        ),
      ),
      child: Center(
        child: FractionallySizedBox(
          widthFactor: 0.38,
          heightFactor: 0.38,
          child: NetImage(channel.logo, fit: BoxFit.contain, cacheWidth: 240, placeholder: const SizedBox.shrink()),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = program;
    if (p == null || !AppServices.I.signedIn) return _fallback();
    final n = large ? AppServices.I.thumbs.watchLarge(channel, p) : AppServices.I.thumbs.watch(channel, p);
    return ValueListenableBuilder<ProgramPicture>(
      valueListenable: n,
      builder: (_, pic, __) {
        Widget child;
        final frame = pic.bytes == null
            ? null
            : Image.memory(pic.bytes!, key: ValueKey(pic.bytes!.length), fit: fit, gaplessPlayback: true, filterQuality: FilterQuality.medium, width: double.infinity, height: double.infinity);
        if (pic.url != null && pic.url!.isNotEmpty) {
          // EPG picture from the panel; the frame (or logo) shows while it loads or if it fails.
          child = NetImage(pic.url, key: ValueKey(pic.url), fit: fit, cacheWidth: large ? 1280 : 480, width: double.infinity, height: double.infinity, placeholder: frame ?? _fallback());
        } else if (frame != null) {
          child = frame;
        } else {
          child = _fallback();
        }
        return AnimatedSwitcher(duration: const Duration(milliseconds: 350), child: child);
      },
    );
  }
}

/// Small rounded tile with the channel logo (over pictures).
class LogoBadge extends StatelessWidget {
  const LogoBadge({super.key, required this.channel, this.size = 40});
  final Channel channel;
  final double size;
  @override
  Widget build(BuildContext context) {
    return Container(
      width: size * 1.45,
      height: size,
      padding: EdgeInsets.all(size * 0.14),
      decoration: BoxDecoration(color: Colors.black.o(0.62), borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.white.o(0.10))),
      child: NetImage(channel.logo, fit: BoxFit.contain, cacheWidth: (size * 3).round(), placeholder: Center(child: Text(channel.name.characters.take(3).toString().toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)))),
    );
  }
}

/// EON-style card: programme picture with channel logo, live badge and progress; title below.
class ProgramCard extends StatelessWidget {
  const ProgramCard({super.key, required this.channel, required this.program, this.onTap, this.showChannel = true, this.width = 300, this.subtitle});
  final Channel channel;
  final Program? program;
  final VoidCallback? onTap;
  final bool showChannel;
  final double width;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final p = program;
    final now = DateTime.now().toUtc();
    final live = p != null && p.isLiveAt(now);
    final past = p != null && p.isPastAt(now);
    return SizedBox(
      width: width,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        FocusTile(
          onTap: onTap,
          radius: 12,
          color: OrbitColors.surface,
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(fit: StackFit.expand, children: [
              ProgramThumb(channel: channel, program: p),
              const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x00000000), Color(0x00000000), Color(0x99000000)], stops: [0, 0.6, 1]))),
              if (showChannel) Positioned(left: 10, top: 10, child: LogoBadge(channel: channel, size: 30)),
              if (live) const Positioned(right: 10, top: 10, child: LiveBadge(small: true)),
              if (past && channel.hasArchive)
                Positioned(
                  right: 10,
                  top: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(color: Colors.black.o(0.7), borderRadius: BorderRadius.circular(6)),
                    child: const Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.history_rounded, size: 12, color: OrbitColors.accent),
                      SizedBox(width: 4),
                      Text('ARHIVA', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
                    ]),
                  ),
                ),
              if (live) Positioned(left: 0, right: 0, bottom: 0, child: ProgressLine(p.progressAt(now), height: 4, background: Colors.white.o(0.18))),
            ]),
          ),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: Text(p?.title ?? channel.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
        ),
        const SizedBox(height: 3),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: Text(
            subtitle ?? (p == null ? channel.name : '${showChannel ? '${channel.name} · ' : ''}${TimeFmt.range(p.start, p.end)}'),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyles.small,
          ),
        ),
      ]),
    );
  }
}

/// Channel tile for the TV grid: live picture, number, name, programme and progress.
class ChannelTile extends StatelessWidget {
  const ChannelTile({super.key, required this.channel, required this.program, required this.onTap, this.favorite = false, this.onSecondary});
  final Channel channel;
  final Program? program;
  final VoidCallback onTap;
  final VoidCallback? onSecondary;
  final bool favorite;

  @override
  Widget build(BuildContext context) {
    final p = program;
    final now = DateTime.now().toUtc();
    return GestureDetector(
      onSecondaryTap: onSecondary,
      onLongPress: onSecondary,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        FocusTile(
          onTap: onTap,
          radius: 12,
          color: OrbitColors.surface,
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(fit: StackFit.expand, children: [
              ProgramThumb(channel: channel, program: p),
              const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x00000000), Color(0x00000000), Color(0xB3000000)], stops: [0, 0.5, 1]))),
              Positioned(left: 10, top: 10, child: LogoBadge(channel: channel, size: 32)),
              Positioned(
                right: 10,
                top: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.black.o(0.65), borderRadius: BorderRadius.circular(6)),
                  child: Text('${channel.number}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, fontFeatures: [ui.FontFeature.tabularFigures()])),
                ),
              ),
              Positioned(
                left: 12,
                right: 12,
                bottom: 12,
                child: Row(children: [
                  if (favorite) const Padding(padding: EdgeInsets.only(right: 6), child: Icon(Icons.star_rounded, size: 16, color: OrbitColors.accent)),
                  if (channel.hasArchive) const Padding(padding: EdgeInsets.only(right: 6), child: Icon(Icons.history_rounded, size: 15, color: OrbitColors.accent)),
                  Expanded(child: Text(channel.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, shadows: [Shadow(blurRadius: 6)]))),
                ]),
              ),
              if (p != null) Positioned(left: 0, right: 0, bottom: 0, child: ProgressLine(p.progressAt(now), height: 4, background: Colors.white.o(0.18))),
            ]),
          ),
        ),
        const SizedBox(height: 9),
        Text(p?.title ?? 'Nema podataka o programu', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700)),
        const SizedBox(height: 2),
        Text(p == null ? '' : '${TimeFmt.range(p.start, p.end)} · još ${TimeFmt.humanMinutes(p.end.difference(now))}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.small),
      ]),
    );
  }
}

/// Row in channel lists (player drawer, search): number, logo, name, current programme, progress.
class ChannelRow extends StatelessWidget {
  const ChannelRow({super.key, required this.channel, required this.now, required this.selected, required this.onTap, this.onDoubleTap, this.favorite = false, this.compact = false, this.autofocus = false, this.onFocus});
  final Channel channel;
  final Program? now;
  final bool selected;
  final bool favorite;
  final bool compact;
  final bool autofocus;
  final VoidCallback onTap;
  final VoidCallback? onDoubleTap;
  final ValueChanged<bool>? onFocus;

  @override
  Widget build(BuildContext context) {
    final t = DateTime.now().toUtc();
    final p = now;
    return GestureDetector(
      onDoubleTap: onDoubleTap,
      child: FocusTile(
        onTap: onTap,
        autofocus: autofocus,
        onFocus: onFocus,
        scale: 1.0,
        radius: 12,
        selected: selected,
        color: selected ? OrbitColors.surfaceHigh : Colors.transparent,
        padding: EdgeInsets.symmetric(horizontal: 10, vertical: compact ? 6 : 9),
        child: Row(children: [
          SizedBox(width: 34, child: Text('${channel.number}', style: TextStyles.small.copyWith(fontWeight: FontWeight.w800), textAlign: TextAlign.right)),
          const SizedBox(width: 10),
          ChannelLogo(name: channel.name, url: channel.logo, size: compact ? 36 : 44, radius: 9),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Row(children: [
                Flexible(child: Text(channel.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700))),
                if (favorite) const Padding(padding: EdgeInsets.only(left: 6), child: Icon(Icons.star_rounded, size: 15, color: OrbitColors.accent)),
                if (channel.hasArchive) const Padding(padding: EdgeInsets.only(left: 6), child: Icon(Icons.history_rounded, size: 14, color: OrbitColors.accent)),
              ]),
              if (!compact || p != null) ...[
                const SizedBox(height: 3),
                Text(p?.title ?? 'Nema programa', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.small),
                if (p != null) ...[const SizedBox(height: 5), ProgressLine(p.progressAt(t), height: 2.5)],
              ],
            ]),
          ),
        ]),
      ),
    );
  }
}

/// Poster for movies/series (2:3) with title below.
class PosterCard extends StatelessWidget {
  const PosterCard({super.key, required this.title, required this.image, this.subtitle, this.onTap, this.progress, this.rating});
  final String title;
  final String image;
  final String? subtitle;
  final VoidCallback? onTap;
  final double? progress;
  final double? rating;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Expanded(
        child: FocusTile(
          onTap: onTap,
          radius: 12,
          color: OrbitColors.surface,
          child: Stack(fit: StackFit.expand, children: [
            NetImage(image, fit: BoxFit.cover, cacheWidth: 360, placeholder: _PosterFallback(title)),
            if (rating != null && rating! > 0)
              Positioned(
                left: 8,
                top: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(color: OrbitColors.accent, borderRadius: BorderRadius.circular(6)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.star_rounded, size: 13, color: OrbitColors.onAccent),
                    const SizedBox(width: 3),
                    Text(rating!.toStringAsFixed(1), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: OrbitColors.onAccent)),
                  ]),
                ),
              ),
            if (progress != null) Positioned(left: 0, right: 0, bottom: 0, child: ProgressLine(progress!, height: 4, background: Colors.black54)),
          ]),
        ),
      ),
      const SizedBox(height: 9),
      Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
      if (subtitle != null) Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.tiny),
    ]);
  }
}

class _PosterFallback extends StatelessWidget {
  const _PosterFallback(this.title);
  final String title;
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [OrbitColors.surfaceHigher, OrbitColors.bgElevated, OrbitColors.accent.o(0.12)])),
      padding: const EdgeInsets.all(14),
      alignment: Alignment.bottomLeft,
      child: Text(title, maxLines: 4, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: OrbitColors.text, height: 1.2)),
    );
  }
}
