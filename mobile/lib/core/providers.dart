import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/user.dart';
import 'api/api_client.dart';
import 'auth/auth_repository.dart';
import 'auth/token_store.dart';

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

  Future<void> logout() async {
    await _repo.logout();
    state = const AuthState();
  }

  void onSessionExpired() => state = const AuthState();
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
