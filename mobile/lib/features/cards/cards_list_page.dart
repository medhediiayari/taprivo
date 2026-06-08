import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../models/loyalty_card.dart';
import '../../widgets/brand.dart';
import '../../widgets/stamp_grid.dart';
import 'cards_providers.dart';

class CardsListPage extends ConsumerWidget {
  const CardsListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cards = ref.watch(cardsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Mes cartes')),
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
    final accent = hexColor(card.brandAccent);
    final logo = resolveImageUrl(card.logoUrl);

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/card/${card.id}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (logo != null)
              SizedBox(
                height: 124,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.network(
                      logo,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => ColoredBox(color: bg),
                      loadingBuilder: (_, child, progress) =>
                          progress == null ? child : ColoredBox(color: bg),
                    ),
                    // Fade into the card background for legibility.
                    DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Colors.transparent, bg],
                          stops: const [0.4, 1.0],
                        ),
                      ),
                    ),
                    if (card.pendingRewards > 0)
                      const Positioned(
                        top: 10,
                        right: 10,
                        child: _GiftBadge(),
                      ),
                  ],
                ),
              ),
            Padding(
              padding: EdgeInsets.fromLTRB(18, logo != null ? 6 : 18, 18, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
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
                      Text(
                        '${card.stampsCount}/${card.stampsRequired}',
                        style: TextStyle(
                          color: fg.withValues(alpha: 0.8),
                          fontWeight: FontWeight.w600,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  StampGrid(
                    filled: card.stampsCount,
                    total: card.stampsRequired,
                    accent: accent,
                    foreground: fg,
                    background: bg,
                    maxCell: 34,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GiftBadge extends StatelessWidget {
  const _GiftBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(5),
      decoration: const BoxDecoration(
        color: Colors.black54,
        shape: BoxShape.circle,
      ),
      child: const Text('🎁', style: TextStyle(fontSize: 14)),
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
