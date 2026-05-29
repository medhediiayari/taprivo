import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../models/loyalty_card.dart';
import '../../widgets/brand.dart';
import 'cards_providers.dart';

class CardsListPage extends ConsumerWidget {
  const CardsListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cards = ref.watch(cardsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mes cartes'),
        actions: [
          IconButton(
            icon: const Icon(Icons.card_giftcard_outlined),
            tooltip: 'Récompenses',
            onPressed: () => context.push('/rewards'),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Déconnexion',
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: cards.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorState(onRetry: () => ref.invalidate(cardsProvider)),
        data: (list) {
          if (list.isEmpty) {
            return const Center(child: Text('Aucune carte pour le moment.'));
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(cardsProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, i) => _CardTile(card: list[i]),
            ),
          );
        },
      ),
    );
  }
}

class _CardTile extends StatelessWidget {
  const _CardTile({required this.card});
  final LoyaltyCard card;

  @override
  Widget build(BuildContext context) {
    final bg = hexColor(card.brandColorBg);
    final fg = hexColor(card.brandColorFg);
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => context.push('/card/${card.id}'),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      card.merchantName,
                      style: TextStyle(
                        color: fg,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (card.pendingRewards > 0)
                    const Text('🎁', style: TextStyle(fontSize: 20)),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                '${card.stampsCount} / ${card.stampsRequired} tampons',
                style: TextStyle(color: fg.withOpacity(0.85)),
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: card.progress,
                  minHeight: 8,
                  backgroundColor: fg.withOpacity(0.2),
                  valueColor:
                      AlwaysStoppedAnimation(hexColor(card.brandAccent)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Impossible de charger vos cartes.'),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Réessayer')),
        ],
      ),
    );
  }
}
