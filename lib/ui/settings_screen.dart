import 'dart:io';

import 'package:flutter/material.dart';

import '../app/config.dart';
import '../app/services.dart';
import '../app/theme.dart';
import '../util/log.dart';
import '../util/time_fmt.dart';
import 'widgets/common.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final s = AppServices.I;
  late final _platform = TextEditingController(text: s.prefs.settings.platformUrl);
  late final _store = TextEditingController(text: s.prefs.settings.store);
  bool _advanced = false;

  @override
  void dispose() {
    _platform.dispose();
    _store.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    await s.prefs.saveSettings();
    if (s.signedIn) await s.engine.applySettings();
    if (mounted) setState(() {});
  }

  Widget _section(String title, List<Widget> children) {
    return Container(
      margin: const EdgeInsets.only(bottom: 22),
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(color: OrbitColors.surface, borderRadius: BorderRadius.circular(18), border: Border.all(color: OrbitColors.stroke)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: TextStyles.h2),
        const SizedBox(height: 14),
        ...children,
      ]),
    );
  }

  Widget _row(String label, String? hint, Widget control) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600)),
            if (hint != null) ...[const SizedBox(height: 3), Text(hint, style: TextStyles.small)],
          ]),
        ),
        const SizedBox(width: 20),
        control,
      ]),
    );
  }

  Widget _choice<T>(T value, List<(T, String)> options, ValueChanged<T> onChanged) {
    return SegmentedButton<T>(
      segments: [for (final o in options) ButtonSegment<T>(value: o.$1, label: Text(o.$2))],
      selected: {value},
      showSelectedIcon: false,
      onSelectionChanged: (v) => onChanged(v.first),
      style: ButtonStyle(
        visualDensity: VisualDensity.compact,
        backgroundColor: WidgetStateProperty.resolveWith((st) => st.contains(WidgetState.selected) ? OrbitColors.violet.o(0.35) : Colors.transparent),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final st = s.prefs.settings;
    final user = s.user;
    final acc = s.prefs.account;
    return ListView(
      padding: const EdgeInsets.only(bottom: 40),
      children: [
        const PageHeader(title: 'Postavke'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.page),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 920),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              _section('Nalog', [
                _row('Korisnik', acc?.loginCode != null ? 'Prijava kodom' : 'Prijava username/lozinka', Text(acc?.username ?? '—', style: const TextStyle(fontWeight: FontWeight.w700))),
                _row('Pretplata važi do', null, Text(user?.expiresAt == null ? 'Bez isteka' : '${TimeFmt.date(user!.expiresAt!)} ${TimeFmt.hm(user.expiresAt!)}', style: const TextStyle(fontWeight: FontWeight.w700))),
                _row('Uređaji / konekcije', 'Koliko uređaja može gledati u isto vrijeme.', Text('${user?.maxConnections ?? 1}', style: const TextStyle(fontWeight: FontWeight.w700))),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final ok = await showDialog<bool>(
                        context: context,
                        builder: (c) => AlertDialog(
                          backgroundColor: OrbitColors.bgElevated,
                          title: const Text('Odjava'),
                          content: const Text('Odjaviti se sa ovog računara?'),
                          actions: [
                            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Ne')),
                            ElevatedButton(onPressed: () => Navigator.pop(c, true), child: const Text('Odjavi me')),
                          ],
                        ),
                      );
                      if (ok == true) await s.signOut();
                    },
                    icon: const Icon(Icons.logout_rounded),
                    label: const Text('Odjava'),
                  ),
                ),
              ]),
              _section('Plejer', [
                _row('Format TV kanala', 'TS je najbrži i najstabilniji. HLS probaj ako neki kanal zastajkuje.', _choice<String>(st.liveFormat, const [('ts', 'TS'), ('m3u8', 'HLS')], (v) {
                  st.liveFormat = v;
                  _save();
                })),
                _row('Hardversko dekodiranje', 'Manje opterećuje procesor. Isključi ako slika treperi ili je zelena.', Switch(value: st.hardwareDecoding, onChanged: (v) {
                  st.hardwareDecoding = v;
                  _save();
                })),
                _row('Deinterlace', 'Uklanja "češljanje" slike na kanalima koji šalju 1080i/576i (uključuje se samo na njima). Radi uz hardversko dekodiranje.', Switch(value: st.deinterlace, onChanged: (v) {
                  st.deinterlace = v;
                  _save();
                })),
                _row('Memorija za premotavanje', 'Više memorije = duže vraćanje unazad bez ponovnog učitavanja.', _choice<int>(st.bufferMb, const [(64, '64 MB'), (128, '128 MB'), (256, '256 MB')], (v) {
                  st.bufferMb = v;
                  _save();
                })),
                _row('Skok naprijed/nazad', 'Strelice lijevo/desno u plejeru.', _choice<int>(st.skipSeconds, const [(10, '10 s'), (15, '15 s'), (30, '30 s')], (v) {
                  st.skipSeconds = v;
                  _save();
                })),
                _row(
                  'Sličice iz arhive',
                  'Prave sličice za TV vodič i premotavanje iz arhive. "Auto" samo kad nalog ima 2+ konekcije, da gledanje nikad ne prekine.',
                  _choice<String>(st.archiveThumbs, const [('auto', 'Auto'), ('on', 'Uvijek'), ('off', 'Isključeno')], (v) {
                    st.archiveThumbs = v;
                    _save();
                  }),
                ),
              ]),
              _section('Pomoć', [
                _row(
                  'Dnevnik rada (log)',
                  'Ako neki kanal ne radi, pošalji prodavcu fajl orbit_tv.log iz ovog foldera.',
                  OutlinedButton.icon(
                    onPressed: () async {
                      await Log.flush();
                      final dir = await Log.folder();
                      if (dir != null && Platform.isWindows) await Process.run('explorer.exe', [dir]);
                    },
                    icon: const Icon(Icons.folder_open_rounded),
                    label: const Text('Otvori folder'),
                  ),
                ),
              ]),
              _section('Napredno', [
                InkWell(
                  onTap: () => setState(() => _advanced = !_advanced),
                  child: Row(children: [
                    Text(_advanced ? 'Sakrij' : 'Prikaži', style: const TextStyle(color: OrbitColors.cyan, fontWeight: FontWeight.w600)),
                    Icon(_advanced ? Icons.expand_less_rounded : Icons.expand_more_rounded, color: OrbitColors.cyan),
                  ]),
                ),
                if (_advanced) ...[
                  const SizedBox(height: 14),
                  TextField(controller: _platform, decoration: const InputDecoration(labelText: 'Platforma za prijavu kodom', hintText: AppConfig.defaultPlatformUrl)),
                  const SizedBox(height: 12),
                  TextField(controller: _store, decoration: const InputDecoration(labelText: 'Prodavnica (opcionalno)', hintText: 'npr. main')),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () async {
                      st.platformUrl = _platform.text.trim().isEmpty ? AppConfig.defaultPlatformUrl : _platform.text.trim();
                      st.store = _store.text.trim();
                      await _save();
                      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sačuvano.')));
                    },
                    child: const Text('Sačuvaj'),
                  ),
                ],
              ]),
              Center(child: Text('${AppConfig.appName} ${AppConfig.version} · ID uređaja ${s.prefs.deviceId}', style: TextStyles.tiny)),
            ]),
          ),
        ),
      ],
    );
  }
}
