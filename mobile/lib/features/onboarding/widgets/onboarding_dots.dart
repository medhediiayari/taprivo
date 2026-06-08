import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// Page indicator: the active dot is a wider terracotta pill, the rest are
/// small sand-coloured dots.
class OnboardingDots extends StatelessWidget {
  const OnboardingDots({super.key, this.count = 3, this.active = 0});

  final int count;
  final int active;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final isActive = i == active;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: isActive ? 22 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: isActive ? TaprivoBrand.terracotta : TaprivoBrand.border,
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
    );
  }
}
