import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import '../../widgets/celebration.dart';
import '../../widgets/stamp_grid.dart';
import '../rewards/rewards_providers.dart';
import 'cards_providers.dart';

class CardDetailPage extends ConsumerStatefulWidget {
  const CardDetailPage({super.key, required this.cardId});
  final String cardId;

  @override
  ConsumerState<CardDetailPage> createState() => _CardDetailPageState();
}

class _CardDetailPageState extends ConsumerState<CardDetailPage>
    with WidgetsBindingObserver {
  final _nfc = NfcService();
  final _location = LocationService();
  bool _busy = false;
  bool _nfcReady = false;
  bool _nfcStarting = false;
  int? _popIndex;
  String? _lastUid; // last serial physically read — shown for diagnosis
  String _nfcStatus = 'Initialisation NFC…';
  DateTime _lastTap = DateTime.fromMillisecondsSinceEpoch(0);
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Poll while the page is open so a stamp added by the merchant (scanning
    // the customer's QR) shows up within a few seconds, no manual refresh.
    _poll = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted) return;
      ref.invalidate(cardDetailProvider(widget.cardId));
      ref.invalidate(cardHistoryProvider(widget.cardId));
      // Reflect a merchant-side stamp (and any unlocked reward) without restart.
      ref.invalidate(cardsProvider);
      ref.invalidate(rewardsProvider);
    });
    // Start the reader AFTER the first frame: Android's enableReaderMode only
    // takes effect once the activity is RESUMED. Starting it in initState (pre
    // first frame) silently no-ops, and the OS "New tag scanned" dispatch wins.
    WidgetsBinding.instance.addPostFrameCallback((_) => _startNfc());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Re-arm the reader whenever the app comes back to the foreground (reader
    // mode is dropped when the activity is paused).
    if (state == AppLifecycleState.resumed) {
      _startNfc();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _nfc.stop();
    }
  }

  Future<void> _startNfc() async {
    if (_nfcStarting) return;
    _nfcStarting = true;
    try {
      // Clear any stale session before (re)enabling reader mode.
      await _nfc.stop();
      final ok = await _nfc.startTapListener(_onBadgeTapped);
      if (!mounted) return;
      setState(() {
        _nfcReady = ok;
        _nfcStatus = ok
            ? 'NFC prêt — le restaurant peut taper son badge sur votre téléphone'
            : 'NFC indisponible — activez le NFC dans les réglages du téléphone';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _nfcReady = false;
        _nfcStatus = 'NFC indisponible ($e)';
      });
    } finally {
      _nfcStarting = false;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poll?.cancel();
    _nfc.stop();
    super.dispose();
  }

  void _refresh() {
    ref.invalidate(cardDetailProvider(widget.cardId));
    ref.invalidate(cardsProvider);
    // A stamp may have unlocked a reward — refresh that list too.
    ref.invalidate(rewardsProvider);
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
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

  /// Fired by the always-on NFC listener whenever the restaurant's badge
  /// touches the phone: validates server-side (/nfc/validate matches the
  /// provisioned device and checks the geofence), then plays haptics + the
  /// stamp pop-in (and confetti when the reward unlocks).
  Future<void> _onBadgeTapped(String uid) async {
    // Debounce: a badge held against the phone can re-trigger discovery.
    final now = DateTime.now();
    if (_busy || now.difference(_lastTap) < const Duration(seconds: 3)) return;
    _lastTap = now;
    HapticFeedback.selectionClick();
    if (!mounted) return;
    // Surface the serial we just read so the merchant can register exactly
    // this UID if it isn't known yet.
    setState(() {
      _busy = true;
      _lastUid = uid;
      _nfcStatus = 'Badge lu : $uid — validation…';
    });
    try {
      final pos = await _location.current();
      if (pos == null) {
        setState(
            () => _nfcStatus = 'Badge lu : $uid — activez la localisation');
        _toast('Activez la localisation pour valider le tampon');
        return;
      }
      if (!mounted) return;
      final res = await ref.read(dioProvider).post<Map<String, dynamic>>(
        Endpoints.nfcValidate,
        data: {
          'device_uid': uid,
          'scan_lat': pos.latitude,
          'scan_lng': pos.longitude,
        },
      );
      final unlocked = res.data?['unlocked'] == true;
      final c = res.data?['card'] as Map<String, dynamic>?;
      final count = c?['stamps_count'] as int?;
      HapticFeedback.heavyImpact();
      if (mounted) {
        setState(() {
          if (count != null) _popIndex = count - 1; // pop the new stamp
          _nfcStatus = 'Tampon ajouté ✓';
        });
      }
      if (unlocked) {
        HapticFeedback.vibrate();
        if (mounted) playCelebration(context);
        _toast('🎁 Récompense débloquée !');
      } else {
        _toast(
            'Tampon ajouté (${c?['stamps_count']}/${c?['stamps_required']})');
      }
      _refresh();
    } on DioException catch (e) {
      HapticFeedback.vibrate();
      final data = e.response?.data;
      final code = data is Map ? data['error'] : null;
      String msg;
      if (code == 'device_unknown') {
        msg = 'Badge inconnu ($uid) — à enregistrer côté restaurant';
      } else if (code == 'geofence_failed') {
        final d = data is Map ? data['distance'] : null;
        msg = 'Trop loin du restaurant${d != null ? ' (${d}m)' : ''}';
      } else if (code == 'nfc_disabled') {
        msg = 'NFC désactivé pour ce restaurant';
      } else {
        msg = 'Échec (${e.response?.statusCode ?? e.message})';
      }
      if (mounted) setState(() => _nfcStatus = msg);
      _toast(msg);
    } catch (e) {
      HapticFeedback.vibrate();
      if (mounted) setState(() => _nfcStatus = 'Erreur : $e');
      _toast('Erreur NFC : $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
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
      final ok =
          await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!ok) _toast('Impossible d’ouvrir Google Wallet');
    } on DioException catch (e) {
      if (e.response?.statusCode == 503) {
        _toast('Google Wallet n’est pas configuré sur le serveur');
        return;
      }
      // Show Google's reason (e.g. 403 = compte de service non autorisé).
      final detail =
          e.response?.data is Map ? e.response?.data['detail'] : null;
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
          popIndex: _popIndex,
        ),
        const SizedBox(height: 16),
        Text('Récompense : ${card.rewardDescription}'),
        const SizedBox(height: 24),
        // Always-on NFC: no button to press — the badge tap is detected as
        // long as this page is open. The banner stays visible with a live
        // status (ready / reading / last UID / error) so the flow is debuggable.
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: (_nfcReady ? accent : Colors.red).withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
                color:
                    (_nfcReady ? accent : Colors.red).withValues(alpha: 0.35)),
          ),
          child: Row(
            children: [
              _busy
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.4),
                    )
                  : Icon(_nfcReady ? Icons.nfc : Icons.nfc_outlined,
                      color: _nfcReady ? accent : Colors.red),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _nfcStatus,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    if (_lastUid != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          'UID lu : $_lastUid',
                          style: TextStyle(
                              fontSize: 11,
                              fontFamily: 'monospace',
                              color: TaprivoColors.oliveNuit
                                  .withValues(alpha: 0.7)),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
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
          onPressed: _addToWallet,
          icon: const Icon(Icons.account_balance_wallet_outlined),
          label: const Text('Ajouter à Google Wallet'),
        ),
        const SizedBox(height: 28),
        const Text('Historique',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        _History(cardId: widget.cardId),
      ],
    );
  }
}

class _History extends ConsumerWidget {
  const _History({required this.cardId});
  final String cardId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(cardHistoryProvider(cardId));
    return history.maybeWhen(
      data: (events) {
        if (events.isEmpty) {
          return const Text('Aucun passage pour l’instant.',
              style: TextStyle(color: Colors.black54));
        }
        return Column(
          children: events.map((e) {
            final method = (e['method'] as String?)?.toUpperCase() ?? '';
            final at = e['scanned_at'] != null
                ? DateTime.tryParse(e['scanned_at'] as String)?.toLocal()
                : null;
            return ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.check_circle_outline, size: 20),
              title: Text('Tampon${method.isNotEmpty ? ' · $method' : ''}'),
              trailing: Text(
                at != null ? _ago(at) : '',
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
            );
          }).toList(),
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }

  String _ago(DateTime t) {
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 1) return "à l'instant";
    if (d.inMinutes < 60) return '${d.inMinutes} min';
    if (d.inHours < 24) return '${d.inHours} h';
    return '${d.inDays} j';
  }
}
