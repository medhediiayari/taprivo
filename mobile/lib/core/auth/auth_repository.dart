import 'package:dio/dio.dart';

import '../../models/user.dart';
import '../api/endpoints.dart';
import 'token_store.dart';

class AuthRepository {
  final Dio _dio;
  final TokenStore _store;

  AuthRepository(this._dio, this._store);

  Future<User> login(String email, String password) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.login,
      data: {'email': email, 'password': password},
    );
    return _persist(res.data!);
  }

  Future<User> signup({
    required String fullName,
    required String email,
    required String password,
    String role = 'client',
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.signup,
      data: {
        'full_name': fullName,
        'email': email,
        'password': password,
        'role': role,
      },
    );
    return _persist(res.data!);
  }

  /// Exchanges a Google ID token for a Taprivo session.
  Future<User> googleAuth(String idToken) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.google,
      data: {'id_token': idToken},
    );
    return _persist(res.data!);
  }

  Future<void> verifyEmail(String code) async {
    await _dio.post(Endpoints.verifyEmail, data: {'code': code});
  }

  Future<void> resendCode() async {
    await _dio.post(Endpoints.resendCode);
  }

  Future<void> forgotPassword(String email) async {
    await _dio.post(Endpoints.forgotPassword, data: {'email': email});
  }

  Future<void> resetPassword({
    required String email,
    required String code,
    required String password,
  }) async {
    await _dio.post(Endpoints.resetPassword,
        data: {'email': email, 'code': code, 'password': password});
  }

  /// Restores the session on app start. Returns null if no valid token (the
  /// interceptor will have already attempted a refresh on the /auth/me 401).
  Future<User?> currentUser() async {
    if (await _store.accessToken == null) return null;
    try {
      final res = await _dio.get<Map<String, dynamic>>(Endpoints.me);
      return User.fromJson(res.data!);
    } catch (_) {
      return null;
    }
  }

  Future<void> logout() async {
    final rt = await _store.refreshToken;
    if (rt != null) {
      try {
        await _dio.post(Endpoints.logout, data: {'refresh_token': rt});
      } catch (_) {
        // best-effort server-side revocation
      }
    }
    await _store.clear();
  }

  Future<User> _persist(Map<String, dynamic> data) async {
    await _store.saveTokens(
      data['token'] as String,
      data['refresh_token'] as String,
    );
    return User.fromJson(data['user'] as Map<String, dynamic>);
  }
}
