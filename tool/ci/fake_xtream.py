"""Fake Xtream Codes / XUI.ONE server for CI end-to-end tests of Orbit TV.

Serves player_api.php (channels, EPG, movies, series), live streams (paced at real time),
timeshift (archive) streams, movie files with HTTP Range, xmltv.php with programme pictures,
logos, and the OrbitModul App API check for Orbit Player (POST /api/app/v1/player/check).
Test media: test_progressive.ts (720p25), test_interlaced.ts (576i25) and epg1..4.png, made by ffmpeg in CI.
EPG pictures: channels 101-103 in xmltv.php (<icon> and XMLTV 1.1 <image>), 104 in the JSON EPG, 105 none.
"""
import base64
import json
import os
import re
import sys
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "."))
MEDIA = sys.argv[1] if len(sys.argv) > 1 else "."
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8899
USER, PASS = "ciuser", "cipass"
SERVER_TZ = 3600  # server wall clock = UTC+1 (tests the archive time stamp conversion)
LOGO = None

CATS = [{"category_id": "1", "category_name": "Informativni", "parent_id": 0},
        {"category_id": "2", "category_name": "Sport HD", "parent_id": 0}]
CHANNELS = [
    (101, 1, "Orbit Info", "1", True, "test_progressive.ts"),
    (102, 2, "Orbit Vijesti", "1", True, "test_progressive.ts"),
    (103, 3, "Orbit Sport 1 (576i)", "2", True, "test_interlaced.ts"),
    (104, 4, "Orbit Sport 2", "2", True, "test_progressive.ts"),
    (105, 5, "Orbit Bez Arhive", "1", False, "test_progressive.ts"),
]
TITLES = ["Jutarnji program", "Dnevnik", "Sportski pregled", "Film: Zvjezdana staza", "Dokumentarac",
          "Muzički sat", "Vijesti", "Kviz", "Serija: Grad", "Fudbal uživo", "Košarka", "Noćni program"]


def b64(s):
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


def wall(ts):
    return time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(ts + SERVER_TZ))


def xmltv_time(ts):
    return time.strftime("%Y%m%d%H%M%S", time.gmtime(ts + SERVER_TZ)) + " +0100"


def epg_picture(stream_id, k):
    return "http://127.0.0.1:%d/epgimg/%d.png" % (PORT, (k + stream_id) % 4 + 1)


