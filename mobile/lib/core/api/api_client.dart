import 'package:dio/dio.dart';

import '../auth/token_store.dart';
import 'auth_interceptor.dart';

/// API base URL, injected at build time (pendant of the web's VITE_API_URL):
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
/// Default targets the host machine as seen from the Android emulator.
const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000',
);

Dio buildDio(TokenStore store, {void Function()? onSessionExpired}) {
  final dio = Dio(
    BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      contentType: 'application/json',
    ),
  );
  dio.interceptors.add(
    AuthInterceptor(dio, store, onSessionExpired: onSessionExpired),
  );
  return dio;
}
