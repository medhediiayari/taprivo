import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/api/endpoints.dart';
import '../../core/providers.dart';

/// Restaurant-owner screen: scan a customer's Taprivo QR to add a stamp.
/// Calls POST /qr/validate (requires the merchant role). No geofence: the
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
  bool _validating = false;
  Map<String, dynamic>? _result;
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
      _validating = true;
      _result = null;
      _error = null;
    });
    try {
      final res = await ref.read(dioProvider).post<Map<String, dynamic>>(
            Endpoints.qrValidate,
            data: {'token': token},
          );
      setState(() => _result = res.data);
    } on DioException catch (e) {
      setState(() => _error = _mapError(e));
    } catch (_) {
      setState(() => _error = 'Échec de la validation. Réessayez.');
    } finally {
      if (mounted) setState(() => _validating = false);
    }
  }

  String _mapError(DioException e) {
    final code = e.response?.data is Map ? e.response?.data['error'] as String? : null;
    switch (code) {
      case 'token_expired_or_used':
        return 'QR invalide ou expiré. Le client doit rouvrir sa carte.';
      case 'not_your_merchant':
        return 'Cette carte appartient à un autre commerce.';
      case 'bad_input':
        return 'QR non reconnu.';
      default:
        return 'Échec de la validation. Réessayez.';
    }
  }

  Future<void> _scanNext() async {
    setState(() {
      _result = null;
      _error = null;
    });
    _busy = false;
    await _controller.start();
  }

  @override
  Widget build(BuildContext context) {
    final showOverlay = _result != null || _error != null || _validating;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scanner un client'),
        actions: [
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
            _ResultOverlay(
              validating: _validating,
              result: _result,
              error: _error,
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
            'Cadrez le QR Taprivo du client',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}

class _ResultOverlay extends StatelessWidget {
  const _ResultOverlay({
    required this.validating,
    required this.result,
    required this.error,
    required this.onScanNext,
  });

  final bool validating;
  final Map<String, dynamic>? result;
  final String? error;
  final VoidCallback onScanNext;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xD904342C),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(28),
      child: validating
          ? const Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(color: Colors.white),
                SizedBox(height: 16),
                Text('Validation…', style: TextStyle(color: Colors.white)),
              ],
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (error != null)
                  _ErrorBody(error!)
                else
                  _SuccessBody(result!),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: onScanNext,
                  child: const Text('Scanner un autre'),
                ),
              ],
            ),
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody(this.message);
  final String message;
  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const CircleAvatar(
          radius: 32,
          backgroundColor: Color(0xFFD85A30),
          child: Icon(Icons.close, color: Colors.white, size: 34),
        ),
        const SizedBox(height: 16),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
      ],
    );
  }
}

class _SuccessBody extends StatelessWidget {
  const _SuccessBody(this.result);
  final Map<String, dynamic> result;
  @override
  Widget build(BuildContext context) {
    final card = (result['card'] as Map?) ?? const {};
    final unlocked = result['unlocked'] == true;
    final reward = result['reward'] as Map?;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const CircleAvatar(
          radius: 32,
          backgroundColor: Color(0xFFEF9F27),
          child: Icon(Icons.check, color: Color(0xFF04342C), size: 36),
        ),
        const SizedBox(height: 16),
        if (unlocked && reward != null) ...[
          const Text('Récompense débloquée',
              style: TextStyle(color: Colors.white70, letterSpacing: 1.5, fontSize: 12)),
          const SizedBox(height: 6),
          Text(
            '${reward['coupon_code']}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 32,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          const Text('Carte remise à zéro.', style: TextStyle(color: Colors.white70)),
        ] else ...[
          const Text('Tampon ajouté',
              style: TextStyle(color: Colors.white70, letterSpacing: 1.5, fontSize: 12)),
          const SizedBox(height: 6),
          Text(
            '${card['stamps_count']} / ${card['stamps_required']}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 36,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ],
    );
  }
}
