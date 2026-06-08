import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// Rounded, full-width button in the Taprivo brand style.
/// Primary = solid green; secondary = cream with a soft border.
class TaprivoButton extends StatelessWidget {
  const TaprivoButton({
    super.key,
    required this.label,
    this.onPressed,
    this.primary = true,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool primary;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(16);
    final child = loading
        ? const SizedBox(
            height: 22,
            width: 22,
            child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
          )
        : Text(
            label,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: primary ? Colors.white : TaprivoBrand.brown,
            ),
          );

    return SizedBox(
      height: 56,
      width: double.infinity,
      child: Material(
        color: primary ? TaprivoBrand.green : TaprivoBrand.card,
        borderRadius: radius,
        elevation: primary ? 1.5 : 0,
        shadowColor: Colors.black.withValues(alpha: 0.2),
        child: InkWell(
          borderRadius: radius,
          onTap: loading ? null : onPressed,
          child: Container(
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: radius,
              border: primary ? null : Border.all(color: TaprivoBrand.border, width: 1.4),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}
