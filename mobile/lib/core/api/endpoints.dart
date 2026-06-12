/// Backend routes (see backend/src/routes). Paths are matched against the
/// `noRefresh` set by the auth interceptor, so keep them literal.
class Endpoints {
  static const login = '/auth/login';
  static const signup = '/auth/signup';
  static const refresh = '/auth/refresh';
  static const logout = '/auth/logout';
  static const me = '/auth/me';
  static const google = '/auth/google';
  static const verifyEmail = '/auth/verify-email';
  static const resendCode = '/auth/resend-code';
  static const forgotPassword = '/auth/forgot-password';
  static const resetPassword = '/auth/reset-password';

  static const cards = '/cards';
  static String card(String id) => '/cards/$id';
  static const merchants = '/merchants';
  static const join = '/cards/join';

  static const qrGenerate = '/qr/generate';
  static const qrValidate = '/qr/validate'; // owner scans a client QR -> stamp
  static const nfcValidate = '/nfc/validate';
  static const nfcRedeem = '/nfc/redeem'; // customer taps merchant badge -> redeem reward
  static const nfcSimulate = '/nfc/simulate';

  static const rewards = '/rewards';
  static String redeem(String id) => '/rewards/$id/redeem';
  static const rewardsRedeem = '/rewards/redeem'; // merchant validates by reward_id

  static const merchantHistory = '/merchants/me/history';
  static const merchantCustomers = '/merchants/me/customers';

  static String walletGoogle(String cardId) => '/wallet/google/$cardId';

  /// Endpoints that must never trigger a refresh-retry (would loop, or are the
  /// refresh mechanism itself). Mirrors web/src/lib/api.ts NO_REFRESH.
  static const noRefresh = {login, signup, refresh, logout, google, forgotPassword, resetPassword};
}
