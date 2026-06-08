import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/theme/theme.dart';
import '../onboarding/widgets/taprivo_button.dart';
import '../onboarding/widgets/taprivo_logo.dart';
import 'widgets.dart';

class ForgotPasswordPage extends ConsumerStatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  ConsumerState<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends ConsumerState<ForgotPasswordPage> {
  final _email = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final email = _email.text.trim();
    if (email.isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref.read(authRepositoryProvider).forgotPassword(email);
      if (mounted) context.push('/reset-password', extra: email);
    } catch (_) {
      // Endpoint always returns ok; ignore.
      if (mounted) context.push('/reset-password', extra: email);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TaprivoBrand.cream,
      appBar: AppBar(
        backgroundColor: TaprivoBrand.cream,
        foregroundColor: TaprivoBrand.brown,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Center(child: TaprivoLogo(size: 48)),
              const SizedBox(height: 20),
              const Text(
                'Réinitialiser votre\nmot de passe',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  color: TaprivoBrand.brown,
                  height: 1.15,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Entrez votre adresse e-mail et nous vous enverrons un code '
                'pour réinitialiser votre mot de passe.',
                textAlign: TextAlign.center,
                style: TextStyle(color: TaprivoBrand.textSecondary, fontSize: 14, height: 1.5),
              ),
              const SizedBox(height: 26),
              AuthField(
                controller: _email,
                label: 'E-mail',
                icon: Icons.mail_outline,
                keyboardType: TextInputType.emailAddress,
                onSubmitted: (_) => _send(),
              ),
              const SizedBox(height: 20),
              TaprivoButton(label: 'Envoyer le code', loading: _busy, onPressed: _send),
              const SizedBox(height: 28),
              Icon(Icons.mark_email_unread_outlined,
                  size: 72, color: TaprivoBrand.green.withValues(alpha: 0.85)),
              const SizedBox(height: 24),
              Center(
                child: TextButton(
                  onPressed: () => context.go('/login'),
                  child: const Text('Retour à la connexion',
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
