import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';

import 'app/config.dart';
import 'app/services.dart';
import 'app/theme.dart';
import 'ui/gate.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  MediaKit.ensureInitialized();
  // Never let a stray async error close the app.
  PlatformDispatcher.instance.onError = (e, st) {
    debugPrint('Uncaught: $e\n$st');
    return true;
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
