import 'package:flutter/material.dart';

import '../app/services.dart';
import '../data/models.dart';
import '../player/player_screen.dart';

/// Opens the player screen (once) after the engine got something to play.
Future<void> _show(BuildContext context) async {
  if (PlayerScreen.isOpen) return;
  await Navigator.of(context).push(PageRouteBuilder<void>(
    pageBuilder: (_, __, ___) => const PlayerScreen(),
    transitionDuration: const Duration(milliseconds: 220),
    reverseTransitionDuration: const Duration(milliseconds: 180),
    transitionsBuilder: (_, a, __, child) => FadeTransition(opacity: a, child: child),
  ));
}

Future<void> playChannel(BuildContext context, Channel c, {List<Channel>? list}) {
  final s = AppServices.I;
  s.engine.playChannel(c, list: list ?? s.catalog.channelsIn(c.categoryId), immediate: true);
  return _show(context);
}

Future<void> playArchive(BuildContext context, Channel c, DateTime at, {List<Channel>? list}) {
  final s = AppServices.I;
  s.engine.playArchive(c, at, list: list ?? s.catalog.channelsIn(c.categoryId));
  return _show(context);
}

/// A programme from the guide: archive when it is past, start-over/live when it is running.
Future<void> playProgram(BuildContext context, Channel c, Program p, {bool fromStart = false}) {
  final now = DateTime.now().toUtc();
  if (p.isLiveAt(now) && !fromStart) return playChannel(context, c);
  if (p.start.isAfter(now)) return playChannel(context, c);
  if (!c.hasArchive) return playChannel(context, c);
  return playArchive(context, c, p.start);
}

Future<void> playVod(BuildContext context, VodItem v, {VodInfo? info, Duration? from}) {
  AppServices.I.engine.playVod(v, info: info, from: from);
  return _show(context);
}

Future<void> playEpisode(BuildContext context, Series s, Episode e, List<Episode> all, {Duration? from}) {
  AppServices.I.engine.playEpisode(s, e, all, from: from);
  return _show(context);
}
