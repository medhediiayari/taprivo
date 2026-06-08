import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/theme/theme.dart';
import '../onboarding/widgets/taprivo_button.dart';
import '../onboarding/widgets/taprivo_logo.dart';
import 'widgets.dart';

/// Email verification (optional / skippable): enter the 6-digit code we e-mailed.
class VerifyEmailPage extends ConsumerStatefulWidget {
  const VerifyEmailPage({super.key});

  @override
  ConsumerState<VerifyEmailPage> createState() => _VerifyEmailPageState();
}

class _VerifyEmailPageState extends ConsumerState<VerifyEmailPage> {
  final _code = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).verifyEmail(_code.text.trim());
      if (mounted) context.go('/');
    } catch (_) {
      setState(() => _error = 'Code invalide ou expiré.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    try {
      await ref.read(authControllerProvider.notifier).resendCode();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Nouveau code envoyé.')),
        );
      }
    } catch (_) {/* ignore */}
  }

  @override
  Widget build(BuildContext context) {
    final email = ref.watch(authControllerProvider).user?.email ?? 'votre e-mail';
    return Scaffold(
      backgroundColor: TaprivoBrand.cream,
      appBar: AppBar(
        backgroundColor: TaprivoBrand.cream,
        foregroundColor: TaprivoBrand.brown,
        elevation: 0,
        actions: [
          TextButton(
            onPressed: () => context.go('/'),
            child: const Text('Passer', style: TextStyle(color: TaprivoBrand.textSecondary)),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Center(child: TaprivoLogo(size: 50)),
              const SizedBox(height: 18),
              const Text(
                'Vérifiez votre e-mail',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  color: TaprivoBrand.brown,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Entrez le code à 6 chiffres envoyé à\n$email.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: TaprivoBrand.textSecondary, fontSize: 14, height: 1.5),
              ),
              const SizedBox(height: 26),
              TextField(
                controller: _code,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                maxLength: 6,
                style: const TextStyle(fontSize: 26, letterSpacing: 10, fontWeight: FontWeight.w700),
                decoration: InputDecoration(
                  counterText: '',
                  hintText: '••••••',
                  filled: true,
                  fillColor: TaprivoBrand.card,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: TaprivoBrand.border),
                  ),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(_error!, style: const TextStyle(color: TaprivoBrand.terracotta)),
              ],
              const SizedBox(height: 20),
              TaprivoButton(label: 'Vérifier', loading: _busy, onPressed: _verify),
              const SizedBox(height: 12),
              Center(
                child: TextButton(
                  onPressed: _resend,
                  child: const Text('Renvoyer le code',
                      style: TextStyle(color: TaprivoBrand.greenSoft, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
