import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../models/user.dart';
import 'api/api_client.dart';
import 'auth/auth_repository.dart';
import 'auth/token_store.dart';

/// Web OAuth client id, injected at build time, required for Android to return
/// an ID token: flutter run --dart-define=GOOGLE_SERVER_CLIENT_ID=xxx.apps.googleusercontent.com
const _googleServerClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final dioProvider = Provider<Dio>((ref) {
  final store = ref.watch(tokenStoreProvider);
  return buildDio(
    store,
    // Fired when a refresh ultimately fails: drop the user to /login.
    onSessionExpired: () =>
        ref.read(authControllerProvider.notifier).onSessionExpired(),
  );
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(dioProvider), ref.watch(tokenStoreProvider));
});

class AuthState {
  final User? user;
  final bool loading;

  const AuthState({this.user, this.loading = false});

  bool get isAuthenticated => user != null;
}

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    _bootstrap();
    return const AuthState(loading: true);
  }

  AuthRepository get _repo => ref.read(authRepositoryProvider);

  Future<void> _bootstrap() async {
    final user = await _repo.currentUser();
    state = AuthState(user: user);
  }

  Future<void> login(String email, String password) async {
    final user = await _repo.login(email, password);
    state = AuthState(user: user);
  }

  Future<void> signup({
    required String fullName,
    required String email,
    required String password,
  }) async {
    final user = await _repo.signup(
      fullName: fullName,
      email: email,
      password: password,
    );
    state = AuthState(user: user);
  }

  /// Triggers the Google account picker, then exchanges the ID token with the
  /// backend. Returns false if the user cancelled.
  Future<bool> googleSignIn() async {
    final google = GoogleSignIn(
      scopes: const ['email'],
      serverClientId: _googleServerClientId.isEmpty ? null : _googleServerClientId,
    );
    final account = await google.signIn();
    if (account == null) return false; // cancelled
    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null) {
      throw Exception('no_id_token');
    }
    final user = await _repo.googleAuth(idToken);
    state = AuthState(user: user);
    return true;
  }

  Future<void> verifyEmail(String code) async {
    await _repo.verifyEmail(code);
    final u = state.user;
    if (u != null) state = AuthState(user: u.copyWith(emailVerified: true));
  }

  Future<void> resendCode() => _repo.resendCode();

  Future<void> logout() async {
    await _repo.logout();
    state = const AuthState();
  }

  void onSessionExpired() => state = const AuthState();
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
