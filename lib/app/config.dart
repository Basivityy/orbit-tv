/// Build-time settings of the Orbit TV app.
class AppConfig {
  static const String appName = 'Orbit TV';
  static const String version = '1.0.0';

  /// OrbitModul platform used for "sign in with a code" (App API).
  /// Can be changed in Settings → Advanced (kept for other stores).
  static const String defaultPlatformUrl = 'https://orbit-modul.info';

  /// Optional reseller store id (slug). Empty = codes of every store are accepted.
  static const String defaultStore = '';

  /// User-Agent sent to the IPTV server and the platform.
  static const String userAgent = 'OrbitTV/1.0 (Windows)';
}
