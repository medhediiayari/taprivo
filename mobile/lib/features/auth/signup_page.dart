import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/theme/theme.dart';
import '../onboarding/widgets/taprivo_button.dart';
import '../onboarding/widgets/taprivo_logo.dart';
import 'widgets.dart';

class SignupPage extends ConsumerStatefulWidget {
  const SignupPage({super.key});

  @override
  ConsumerState<SignupPage> createState() => _SignupPageState();
}

class _SignupPageState extends ConsumerState<SignupPage> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _accepted = false;
  bool _busy = false;
  bool _google = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_name.text.trim().isEmpty || _email.text.trim().isEmpty || _password.text.length < 8) {
      setState(() => _error = 'Nom, email et mot de passe (8+ caractères) requis.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).signup(
            fullName: _name.text.trim(),
            email: _email.text.trim(),
            password: _password.text,
          );
      final u = ref.read(authControllerProvider).user;
      if (mounted && u != null && !u.emailVerified) {
        context.go('/verify-email');
      }
    } catch (_) {
      setState(() => _error = 'Inscription impossible. Email déjà utilisé ?');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _googleSignIn() async {
    setState(() {
      _google = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).googleSignIn();
      // Router redirect handles navigation on success.
    } catch (e) {
      debugPrint('Google sign-in failed: $e');
      setState(() => _error = googleErrorMessage(e));
    } finally {
      if (mounted) setState(() => _google = false);
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
              const Center(child: TaprivoLogo(size: 50)),
              const SizedBox(height: 18),
              const Text(
                'Créer un compte',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 27,
                  fontWeight: FontWeight.w700,
                  color: TaprivoBrand.brown,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Rejoignez Taprivo et simplifiez votre fidélité au quotidien.',
                textAlign: TextAlign.center,
                style: TextStyle(color: TaprivoBrand.textSecondary, fontSize: 14),
              ),
              const SizedBox(height: 26),
              AuthField(controller: _name, label: 'Nom', icon: Icons.person_outline),
              const SizedBox(height: 12),
              AuthField(
                controller: _email,
                label: 'E-mail',
                icon: Icons.mail_outline,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              AuthField(
                controller: _password,
                label: 'Mot de passe',
                icon: Icons.lock_outline,
                obscure: true,
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 8),
              // Terms checkbox
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Checkbox(
                    value: _accepted,
                    activeColor: TaprivoBrand.green,
                    onChanged: (v) => setState(() => _accepted = v ?? false),
                  ),
                  const Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(top: 12),
                      child: Text(
                        'J’accepte les Conditions Générales d’Utilisation et la '
                        'Politique de Confidentialité.',
                        style: TextStyle(color: TaprivoBrand.textSecondary, fontSize: 13, height: 1.4),
                      ),
                    ),
                  ),
                ],
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: const TextStyle(color: TaprivoBrand.terracotta)),
              ],
              const SizedBox(height: 16),
              TaprivoButton(
                label: 'Continuer',
                loading: _busy,
                onPressed: _accepted ? _submit : null,
              ),
              const SizedBox(height: 20),
              const OrDivider(label: 'ou continuer avec'),
              const SizedBox(height: 16),
              GoogleButton(loading: _google, onPressed: _googleSignIn),
              const SizedBox(height: 18),
              Center(
                child: TextButton(
                  onPressed: () => context.go('/login'),
                  child: const Text.rich(
                    TextSpan(
                      text: 'Vous avez déjà un compte ? ',
                      style: TextStyle(color: TaprivoBrand.textSecondary),
                      children: [
                        TextSpan(
                          text: 'Se connecter',
                          style: TextStyle(color: TaprivoBrand.greenSoft, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
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
