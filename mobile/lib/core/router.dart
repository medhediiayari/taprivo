import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/forgot_password_page.dart';
import '../features/auth/login_page.dart';
import '../features/auth/reset_password_page.dart';
import '../features/auth/signup_page.dart';
import '../features/auth/verify_email_page.dart';
import '../features/cards/card_detail_page.dart';
import '../features/cards/cards_list_page.dart';
import '../features/home/home_page.dart';
import '../features/onboarding/welcome_page.dart';
import '../features/owner/owner_customers_page.dart';
import '../features/owner/owner_history_page.dart';
import '../features/owner/owner_scan_page.dart';
import '../features/profile/profile_page.dart';
import '../features/rewards/rewards_page.dart';
import '../features/shell/home_shell.dart';
import 'providers.dart';

final routerProvider = Provider<GoRouter>((ref) {
  // Rebuild the router's redirect whenever auth state changes.
  final refresh = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      if (auth.loading) return null; // wait for bootstrap
      final loc = state.matchedLocation;
      const publicRoutes = {'/welcome', '/login', '/signup', '/forgot-password', '/reset-password'};
      final onPublic = publicRoutes.contains(loc);

      // Unauthenticated: only the welcome/login/signup/reset screens are reachable.
      if (!auth.isAuthenticated) return onPublic ? null : '/welcome';

      // Email verification is reachable by any authenticated role.
      if (loc == '/verify-email') return null;

      // Restaurant owners get the scanner; clients get their cards. Keep each
      // role inside its own area.
      final isOwner = auth.user?.role == 'merchant' || auth.user?.role == 'admin';
      if (onPublic) return isOwner ? '/owner' : '/';
      final inOwnerArea = loc.startsWith('/owner');
      if (isOwner && !inOwnerArea) return '/owner';
      if (!isOwner && inOwnerArea) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/welcome', builder: (_, __) => const WelcomePage()),
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(path: '/signup', builder: (_, __) => const SignupPage()),
      GoRoute(path: '/verify-email', builder: (_, __) => const VerifyEmailPage()),
      GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordPage()),
      GoRoute(
        path: '/reset-password',
        builder: (_, state) => ResetPasswordPage(email: state.extra as String? ?? ''),
      ),
      // Client area: bottom-nav shell with four tabs.
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            HomeShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: '/', builder: (_, __) => const HomePage())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/cards', builder: (_, __) => const CardsListPage())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/rewards', builder: (_, __) => const RewardsPage())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/profile', builder: (_, __) => const ProfilePage())],
          ),
        ],
      ),
      // Card detail covers the bottom bar (root navigator).
      GoRoute(
        path: '/card/:id',
        builder: (_, state) =>
            CardDetailPage(cardId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/owner', builder: (_, __) => const OwnerScanPage()),
      GoRoute(path: '/owner/history', builder: (_, __) => const OwnerHistoryPage()),
      GoRoute(path: '/owner/customers', builder: (_, __) => const OwnerCustomersPage()),
    ],
  );
});
