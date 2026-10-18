import 'package:flutter_test/flutter_test.dart';
import 'package:orbit_tv/data/models.dart';
import 'package:orbit_tv/data/server_clock.dart';
import 'package:orbit_tv/player/engine.dart' show parseSeekableRanges;
import 'package:orbit_tv/player/widgets/seek_bar.dart';
import 'package:orbit_tv/util/debouncer.dart';
import 'package:orbit_tv/util/time_fmt.dart';

void main() {
  group('ServerClock', () {
    test('learns the offset from an EPG entry and builds the archive stamp', () {
      final c = ServerClock();
      final utcStart = DateTime.utc(2026, 10, 19, 19, 0);
      c.learnFromEpg('2026-10-19 21:00:00', utcStart);
      expect(c.offset, const Duration(hours: 2));
      expect(c.archiveStamp(DateTime.utc(2026, 10, 19, 19, 5, 40)), '2026-10-19:21-05');
    });

    test('server_info is ignored once the EPG taught the offset', () {
      final c = ServerClock();
      c.learnFromEpg('2026-10-19 20:00:00', DateTime.utc(2026, 10, 19, 19, 0));
      c.learnFromServerInfo('2026-10-19 23:00:00', DateTime.utc(2026, 10, 19, 19, 0).millisecondsSinceEpoch ~/ 1000);
      expect(c.offset, const Duration(hours: 1));
    });

    test('offset is rounded to 15 minutes (clock drift)', () {
      final c = ServerClock();
      c.learnFromServerInfo('2026-10-19 21:00:40', DateTime.utc(2026, 10, 19, 19, 0).millisecondsSinceEpoch ~/ 1000);
      expect(c.offset, const Duration(hours: 2));
    });

    test('archive stamp crosses midnight correctly', () {
      final c = ServerClock()..offset = const Duration(hours: 2);
      expect(c.archiveStamp(DateTime.utc(2026, 12, 31, 23, 30)), '2027-01-01:01-30');
    });

    test('parseWall accepts "T" and missing seconds', () {
      expect(ServerClock.parseWall('2026-10-19T21:05'), DateTime.utc(2026, 10, 19, 21, 5));
      expect(ServerClock.parseWall('garbage'), isNull);
    });
  });

  group('Xtream parsing', () {
    test('base64 EPG text is decoded, plain text is kept', () {
      expect(decodeMaybeBase64('RGFuYXMgdSAyMWg='), 'Danas u 21h');
      expect(decodeMaybeBase64('News'), 'News');
      expect(decodeMaybeBase64('Dnevnik 2'), 'Dnevnik 2');
      expect(decodeMaybeBase64(null), '');
    });

    test('programme from get_simple_data_table', () {
      final p = Program.fromJson({
        'title': 'U3BvcnQ=',
        'description': '',
        'start': '2026-10-19 21:00:00',
        'start_timestamp': '1792429200',
        'stop_timestamp': '1792432800',
        'has_archive': 1,
      }, 7)!;
      expect(p.title, 'Sport');
      expect(p.duration, const Duration(hours: 1));
      expect(p.hasArchiveFlag, isTrue);
      expect(p.serverStart, '2026-10-19 21:00:00');
      expect(p.key, '7@1792429200');
    });

    test('broken programme (end before start) is skipped', () {
      expect(Program.fromJson({'start_timestamp': 200, 'stop_timestamp': 100}, 1), isNull);
    });

    test('channel from get_live_streams', () {
      final c = Channel.fromJson({
        'num': '12',
        'name': ' RTS 1 ',
        'stream_id': 345,
        'stream_icon': 'http://x/logo.png',
        'category_id': '3',
        'epg_channel_id': 'rts1.rs',
        'tv_archive': '1',
        'tv_archive_duration': '7',
      }, 0);
      expect(c.number, 12);
      expect(c.name, 'RTS 1');
      expect(c.hasArchive, isTrue);
      expect(c.archiveDays, 7);
    });

    test('archive flag without days means no archive', () {
      final c = Channel.fromJson({'stream_id': 1, 'tv_archive': 1, 'tv_archive_duration': 0}, 4);
      expect(c.hasArchive, isFalse);
      expect(c.number, 5);
    });

    test('lenient number parsing', () {
      expect(asInt('7'), 7);
      expect(asInt(' 7.6 '), 8);
      expect(asInt(''), isNull);
      expect(asBool('1'), isTrue);
      expect(asBool('0'), isFalse);
      expect(asStr(null, 'x'), 'x');
    });
  });

  group('Player helpers', () {
    test('mpv seekable ranges', () {
      final r = parseSeekableRanges('{"seekable-ranges":[{"start":1.5,"end":64.25}],"cache-end":64.25}');
      expect(r, hasLength(1));
      expect(r.first.$1, const Duration(milliseconds: 1500));
      expect(r.first.$2, const Duration(milliseconds: 64250));
      expect(parseSeekableRanges('not json'), isEmpty);
      expect(parseSeekableRanges('{"seekable-ranges":[{"start":5,"end":2}]}'), isEmpty);
    });

    test('seek model clamps into the reachable part', () {
      const m = SeekModel(startMs: 0, endMs: 1000, positionMs: 500, minMs: 200, maxMs: 800, liveMs: 800);
      expect(m.clamp(100), 200);
      expect(m.clamp(900), 800);
      expect(m.clamp(500), 500);
      expect(m.frac(250), 0.25);
      const empty = SeekModel(startMs: 0, endMs: 1000, positionMs: 0, minMs: 600, maxMs: 400);
      expect(empty.clamp(10), 600);
    });

    test('clock and duration formatting', () {
      expect(TimeFmt.clock(const Duration(minutes: 5, seconds: 9)), '5:09');
      expect(TimeFmt.clock(const Duration(hours: 1, minutes: 2, seconds: 3)), '1:02:03');
      expect(TimeFmt.clock(const Duration(seconds: -75)), '-1:15');
      expect(TimeFmt.humanMinutes(const Duration(minutes: 90)), '1 h 30 min');
    });

    test('LRU evicts the least recently used entry', () {
      final l = Lru<String, int>(2);
      l.put('a', 1);
      l.put('b', 2);
      l.get('a');
      l.put('c', 3);
      expect(l.containsKey('a'), isTrue);
      expect(l.containsKey('b'), isFalse);
    });
  });
}
