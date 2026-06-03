import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/endpoints.dart';
import '../../core/providers.dart';
import '../../models/reward.dart';
import '../../widgets/brand.dart';

final rewardsProvider = FutureProvider.autoDispose<List<Reward>>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>(Endpoints.rewards);
  final list = (res.data!['rewards'] as List).cast<Map<String, dynamic>>();
  return list.map(Reward.fromJson).toList();
});

class RewardsPage extends ConsumerWidget {
  const RewardsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rewards = ref.watch(rewardsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Récompenses')),
      body: rewards.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: FilledButton(
            onPressed: () => ref.invalidate(rewardsProvider),
            child: const Text('Réessayer'),
          ),
        ),
        data: (list) {
          if (list.isEmpty) {
            return const Center(child: Text('Aucune récompense pour l’instant.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: list.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (_, i) => _RewardTile(reward: list[i]),
          );
        },
      ),
    );
  }
}

class _RewardTile extends StatelessWidget {
  const _RewardTile({required this.reward});
  final Reward reward;

  @override
  Widget build(BuildContext context) {
    final usable = !reward.redeemed && !reward.expired;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: hexColor(reward.brandColorBg),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(reward.merchantName,
              style: const TextStyle(
                  color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(reward.rewardDescription,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.9))),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Code : ${reward.couponCode}',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.9))),
              if (reward.redeemed)
                const Text('Utilisé', style: TextStyle(color: Colors.white70))
              else if (reward.expired)
                const Text('Expiré', style: TextStyle(color: Colors.white70))
              else
                const Chip(
                  label: Text('Disponible'),
                  visualDensity: VisualDensity.compact,
                  backgroundColor: Color(0xFFEF9F27),
                  labelStyle: TextStyle(color: Color(0xFF04342C), fontWeight: FontWeight.w600),
                ),
            ],
          ),
          if (usable) ...[
            const SizedBox(height: 8),
            Text('Présentez votre carte au comptoir : le commerçant la scanne et valide le cadeau.',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 12)),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: reward.cardId.isEmpty
                    ? null
                    : () => context.push('/card/${reward.cardId}'),
                icon: const Icon(Icons.qr_code_2),
                label: const Text('Présenter ma carte'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
