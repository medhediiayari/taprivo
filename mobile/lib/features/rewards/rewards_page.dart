import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/theme.dart';
import '../../models/reward.dart';
import '../../widgets/brand.dart';
import 'rewards_providers.dart';

class RewardsPage extends ConsumerWidget {
  const RewardsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rewards = ref.watch(rewardsProvider);
    return Scaffold(
      backgroundColor: TaprivoBrand.cream,
      body: SafeArea(
        bottom: false,
        child: rewards.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => Center(
            child: FilledButton(
              onPressed: () => ref.invalidate(rewardsProvider),
              child: const Text('Réessayer'),
            ),
          ),
          data: (list) => RefreshIndicator(
            onRefresh: () => ref.refresh(rewardsProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              children: [
                const _Header(),
                const SizedBox(height: 20),
                if (list.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 60),
                    child: Center(child: Text('Aucune récompense pour l’instant.')),
                  )
                else ...[
                  for (final r in list) ...[
                    _RewardTile(reward: r),
                    const SizedBox(height: 14),
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
  const _Header();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        Text('Récompenses',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: TaprivoBrand.brown)),
        SizedBox(height: 4),
        Text('Vos récompenses disponibles chez nos partenaires',
            textAlign: TextAlign.center,
            style: TextStyle(color: TaprivoBrand.textSecondary, fontSize: 13)),
      ],
    );
  }
}

class _RewardTile extends StatelessWidget {
  const _RewardTile({required this.reward});
  final Reward reward;

  bool get _usable => !reward.redeemed && !reward.expired;

  String get _status {
    if (reward.redeemed) return 'Récompense utilisée';
    if (reward.expired) return 'Récompense expirée';
    return 'Disponible';
  }

  void _use(BuildContext context) {
    final brand = hexColor(reward.brandColorBg);
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: TaprivoBrand.cream,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(reward.rewardDescription,
                style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: TaprivoBrand.brown)),
            const SizedBox(height: 2),
            Text(reward.merchantName, style: const TextStyle(color: TaprivoBrand.textSecondary)),
            const SizedBox(height: 18),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: TaprivoBrand.border),
              ),
              child: Column(
                children: [
                  const Text('Code', style: TextStyle(color: TaprivoBrand.textSecondary, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(
                    reward.couponCode,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 3,
                      color: TaprivoBrand.terracotta,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Présentez votre carte (ou ce code) au comptoir : le commerçant la scanne et valide le cadeau.',
              textAlign: TextAlign.center,
              style: TextStyle(color: TaprivoBrand.textSecondary, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: reward.cardId.isEmpty
                    ? null
                    : () {
                        Navigator.of(context).pop();
                        context.push('/card/${reward.cardId}');
                      },
                style: FilledButton.styleFrom(
                  backgroundColor: brand,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                icon: const Icon(Icons.qr_code_2),
                label: const Text('Présenter ma carte', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final brand = hexColor(reward.brandColorBg);
    final logo = resolveImageUrl(reward.logoUrl);

    return Material(
      color: TaprivoBrand.card,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: _usable ? () => _use(context) : null,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                width: 112,
                child: logo != null
                    ? Image.network(
                        logo,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => ColoredBox(color: brand),
                        loadingBuilder: (_, child, p) => p == null ? child : ColoredBox(color: brand),
                      )
                    : ColoredBox(color: brand),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        reward.rewardDescription,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w700, color: TaprivoBrand.brown),
                      ),
                      const SizedBox(height: 3),
                      Text(reward.merchantName,
                          style: const TextStyle(color: TaprivoBrand.textSecondary, fontSize: 13)),
                      const SizedBox(height: 2),
                      Text(_status,
                          style: TextStyle(
                            color: _usable ? TaprivoBrand.greenSoft : TaprivoBrand.textSecondary,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          )),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: _usable ? () => _use(context) : null,
                          style: FilledButton.styleFrom(
                            backgroundColor: brand,
                            disabledBackgroundColor: TaprivoBrand.border,
                            padding: const EdgeInsets.symmetric(vertical: 11),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: Text(
                            _usable ? 'Voir et utiliser' : _status,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
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
          Icon(Icons.card_giftcard, color: TaprivoBrand.gold),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'Plus de récompenses arrivent bientôt. Restez à l’affût !',
              style: TextStyle(color: TaprivoBrand.textSecondary, fontSize: 13, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}
