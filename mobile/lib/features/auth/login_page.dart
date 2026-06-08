import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/theme/theme.dart';
import '../onboarding/widgets/taprivo_button.dart';
import '../onboarding/widgets/taprivo_logo.dart';
import 'widgets.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  // Pre-filled with a seeded demo account for convenience.
  final _email = TextEditingController(text: 'karim@demo.com');
  final _password = TextEditingController(text: 'demo1234');
  bool _busy = false;
  bool _google = false;
  String? _error;

  Future<void> _googleSignIn() async {
    setState(() {
      _google = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).googleSignIn();
    } catch (e) {
      debugPrint('Google sign-in failed: $e');
      setState(() => _error = googleErrorMessage(e));
    } finally {
      if (mounted) setState(() => _google = false);
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .login(_email.text.trim(), _password.text);
      // Navigation is handled by the go_router redirect on auth change.
    } catch (_) {
      setState(() => _error = 'Identifiants invalides');
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
              const Center(child: TaprivoLogo(size: 52)),
              const SizedBox(height: 20),
              const Text(
                'Bon retour',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: TaprivoBrand.brown,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Connectez-vous à votre compte Taprivo.',
                textAlign: TextAlign.center,
                style: TextStyle(color: TaprivoBrand.textSecondary, fontSize: 14),
              ),
              const SizedBox(height: 28),
              _Field(
                controller: _email,
                label: 'Email',
                icon: Icons.mail_outline,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              _Field(
                controller: _password,
                label: 'Mot de passe',
                icon: Icons.lock_outline,
                obscure: true,
                onSubmitted: (_) => _submit(),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: TaprivoBrand.terracotta)),
              ],
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => context.push('/forgot-password'),
                  child: const Text('Mot de passe oublié ?',
                      style: TextStyle(color: TaprivoBrand.textSecondary, fontSize: 13)),
                ),
              ),
              const SizedBox(height: 8),
              TaprivoButton(label: 'Se connecter', loading: _busy, onPressed: _submit),
              const SizedBox(height: 20),
              const OrDivider(label: 'ou continuer avec'),
              const SizedBox(height: 16),
              GoogleButton(loading: _google, onPressed: _googleSignIn),
              const SizedBox(height: 18),
              Center(
                child: TextButton(
                  onPressed: () => context.go('/signup'),
                  child: const Text.rich(
                    TextSpan(
                      text: 'Pas de compte ? ',
                      style: TextStyle(color: TaprivoBrand.textSecondary),
                      children: [
                        TextSpan(
                          text: 'Créer un compte',
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

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.icon,
    this.obscure = false,
    this.keyboardType,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final bool obscure;
  final TextInputType? keyboardType;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      keyboardType: keyboardType,
      autocorrect: false,
      onSubmitted: onSubmitted,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: TaprivoBrand.textSecondary),
        filled: true,
        fillColor: TaprivoBrand.card,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: TaprivoBrand.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: TaprivoBrand.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: TaprivoBrand.green, width: 1.6),
        ),
      ),
    );
  }
}
