/// Build-time settings of the Orbit Player app.
class AppConfig {
  static const String appName = 'Orbit Player';
  static const String version = '1.1.0';

  /// OrbitModul platform used for "sign in with a code" (App API).
  /// Can be changed in Settings → Advanced (kept for other stores).
  static const String defaultPlatformUrl = 'https://orbit-modul.info';

  /// Optional reseller store id (slug). Empty = codes of every store are accepted.
  static const String defaultStore = '';

  /// User-Agent sent to the IPTV server and the platform.
  static const String userAgent = 'OrbitPlayer/1.0 (Windows)';
}
