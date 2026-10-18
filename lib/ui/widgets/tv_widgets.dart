import 'package:flutter/material.dart';

import '../../app/services.dart';
import '../../app/theme.dart';
import '../../data/models.dart';
import '../../media/thumbs.dart';
import '../../util/time_fmt.dart';
import 'common.dart';

/// Picture of a programme: real frame → EPG picture → channel logo on a gradient.
class ProgramThumb extends StatelessWidget {
  const ProgramThumb({super.key, required this.channel, required this.program, this.radius = 0});
  final Channel channel;
  final Program? program;
  final double radius;

  Widget _fallback() {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [OrbitColors.surfaceHigh, OrbitColors.violet.o(0.35), OrbitColors.bgElevated],
        ),
      ),
      child: Center(
        child: FractionallySizedBox(
          widthFactor: 0.42,
          heightFactor: 0.42,
          child: NetImage(channel.logo, fit: BoxFit.contain, cacheWidth: 200, placeholder: const SizedBox.shrink()),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = program;
    if (p == null || !AppServices.I.signedIn) return _fallback();
    final n = AppServices.I.thumbs.watch(channel, p);
    return ValueListenableBuilder<ProgramPicture>(
      valueListenable: n,
      builder: (_, pic, __) {
        if (pic.bytes != null) {
          return Image.memory(pic.bytes!, fit: BoxFit.cover, gaplessPlayback: true, filterQuality: FilterQuality.medium);
        }
        if (pic.url != null && pic.url!.isNotEmpty) {
          return NetImage(pic.url, fit: BoxFit.cover, cacheWidth: 480, placeholder: _fallback());
        }
        return _fallback();
      },
    );
  }
}

/// Wide card: programme picture, channel logo, title, time and progress (home rows, guide).
class ProgramCard extends StatelessWidget {
  const ProgramCard({super.key, required this.channel, required this.program, this.onTap, this.showChannel = true, this.width = 300});
  final Channel channel;
  final Program? program;
  final VoidCallback? onTap;
  final bool showChannel;
  final double width;

  @override
  Widget build(BuildContext context) {
    final p = program;
    final now = DateTime.now().toUtc();
    final live = p != null && p.isLiveAt(now);
    return SizedBox(
      width: width,
      child: FocusTile(
        onTap: onTap,
        color: OrbitColors.surface,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(fit: StackFit.expand, children: [
              ProgramThumb(channel: channel, program: p),
              const DecoratedBox(decoration: BoxDecoration(gradient: OrbitColors.bottomFade)),
              if (showChannel)
                Positioned(left: 10, top: 10, child: ChannelLogo(name: channel.name, url: channel.logo, size: 38, radius: 8)),
              if (live) const Positioned(right: 10, top: 10, child: LiveBadge(small: true)),
              if (p != null && !live && p.isPastAt(now) && channel.hasArchive)
                const Positioned(right: 10, top: 10, child: Pill('ARHIVA', icon: Icons.history_rounded, color: OrbitColors.cyan)),
              if (live)
                Positioned(left: 0, right: 0, bottom: 0, child: ProgressLine(p!.progressAt(now), height: 4, background: Colors.black54)),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p?.title ?? channel.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.h3),
              const SizedBox(height: 3),
              Text(
                p == null ? 'Nema programa' : '${showChannel ? '${channel.name} · ' : ''}${TimeFmt.range(p.start, p.end)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyles.small,
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// Row in channel lists: number, logo, name, current programme and progress.
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
          SizedBox(width: 34, child: Text('${channel.number}', style: TextStyles.small.copyWith(fontWeight: FontWeight.w700), textAlign: TextAlign.right)),
          const SizedBox(width: 10),
          ChannelLogo(name: channel.name, url: channel.logo, size: compact ? 36 : 44, radius: 9),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Row(children: [
                Flexible(child: Text(channel.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
                if (favorite) const Padding(padding: EdgeInsets.only(left: 6), child: Icon(Icons.star_rounded, size: 15, color: OrbitColors.warning)),
                if (channel.hasArchive) const Padding(padding: EdgeInsets.only(left: 6), child: Icon(Icons.history_rounded, size: 14, color: OrbitColors.cyan)),
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
          color: OrbitColors.surface,
          child: Stack(fit: StackFit.expand, children: [
            NetImage(image, fit: BoxFit.cover, cacheWidth: 360, placeholder: _PosterFallback(title)),
            if (rating != null && rating! > 0)
              Positioned(
                left: 8,
                top: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(color: Colors.black.o(0.65), borderRadius: BorderRadius.circular(6)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.star_rounded, size: 13, color: OrbitColors.warning),
                    const SizedBox(width: 3),
                    Text(rating!.toStringAsFixed(1), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                  ]),
                ),
              ),
            if (progress != null) Positioned(left: 0, right: 0, bottom: 0, child: ProgressLine(progress!, height: 4, background: Colors.black54)),
          ]),
        ),
      ),
      const SizedBox(height: 8),
      Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
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
      decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [OrbitColors.surfaceHigh, OrbitColors.bgElevated])),
      padding: const EdgeInsets.all(12),
      alignment: Alignment.bottomLeft,
      child: Text(title, maxLines: 4, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: OrbitColors.textMuted)),
    );
  }
}
