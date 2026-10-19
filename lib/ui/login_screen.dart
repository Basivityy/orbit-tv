import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app/config.dart';
import '../app/services.dart';
import '../app/theme.dart';
import '../data/models.dart';
import '../data/orbit_api.dart';
import '../data/xtream_client.dart';
import 'gate.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.onSignedIn});
  final VoidCallback onSignedIn;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final s = AppServices.I;
  bool _codeMode = true;
  bool _busy = false;
  String? _error;
  String? _progress;
  bool _showPass = false;
  final _code = TextEditingController();
  final _server = TextEditingController();
  final _user = TextEditingController();
  final _pass = TextEditingController();

  @override
  void initState() {
    super.initState();
    _error = s.signOutReason;
    final a = s.prefs.account;
    if (a != null && a.loginCode == null) {
      _codeMode = false;
      _server.text = a.server;
      _user.text = a.username;
    }
  }

  @override
  void dispose() {
    _code.dispose();
    _server.dispose();
    _user.dispose();
    _pass.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _progress = null;
    });
    void progress(String m) {
      if (mounted) setState(() => _progress = m);
    }

    try {
      if (_codeMode) {
        final code = _code.text.replaceAll(RegExp(r'\s'), '');
        if (code.length < 6) throw OrbitApiException('Upiši kod koji si dobio od prodavca (npr. A7K2-9QXM-4TPL).');
        await s.signInWithCode(code, progress: progress);
      } else {
        if (_server.text.trim().isEmpty || _user.text.trim().isEmpty) throw XtreamException('Upiši adresu servera i username.');
        await s.signIn(Account(server: XtreamClient.normalizeServer(_server.text), username: _user.text.trim(), password: _pass.text), progress: progress);
      }
      widget.onSignedIn();
    } on OrbitApiException catch (e) {
      setState(() => _error = e.message);
    } on XtreamException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Prijava nije uspjela: $e');
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _progress = null;
        });
      }
    }
  }

  Widget _tab(String label, bool active, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: _busy ? null : onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: active ? OrbitColors.accent : null,
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: Text(label, style: TextStyle(fontWeight: FontWeight.w800, color: active ? OrbitColors.onAccent : OrbitColors.textMuted)),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(center: Alignment(-0.8, -0.9), radius: 1.6, colors: [Color(0xFF3A3104), Color(0xFF0B0A05), OrbitColors.bg], stops: [0, 0.55, 1]),
        ),
        child: Row(children: [
          // Left: brand panel.
          Expanded(
            flex: 5,
            child: Padding(
              padding: const EdgeInsets.all(56),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const OrbitLogo(size: 40),
                const Spacer(),
                const Text('Televizija kad tebi\nodgovara.', style: TextStyles.display),
                const SizedBox(height: 18),
                const Text('Uživo, unazad 7 dana, od početka emisije, filmovi i serije — sve na jednom mjestu.', style: TextStyle(fontSize: 17, color: OrbitColors.textMuted, height: 1.5)),
                const SizedBox(height: 28),
                Wrap(spacing: 10, runSpacing: 10, children: const [
                  _Feature(Icons.live_tv_rounded, 'TV uživo'),
                  _Feature(Icons.history_rounded, 'Gledanje unazad'),
                  _Feature(Icons.replay_rounded, 'Od početka'),
                  _Feature(Icons.grid_view_rounded, 'TV vodič'),
                  _Feature(Icons.movie_rounded, 'Filmovi i serije'),
                ]),
                const Spacer(),
                Text('${AppConfig.appName} ${AppConfig.version}', style: TextStyles.tiny),
              ]),
            ),
          ),
          // Right: sign-in card.
          Expanded(
            flex: 4,
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
                child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Container(
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: OrbitColors.bgElevated.o(0.92),
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: OrbitColors.stroke),
                    boxShadow: [BoxShadow(color: Colors.black.o(0.4), blurRadius: 40, offset: const Offset(0, 20))],
                  ),
                  child: AutofillGroup(
                    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      const Text('Prijava', style: TextStyles.h1),
                      const SizedBox(height: 6),
                      const Text('Upiši kod ili podatke koje si dobio od prodavca.', style: TextStyles.muted),
                      const SizedBox(height: 22),
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(color: OrbitColors.surface, borderRadius: BorderRadius.circular(12)),
                        child: Row(children: [
                          _tab('Kod', _codeMode, () => setState(() => _codeMode = true)),
                          _tab('Username i lozinka', !_codeMode, () => setState(() => _codeMode = false)),
                        ]),
                      ),
                      const SizedBox(height: 22),
                      if (_codeMode) ...[
                        TextField(
                          controller: _code,
                          autofocus: true,
                          enabled: !_busy,
                          textCapitalization: TextCapitalization.characters,
                          style: const TextStyle(fontSize: 20, letterSpacing: 2, fontWeight: FontWeight.w700),
                          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9\- ]')), LengthLimitingTextInputFormatter(24)],
                          decoration: const InputDecoration(labelText: 'Kod', hintText: 'A7K2-9QXM-4TPL', prefixIcon: Icon(Icons.vpn_key_rounded)),
                          onSubmitted: (_) => _submit(),
                        ),
                      ] else ...[
                        TextField(
                          controller: _server,
                          enabled: !_busy,
                          autofocus: true,
                          keyboardType: TextInputType.url,
                          decoration: const InputDecoration(labelText: 'Adresa servera', hintText: 'http://server.com:8080', prefixIcon: Icon(Icons.dns_rounded)),
                          onSubmitted: (_) => _submit(),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _user,
                          enabled: !_busy,
                          autofillHints: const [AutofillHints.username],
                          decoration: const InputDecoration(labelText: 'Username', prefixIcon: Icon(Icons.person_rounded)),
                          onSubmitted: (_) => _submit(),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _pass,
                          enabled: !_busy,
                          obscureText: !_showPass,
                          autofillHints: const [AutofillHints.password],
                          decoration: InputDecoration(
                            labelText: 'Lozinka',
                            prefixIcon: const Icon(Icons.lock_rounded),
                            suffixIcon: IconButton(icon: Icon(_showPass ? Icons.visibility_off_rounded : Icons.visibility_rounded), onPressed: () => setState(() => _showPass = !_showPass)),
                          ),
                          onSubmitted: (_) => _submit(),
                        ),
                      ],
                      if (_error != null) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: OrbitColors.live.o(0.12), borderRadius: BorderRadius.circular(10), border: Border.all(color: OrbitColors.live.o(0.4))),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            const Icon(Icons.error_outline_rounded, color: OrbitColors.live, size: 20),
                            const SizedBox(width: 10),
                            Expanded(child: Text(_error!, style: const TextStyle(fontSize: 13.5))),
                          ]),
                        ),
                      ],
                      const SizedBox(height: 22),
                      SizedBox(
                        height: 52,
                        child: ElevatedButton(
                          onPressed: _busy ? null : _submit,
                          child: _busy
                              ? Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                  const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.4, color: OrbitColors.onAccent)),
                                  const SizedBox(width: 12),
                                  Flexible(child: Text(_progress ?? 'Prijavljujem…', overflow: TextOverflow.ellipsis)),
                                ])
                              : const Text('Prijavi se'),
                        ),
                      ),
                    ]),
                  ),
                ),
              ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

class _Feature extends StatelessWidget {
  const _Feature(this.icon, this.label);
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(color: Colors.white.o(0.06), borderRadius: BorderRadius.circular(30), border: Border.all(color: Colors.white.o(0.08))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 17, color: OrbitColors.accent),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
      ]),
    );
  }
}
