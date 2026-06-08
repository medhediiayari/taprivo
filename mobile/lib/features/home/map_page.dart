import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/endpoints.dart';
import '../../core/providers.dart';
import '../../core/theme/theme.dart';
import '../../models/merchant.dart';
import 'home_providers.dart';
import 'merchant_map.dart';

/// Full-screen map of nearby partners (opened from "Voir sur la carte").
class MapPage extends ConsumerStatefulWidget {
  const MapPage({super.key});

  @override
  ConsumerState<MapPage> createState() => _MapPageState();
}

class _MapPageState extends ConsumerState<MapPage> {
  Future<void> _open(Merchant m) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final res = await ref.read(dioProvider).post<Map<String, dynamic>>(
            Endpoints.join,
            data: {'merchant_id': m.id},
          );
      final cardId = res.data!['card_id'] as String;
      if (mounted) context.push('/card/$cardId');
    } catch (_) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Impossible d’ouvrir ce partenaire.')),
      );
    }
  }

  void _tap(Merchant m) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: TaprivoBrand.cream,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              m.name,
              style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: TaprivoBrand.brown),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.place_outlined, size: 16, color: TaprivoBrand.textSecondary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    m.address.isEmpty ? 'Partenaire Taprivo' : m.address,
                    style: const TextStyle(color: TaprivoBrand.textSecondary),
                  ),
                ),
              ],
            ),
            if (m.rewardDescription.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text('🎁 ${m.rewardDescription} — dès ${m.stampsRequired} tampons',
                  style: const TextStyle(color: TaprivoBrand.greenSoft, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  _open(m);
                },
                style: FilledButton.styleFrom(
                  backgroundColor: TaprivoBrand.green,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text('Voir l’offre', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final merchants = ref.watch(merchantsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Autour de vous'),
        backgroundColor: TaprivoBrand.cream,
        foregroundColor: TaprivoBrand.brown,
        elevation: 0,
      ),
      body: merchants.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: FilledButton(
            onPressed: () => ref.invalidate(merchantsProvider),
            child: const Text('Réessayer'),
          ),
        ),
        data: (list) => MerchantMap(
          merchants: list,
          onTapMerchant: _tap,
          showAttribution: true,
        ),
      ),
    );
  }
}
