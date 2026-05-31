import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/location/location_service.dart';
import '../../core/nfc/nfc_service.dart';
import '../../core/providers.dart';
import '../../core/theme/theme.dart';
import '../../models/loyalty_card.dart';
import '../../widgets/brand.dart';
import '../../widgets/stamp_grid.dart';
import 'cards_providers.dart';

class CardDetailPage extends ConsumerStatefulWidget {
  const CardDetailPage({super.key, required this.cardId});
  final String cardId;

  @override
  ConsumerState<CardDetailPage> createState() => _CardDetailPageState();
}

class _CardDetailPageState extends ConsumerState<CardDetailPage> {
  final _nfc = NfcService();
  final _location = LocationService();
  bool _busy = false;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    // Poll while the page is open so a stamp added by the merchant (scanning
    // the customer's QR) shows up within a few seconds, no manual refresh.
    _poll = Timer.periodic(const Duration(seconds: 4), (_) {
      if (mounted) ref.invalidate(cardDetailProvider(widget.cardId));
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  void _refresh() {
    ref.invalidate(cardDetailProvider(widget.cardId));
    ref.invalidate(cardsProvider);
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg)));
  }

  /// Demo stamp via /nfc/simulate (uses the merchant's own coords server-side).
  Future<void> _simulateStamp(LoyaltyCard card) async {
    setState(() => _busy = true);
    try {
      final res = await ref.read(dioProvider).post<Map<String, dynamic>>(
        Endpoints.nfcSimulate,
        data: {'merchant_id': card.merchantId},
      );
      final unlocked = res.data?['unlocked'] == true;
      final c = res.data?['card'] as Map<String, dynamic>?;
      _toast(unlocked
          ? '🎁 Récompense débloquée !'
          : 'Tampon ajouté (${c?['stamps_count']}/${c?['stamps_required']})');
      _refresh();
    } catch (_) {
      _toast('Échec de l’ajout du tampon');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Reads a physical NFC badge to prove the plumbing. Full validation
  /// (/nfc/validate) requires challenge-response provisioning — see §5.6.
  Future<void> _readNfc() async {
    if (!await _nfc.isAvailable()) {
      _toast('NFC indisponible sur cet appareil');
      return;
    }
    final uid = await _nfc.readUid();
    final pos = await _location.current();
    if (uid == null) {
      _toast('Aucun badge lu');
      return;
    }
    final where = pos == null
        ? 'GPS indisponible'
        : '${pos.latitude.toStringAsFixed(4)}, ${pos.longitude.toStringAsFixed(4)}';
    _toast('Badge $uid · $where');
  }

  /// Requests an "Add to Google Wallet" URL from the backend and opens it.
  Future<void> _addToWallet() async {
    try {
      final res = await ref
          .read(dioProvider)
          .post<Map<String, dynamic>>(Endpoints.walletGoogle(widget.cardId));
      final url = res.data?['saveUrl'] as String?;
      if (url == null) {
        _toast('Wallet indisponible');
        return;
      }
      final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!ok) _toast('Impossible d’ouvrir Google Wallet');
    } on DioException catch (e) {
      if (e.response?.statusCode == 503) {
        _toast('Google Wallet n’est pas configuré sur le serveur');
        return;
      }
      // Show Google's reason (e.g. 403 = compte de service non autorisé).
      final detail = e.response?.data is Map ? e.response?.data['detail'] : null;
      _toast(detail is String && detail.isNotEmpty
          ? 'Wallet: $detail'
          : 'Échec de l’ajout à Google Wallet');
    }
  }

  /// Shows the card's stable QR (the loyalty-card id) — the same value carried
  /// by the Google Wallet barcode. The merchant scans it to add a stamp; it
  /// never expires.
  Future<void> _showQr(LoyaltyCard card) async {
    await showModalBottomSheet<void>(
      context: context,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Montrez ce QR au comptoir',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            const Text('Le commerçant le scanne pour ajouter un tampon'),
            const SizedBox(height: 16),
            QrImageView(data: card.id, size: 220),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(cardDetailProvider(widget.cardId));
    return Scaffold(
      appBar: AppBar(title: const Text('Carte')),
      body: detail.when(
        // Keep showing the card during the 4s poll refresh instead of flashing
        // a spinner each time.
        skipLoadingOnReload: true,
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: FilledButton(
            onPressed: () => ref.invalidate(cardDetailProvider(widget.cardId)),
            child: const Text('Réessayer'),
          ),
        ),
        data: (card) => _body(card),
      ),
    );
  }

  Widget _body(LoyaltyCard card) {
    final accent = hexColor(card.brandAccent);
    final bg = hexColor(card.brandColorBg);
    final logo = resolveImageUrl(card.logoUrl);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (logo != null) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(
                logo,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => ColoredBox(color: bg),
                loadingBuilder: (_, child, progress) =>
                    progress == null ? child : ColoredBox(color: bg),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
        Text(card.merchantName,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
        if (card.address != null) ...[
          const SizedBox(height: 4),
          Text(card.address!),
        ],
        const SizedBox(height: 24),
        Text('${card.stampsCount} / ${card.stampsRequired} tampons',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 16),
        StampGrid(
          filled: card.stampsCount,
          total: card.stampsRequired,
          accent: accent,
          foreground: TaprivoColors.oliveNuit,
          background: TaprivoColors.sable,
        ),
        const SizedBox(height: 16),
        Text('Récompense : ${card.rewardDescription}'),
        const SizedBox(height: 32),
        FilledButton.icon(
          onPressed: _busy ? null : () => _simulateStamp(card),
          icon: const Icon(Icons.add),
          label: const Text('Ajouter un tampon (démo)'),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => _showQr(card),
          icon: const Icon(Icons.qr_code_2),
          label: const Text('Afficher le QR'),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _readNfc,
          icon: const Icon(Icons.nfc),
          label: const Text('Lire un badge NFC'),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _addToWallet,
          icon: const Icon(Icons.account_balance_wallet_outlined),
          label: const Text('Ajouter à Google Wallet'),
        ),
      ],
    );
  }
}
