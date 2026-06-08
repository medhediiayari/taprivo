import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/theme.dart';
import '../cards/cards_providers.dart';
import '../rewards/rewards_providers.dart';

/// Bottom-navigation scaffold hosting the client tabs (Accueil, Cartes,
/// Récompenses, Profil) via a go_router StatefulShellRoute.
class HomeShell extends ConsumerWidget {
  const HomeShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        height: 66,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        indicatorColor: TaprivoBrand.green.withValues(alpha: 0.12),
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (i) {
          // The tabs are kept alive (IndexedStack), so refetch the data that
          // can change while away — a reward unlocked or a card stamped shows
          // up immediately, no app restart needed.
          if (i == 1) ref.invalidate(cardsProvider);
          if (i == 2) ref.invalidate(rewardsProvider);
          navigationShell.goBranch(
            i,
            initialLocation: i == navigationShell.currentIndex,
          );
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: TaprivoBrand.green),
            label: 'Accueil',
          ),
          NavigationDestination(
            icon: Icon(Icons.credit_card_outlined),
            selectedIcon: Icon(Icons.credit_card, color: TaprivoBrand.green),
            label: 'Cartes',
          ),
          NavigationDestination(
            icon: Icon(Icons.card_giftcard_outlined),
            selectedIcon: Icon(Icons.card_giftcard, color: TaprivoBrand.green),
            label: 'Récompenses',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: TaprivoBrand.green),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
