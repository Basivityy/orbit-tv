import 'package:flutter_test/flutter_test.dart';
import 'package:orbit_tv/data/models.dart';
import 'package:orbit_tv/player/timeline.dart';

Channel _channel({bool archive = true, int days = 3}) => Channel(
      id: 7,
      number: 1,
      name: 'Test 1',
      logo: '',
      categoryId: '1',
      epgId: '',
      hasArchive: archive,
      archiveDays: archive ? days : 0,
    );

void main() {
  final now = DateTime.utc(2026, 10, 19, 20, 0, 0);

  group('Timeline.plan', () {
    test('target at the live edge while live → stay live', () {
      final s = StreamState(
        mode: ChannelMode.live,
        origin: now.subtract(const Duration(minutes: 5)),
        position: const Duration(minutes: 5),
        bufferedEnd: const Duration(minutes: 5, seconds: 2),
        backCache: const Duration(seconds: 20),
      );
      expect(Timeline.plan(channel: _channel(), target: now, now: now, stream: s), isA<StayLive>());
    });

    test('target in the future is treated as now', () {
      expect(Timeline.plan(channel: _channel(), target: now.add(const Duration(hours: 1)), now: now), isA<GoLive>());
    });

    test('target inside mpv cache → seek in the stream (no new connection)', () {
      final s = StreamState(
        mode: ChannelMode.live,
        origin: now.subtract(const Duration(minutes: 10)),
        position: const Duration(minutes: 10),
        bufferedEnd: const Duration(minutes: 10),
        backCache: const Duration(seconds: 20),
        ranges: const [(Duration.zero, Duration(minutes: 10))],
      );
      final plan = Timeline.plan(channel: _channel(), target: now.subtract(const Duration(minutes: 4)), now: now, stream: s);
      expect(plan, isA<SeekInStream>());
      expect((plan as SeekInStream).position, const Duration(minutes: 6));
    });

    test('target outside the cache → archive opened at the whole minute plus an offset', () {
      final target = DateTime.utc(2026, 10, 19, 18, 31, 45);
      final plan = Timeline.plan(channel: _channel(), target: target, now: now);
      expect(plan, isA<OpenArchive>());
      final a = plan as OpenArchive;
      expect(a.minute, DateTime.utc(2026, 10, 19, 18, 31));
      expect(a.offset, const Duration(seconds: 45));
    });

    test('channel without archive cannot go back beyond the cache', () {
      final plan = Timeline.plan(channel: _channel(archive: false), target: now.subtract(const Duration(hours: 1)), now: now);
      expect(plan, isA<NotAvailable>());
    });

    test('older than the archive window → not available', () {
      final plan = Timeline.plan(channel: _channel(days: 1), target: now.subtract(const Duration(days: 2)), now: now);
      expect(plan, isA<NotAvailable>());
    });
  });

  group('Timeline helpers', () {
    test('archive length grows with the recording and is capped', () {
      expect(Timeline.archiveLength(now.subtract(const Duration(minutes: 10)), now), const Duration(minutes: 12));
      expect(Timeline.archiveLength(now.subtract(const Duration(hours: 6)), now), Timeline.maxArchiveChunk);
      expect(Timeline.archiveLength(now, now), const Duration(minutes: 2));
    });

    test('seek window is the programme when known', () {
      final p = Program(channelId: 7, start: now.subtract(const Duration(minutes: 30)), end: now.add(const Duration(minutes: 30)), title: 'x', description: '', hasArchiveFlag: true);
      final (a, b) = Timeline.window(now, p, now);
      expect(a, p.start);
      expect(b, p.end);
    });

    test('seek window without EPG is a half-hour aligned hour', () {
      final (a, b) = Timeline.window(DateTime.utc(2026, 10, 19, 19, 40), null, now);
      expect(a, DateTime.utc(2026, 10, 19, 19, 30));
      expect(b, DateTime.utc(2026, 10, 19, 20, 30));
    });

    test('earliest reachable moment', () {
      expect(Timeline.earliest(_channel(days: 2), now, null), now.subtract(const Duration(days: 2)).add(const Duration(minutes: 2)));
      expect(Timeline.earliest(_channel(archive: false), now, null), isNull);
    });

    test('cached() keeps a safety margin at the end of a range', () {
      final s = StreamState(
        mode: ChannelMode.archive,
        origin: now,
        position: const Duration(seconds: 30),
        bufferedEnd: const Duration(seconds: 60),
        backCache: Duration.zero,
        ranges: const [(Duration(seconds: 10), Duration(seconds: 60))],
      );
      expect(s.cached(const Duration(seconds: 59)), isTrue);
      expect(s.cached(const Duration(seconds: 59, milliseconds: 500)), isFalse);
      expect(s.cached(const Duration(seconds: 5)), isFalse);
    });
  });
}
