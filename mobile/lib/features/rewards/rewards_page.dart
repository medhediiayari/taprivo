import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/api/api_client.dart';
import '../../core/nfc/nfc_service.dart';
import '../../core/theme/theme.dart';
import '../../models/reward.dart';
import '../../widgets/brand.dart';
import '../../widgets/celebration.dart';
import '../cards/cards_providers.dart';
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
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: TaprivoBrand.cream,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) => _UseRewardSheet(reward: reward),
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
                            _usable ? 'Utiliser' : _status,
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

/// "Utiliser" sheet: shows the card QR (which the merchant scans to validate
/// the reward) and turns on NFC so the customer can also tap a partner reader.
class _UseRewardSheet extends ConsumerStatefulWidget {
  const _UseRewardSheet({required this.reward});
  final Reward reward;

  @override
  ConsumerState<_UseRewardSheet> createState() => _UseRewardSheetState();
}

class _UseRewardSheetState extends ConsumerState<_UseRewardSheet> {
  final _nfc = NfcService();
  Timer? _poll;
  bool _nfcOn = false;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _startNfc();
    // Detect QR-side validation (merchant scanned the QR) by polling status.
    _poll = Timer.periodic(const Duration(seconds: 3), (_) => _checkRedeemed());
  }

  Future<void> _startNfc() async {
    if (!await _nfc.isAvailable()) return;
    if (mounted) setState(() => _nfcOn = true);
    final uid = await _nfc.readUid(); // resolves when a reader/tag is tapped
    if (uid != null && mounted) _celebrate();
  }

  Future<void> _checkRedeemed() async {
    try {
      final list = await ref.refresh(rewardsProvider.future);
      final hit = list.where((x) => x.id == widget.reward.id);
      if (hit.isNotEmpty && hit.first.redeemed) _celebrate();
    } catch (_) {
      // transient network error — keep polling
    }
  }

  void _celebrate() {
    if (_done || !mounted) return;
    setState(() => _done = true);
    _poll?.cancel();
    _nfc.stop();
    ref.invalidate(cardsProvider); // stamps reset after redemption
    playCelebration(context);
  }

  @override
  void dispose() {
    _poll?.cancel();
    _nfc.stop(); // best-effort: end the session when the sheet closes
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.reward;
    final qrData = r.cardId.isNotEmpty ? r.cardId : r.couponCode;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 22, 24, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(r.rewardDescription,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: TaprivoBrand.brown)),
          const SizedBox(height: 2),
          Text(r.merchantName, style: const TextStyle(color: TaprivoBrand.textSecondary)),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: TaprivoBrand.border),
            ),
            child: QrImageView(
              data: qrData,
              size: 210,
              backgroundColor: Colors.white,
            ),
          ),
          const SizedBox(height: 16),
          if (_done)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
              decoration: BoxDecoration(
                color: TaprivoBrand.success.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle, size: 20, color: TaprivoBrand.success),
                  SizedBox(width: 8),
                  Text('Récompense validée 🎉',
                      style: TextStyle(
                          color: TaprivoBrand.success, fontWeight: FontWeight.w700, fontSize: 14)),
                ],
              ),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              decoration: BoxDecoration(
                color: (_nfcOn ? TaprivoBrand.success : TaprivoBrand.textSecondary).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.nfc,
                      size: 18, color: _nfcOn ? TaprivoBrand.success : TaprivoBrand.textSecondary),
                  const SizedBox(width: 6),
                  Text(
                    _nfcOn ? 'NFC activé — approchez votre téléphone' : 'NFC indisponible',
                    style: TextStyle(
                      color: _nfcOn ? TaprivoBrand.success : TaprivoBrand.textSecondary,
                      fontWeight: FontWeight.w600,
                      fontSize: 12.5,
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 14),
          Text(
            _done
                ? 'Profitez bien de votre récompense !'
                : 'Le commerçant scanne ce QR (ou vous approchez le téléphone du lecteur) pour valider votre récompense.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: TaprivoBrand.textSecondary, fontSize: 13, height: 1.4),
          ),
        ],
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
