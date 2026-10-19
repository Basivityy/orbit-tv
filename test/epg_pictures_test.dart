import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:orbit_tv/data/models.dart';
import 'package:orbit_tv/data/orbit_api.dart';
import 'package:orbit_tv/data/xmltv_icons.dart';

Channel _ch(String name, String epgId) => Channel(id: 1, number: 1, name: name, logo: '', categoryId: '1', epgId: epgId, hasArchive: true, archiveDays: 7);

Program _p(DateTime start, String title) => Program(channelId: 1, start: start, end: start.add(const Duration(hours: 1)), title: title, description: '', hasArchiveFlag: true);

String _t(DateTime t) {
  String two(int v) => v.toString().padLeft(2, '0');
  return '${t.year}${two(t.month)}${two(t.day)}${two(t.hour)}${two(t.minute)}00 +0000';
}

void main() {
  group('EPG pictures', () {
    test('picture keys from the panel JSON', () {
      expect(Program.pictureOf({'image': 'https://x/a.jpg'}), 'https://x/a.jpg');
      expect(Program.pictureOf({'icon': ' http://x/b.png '}), 'http://x/b.png');
      expect(Program.pictureOf({'images': null, 'poster': ['https://x/c.jpg']}), 'https://x/c.jpg');
      expect(Program.pictureOf({'image': {'url': 'https://x/d.jpg'}}), 'https://x/d.jpg');
      expect(Program.pictureOf({'image': 'data:image/png;base64,AAA'}), isNull);
      expect(Program.pictureOf({}), isNull);
      final p = Program.fromJson({'start_timestamp': '1760900400', 'stop_timestamp': '1760904000', 'title': 'TmV3cw==', 'img': 'https://x/e.jpg'}, 3)!;
      expect(p.icon, 'https://x/e.jpg');
    });

    test('names and titles are normalised', () {
      expect(XmltvIcons.normName('BA: Nova BH HD'), 'novabh');
      expect(XmltvIcons.normName('HRT 1 (FHD)'), 'hrt1');
      expect(XmltvIcons.titleHash('Dnevnik 2'), XmltvIcons.titleHash('DNEVNIK-2'));
      expect(XmltvIcons.titleHash('Bez naziva'), 0);
    });

    test('tolerant matching: exact start, same title, near start', () {
      const base = 1760900400;
      final e = [(base, 'u1', XmltvIcons.titleHash('Vijesti')), (base + 3600, 'u2', XmltvIcons.titleHash('Film')), (base + 7200, 'u3', XmltvIcons.titleHash('Sport'))];
      expect(XmltvIcons.matchForTest(e, base + 3600, XmltvIcons.titleHash('Nešto drugo')), 'u2'); // same start
      expect(XmltvIcons.matchForTest(e, base + 3600 + 300, 0), 'u2'); // 5 min later
      expect(XmltvIcons.matchForTest(e, base + 3600 + 3600 * 2, XmltvIcons.titleHash('Film')), 'u2'); // 2 h shifted, same title
      expect(XmltvIcons.matchForTest(e, base + 3600 * 5, XmltvIcons.titleHash('Ništa')), isNull);
      expect(XmltvIcons.matchForTest(e, base + 1800, XmltvIcons.titleHash('Ništa')), isNull); // 30 min off, other title
    });

    test('downloads XMLTV (plain and gzip) and finds pictures', () async {
      final now = DateTime.now().toUtc();
      final h = DateTime.utc(now.year, now.month, now.day, now.hour);
      final xml = '''<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="Nova.ba"><display-name>Nova BH</display-name><icon src="https://logo/nova.png"/></channel>
  <channel id="other.ba"><display-name>Other TV HD</display-name></channel>
  <programme start="${_t(h)}" stop="${_t(h.add(const Duration(hours: 1)))}" channel="Nova.ba">
    <title lang="bs">Vijesti</title><icon src="https://img/vijesti.jpg"/>
  </programme>
  <programme start="${_t(h.add(const Duration(hours: 1)))}" stop="${_t(h.add(const Duration(hours: 2)))}" channel="Nova.ba">
    <title>Film &amp; serija</title>
    <image type="poster" orient="P">https://img/poster.jpg</image>
    <image type="backdrop" orient="L" size="3"><![CDATA[https://img/backdrop.jpg]]></image>
  </programme>
  <programme start="${_t(h)}" stop="${_t(h.add(const Duration(hours: 1)))}" channel="other.ba"><title>Bez slike</title></programme>
  <programme start="${_t(h)}" stop="${_t(h.add(const Duration(hours: 1)))}" channel="other.ba"><title>Druga</title><icon src="https://img/other.jpg"/></programme>
</tv>''';
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((req) {
        final body = utf8.encode(xml);
        req.response.add(req.uri.path.endsWith('.gz') ? gzip.encode(body) : body);
        req.response.close();
      });
      final tmp = await Directory.systemTemp.createTemp('orbit_xmltv');
      try {
        for (final path in ['/xmltv.php', '/epg.xml.gz']) {
          final icons = XmltvIcons(cacheDir: () async => tmp);
          var notified = 0;
          icons.addListener(() => notified++);
          await icons.load('http://127.0.0.1:${server.port}$path', force: true);
          expect(icons.lastError, isNull, reason: path);
          expect(icons.count, 3, reason: path);
          expect(notified, greaterThan(0));
          // By epg id (case-insensitive).
          expect(icons.iconFor(_ch('Nova', 'nova.ba'), _p(h, 'Vijesti')), 'https://img/vijesti.jpg');
          // Landscape picture wins over the poster.
          expect(icons.iconFor(_ch('Nova', 'NOVA.BA'), _p(h.add(const Duration(hours: 1)), 'Film & serija')), 'https://img/backdrop.jpg');
          // No epg id in the panel: matched by channel name.
          expect(icons.iconFor(_ch('BA: Nova BH FHD', ''), _p(h.add(const Duration(minutes: 4)), 'Vijesti')), 'https://img/vijesti.jpg');
          expect(icons.iconFor(_ch('Other TV', ''), _p(h, 'Druga')), 'https://img/other.jpg');
          expect(icons.iconFor(_ch('Unknown', 'x.y'), _p(h, 'Vijesti')), isNull);
        }
        // Cached copy is used on the next start.
        final again = XmltvIcons(cacheDir: () async => tmp);
        await again.load('http://127.0.0.1:${server.port}/epg.xml.gz');
        expect(again.count, 3);
        // An unreachable source keeps what was loaded.
        await again.load('http://127.0.0.1:${server.port}/epg.xml.gz', extraUrl: 'http://127.0.0.1:1/none.xml', force: true);
        expect(again.count, 3);
      } finally {
        await server.close(force: true);
        await tmp.delete(recursive: true);
      }
    });
  });

  group('Platform messages', () {
    test('Orbit Player licence answers are explained in Bosnian', () {
      expect(platformMessage('no_seats', 'x'), contains('slobodnih mjesta'));
      expect(platformMessage('player_inactive', 'x'), contains('nije aktivan'));
      expect(platformMessage('not_licensed', 'x'), contains('nije registrovana'));
      expect(platformMessage('something_new', 'fallback'), 'fallback');
      expect(OrbitApiException('x').transient, isTrue);
      expect(OrbitApiException('x', code: 'server_error').transient, isTrue);
      expect(OrbitApiException('x', code: 'no_seats').transient, isFalse);
    });
  });
}