def programmes(stream_id, now):
    base = int(now // 1800) * 1800
    out = []
    for k in range(-16, 14):
        start = base + k * 1800
        end = start + 1800
        t = TITLES[(k + stream_id) % len(TITLES)]
        extra = {"image": epg_picture(stream_id, k)} if stream_id == 104 else {}
        out.append({**extra,
            "id": str(stream_id * 1000 + k + 100),
            "epg_id": str(stream_id),
            "title": b64(t),
            "lang": "bs",
            "start": wall(start),
            "end": wall(end),
            "description": b64("Opis emisije %s na kanalu %d. Test podaci za Orbit TV." % (t, stream_id)),
            "channel_id": "orbit%d" % stream_id,
            "start_timestamp": str(start),
            "stop_timestamp": str(end),
            "now_playing": 1 if start <= now < end else 0,
            "has_archive": 1 if end <= now else 0,
        })
    return out


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("[fake] " + (fmt % args) + "\n")

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = dict(urllib.parse.parse_qsl(u.query))
        p = u.path
        try:
            if p == "/player_api.php":
                return self.api(q)
            if p == "/xmltv.php":
                return self.xmltv()
            if p.startswith("/logo/"):
                return self.file(LOGO, "image/png")
            m = re.match(r"^/epgimg/(\d+)\.png$", p)
            if m:
                path = os.path.join(MEDIA, "epg%d.png" % ((int(m.group(1)) - 1) % 4 + 1))
                return self.file(path if os.path.exists(path) else LOGO, "image/png")
            m = re.match(r"^/live/([^/]+)/([^/]+)/(\d+)\.(ts|m3u8)$", p)
            if m:
                return self.live(int(m.group(3)))
            m = re.match(r"^/timeshift/([^/]+)/([^/]+)/(\d+)/([0-9:-]+)/(\d+)\.ts$", p)
            if m:
                sys.stderr.write("[fake] TIMESHIFT duration=%s start=%s stream=%s\n" % (m.group(3), m.group(4), m.group(5)))
                return self.file(self.media_for(int(m.group(5))), "video/mp2t")
            m = re.match(r"^/(movie|series)/([^/]+)/([^/]+)/(\d+)\.(\w+)$", p)
            if m:
                return self.file(os.path.join(MEDIA, "test_progressive.ts"), "video/mp2t")
            self.send_error(404)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def do_POST(self):
        """OrbitModul App API: Orbit Player licence check for username/password sign-ins."""
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            body = {}
        p = urllib.parse.urlparse(self.path).path
        sys.stderr.write("[fake] POST %s client=%s user=%s\n" % (p, body.get("client"), body.get("username")))
        if p == "/api/app/v1/player/check":
            if body.get("client") != "orbit-player" or not body.get("deviceId"):
                return self._json({"status": "error", "error": "invalid_request", "message": "bad request"}, 400)
            if body.get("username") == USER and body.get("password") == PASS:
                return self._json({"status": "active", "expiresAt": None, "store": {"name": "CI store", "extendUrl": None, "contact": None}})
            return self._json({"status": "error", "error": "not_licensed",
                               "message": "This line is not registered for Orbit Player."}, 404)
        return self._json({"status": "error", "error": "not_found", "message": "not found"}, 404)

    def media_for(self, sid):
        for c in CHANNELS:
            if c[0] == sid:
                return os.path.join(MEDIA, c[5])
        return os.path.join(MEDIA, "test_progressive.ts")

    def api(self, q):
        if q.get("username") != USER or q.get("password") != PASS:
            return self._json({"user_info": {"auth": 0}})
        a = q.get("action")
        now = time.time()
        host = "http://127.0.0.1:%d" % PORT
        if not a:
            return self._json({
                "user_info": {"username": USER, "password": PASS, "auth": 1, "status": "Active",
                              "exp_date": str(int(now + 30 * 86400)), "is_trial": "0", "active_cons": "0",
                              "max_connections": "2", "allowed_output_formats": ["m3u8", "ts"]},
                "server_info": {"url": "127.0.0.1", "port": str(PORT), "timezone": "Europe/Sarajevo",
                                "timestamp_now": int(now), "time_now": wall(now)},
            })
        if a == "get_live_categories":
            return self._json(CATS)
        if a == "get_live_streams":
            return self._json([{"num": n, "name": name, "stream_type": "live", "stream_id": sid,
                                "stream_icon": host + "/logo/%d.png" % sid, "epg_channel_id": "orbit%d" % sid,
                                "added": "1700000000", "category_id": cat, "tv_archive": 1 if arch else 0,
                                "tv_archive_duration": 3 if arch else 0} for (sid, n, name, cat, arch, _) in CHANNELS])
        if a in ("get_short_epg", "get_simple_data_table"):
            sid = int(q.get("stream_id", "0"))
            progs = programmes(sid, now)
            if a == "get_short_epg":
                progs = [x for x in progs if int(x["stop_timestamp"]) > now][: int(q.get("limit", "4"))]
            return self._json({"epg_listings": progs})
        if a == "get_vod_categories":
            return self._json([{"category_id": "10", "category_name": "Akcija", "parent_id": 0}])
        if a == "get_vod_streams":
            return self._json([{"num": i, "name": "Test film %d" % i, "stream_type": "movie", "stream_id": 500 + i,
                                "stream_icon": host + "/logo/m%d.png" % i, "rating": "7.%d" % i, "added": str(int(now) - i * 3600),
                                "category_id": "10", "container_extension": "ts"} for i in range(1, 9)])
        if a == "get_vod_info":
            return self._json({"info": {"plot": "Test film za provjeru plejera.", "genre": "Akcija", "duration_secs": 300,
                                        "releasedate": "2024-05-01", "rating": "7.5", "director": "CI", "cast": "Orbit"},
                               "movie_data": {"stream_id": q.get("vod_id"), "container_extension": "ts"}})
        if a == "get_series_categories":
            return self._json([{"category_id": "20", "category_name": "Drama", "parent_id": 0}])
        if a == "get_series":
            return self._json([{"num": 1, "name": "Test serija", "series_id": 900, "cover": host + "/logo/s.png",
                                "plot": "Serija za test.", "genre": "Drama", "releaseDate": "2023-01-01",
                                "last_modified": str(int(now)), "rating": "8.1", "category_id": "20"}])
        if a == "get_series_info":
            eps = {"1": [{"id": "9001", "episode_num": 1, "title": "Pilot", "container_extension": "ts", "season": 1,
                          "info": {"duration_secs": 300, "plot": "Prva epizoda."}},
                         {"id": "9002", "episode_num": 2, "title": "Drugi dio", "container_extension": "ts", "season": 1,
                          "info": {"duration_secs": 300, "plot": "Druga epizoda."}}]}
            return self._json({"seasons": [], "info": {"name": "Test serija"}, "episodes": eps})
        return self._json([])

    def xmltv(self):
        now = time.time()
        base = int(now // 1800) * 1800
        parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<tv generator-info-name="fake">']
        for (sid, _n, name, _c, _a, _m) in CHANNELS:
            parts.append('<channel id="orbit%d"><display-name>%s</display-name></channel>' % (sid, name))
        for sid in (101, 102, 103):
            for k in range(-16, 14):
                start = base + k * 1800
                t = TITLES[(k + sid) % len(TITLES)]
                if sid == 102:
                    pic = '<image type="backdrop" orient="L" size="3">%s</image>' % epg_picture(sid, k)
                else:
                    pic = '<icon src="%s" width="960" height="540"/>' % epg_picture(sid, k)
                parts.append('<programme start="%s" stop="%s" channel="orbit%d"><title lang="bs">%s</title>%s</programme>'
                             % (xmltv_time(start), xmltv_time(start + 1800), sid, t.replace("&", "&amp;"), pic))
        parts.append('</tv>')
        body = "\n".join(parts).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/xml")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def file(self, path, ctype):
        size = os.path.getsize(path)
        start, end = 0, size - 1
        rng = self.headers.get("Range")
        if rng:
            m = re.match(r"bytes=(\d*)-(\d*)", rng)
            if m:
                if m.group(1):
                    start = int(m.group(1))
                if m.group(2):
                    end = min(int(m.group(2)), size - 1)
            self.send_response(206)
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        else:
            self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            left = end - start + 1
            while left > 0:
                chunk = f.read(min(65536, left))
                if not chunk:
                    break
                self.wfile.write(chunk)
                left -= len(chunk)

    def live(self, sid):
        """Endless live stream: the test file in a loop, paced at its real bitrate."""
        path = self.media_for(sid)
        size = os.path.getsize(path)
        duration = 300.0
        rate = size / duration
        self.send_response(200)
        self.send_header("Content-Type", "video/mp2t")
        self.send_header("Connection", "close")
        self.end_headers()
        pos = int((time.time() % duration) * rate) // 188 * 188
        t0 = time.time()
        sent = 0
        burst = int(rate * 3)  # 3 s head start like a real server
        with open(path, "rb") as f:
            f.seek(pos)
            while True:
                chunk = f.read(188 * 348)
                if not chunk:
                    f.seek(0)
                    continue
                self.wfile.write(chunk)
                sent += len(chunk)
                ahead = (sent - burst) / rate - (time.time() - t0)
                if ahead > 0:
                    time.sleep(ahead)


def main():
    global LOGO
    LOGO = os.path.join(MEDIA, "logo.png")
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    srv.daemon_threads = True
    sys.stderr.write("[fake] listening on %d\n" % PORT)
    srv.serve_forever()


if __name__ == "__main__":
    main()
