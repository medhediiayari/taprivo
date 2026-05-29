import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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

  Future<void> _redeem(BuildContext context, WidgetRef ref, Reward r) async {
    try {
      await ref.read(dioProvider).post(Endpoints.redeem(r.id));
      ref.invalidate(rewardsProvider);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Échec de l’utilisation du coupon')),
        );
      }
    }
  }

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
            itemBuilder: (_, i) => _RewardTile(
              reward: list[i],
              onRedeem: () => _redeem(context, ref, list[i]),
            ),
          );
        },
      ),
    );
  }
}

class _RewardTile extends StatelessWidget {
  const _RewardTile({required this.reward, required this.onRedeem});
  final Reward reward;
  final VoidCallback onRedeem;

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
              style: TextStyle(color: Colors.white.withOpacity(0.9))),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Code : ${reward.couponCode}',
                  style: TextStyle(color: Colors.white.withOpacity(0.9))),
              if (reward.redeemed)
                const Text('Utilisé',
                    style: TextStyle(color: Colors.white70))
              else if (reward.expired)
                const Text('Expiré',
                    style: TextStyle(color: Colors.white70))
              else
                FilledButton(
                  onPressed: usable ? onRedeem : null,
                  child: const Text('Utiliser'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
