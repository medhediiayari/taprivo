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

/// Resolves a stored logo path to a fetchable URL. Absolute URLs (seeded
/// picsum links) pass through; relative `/uploads/...` paths get the API base
/// prefixed so they hit the backend that served them.
String? resolveImageUrl(String? path) {
  if (path == null || path.isEmpty) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  final base = apiBaseUrl.endsWith('/')
      ? apiBaseUrl.substring(0, apiBaseUrl.length - 1)
      : apiBaseUrl;
  return '$base${path.startsWith('/') ? path : '/$path'}';
}

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
