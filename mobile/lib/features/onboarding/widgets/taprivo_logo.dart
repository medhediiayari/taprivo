import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// The bare Taprivo mark — a "T" with the three-colour fan, on a transparent
/// background. Use on coloured surfaces (e.g. the green card).
class TaprivoMark extends StatelessWidget {
  const TaprivoMark({super.key, this.size = 48, this.color = Colors.white});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Three-colour fan, lower-left, angled.
          Positioned(
            left: size * 0.12,
            bottom: size * 0.18,
            child: Transform.rotate(
              angle: -0.62,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _bar(TaprivoBrand.greenSoft),
                  SizedBox(height: size * 0.035),
                  _bar(TaprivoBrand.terracotta),
                  SizedBox(height: size * 0.035),
                  _bar(TaprivoBrand.gold),
                ],
              ),
            ),
          ),
          // The "T".
          Center(
            child: Text(
              'T',
              style: TextStyle(
                color: color,
                fontSize: size * 0.74,
                fontWeight: FontWeight.w800,
                height: 1,
                letterSpacing: -1,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _bar(Color c) => Container(
        width: size * 0.28,
        height: size * 0.075,
        decoration: BoxDecoration(
          color: c,
          borderRadius: BorderRadius.circular(size * 0.05),
        ),
      );
}

/// The boxed logo: the mark on a rounded green tile. Use in headers.
class TaprivoLogo extends StatelessWidget {
  const TaprivoLogo({super.key, this.size = 48});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: TaprivoBrand.green,
        borderRadius: BorderRadius.circular(size * 0.3),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: size * 0.2,
            offset: Offset(0, size * 0.08),
          ),
        ],
      ),
      child: Center(child: TaprivoMark(size: size * 0.7)),
    );
  }
}
