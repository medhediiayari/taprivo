import 'package:flutter/material.dart';

/// Parses a backend brand colour ('#RRGGBB') into a [Color].
Color hexColor(String hex) {
  var h = hex.replaceFirst('#', '').trim();
  if (h.length == 6) h = 'FF$h';
  final value = int.tryParse(h, radix: 16) ?? 0xFF04342C;
  return Color(value);
}
