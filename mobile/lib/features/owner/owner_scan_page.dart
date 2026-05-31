import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/api/endpoints.dart';
import '../../core/providers.dart';

/// Restaurant-owner screen: scan a customer's Taprivo QR. One QR does both —
/// it adds a stamp, or, if the customer already has a pending reward, surfaces
/// it so the cashier can validate it (which resets the card). No geofence: the
/// customer presents the QR in person at the counter.
class OwnerScanPage extends ConsumerStatefulWidget {
  const OwnerScanPage({super.key});

  @override
  ConsumerState<OwnerScanPage> createState() => _OwnerScanPageState();
}

class _OwnerScanPageState extends ConsumerState<OwnerScanPage> {
  final _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    facing: CameraFacing.back,
  );
  bool _busy = false; // a scan is being processed / a result is shown
  bool _working = false; // network call in flight
  Map<String, dynamic>? _scan; // /qr/validate response
  String? _redeemed; // reward description after a successful redemption
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_busy) return;
    final raw = capture.barcodes.isEmpty ? null : capture.barcodes.first.rawValue;
    if (raw == null || raw.length < 8) return;
    _busy = true;
    await _controller.stop();
    await _validate(raw);
  }

  Future<void> _validate(String token) async {
    setState(() {
      _working = true;
      _scan = null;
      _redeemed = null;
      _error = null;
    });
    try {
      final res = await ref.read(dioProvider).post<Map<String, dynamic>>(
            Endpoints.qrValidate,
            data: {'token': token},
          );
      setState(() => _scan = res.data);
    } on DioException catch (e) {
      setState(() => _error = _mapError(e));
    } catch (_) {
      setState(() => _error = 'Échec de la validation. Réessayez.');
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _redeem(String rewardId) async {
    setState(() => _working = true);
    try {
      final res = await ref.read(dioProvider).post<Map<String, dynamic>>(
            Endpoints.rewardsRedeem,
            data: {'reward_id': rewardId},
          );
      setState(() {
        _scan = null;
        _redeemed = res.data?['reward_description'] as String? ?? 'Cadeau remis';
      });
    } on DioException catch (e) {
      setState(() => _error = _mapError(e));
    } catch (_) {
      setState(() => _error = 'Échec de la validation du cadeau.');
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  String _mapError(DioException e) {
    final code = e.response?.data is Map ? e.response?.data['error'] as String? : null;
    switch (code) {
      case 'token_expired_or_used':
        return 'QR invalide. Le client doit rouvrir sa carte.';
      case 'not_your_merchant':
        return 'Cette carte appartient à un autre commerce.';
      case 'already_redeemed':
        return 'Ce cadeau a déjà été utilisé.';
      case 'expired':
        return 'Ce cadeau a expiré.';
      case 'bad_input':
        return 'QR non reconnu.';
      default:
        return 'Échec de la validation. Réessayez.';
    }
  }

  Future<void> _scanNext() async {
    setState(() {
      _scan = null;
      _redeemed = null;
      _error = null;
    });
    _busy = false;
    await _controller.start();
  }

  @override
  Widget build(BuildContext context) {
    final showOverlay = _scan != null || _redeemed != null || _error != null || _working;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scanner un client'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            tooltip: 'Historique',
            onPressed: () => context.push('/owner/history'),
          ),
          IconButton(
            icon: const Icon(Icons.flash_on),
            tooltip: 'Lampe',
            onPressed: () => _controller.toggleTorch(),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Déconnexion',
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          if (!showOverlay) const _Reticle(),
          if (showOverlay)
            _Overlay(
              working: _working,
              scan: _scan,
              redeemed: _redeemed,
              error: _error,
              onRedeem: _redeem,
              onScanNext: _scanNext,
            ),
        ],
      ),
    );
  }
}

