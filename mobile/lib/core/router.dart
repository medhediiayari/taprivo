import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/login_page.dart';
import '../features/cards/card_detail_page.dart';
import '../features/cards/cards_list_page.dart';
import '../features/owner/owner_customers_page.dart';
import '../features/owner/owner_history_page.dart';
import '../features/owner/owner_scan_page.dart';
import '../features/rewards/rewards_page.dart';
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
      final loggingIn = loc == '/login';
      if (!auth.isAuthenticated) return loggingIn ? null : '/login';

      // Restaurant owners get the scanner; clients get their cards. Keep each
      // role inside its own area.
      final isOwner = auth.user?.role == 'merchant' || auth.user?.role == 'admin';
      if (loggingIn) return isOwner ? '/owner' : '/';
      final inOwnerArea = loc.startsWith('/owner');
      if (isOwner && !inOwnerArea) return '/owner';
      if (!isOwner && inOwnerArea) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(path: '/', builder: (_, __) => const CardsListPage()),
      GoRoute(
        path: '/card/:id',
        builder: (_, state) =>
            CardDetailPage(cardId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/rewards', builder: (_, __) => const RewardsPage()),
      GoRoute(path: '/owner', builder: (_, __) => const OwnerScanPage()),
      GoRoute(path: '/owner/history', builder: (_, __) => const OwnerHistoryPage()),
      GoRoute(path: '/owner/customers', builder: (_, __) => const OwnerCustomersPage()),
    ],
  );
});
