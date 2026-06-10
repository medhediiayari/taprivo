import 'dart:ui' show FontFeature;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/theme.dart';
import '../../models/loyalty_card.dart';
import '../../widgets/brand.dart';
import 'cards_providers.dart';

class CardsListPage extends ConsumerWidget {
  const CardsListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cards = ref.watch(cardsProvider);
    return Scaffold(
      backgroundColor: TaprivoBrand.cream,
      body: SafeArea(
        bottom: false,
        child: cards.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _ErrorState(onRetry: () => ref.invalidate(cardsProvider)),
          data: (list) => RefreshIndicator(
            onRefresh: () => ref.refresh(cardsProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              children: [
                _Header(onAdd: () => context.go('/')),
                const SizedBox(height: 20),
                if (list.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 60),
                    child: Center(child: Text('Aucune carte pour le moment.')),
                  )
                else ...[
                  for (final c in list) ...[
                    _CardTile(card: c),
                    const SizedBox(height: 16),
                  ],
                  const SizedBox(height: 4),
                  const _HintCard(),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onAdd});
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const SizedBox(width: 44),
        const Expanded(
          child: Column(
            children: [
              Text('Cartes',
                  style: TextStyle(
                      fontSize: 26, fontWeight: FontWeight.w800, color: TaprivoBrand.brown)),
              SizedBox(height: 4),
              Text('Vos cartes de fidélité chez nos partenaires',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: TaprivoBrand.textSecondary, fontSize: 13)),
            ],
          ),
        ),
        IconButton(
          onPressed: onAdd,
          icon: const Icon(Icons.add, color: TaprivoBrand.green),
          tooltip: 'Ajouter une carte',
          style: IconButton.styleFrom(
            backgroundColor: TaprivoBrand.card,
            side: const BorderSide(color: TaprivoBrand.border),
          ),
        ),
      ],
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
    final logo = resolveImageUrl(card.logoUrl);
    final remaining = (card.stampsRequired - card.stampsCount).clamp(0, card.stampsRequired);
    final ready = card.pendingRewards > 0 || remaining == 0;

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/card/${card.id}'),
        child: Stack(
          children: [
            // Faint decorative leaf in the corner.
            Positioned(
              right: -16,
              bottom: -24,
              child: Icon(Icons.spa_outlined, size: 130, color: fg.withValues(alpha: 0.06)),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _LogoCircle(logo: logo, fg: fg, name: card.merchantName),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              card.merchantName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: fg, fontSize: 18, fontWeight: FontWeight.w700),
                            ),
                            if ((card.address ?? '').isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(
                                card.address!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: fg.withValues(alpha: 0.7), fontSize: 12.5),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '${card.stampsCount} / ${card.stampsRequired}',
                            style: TextStyle(
                              color: fg,
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                              fontFeatures: const [FontFeature.tabularFigures()],
                            ),
                          ),
                          Text('tampons',
                              style: TextStyle(color: fg.withValues(alpha: 0.7), fontSize: 11)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _Dots(filled: card.stampsCount, total: card.stampsRequired, fg: fg),
                  const SizedBox(height: 16),
                  Text(
                    ready ? 'Votre récompense est disponible 🎁' : 'Encore $remaining ${remaining > 1 ? 'tampons' : 'tampon'} pour obtenir',
                    style: TextStyle(color: fg.withValues(alpha: 0.75), fontSize: 12),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    card.rewardDescription,
                    style: TextStyle(color: fg, fontSize: 15, fontWeight: FontWeight.w700),
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

class _LogoCircle extends StatelessWidget {
  const _LogoCircle({required this.logo, required this.fg, required this.name});
  final String? logo;
  final Color fg;
  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: fg.withValues(alpha: 0.15),
        border: Border.all(color: fg.withValues(alpha: 0.35)),
      ),
      clipBehavior: Clip.antiAlias,
      child: logo != null
          ? Image.network(
              logo!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _fallback(),
              loadingBuilder: (_, child, p) => p == null ? child : _fallback(),
            )
          : _fallback(),
    );
  }

  Widget _fallback() => Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 18),
        ),
      );
}

class _Dots extends StatelessWidget {
  const _Dots({required this.filled, required this.total, required this.fg});
  final int filled;
  final int total;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (var i = 0; i < total; i++)
          Container(
            width: 18,
            height: 18,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: i < filled ? fg : Colors.transparent,
              border: Border.all(color: fg.withValues(alpha: 0.45), width: 1.4),
            ),
          ),
      ],
    );
  }
}

class _HintCard extends StatelessWidget {
  const _HintCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: TaprivoBrand.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: TaprivoBrand.border),
      ),
      child: Row(
        children: const [
          Icon(Icons.spa_outlined, color: TaprivoBrand.gold),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'Cumulez des tampons et profitez de récompenses exclusives chez nos partenaires.',
              style: TextStyle(color: TaprivoBrand.textSecondary, fontSize: 13, height: 1.4),
            ),
          ),
        ],
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
