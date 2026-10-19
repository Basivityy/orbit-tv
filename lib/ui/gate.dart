import 'package:flutter/material.dart';

import '../app/services.dart';
import '../app/theme.dart';
import '../data/xtream_client.dart';
import 'login_screen.dart';
import 'shell.dart';
import 'widgets/common.dart';

enum _Phase { starting, login, ready, failed }

/// Decides what to show: sign-in, the app, or a retry screen when the server is unreachable.
class Gate extends StatefulWidget {
  const Gate({super.key});
  @override
  State<Gate> createState() => _GateState();
}

class _GateState extends State<Gate> {
  final s = AppServices.I;
  _Phase _phase = _Phase.starting;
  String _progress = 'Pokrećem…';
  String? _error;

  @override
  void initState() {
    super.initState();
    s.addListener(_onServices);
    if (s.prefs.account == null) {
      _phase = _Phase.login;
    } else {
      _resume();
    }
  }

  @override
  void dispose() {
    s.removeListener(_onServices);
    super.dispose();
  }

  void _onServices() {
    if (_phase == _Phase.ready && !s.signedIn && mounted) {
      setState(() => _phase = _Phase.login);
    }
  }

  Future<void> _resume() async {
    setState(() {
      _phase = _Phase.starting;
      _error = null;
    });
    try {
      await s.resume(progress: (m) {
        if (mounted) setState(() => _progress = m);
      });
      if (mounted) setState(() => _phase = _Phase.ready);
    } on XtreamException catch (e) {
      if (e.auth) {
        s.signOutReason = e.message;
        await s.signOut();
        if (mounted) setState(() => _phase = _Phase.login);
      } else {
        if (mounted) {
          setState(() {
            _phase = _Phase.failed;
            _error = e.message;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _phase = _Phase.failed;
          _error = e.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    switch (_phase) {
      case _Phase.login:
        return LoginScreen(onSignedIn: () => setState(() => _phase = _Phase.ready));
      case _Phase.ready:
        return const Shell();
      case _Phase.starting:
        return Scaffold(body: _Splash(child: LoadingView(message: _progress)));
      case _Phase.failed:
        return Scaffold(
          body: _Splash(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              MessageView(icon: Icons.wifi_off_rounded, title: 'Ne mogu se povezati', text: _error),
              const SizedBox(height: 22),
              Row(mainAxisSize: MainAxisSize.min, children: [
                ElevatedButton.icon(onPressed: _resume, icon: const Icon(Icons.refresh_rounded), label: const Text('Pokušaj ponovo')),
                const SizedBox(width: 12),
                OutlinedButton(
                  onPressed: () async {
                    await s.signOut();
                    if (mounted) setState(() => _phase = _Phase.login);
                  },
                  child: const Text('Odjava'),
                ),
              ]),
            ]),
          ),
        );
    }
  }
}

class _Splash extends StatelessWidget {
  const _Splash({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: RadialGradient(center: Alignment(-0.6, -0.8), radius: 1.4, colors: [Color(0xFF2A2405), OrbitColors.bg]),
      ),
      child: Column(children: [
        const SizedBox(height: 60),
        const OrbitLogo(size: 44),
        Expanded(child: Center(child: child)),
      ]),
    );
  }
}

/// Wordmark: orbit ring + "Orbit Player".
class OrbitLogo extends StatelessWidget {
  const OrbitLogo({super.key, this.size = 32, this.showText = true});
  final double size;
  final bool showText;
  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      SizedBox(width: size, height: size, child: CustomPaint(painter: _OrbitMark())),
      if (showText) ...[
        SizedBox(width: size * 0.32),
        Text('Orbit', style: TextStyle(fontSize: size * 0.74, fontWeight: FontWeight.w900, color: OrbitColors.text, letterSpacing: -0.6, height: 1)),
        Text(' Player', style: TextStyle(fontSize: size * 0.74, fontWeight: FontWeight.w900, color: OrbitColors.accent, letterSpacing: -0.6, height: 1)),
      ],
    ]);
  }
}

class _OrbitMark extends CustomPainter {
  @override
  void paint(Canvas canvas, Size s) {
    final c = s.center(Offset.zero);
    final r = s.shortestSide / 2;
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = r * 0.16
      ..shader = OrbitColors.accentGradient.createShader(Offset.zero & s);
    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.rotate(-0.45);
    canvas.drawOval(Rect.fromCenter(center: Offset.zero, width: r * 2, height: r * 1.1), ring);
    canvas.restore();
    canvas.drawCircle(c, r * 0.36, Paint()..color = OrbitColors.text);
    canvas.drawCircle(c + Offset(r * 0.82, -r * 0.38), r * 0.15, Paint()..color = OrbitColors.accent);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
