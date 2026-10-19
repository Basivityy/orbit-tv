import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../app/theme.dart';

/// Everything the seek bar shows, in milliseconds (epoch ms for TV, position ms for movies).
class SeekModel {
  const SeekModel({
    required this.startMs,
    required this.endMs,
    required this.positionMs,
    required this.minMs,
    required this.maxMs,
    this.liveMs,
  });
  final int startMs, endMs, positionMs, minMs, maxMs;

  /// TV: the live edge ("now"); everything after it is still to come.
  final int? liveMs;

  int clamp(int ms) {
    final lo = math.max(minMs, startMs);
    final hi = math.min(maxMs, endMs);
    if (hi <= lo) return lo;
    return ms.clamp(lo, hi);
  }
  double frac(int ms) => endMs <= startMs ? 0 : ((ms - startMs) / (endMs - startMs)).clamp(0.0, 1.0);
}

/// Seek bar with hover/drag preview (frame + time) and keyboard scrub indicator.
class SeekBar extends StatefulWidget {
  const SeekBar({
    super.key,
    required this.model,
    required this.onSeek,
    required this.previewBuilder,
    this.scrubMs,
    this.onScrubbing,
  });
  final SeekModel model;
  final ValueChanged<int> onSeek;

  /// Builds the preview bubble for a moment (frame, time, title).
  final Widget Function(int ms) previewBuilder;

  /// Externally driven scrub position (arrow keys).
  final int? scrubMs;
  final ValueChanged<bool>? onScrubbing;

  @override
  State<SeekBar> createState() => _SeekBarState();
}

class _SeekBarState extends State<SeekBar> {
  int? _hoverMs;
  int? _dragMs;
  bool _hovering = false;

  int _msAt(double dx, double width) {
    final m = widget.model;
    final f = (dx / width).clamp(0.0, 1.0);
    return m.clamp((m.startMs + f * (m.endMs - m.startMs)).round());
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final w = c.maxWidth;
      final m = widget.model;
      final previewMs = _dragMs ?? widget.scrubMs ?? (_hovering ? _hoverMs : null);
      final previewX = previewMs == null ? null : m.frac(previewMs) * w;
      const bubbleW = 272.0;
      return SizedBox(
        height: 34,
        child: Stack(clipBehavior: Clip.none, children: [
          Positioned.fill(
            child: MouseRegion(
              cursor: SystemMouseCursors.click,
              onEnter: (_) => setState(() => _hovering = true),
              onExit: (_) => setState(() {
                _hovering = false;
                _hoverMs = null;
              }),
              onHover: (e) => setState(() => _hoverMs = _msAt(e.localPosition.dx, w)),
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTapUp: (e) => widget.onSeek(_msAt(e.localPosition.dx, w)),
                onHorizontalDragStart: (e) {
                  widget.onScrubbing?.call(true);
                  setState(() => _dragMs = _msAt(e.localPosition.dx, w));
                },
                onHorizontalDragUpdate: (e) => setState(() => _dragMs = _msAt(e.localPosition.dx, w)),
                onHorizontalDragEnd: (_) {
                  final ms = _dragMs;
                  setState(() => _dragMs = null);
                  widget.onScrubbing?.call(false);
                  if (ms != null) widget.onSeek(ms);
                },
                onHorizontalDragCancel: () {
                  setState(() => _dragMs = null);
                  widget.onScrubbing?.call(false);
                },
                child: CustomPaint(painter: _BarPainter(model: m, preview: previewMs, active: _hovering || _dragMs != null || widget.scrubMs != null)),
              ),
            ),
          ),
          if (previewX != null && previewMs != null)
            Positioned(
              left: (previewX - bubbleW / 2).clamp(0.0, math.max(0.0, w - bubbleW)),
              bottom: 40,
              width: bubbleW,
              child: IgnorePointer(child: widget.previewBuilder(previewMs)),
            ),
        ]),
      );
    });
  }
}

class _BarPainter extends CustomPainter {
  _BarPainter({required this.model, required this.preview, required this.active});
  final SeekModel model;
  final int? preview;
  final bool active;

  @override
  void paint(Canvas canvas, Size size) {
    final m = model;
    final h = active ? 8.0 : 5.0;
    final y = size.height / 2;
    final r = Radius.circular(h / 2);
    final track = Rect.fromLTWH(0, y - h / 2, size.width, h);

    // Whole window
    canvas.drawRRect(RRect.fromRectAndRadius(track, r), Paint()..color = Colors.white.o(0.14));

    // Reachable part (archive/cache) — slightly brighter.
    final a = m.frac(math.max(m.minMs, m.startMs)) * size.width;
    final b = m.frac(math.min(m.maxMs, m.endMs)) * size.width;
    if (b > a) {
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTRB(a, y - h / 2, b, y + h / 2), r), Paint()..color = Colors.white.o(0.26));
    }

    // Watched up to the playhead.
    final px = m.frac(m.positionMs) * size.width;
    if (px > 0) {
      final played = Rect.fromLTRB(0, y - h / 2, px, y + h / 2);
      canvas.drawRRect(RRect.fromRectAndRadius(played, r), Paint()..shader = OrbitColors.accentGradient.createShader(Rect.fromLTWH(0, 0, size.width, size.height)));
    }

    // Future (after "now") — hatched.
    final live = m.liveMs;
    if (live != null && live < m.endMs) {
      final lx = m.frac(live) * size.width;
      final hatch = Paint()
        ..color = Colors.white.o(0.10)
        ..strokeWidth = 1;
      canvas.save();
      canvas.clipRect(Rect.fromLTRB(lx, y - h / 2, size.width, y + h / 2));
      for (var x = lx - h; x < size.width; x += 5) {
        canvas.drawLine(Offset(x, y + h / 2), Offset(x + h, y - h / 2), hatch);
      }
      canvas.restore();
      // Live edge marker
      canvas.drawCircle(Offset(lx, y), active ? 5.5 : 4.5, Paint()..color = OrbitColors.live);
    }

    // Preview cursor
    if (preview != null) {
      final x = m.frac(preview!) * size.width;
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(x, y), width: 3, height: h + 12), const Radius.circular(2)), Paint()..color = Colors.white);
    }

    // Playhead knob
    canvas.drawCircle(Offset(px, y), active ? 9 : 7, Paint()..color = Colors.white);
    canvas.drawCircle(Offset(px, y), active ? 4.5 : 3.5, Paint()..color = OrbitColors.accentDeep);
  }

  @override
  bool shouldRepaint(covariant _BarPainter old) =>
      old.model.positionMs != model.positionMs ||
      old.model.startMs != model.startMs ||
      old.model.endMs != model.endMs ||
      old.model.minMs != model.minMs ||
      old.model.maxMs != model.maxMs ||
      old.model.liveMs != model.liveMs ||
      old.preview != preview ||
      old.active != active;
}
