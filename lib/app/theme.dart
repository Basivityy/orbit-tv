import 'package:flutter/material.dart';

/// Opacity helper (Color.withOpacity is deprecated in newer Flutter).
extension ColorAlpha on Color {
  Color o(double opacity) => withAlpha((opacity.clamp(0.0, 1.0) * 255).round());
}

/// Orbit TV visual identity: deep night background, violet → cyan accent.
class OrbitColors {
  static const bg = Color(0xFF07080F);
  static const bgElevated = Color(0xFF0E1020);
  static const surface = Color(0xFF14172B);
  static const surfaceHigh = Color(0xFF1C2040);
  static const stroke = Color(0xFF262B4D);
  static const text = Color(0xFFF2F3FA);
  static const textMuted = Color(0xFF9AA0C3);
  static const textDim = Color(0xFF636A93);
  static const violet = Color(0xFF7C5CFF);
  static const cyan = Color(0xFF22D3EE);
  static const live = Color(0xFFFF3B5C);
  static const success = Color(0xFF2EE59D);
  static const warning = Color(0xFFFFC547);

  static const accentGradient = LinearGradient(colors: [violet, cyan], begin: Alignment.centerLeft, end: Alignment.centerRight);
  static const heroFade = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xF207080F), Color(0xB307080F), Color(0x0007080F)],
    stops: [0.0, 0.45, 1.0],
  );
  static const bottomFade = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0x0007080F), Color(0xE607080F)],
  );
}

class OrbitTheme {
  static ThemeData build() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: 'Inter',
      colorScheme: const ColorScheme.dark(
        primary: OrbitColors.violet,
        secondary: OrbitColors.cyan,
        surface: OrbitColors.surface,
        error: OrbitColors.live,
        onPrimary: Colors.white,
        onSurface: OrbitColors.text,
      ),
      scaffoldBackgroundColor: OrbitColors.bg,
      canvasColor: OrbitColors.bg,
      dividerColor: OrbitColors.stroke,
      splashFactory: InkSparkle.splashFactory,
    );
    return base.copyWith(
      textTheme: base.textTheme.apply(bodyColor: OrbitColors.text, displayColor: OrbitColors.text),
      focusColor: OrbitColors.violet.o(0.25),
      hoverColor: Colors.white.o(0.04),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(color: OrbitColors.surfaceHigh, borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(color: OrbitColors.text, fontSize: 12),
        waitDuration: const Duration(milliseconds: 400),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: OrbitColors.surface,
        hintStyle: const TextStyle(color: OrbitColors.textDim),
        labelStyle: const TextStyle(color: OrbitColors.textMuted),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: OrbitColors.stroke)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: OrbitColors.stroke)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: OrbitColors.violet, width: 2)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: OrbitColors.violet,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: OrbitColors.text,
          side: const BorderSide(color: OrbitColors.stroke),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: OrbitColors.cyan, textStyle: const TextStyle(fontWeight: FontWeight.w600)),
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: OrbitColors.surfaceHigh,
        contentTextStyle: TextStyle(color: OrbitColors.text),
        behavior: SnackBarBehavior.floating,
      ),
      scrollbarTheme: ScrollbarThemeData(
        thumbColor: WidgetStatePropertyAll(Colors.white.o(0.18)),
        radius: const Radius.circular(8),
        thickness: const WidgetStatePropertyAll(6),
      ),
    );
  }
}

/// Spacing scale used across screens.
class Gap {
  static const xs = 4.0;
  static const s = 8.0;
  static const m = 16.0;
  static const l = 24.0;
  static const xl = 32.0;
  static const page = 40.0;
}

class TextStyles {
  static const display = TextStyle(fontSize: 38, fontWeight: FontWeight.w800, height: 1.1, letterSpacing: -0.6);
  static const h1 = TextStyle(fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: -0.3);
  static const h2 = TextStyle(fontSize: 20, fontWeight: FontWeight.w700);
  static const h3 = TextStyle(fontSize: 16, fontWeight: FontWeight.w600);
  static const body = TextStyle(fontSize: 14, height: 1.45, color: OrbitColors.text);
  static const muted = TextStyle(fontSize: 13, color: OrbitColors.textMuted, height: 1.4);
  static const small = TextStyle(fontSize: 12, color: OrbitColors.textMuted);
  static const tiny = TextStyle(fontSize: 11, color: OrbitColors.textDim, letterSpacing: 0.2);
  static const label = TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: OrbitColors.textMuted);
}
