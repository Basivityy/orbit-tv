import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';

import 'app/config.dart';
import 'app/services.dart';
import 'app/theme.dart';
import 'ui/gate.dart';
import 'util/log.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  MediaKit.ensureInitialized();
  unawaited(Log.init());
  Log.i('${AppConfig.appName} ${AppConfig.version} starting');
  // Never let a stray async error close the app.
  PlatformDispatcher.instance.onError = (e, st) {
    Log.i('Uncaught: $e\n$st');
    return true;
  };
  FlutterError.onError = (details) {
    Log.i('Flutter: ${details.exceptionAsString()}\n${details.stack ?? ''}');
    FlutterError.presentError(details);
  };
  await AppServices.I.boot();
  runApp(const OrbitApp());
}

class OrbitApp extends StatelessWidget {
  const OrbitApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: OrbitTheme.build(),
      themeMode: ThemeMode.dark,
      home: const Gate(),
    );
  }
}
