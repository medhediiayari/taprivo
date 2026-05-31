/// Backend routes (see backend/src/routes). Paths are matched against the
/// `noRefresh` set by the auth interceptor, so keep them literal.
class Endpoints {
  static const login = '/auth/login';
  static const signup = '/auth/signup';
  static const refresh = '/auth/refresh';
  static const logout = '/auth/logout';
  static const me = '/auth/me';

  static const cards = '/cards';
  static String card(String id) => '/cards/$id';
  static const merchants = '/merchants';
  static const join = '/cards/join';

  static const qrGenerate = '/qr/generate';
  static const qrValidate = '/qr/validate'; // owner scans a client QR -> stamp
  static const nfcValidate = '/nfc/validate';
  static const nfcSimulate = '/nfc/simulate';

  static const rewards = '/rewards';
  static String redeem(String id) => '/rewards/$id/redeem';

  static String walletGoogle(String cardId) => '/wallet/google/$cardId';

  /// Endpoints that must never trigger a refresh-retry (would loop, or are the
  /// refresh mechanism itself). Mirrors web/src/lib/api.ts NO_REFRESH.
  static const noRefresh = {login, signup, refresh, logout};
}
