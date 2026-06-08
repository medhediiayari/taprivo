import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/theme.dart';
import 'widgets/onboarding_card_stack.dart';
import 'widgets/onboarding_dots.dart';
import 'widgets/taprivo_button.dart';
import 'widgets/taprivo_logo.dart';

/// Premium welcome / onboarding screen shown to unauthenticated users.
class WelcomePage extends StatelessWidget {
  const WelcomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TaprivoBrand.cream,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Brand lockup
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const TaprivoLogo(size: 38),
                          const SizedBox(width: 10),
                          Text(
                            'Taprivo',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: TaprivoBrand.brown,
                              letterSpacing: -0.2,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 40),

                      // Title
                      const _Title(),
                      const SizedBox(height: 16),

                      // Description
                      const Text(
                        'Taprivo regroupe vos avantages chez des restaurants, '
                        'cafés et enseignes partenaires dans une seule application.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 15,
                          height: 1.5,
                          color: TaprivoBrand.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Hero illustration
                      const OnboardingCardStack(),
                      const SizedBox(height: 22),

                      const OnboardingDots(count: 3, active: 0),
                      const SizedBox(height: 30),

                      // Actions
                      TaprivoButton(
                        label: 'Créer un compte',
                        primary: true,
                        onPressed: () => context.push('/signup'),
                      ),
                      const SizedBox(height: 12),
                      TaprivoButton(
                        label: 'Se connecter',
                        primary: false,
                        onPressed: () => context.push('/login'),
                      ),
                      const SizedBox(height: 18),

                      // Discreet bottom accent
                      Icon(Icons.spa_outlined,
                          color: TaprivoBrand.gold.withValues(alpha: 0.7), size: 20),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _Title extends StatelessWidget {
  const _Title();

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      const TextSpan(
        children: [
          TextSpan(text: 'Votre fidélité,\n', style: TextStyle(color: TaprivoBrand.brown)),
          TextSpan(text: 'simplifiée.', style: TextStyle(color: TaprivoBrand.terracotta)),
        ],
      ),
      textAlign: TextAlign.center,
      style: const TextStyle(
        fontSize: 34,
        fontWeight: FontWeight.w700,
        height: 1.12,
        letterSpacing: -0.5,
      ),
    );
  }
}
