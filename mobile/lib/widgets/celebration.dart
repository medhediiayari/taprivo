import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

/// Plays the confetti celebration once as a full-screen overlay, then removes
/// itself. Non-blocking: it ignores pointer events so the UI underneath stays
/// usable. Call when a reward is validated (QR scanned / NFC read).
void playCelebration(BuildContext context) {
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) return;

  var removed = false;
  late OverlayEntry entry;
  void dismiss() {
    if (removed) return;
    removed = true;
    entry.remove();
  }

  entry = OverlayEntry(
    builder: (_) => Positioned.fill(
      child: IgnorePointer(
        child: Lottie.asset(
          'assets/lottie/celebration.json',
          repeat: false,
          fit: BoxFit.cover,
          onLoaded: (composition) {
            Future.delayed(composition.duration + const Duration(milliseconds: 200), dismiss);
          },
          errorBuilder: (_, __, ___) {
            // Asset missing / failed to parse — don't leave a stuck overlay.
            WidgetsBinding.instance.addPostFrameCallback((_) => dismiss());
            return const SizedBox.shrink();
          },
        ),
      ),
    ),
  );
  overlay.insert(entry);
}
