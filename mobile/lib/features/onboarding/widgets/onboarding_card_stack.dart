import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import 'taprivo_logo.dart';

/// Hero illustration: the fanned loyalty cards. Uses the provided PNG asset when
/// present (assets/images/onboarding_cards.png); otherwise falls back to a
/// vector-drawn version so the build always works.
class OnboardingCardStack extends StatelessWidget {
  const OnboardingCardStack({super.key, this.height = 300});

  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: Image.asset(
        'assets/images/onboarding_cards.png',
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => const _DrawnCardStack(),
      ),
    );
  }
}

class _DrawnCardStack extends StatelessWidget {
  const _DrawnCardStack();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 230,
          height: 250,
          decoration: BoxDecoration(
            color: TaprivoBrand.border.withValues(alpha: 0.55),
            borderRadius: const BorderRadius.all(Radius.elliptical(140, 160)),
          ),
        ),
        const Positioned(
          right: 18,
          bottom: 36,
          child: Icon(Icons.eco, color: TaprivoBrand.greenSoft, size: 26),
        ),
        Positioned(
          top: 26,
          right: 40,
          child: Icon(Icons.auto_awesome,
              color: TaprivoBrand.gold.withValues(alpha: 0.8), size: 18),
        ),
        const _Card(dx: 84, dy: 34, angle: 0.18, color: TaprivoBrand.gold, icon: Icons.local_cafe_outlined, iconColor: TaprivoBrand.cream),
        const _Card(dx: 96, dy: -20, angle: 0.28, color: TaprivoBrand.terracotta, icon: Icons.shopping_bag_outlined, iconColor: TaprivoBrand.brown),
        const _Card(dx: 30, dy: -10, angle: 0.08, color: TaprivoBrand.greenSoft, icon: Icons.card_giftcard, iconColor: Colors.white),
        const _Card(dx: -46, dy: 8, angle: -0.10, color: TaprivoBrand.green, logo: true),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({
    required this.dx,
    required this.dy,
    required this.angle,
    required this.color,
    this.icon,
    this.iconColor,
    this.logo = false,
  });

  final double dx;
  final double dy;
  final double angle;
  final Color color;
  final IconData? icon;
  final Color? iconColor;
  final bool logo;

  @override
  Widget build(BuildContext context) {
    return Transform.translate(
      offset: Offset(dx, dy),
      child: Transform.rotate(
        angle: angle,
        child: Container(
          width: 148,
          height: 188,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(22),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.14),
                blurRadius: 26,
                offset: const Offset(0, 14),
              ),
            ],
          ),
          child: Center(
            child: logo
                ? const TaprivoMark(size: 78)
                : Icon(icon, size: 44, color: iconColor),
          ),
        ),
      ),
    );
  }
}
