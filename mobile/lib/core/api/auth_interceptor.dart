import 'package:dio/dio.dart';

import '../auth/token_store.dart';
import 'endpoints.dart';

/// Mirrors web/src/lib/api.ts: attaches `Authorization: Bearer` + `X-Device-Id`,
/// and on a 401 performs a single-flight refresh then retries the original
/// request exactly once.
class AuthInterceptor extends Interceptor {
  final Dio _dio;
  final TokenStore _store;
  final void Function()? onSessionExpired;

  Future<bool>? _refreshing;

  AuthInterceptor(this._dio, this._store, {this.onSessionExpired});

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    options.headers['X-Device-Id'] = await _store.deviceId();
    if (!Endpoints.noRefresh.contains(options.path)) {
      final access = await _store.accessToken;
      if (access != null) options.headers['Authorization'] = 'Bearer $access';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final path = err.requestOptions.path;
    final alreadyRetried = err.requestOptions.extra['__retried'] == true;
    final hasRefresh = (await _store.refreshToken) != null;

    final shouldRefresh = err.response?.statusCode == 401 &&
        !alreadyRetried &&
        hasRefresh &&
        !Endpoints.noRefresh.contains(path);

    if (!shouldRefresh) return handler.next(err);

    final ok = await _refreshOnce();
    if (!ok) {
      await _store.clear();
      onSessionExpired?.call();
      return handler.next(err);
    }

    try {
      final req = err.requestOptions;
      req.extra['__retried'] = true;
      req.headers['Authorization'] = 'Bearer ${await _store.accessToken}';
      final response = await _dio.fetch<dynamic>(req);
      return handler.resolve(response);
    } on DioException catch (e) {
      return handler.next(e);
    }
  }

  /// Single-flight: concurrent 401s share one in-flight refresh. Critical — the
  /// backend rotates and cascade-revokes refresh tokens, so parallel refreshes
  /// would invalidate each other and kill the whole session.
  Future<bool> _refreshOnce() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<bool> _doRefresh() async {
    final rt = await _store.refreshToken;
    if (rt == null) return false;
    try {
      // Bare Dio (no interceptors) so /auth/refresh can't recurse.
      final bare = Dio(BaseOptions(baseUrl: _dio.options.baseUrl));
      final res = await bare.post<Map<String, dynamic>>(
        Endpoints.refresh,
        data: {'refresh_token': rt},
        options: Options(headers: {'X-Device-Id': await _store.deviceId()}),
      );
      final data = res.data;
      if (data == null) return false;
      await _store.saveTokens(
        data['token'] as String,
        data['refresh_token'] as String,
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}
