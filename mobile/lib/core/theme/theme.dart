import 'package:flutter/material.dart';

/// Palette méditerranéenne café/resto (cf. README racine + architecture §Design).
class TaprivoColors {
  static const sable = Color(0xFFF4EBD9); // fond papier
  static const oliveNuit = Color(0xFF04342C); // texte principal / surfaces sombres
  static const olive = Color(0xFF0F6E56); // succès / validation GPS
  static const terracotta = Color(0xFFD85A30); // CTA principal
  static const soleil = Color(0xFFEF9F27); // highlight récompense
}

ThemeData buildTaprivoTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: TaprivoColors.terracotta,
    primary: TaprivoColors.terracotta,
    secondary: TaprivoColors.olive,
    surface: TaprivoColors.sable,
    brightness: Brightness.light,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: TaprivoColors.sable,
    appBarTheme: const AppBarTheme(
      backgroundColor: TaprivoColors.sable,
      foregroundColor: TaprivoColors.oliveNuit,
      elevation: 0,
      centerTitle: false,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: TaprivoColors.terracotta,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        padding: const EdgeInsets.symmetric(vertical: 16),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
    ),
  );
}
