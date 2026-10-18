/// Date/time formatting in local time (BHS names), without locale data packages.
class TimeFmt {
  static const _days = ['Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota', 'Nedjelja'];
  static const _daysShort = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
  static const _months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  static String two(int n) => n.toString().padLeft(2, '0');

  /// 21:05
  static String hm(DateTime t) {
    final l = t.toLocal();
    return '${two(l.hour)}:${two(l.minute)}';
  }

  /// 21:05:09
  static String hms(DateTime t) {
    final l = t.toLocal();
    return '${two(l.hour)}:${two(l.minute)}:${two(l.second)}';
  }

  /// 21:05 – 22:00
  static String range(DateTime a, DateTime b) => '${hm(a)} – ${hm(b)}';

  /// "Danas", "Jučer", "Sutra" or "Uto 14. okt"
  static String dayLabel(DateTime t, {DateTime? now}) {
    final l = t.toLocal();
    final n = (now ?? DateTime.now()).toLocal();
    final d0 = DateTime(n.year, n.month, n.day);
    final d1 = DateTime(l.year, l.month, l.day);
    final diff = d1.difference(d0).inDays;
    if (diff == 0) return 'Danas';
    if (diff == -1) return 'Jučer';
    if (diff == 1) return 'Sutra';
    return '${_daysShort[l.weekday - 1]} ${l.day}. ${_months[l.month - 1]}';
  }

  static String weekday(DateTime t) => _days[t.toLocal().weekday - 1];

  /// 14.10.2026
  static String date(DateTime t) {
    final l = t.toLocal();
    return '${two(l.day)}.${two(l.month)}.${l.year}';
  }

  /// 1:05:09 or 5:09 for durations (negative shown with "-").
  static String clock(Duration d) {
    final neg = d.isNegative;
    final a = d.abs();
    final h = a.inHours;
    final m = a.inMinutes.remainder(60);
    final s = a.inSeconds.remainder(60);
    final body = h > 0 ? '$h:${two(m)}:${two(s)}' : '$m:${two(s)}';
    return neg ? '-$body' : body;
  }

  /// "45 min", "1 h 30 min"
  static String humanMinutes(Duration d) {
    final m = d.inMinutes;
    if (m < 60) return '$m min';
    final h = m ~/ 60;
    final r = m % 60;
    return r == 0 ? '$h h' : '$h h $r min';
  }

  /// Start of the local day containing [t].
  static DateTime startOfDay(DateTime t) {
    final l = t.toLocal();
    return DateTime(l.year, l.month, l.day);
  }
}
