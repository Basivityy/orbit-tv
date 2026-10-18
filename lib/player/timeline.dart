import '../data/models.dart';
import '../data/server_clock.dart';

/// How a channel is being played.
enum ChannelMode { live, archive }

/// What the engine must do to reach a moment on a channel's timeline.
sealed class SeekPlan {
  const SeekPlan();
}

/// Already watching live at the live edge — nothing to do.
class StayLive extends SeekPlan {
  const StayLive();
}

/// Open the live stream (target is "now").
class GoLive extends SeekPlan {
  const GoLive();
}

/// Seek inside the current stream (data is in mpv's cache) to [position].
class SeekInStream extends SeekPlan {
  const SeekInStream(this.position);
  final Duration position;
}

/// Open the archive at the minute [minute] (UTC) and skip [offset] more once it plays.
class OpenArchive extends SeekPlan {
  const OpenArchive(this.minute, this.offset);
  final DateTime minute;
  final Duration offset;
}

/// The moment is not available (no archive / outside the archive window).
class NotAvailable extends SeekPlan {
  const NotAvailable(this.reason);
  final String reason;
}

/// State of the stream currently open for a channel.
class StreamState {
  const StreamState({
    required this.mode,
    required this.origin,
    required this.position,
    required this.bufferedEnd,
    required this.backCache,
    this.ranges = const [],
  });

  final ChannelMode mode;

  /// Absolute time (UTC) of stream position 0 (live: when it was opened; archive: URL start minute).
  final DateTime origin;
  final Duration position;

  /// mpv cache end (position up to which data is downloaded).
  final Duration bufferedEnd;

  /// How far back from [position] data is surely still cached (fallback when [ranges] is empty).
  final Duration backCache;

  /// Exact seekable ranges of mpv's cache (stream positions), when mpv reports them.
  final List<(Duration, Duration)> ranges;

  bool cached(Duration pos) {
    if (ranges.isNotEmpty) {
      for (final r in ranges) {
        // Stay a little inside the edges: the very end may not be decodable yet.
        if (pos >= r.$1 && pos <= r.$2 - const Duration(milliseconds: 800)) return true;
      }
      return false;
    }
    return pos >= position - backCache && pos <= bufferedEnd;
  }

  DateTime get playhead => origin.add(position);
}

class Timeline {
  /// Within this distance of "now", playback counts as live.
  static const liveTolerance = Duration(seconds: 25);

  /// Archive requests are capped (XUI builds the stream from minute files).
  static const maxArchiveChunk = Duration(hours: 3);

  /// Earliest moment that can be reached on [channel].
  static DateTime? earliest(Channel channel, DateTime now, StreamState? s) {
    final a = channel.archiveStart(now);
    if (a != null) return a.add(const Duration(minutes: 2)); // the oldest minutes are rotated out first
    if (s == null) return null;
    if (s.ranges.isNotEmpty) return s.origin.add(s.ranges.first.$1);
    final cacheStart = s.position - s.backCache;
    return s.origin.add(cacheStart.isNegative ? Duration.zero : cacheStart);
  }

  static SeekPlan plan({
    required Channel channel,
    required DateTime target,
    required DateTime now,
    StreamState? stream,
  }) {
    var t = target;
    if (t.isAfter(now)) t = now;

    final atLiveEdge = !t.isBefore(now.subtract(liveTolerance));
    if (atLiveEdge) {
      if (stream != null && stream.mode == ChannelMode.live && !stream.playhead.isBefore(now.subtract(liveTolerance))) {
        return const StayLive();
      }
      return const GoLive();
    }

    // Inside what mpv already has?
    if (stream != null) {
      final pos = t.difference(stream.origin);
      if (!pos.isNegative && stream.cached(pos)) {
        return SeekInStream(pos);
      }
    }

    final earliest = Timeline.earliest(channel, now, stream);
    if (!channel.hasArchive) {
      return const NotAvailable('Ovaj kanal nema arhivu — može se vratiti samo koliko je već učitano.');
    }
    if (earliest != null && t.isBefore(earliest)) {
      return NotAvailable('Arhiva ovog kanala traje ${channel.archiveDays} ${channel.archiveDays == 1 ? 'dan' : 'dana'}.');
    }
    final minute = ServerClock.floorMinute(t);
    return OpenArchive(minute, t.difference(minute));
  }

  /// Length to request when opening the archive at [start]: up to now (it grows while recording),
  /// at most [maxArchiveChunk]; continuation is opened when it ends.
  static Duration archiveLength(DateTime start, DateTime now) {
    final available = now.difference(start);
    final mins = available.inMinutes + 2;
    final d = Duration(minutes: mins < 2 ? 2 : mins);
    return d > maxArchiveChunk ? maxArchiveChunk : d;
  }

  /// The span the seek bar shows: the programme at the playhead, or a 1-hour window.
  static (DateTime, DateTime) window(DateTime playhead, Program? program, DateTime now) {
    if (program != null) return (program.start, program.end);
    final l = playhead.toUtc();
    final start = DateTime.utc(l.year, l.month, l.day, l.hour, l.minute < 30 ? 0 : 30);
    var end = start.add(const Duration(hours: 1));
    if (end.isBefore(now) && now.difference(playhead) < const Duration(minutes: 30)) {
      end = now.add(const Duration(minutes: 10));
    }
    return (start, end);
  }
}
