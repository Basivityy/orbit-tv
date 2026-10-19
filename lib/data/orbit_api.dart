import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../app/config.dart';
import 'models.dart';

/// Result of signing in with an activation/login code on the OrbitModul platform.
class CodeLogin {
  CodeLogin({required this.status, this.account, this.expiresAt, this.storeName, this.contact, this.extendUrl, this.message});
  final String status; // active | expired | activating | extending | error
  final Account? account;
  final DateTime? expiresAt;
  final String? storeName, contact, extendUrl, message;
}

class OrbitApiException implements Exception {
  OrbitApiException(this.message, {this.code});
  final String message;
  final String? code;

  /// No answer from the platform, or a temporary problem there (not a "no").
  bool get transient => code == null || code!.isEmpty || code == 'server_error' || code == 'rate_limited';

  @override
  String toString() => message;
}

/// Platform error codes → messages for the viewer (the platform answers in English).
String platformMessage(String code, String fallback) {
  switch (code) {
    case 'no_seats':
      return 'Tvoj prodavac trenutno nema slobodnih mjesta za Orbit Player. Javi mu se.';
    case 'player_inactive':
      return 'Orbit Player trenutno nije aktivan kod tvog prodavca. Javi mu se.';
    case 'not_licensed':
      return 'Ova linija nije registrovana za Orbit Player. Prijavi se kodom od prodavca ili mu se javi.';
    case 'unknown_code':
      return 'Ovaj kod ne postoji. Provjeri da li si ga dobro prepisao.';
    case 'invalid_code':
      return 'Upiši kod od 12 znakova, npr. A7K2-9QXM-4TPL.';
    case 'device_limit':
      return 'Ovaj kod se već koristi na najvećem broju uređaja. Javi se prodavcu da resetuje uređaje.';
    case 'unknown_device':
      return 'Na ovom uređaju se prvo prijavi kodom.';
    case 'extension_code':
      return 'Ovim kodom je produžena linija — prijavi se prvim kodom.';
    case 'store_inactive':
      return 'Prodavnica trenutno nije aktivna. Javi se prodavcu.';
    case 'rate_limited':
      return 'Previše pokušaja. Sačekaj par minuta pa probaj ponovo.';
    default:
      return fallback;
  }
}

/// OrbitModul App API (POST /api/app/v1/activate | status | extend | player/check).
class OrbitApi {
  /// Tells the platform this is Orbit Player (user places of the store are checked).
  static const clientName = 'orbit-player';

  OrbitApi({required this.platformUrl, this.store = '', http.Client? client}) : _http = client ?? http.Client();
  final String platformUrl;
  final String store;
  final http.Client _http;

  Uri _u(String path) {
    var b = platformUrl.trim();
    while (b.endsWith('/')) {
      b = b.substring(0, b.length - 1);
    }
    if (!b.startsWith('http')) b = 'https://$b';
    return Uri.parse('$b/api/app/v1/$path');
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    try {
      final res = await _http
          .post(_u(path), headers: {'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': AppConfig.userAgent}, body: jsonEncode({...body, 'client': clientName, if (store.isNotEmpty) 'store': store}))
          .timeout(const Duration(seconds: 30));
      final text = utf8.decode(res.bodyBytes, allowMalformed: true);
      final j = jsonDecode(text);
      if (j is! Map) throw OrbitApiException('Neispravan odgovor servera.');
      return Map<String, dynamic>.from(j);
    } on TimeoutException {
      throw OrbitApiException('Server se ne javlja. Pokušaj ponovo.');
    } on SocketException {
      throw OrbitApiException('Nema interneta ili je server nedostupan.');
    } on http.ClientException {
      throw OrbitApiException('Nema veze sa serverom.');
    } on FormatException {
      throw OrbitApiException('Neispravan odgovor servera.');
    }
  }

  CodeLogin _parse(Map<String, dynamic> j, String loginCode) {
    final status = asStr(j['status'], 'error');
    if (status == 'error') {
      final code = asStr(j['error'], 'error');
      throw OrbitApiException(platformMessage(code, asStr(j['message'], 'Kod nije prihvaćen.')), code: code);
    }
    Account? acc;
    final server = asStr(j['server']);
    final user = asStr(j['username']);
    if (server.isNotEmpty && user.isNotEmpty) {
      acc = Account(server: server, username: user, password: asStr(j['password']), loginCode: loginCode);
    }
    final store = j['store'] is Map ? Map<String, dynamic>.from(j['store'] as Map) : const <String, dynamic>{};
    return CodeLogin(
      status: status,
      account: acc,
      expiresAt: DateTime.tryParse(asStr(j['expiresAt'])),
      storeName: asStr(store['name']).isEmpty ? null : asStr(store['name']),
      contact: asStr(store['contact']).isEmpty ? null : asStr(store['contact']),
      extendUrl: asStr(store['extendUrl']).isEmpty ? null : asStr(store['extendUrl']),
    );
  }

  /// New code → creates the line (status "activating" — poll); used code → signs in.
  Future<CodeLogin> activate(String code, String deviceId, String deviceName) async {
    final clean = code.trim().toUpperCase();
    return _parse(await _post('activate', {'code': clean, 'deviceId': deviceId, 'deviceName': deviceName}), clean);
  }

  /// On app start: fresh server/username/password/expiry for a code login.
  Future<CodeLogin> status(String loginCode, String deviceId) async {
    return _parse(await _post('status', {'loginCode': loginCode, 'deviceId': deviceId}), loginCode);
  }

  /// Extends the same line with a new code.
  Future<CodeLogin> extend(String loginCode, String newCode, String deviceId) async {
    return _parse(await _post('extend', {'loginCode': loginCode, 'code': newCode.trim().toUpperCase(), 'deviceId': deviceId}), loginCode);
  }

  /// Signed in with server + username + password (no code): may this line use Orbit Player?
  /// Returns "active" or "expired"; throws [OrbitApiException] with the platform's reason.
  Future<String> playerCheck({required String server, required String username, required String password, required String deviceId, required String deviceName}) async {
    final j = await _post('player/check', {'server': server, 'username': username, 'password': password, 'deviceId': deviceId, 'deviceName': deviceName});
    final status = asStr(j['status'], 'error');
    if (status == 'error') {
      final code = asStr(j['error'], 'error');
      throw OrbitApiException(platformMessage(code, asStr(j['message'], 'Prijava nije dozvoljena.')), code: code);
    }
    return status;
  }

  /// Signs in with [code], waiting while a brand-new line is being created.
  Future<CodeLogin> activateAndWait(String code, String deviceId, String deviceName, {void Function(String)? onProgress}) async {
    var r = await activate(code, deviceId, deviceName);
    var tries = 0;
    while ((r.status == 'activating' || r.status == 'extending') && tries < 40) {
      onProgress?.call('Pravim tvoju liniju… (${tries + 1})');
      await Future<void>.delayed(const Duration(seconds: 3));
      r = await activate(code, deviceId, deviceName);
      tries++;
    }
    if (r.status == 'activating') throw OrbitApiException('Aktivacija traje duže nego obično. Pokušaj ponovo za minut.');
    if (r.status == 'expired') throw OrbitApiException('Pretplata je istekla. Produži je novim kodom.');
    if (r.account == null) throw OrbitApiException('Server nije poslao podatke za prijavu.');
    return r;
  }

  void close() => _http.close();
}