class _Reticle extends StatelessWidget {
  const _Reticle();
  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Center(
          child: Container(
            width: 240,
            height: 240,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white70, width: 2),
              borderRadius: BorderRadius.circular(20),
            ),
          ),
        ),
        const Positioned(
          left: 0,
          right: 0,
          bottom: 48,
          child: Text(
            'Tampon ou cadeau : un seul QR',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}

class _Overlay extends StatelessWidget {
  const _Overlay({
    required this.working,
    required this.scan,
    required this.redeemed,
    required this.error,
    required this.onRedeem,
    required this.onScanNext,
  });

  final bool working;
  final Map<String, dynamic>? scan;
  final String? redeemed;
  final String? error;
  final void Function(String rewardId) onRedeem;
  final VoidCallback onScanNext;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xE004342C),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(28),
      child: working
          ? const _Working()
          : Column(mainAxisSize: MainAxisSize.min, children: _content()),
    );
  }

  List<Widget> _content() {
    if (error != null) {
      return [
        _badge(const Color(0xFFD85A30), Icons.close),
        const SizedBox(height: 16),
        _text(error!, 16),
        const SizedBox(height: 24),
        FilledButton(onPressed: onScanNext, child: const Text('Scanner un autre')),
      ];
    }
    if (redeemed != null) {
      return [
        _badge(const Color(0xFFEF9F27), Icons.check, dark: true),
        const SizedBox(height: 16),
        _label('Cadeau remis'),
        const SizedBox(height: 6),
        _text(redeemed!, 22, bold: true),
        const SizedBox(height: 4),
        _text('Carte remise à zéro.', 13, faded: true),
        const SizedBox(height: 24),
        FilledButton(onPressed: onScanNext, child: const Text('Scanner un autre')),
      ];
    }
    final data = scan ?? const {};
    final reward = data['reward'] as Map?;
    final isReward = (data['reward_available'] == true || data['unlocked'] == true) && reward != null;
    if (isReward) {
      return [
        _badge(const Color(0xFFEF9F27), Icons.card_giftcard, dark: true),
        const SizedBox(height: 16),
        _label('Ce client a un cadeau'),
        const SizedBox(height: 6),
        _text('${reward['reward_description']}', 20, bold: true),
        const SizedBox(height: 6),
        _text('${reward['coupon_code']}', 13, faded: true),
        if (data['customer_name'] != null) ...[
          const SizedBox(height: 4),
          _text('${data['customer_name']}', 13, faded: true),
        ],
        const SizedBox(height: 24),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextButton(
              onPressed: onScanNext,
              child: const Text('Plus tard', style: TextStyle(color: Colors.white70)),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: () => onRedeem(reward['id'] as String),
              child: const Text('Valider le cadeau'),
            ),
          ],
        ),
      ];
    }
    final card = (data['card'] as Map?) ?? const {};
    return [
      _badge(const Color(0xFFEF9F27), Icons.check, dark: true),
      const SizedBox(height: 16),
      _label('Tampon ajouté'),
      const SizedBox(height: 6),
      _text('${card['stamps_count']} / ${card['stamps_required']}', 34, bold: true),
      const SizedBox(height: 24),
      FilledButton(onPressed: onScanNext, child: const Text('Scanner un autre')),
    ];
  }

  Widget _badge(Color bg, IconData icon, {bool dark = false}) => CircleAvatar(
        radius: 32,
        backgroundColor: bg,
        child: Icon(icon, color: dark ? const Color(0xFF04342C) : Colors.white, size: 34),
      );

  Widget _label(String s) => Text(s,
      style: const TextStyle(color: Colors.white70, letterSpacing: 1.5, fontSize: 12));

  Widget _text(String s, double size, {bool bold = false, bool faded = false}) => Text(
        s,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: faded ? Colors.white70 : Colors.white,
          fontSize: size,
          fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
        ),
      );
}

class _Working extends StatelessWidget {
  const _Working();
  @override
  Widget build(BuildContext context) => const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: Colors.white),
          SizedBox(height: 16),
          Text('Validation…', style: TextStyle(color: Colors.white)),
        ],
      );
}
