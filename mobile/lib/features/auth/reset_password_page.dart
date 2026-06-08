import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/theme/theme.dart';
import '../onboarding/widgets/taprivo_button.dart';
import '../onboarding/widgets/taprivo_logo.dart';
import 'widgets.dart';

class ResetPasswordPage extends ConsumerStatefulWidget {
  const ResetPasswordPage({super.key, required this.email});

  final String email;

  @override
  ConsumerState<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends ConsumerState<ResetPasswordPage> {
  final _code = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_code.text.trim().isEmpty || _password.text.length < 8) {
      setState(() => _error = 'Code et nouveau mot de passe (8+ caractères) requis.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).resetPassword(
            email: widget.email,
            code: _code.text.trim(),
            password: _password.text,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Mot de passe réinitialisé. Connectez-vous.')),
        );
        context.go('/login');
      }
    } catch (_) {
      setState(() => _error = 'Code invalide ou expiré.');
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
                'Nouveau mot de passe',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 25,
                  fontWeight: FontWeight.w700,
                  color: TaprivoBrand.brown,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Entrez le code reçu à ${widget.email} et choisissez un nouveau '
                'mot de passe.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: TaprivoBrand.textSecondary, fontSize: 14, height: 1.5),
              ),
              const SizedBox(height: 24),
              AuthField(controller: _code, label: 'Code', icon: Icons.pin_outlined, keyboardType: TextInputType.number),
              const SizedBox(height: 12),
              AuthField(
                controller: _password,
                label: 'Nouveau mot de passe',
                icon: Icons.lock_outline,
                obscure: true,
                onSubmitted: (_) => _submit(),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(_error!, style: const TextStyle(color: TaprivoBrand.terracotta)),
              ],
              const SizedBox(height: 20),
              TaprivoButton(label: 'Réinitialiser', loading: _busy, onPressed: _submit),
              const SizedBox(height: 14),
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
