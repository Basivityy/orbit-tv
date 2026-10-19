import 'package:flutter/material.dart';

/// Opacity helper (Color.withOpacity is deprecated in newer Flutter).
extension ColorAlpha on Color {
  Color o(double opacity) => withAlpha((opacity.clamp(0.0, 1.0) * 255).round());
}

/// Orbit Player visual identity — the OrbitModul brand: black and signal yellow.
class OrbitColors {
  static const bg = Color(0xFF050505);
  static const bgElevated = Color(0xFF0E0E0D);
  static const surface = Color(0xFF161615);
  static const surfaceHigh = Color(0xFF20201E);
  static const surfaceHigher = Color(0xFF2A2A27);
  static const stroke = Color(0xFF2C2C29);
  static const text = Color(0xFFF7F7F2);
  static const textMuted = Color(0xFFA4A49C);
  static const textDim = Color(0xFF6E6E67);

  /// Brand yellow (#FFD400) and its shades.
  static const accent = Color(0xFFFFD400);
  static const accentLight = Color(0xFFFFE14D);
  static const accentDeep = Color(0xFFE6BE00);

  /// Text/icons on top of the yellow.
  static const onAccent = Color(0xFF0A0A0A);

  static const live = Color(0xFFFF3B30);
  static const success = Color(0xFF34D399);
  static const warning = Color(0xFFFFB020);

  static const accentGradient = LinearGradient(colors: [accentLight, accent, Color(0xFFFFC300)], begin: Alignment.centerLeft, end: Alignment.centerRight);

  /// Left-to-right darkening over hero pictures (text sits on the left).
  static const heroFade = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xF5050505), Color(0xB3050505), Color(0x00050505)],
    stops: [0.0, 0.42, 0.85],
  );

  /// Bottom darkening over pictures (titles at the bottom of cards).
  static const bottomFade = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0x00050505), Color(0xE6050505)],
  );

  /// Hero pictures melt into the page background at the bottom.
  static const pageFade = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0x99050505), Color(0x00050505), Color(0x00050505), bg],
    stops: [0.0, 0.22, 0.6, 1.0],
  );
}

class OrbitTheme {
  static ThemeData build() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: 'Archivo',
      colorScheme: const ColorScheme.dark(
        primary: OrbitColors.accent,
        secondary: OrbitColors.accentLight,
        surface: OrbitColors.surface,
        error: OrbitColors.live,
        onPrimary: OrbitColors.onAccent,
        onSecondary: OrbitColors.onAccent,
        onSurface: OrbitColors.text,
      ),
      scaffoldBackgroundColor: OrbitColors.bg,
      canvasColor: OrbitColors.bg,
      dividerColor: OrbitColors.stroke,
      splashFactory: InkSparkle.splashFactory,
    );
    return base.copyWith(
      textTheme: base.textTheme.apply(bodyColor: OrbitColors.text, displayColor: OrbitColors.text, fontFamily: 'Archivo'),
      focusColor: OrbitColors.accent.o(0.2),
      hoverColor: Colors.white.o(0.05),
      textSelectionTheme: TextSelectionThemeData(cursorColor: OrbitColors.accent, selectionColor: OrbitColors.accent.o(0.35), selectionHandleColor: OrbitColors.accent),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: OrbitColors.accent),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(color: OrbitColors.surfaceHigher, borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(color: OrbitColors.text, fontSize: 12, fontFamily: 'Archivo'),
        waitDuration: const Duration(milliseconds: 400),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: OrbitColors.surface,
        hintStyle: const TextStyle(color: OrbitColors.textDim),
        labelStyle: const TextStyle(color: OrbitColors.textMuted),
        floatingLabelStyle: const TextStyle(color: OrbitColors.accent),
        prefixIconColor: OrbitColors.textMuted,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: OrbitColors.stroke)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: OrbitColors.stroke)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: OrbitColors.accent, width: 2)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: OrbitColors.accent,
          foregroundColor: OrbitColors.onAccent,
          disabledBackgroundColor: OrbitColors.surfaceHigher,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 17),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, fontFamily: 'Archivo'),
          elevation: 0,
        ).copyWith(
          overlayColor: WidgetStatePropertyAll(Colors.white.o(0.18)),
          side: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.focused) ? const BorderSide(color: Colors.white, width: 2) : null),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: OrbitColors.text,
          backgroundColor: Colors.white.o(0.08),
          side: BorderSide(color: Colors.white.o(0.14)),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5, fontFamily: 'Archivo'),
        ).copyWith(
          side: WidgetStateProperty.resolveWith((s) => BorderSide(color: s.contains(WidgetState.focused) ? OrbitColors.accent : Colors.white.o(0.14), width: s.contains(WidgetState.focused) ? 2 : 1)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: OrbitColors.accent, textStyle: const TextStyle(fontWeight: FontWeight.w700, fontFamily: 'Archivo')),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? OrbitColors.onAccent : OrbitColors.textMuted),
        trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? OrbitColors.accent : OrbitColors.surfaceHigher),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      sliderTheme: const SliderThemeData(activeTrackColor: OrbitColors.accent, thumbColor: OrbitColors.accent, inactiveTrackColor: OrbitColors.surfaceHigher),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: OrbitColors.surfaceHigher,
        contentTextStyle: TextStyle(color: OrbitColors.text, fontFamily: 'Archivo'),
        behavior: SnackBarBehavior.floating,
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: OrbitColors.surfaceHigh,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: OrbitColors.stroke)),
        textStyle: const TextStyle(color: OrbitColors.text, fontFamily: 'Archivo'),
      ),
      dialogTheme: DialogThemeData(backgroundColor: OrbitColors.bgElevated, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))),
      scrollbarTheme: ScrollbarThemeData(
        thumbColor: WidgetStatePropertyAll(Colors.white.o(0.2)),
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
  static const page = 48.0;
}

class TextStyles {
  static const display = TextStyle(fontSize: 46, fontWeight: FontWeight.w800, height: 1.05, letterSpacing: -1.0);
  static const h1 = TextStyle(fontSize: 30, fontWeight: FontWeight.w800, letterSpacing: -0.5, height: 1.15);
  static const h2 = TextStyle(fontSize: 21, fontWeight: FontWeight.w700, letterSpacing: -0.2);
  static const h3 = TextStyle(fontSize: 16, fontWeight: FontWeight.w600);
  static const body = TextStyle(fontSize: 14.5, height: 1.5, color: OrbitColors.text);
  static const muted = TextStyle(fontSize: 13.5, color: OrbitColors.textMuted, height: 1.45);
  static const small = TextStyle(fontSize: 12.5, color: OrbitColors.textMuted);
  static const tiny = TextStyle(fontSize: 11.5, color: OrbitColors.textDim, letterSpacing: 0.2);
  static const label = TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.4, color: OrbitColors.textMuted);
}
