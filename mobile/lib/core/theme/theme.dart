import 'package:flutter/material.dart';

/// Palette méditerranéenne café/resto (cf. README racine + architecture §Design).
class TaprivoColors {
  static const sable = Color(0xFFF4EBD9); // fond papier
  static const oliveNuit = Color(0xFF04342C); // texte principal / surfaces sombres
  static const olive = Color(0xFF0F6E56); // succès / validation GPS
  static const terracotta = Color(0xFFD85A30); // CTA principal
  static const soleil = Color(0xFFEF9F27); // highlight récompense
}

/// Palette « premium » de l'onboarding / écran d'accueil.
class TaprivoBrand {
  static const cream = Color(0xFFF7EFE3); // fond principal
  static const card = Color(0xFFFFF9F0); // fond secondaire / cartes
  static const green = Color(0xFF1F3A2D); // vert premium principal
  static const greenSoft = Color(0xFF526B4E); // vert doux
  static const brown = Color(0xFF3A2118); // texte fort / logo
  static const brownLight = Color(0xFFB9854F); // marron clair
  static const terracotta = Color(0xFFB95035); // CTA principal
  static const gold = Color(0xFFC99A5B); // accent cuivre doré
  static const textSecondary = Color(0xFF7A6A5E); // texte secondaire
  static const border = Color(0xFFE8D8C6); // bordures / lignes fines
  static const success = Color(0xFF4F8A5B); // validation
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
