import 'package:media_kit/media_kit.dart';

import '../app/config.dart';

/// Sets an mpv property on the native player (ignored on platforms without mpv).
Future<void> mpvSet(Player p, String name, String value) async {
  try {
    final dynamic native = p.platform;
    await native.setProperty(name, value);
  } catch (_) {
    // Not an mpv backend or unknown property in this mpv build.
  }
}

/// Reads an mpv property as text (null when unavailable).
Future<String?> mpvGet(Player p, String name) async {
  try {
    final dynamic native = p.platform;
    final dynamic v = await native.getProperty(name);
    return v is String ? v : null;
  } catch (_) {
    return null;
  }
}

/// mpv tuning for IPTV: big seekable cache (rewind without reconnecting), automatic HTTP
/// reconnects and tolerant timeouts. (Deinterlacing is switched per stream by the engine.)
Future<void> configureMpvForIptv(Player p, {required int bufferMb, bool preview = false}) async {
  final mb = bufferMb.clamp(16, 512);
  await mpvSet(p, 'user-agent', AppConfig.userAgent);
  await mpvSet(p, 'network-timeout', preview ? '10' : '20');
  await mpvSet(p, 'cache', 'yes');
  await mpvSet(p, 'demuxer-max-bytes', '${preview ? 8 : mb}MiB');
  await mpvSet(p, 'demuxer-max-back-bytes', '${preview ? 2 : mb}MiB');
  await mpvSet(p, 'demuxer-seekable-cache', 'yes');
  await mpvSet(p, 'force-seekable', 'yes');
  await mpvSet(p, 'demuxer-readahead-secs', preview ? '2' : '30');
  await mpvSet(p, 'demuxer-lavf-analyzeduration', '2');
  await mpvSet(p, 'stream-lavf-o', 'reconnect=1,reconnect_streamed=1,reconnect_on_network_error=1,reconnect_delay_max=4');
  await mpvSet(p, 'hls-bitrate', 'max');
  await mpvSet(p, 'keep-open', 'no');
  await mpvSet(p, 'sub-auto', 'no');
  await mpvSet(p, 'audio-display', 'no');
  await mpvSet(p, 'deinterlace', 'no');
  if (preview) {
    await mpvSet(p, 'aid', 'no');
    await mpvSet(p, 'sid', 'no');
    await mpvSet(p, 'mute', 'yes');
  }
}
