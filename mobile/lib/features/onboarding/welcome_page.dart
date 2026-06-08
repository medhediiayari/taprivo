import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/theme.dart';
import 'widgets/onboarding_card_stack.dart';
import 'widgets/onboarding_dots.dart';
import 'widgets/taprivo_button.dart';
import 'widgets/taprivo_logo.dart';

/// Premium welcome / onboarding carousel shown to unauthenticated users.
class WelcomePage extends StatefulWidget {
  const WelcomePage({super.key});

  @override
  State<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends State<WelcomePage> {
  final _controller = PageController();
  int _page = 0;

  static const _slides = <_Slide>[
    _Slide(
      lead: 'Votre fidélité,\n',
      accent: 'simplifiée.',
      desc:
          'Taprivo regroupe vos avantages chez des restaurants, cafés et '
          'enseignes partenaires dans une seule application.',
      illustration: _IllustrationType.cards,
    ),
    _Slide(
      lead: 'Cumulez à\nchaque ',
      accent: 'visite.',
      desc:
          'Un tampon à chaque passage. Une fois la carte pleine, votre '
          'récompense se débloque automatiquement.',
      illustration: _IllustrationType.gift,
    ),
    _Slide(
      lead: 'Toujours\n',
      accent: 'sur vous.',
      desc:
          'Présentez votre QR au comptoir et ajoutez vos cartes à Google '
          'Wallet : vous ne ratez plus aucun avantage.',
      illustration: _IllustrationType.wallet,
    ),
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TaprivoBrand.cream,
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 24),
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
            const SizedBox(height: 8),

            // Swipeable slides
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _slides.length,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (_, i) => _SlideView(slide: _slides[i]),
              ),
            ),

            OnboardingDots(count: _slides.length, active: _page),
            const SizedBox(height: 26),

            // Actions (fixed)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                children: [
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
                ],
              ),
            ),
            const SizedBox(height: 16),
            Icon(Icons.spa_outlined,
                color: TaprivoBrand.gold.withValues(alpha: 0.7), size: 20),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}

enum _IllustrationType { cards, gift, wallet }

class _Slide {
  const _Slide({
    required this.lead,
    required this.accent,
    required this.desc,
    required this.illustration,
  });

  final String lead;
  final String accent;
  final String desc;
  final _IllustrationType illustration;
}

class _SlideView extends StatelessWidget {
  const _SlideView({required this.slide});

  final _Slide slide;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _illustration(),
            const SizedBox(height: 24),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: slide.lead, style: const TextStyle(color: TaprivoBrand.brown)),
                  TextSpan(text: slide.accent, style: const TextStyle(color: TaprivoBrand.terracotta)),
                ],
              ),
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.w700,
                height: 1.12,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              slide.desc,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 15,
                height: 1.5,
                color: TaprivoBrand.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _illustration() {
    switch (slide.illustration) {
      case _IllustrationType.cards:
        return const OnboardingCardStack(height: 280);
      case _IllustrationType.gift:
        return const _Medallion(icon: Icons.card_giftcard, bg: TaprivoBrand.green, fg: Colors.white);
      case _IllustrationType.wallet:
        return const _Medallion(icon: Icons.qr_code_2, bg: TaprivoBrand.terracotta, fg: TaprivoBrand.cream);
    }
  }
}

/// Large branded circle with a centered icon — used for non-card slides.
class _Medallion extends StatelessWidget {
  const _Medallion({required this.icon, required this.bg, required this.fg});

  final IconData icon;
  final Color bg;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 280,
      child: Center(
        child: Container(
          width: 200,
          height: 200,
          decoration: BoxDecoration(
            color: bg,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.14),
                blurRadius: 30,
                offset: const Offset(0, 16),
              ),
            ],
          ),
          child: Icon(icon, size: 88, color: fg),
        ),
      ),
    );
  }
}
