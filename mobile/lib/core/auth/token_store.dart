import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

/// Encrypted token storage (Keychain on iOS, Keystore-backed on Android) plus a
/// stable per-install device id sent as X-Device-Id. Mirrors the web client's
/// localStorage scheme but on secure storage.
class TokenStore {
  static const _kAccess = 'taprivo_access';
  static const _kRefresh = 'taprivo_refresh';
  static const _kDevice = 'taprivo_device';

  final FlutterSecureStorage _storage;

  TokenStore([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  Future<String?> get accessToken => _storage.read(key: _kAccess);
  Future<String?> get refreshToken => _storage.read(key: _kRefresh);

  /// Stable UUID generated once and reused. We deliberately avoid hardware
  /// identifiers (IMEI / androidId) for privacy — an app-level UUID is enough
  /// for device binding.
  Future<String> deviceId() async {
    final existing = await _storage.read(key: _kDevice);
    if (existing != null) return existing;
    final id = const Uuid().v4();
    await _storage.write(key: _kDevice, value: id);
    return id;
  }

  Future<void> saveTokens(String access, String refresh) async {
    await _storage.write(key: _kAccess, value: access);
    await _storage.write(key: _kRefresh, value: refresh);
  }

  /// Clears the session but keeps the device id stable across logins.
  Future<void> clear() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
  }
}
