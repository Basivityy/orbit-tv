/// The XUI archive (timeshift) takes its start time as the server's *local* wall time
/// ("2026-10-19:21-05"). This keeps the offset between that wall time and UTC, learnt from
/// the server itself (server_info.time_now vs timestamp_now, or an EPG entry), so no time
/// zone database is needed.
class ServerClock {
  /// server local wall time − UTC.
  Duration offset = Duration.zero;
  bool _fromEpg = false;

  /// Parses "YYYY-MM-DD HH:MM:SS" as if it were UTC (wall-clock reading).
  static DateTime? parseWall(String? s) {
    if (s == null) return null;
    final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?').firstMatch(s.trim());
    if (m == null) return null;
    return DateTime.utc(int.parse(m[1]!), int.parse(m[2]!), int.parse(m[3]!), int.parse(m[4]!), int.parse(m[5]!), int.parse(m[6] ?? '0'));
  }

  static Duration _round15(Duration d) {
    const q = 15 * 60;
    final s = d.inSeconds;
    final r = (s / q).round() * q;
    return Duration(seconds: r);
  }

  void learnFromServerInfo(String? timeNow, int? timestampNow) {
    if (_fromEpg) return;
    final wall = parseWall(timeNow);
    if (wall == null || timestampNow == null || timestampNow <= 0) return;
    final utc = DateTime.fromMillisecondsSinceEpoch(timestampNow * 1000, isUtc: true);
    offset = _round15(wall.difference(utc));
  }

  /// EPG entries carry both the wall time ("start") and the unix time — the most reliable source.
  void learnFromEpg(String? wallStart, DateTime utcStart) {
    final wall = parseWall(wallStart);
    if (wall == null) return;
    offset = _round15(wall.difference(utcStart));
    _fromEpg = true;
  }

  /// "2026-10-19:21-05" for the timeshift URL (minute precision, floor).
  String archiveStamp(DateTime utc) {
    final w = utc.toUtc().add(offset);
    String two(int n) => n.toString().padLeft(2, '0');
    return '${w.year}-${two(w.month)}-${two(w.day)}:${two(w.hour)}-${two(w.minute)}';
  }

  /// Floors [t] to the whole minute (archive start granularity).
  static DateTime floorMinute(DateTime t) {
    final u = t.toUtc();
    return DateTime.utc(u.year, u.month, u.day, u.hour, u.minute);
  }
}
