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
  @override
  String toString() => message;
}

/// OrbitModul App API (POST /api/app/v1/activate | status | extend).
class OrbitApi {
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
          .post(_u(path), headers: {'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': AppConfig.userAgent}, body: jsonEncode({...body, if (store.isNotEmpty) 'store': store}))
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
      throw OrbitApiException(asStr(j['message'], 'Kod nije prihvaćen.'), code: asStr(j['error']));
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
