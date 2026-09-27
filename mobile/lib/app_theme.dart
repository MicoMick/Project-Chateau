import 'package:flutter/material.dart';
import 'app_colors.dart';

// Design direction (from the UI/UX Pro Max skill, `.claude/skills/ui-ux-pro-max`):
// - Style: clean "bento" cards — white surfaces on a soft neutral page, 1px
//   hairline borders + very soft shadows, 16px card radius, 8dp spacing grid.
// - Color: brand greens kept; neutrals + semantic tokens in app_colors.dart,
//   all text tokens ≥ 4.5:1 contrast.
// - Type: platform font (matches the web app's system stack); Material type
//   roles, nothing under 12sp, body 14–15sp at 1.5 line height.
// - Touch: ≥ 48dp targets, visible pressed/focus states via ThemeData.
//
// Prefer AppText / AppSpacing / AppRadius / chateu* tokens over raw values.

// ── Typography ─────────────────────────────────────────────────────────────────

class AppText {
  AppText._();

  static const TextStyle displayLarge = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w800,
    color: chateuText,
    letterSpacing: -0.5,
    height: 1.2,
  );

  static const TextStyle displayMedium = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w800,
    color: chateuText,
    letterSpacing: -0.3,
  );

  static const TextStyle titleLarge = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    color: chateuText,
    letterSpacing: -0.2,
  );

  static const TextStyle titleMedium = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: chateuText,
  );

  static const TextStyle bodyLarge = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w400,
    color: chateuText,
    height: 1.55,
  );

  static const TextStyle bodyMedium = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: chateuText,
    height: 1.5,
  );

  static const TextStyle labelLarge = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    color: Colors.white,
    letterSpacing: 0.2,
  );

  static const TextStyle labelMedium = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.2,
  );

  static const TextStyle caption = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: chateuTextMuted,
    height: 1.4,
  );
}

// ── Radius ─────────────────────────────────────────────────────────────────────

class AppRadius {
  AppRadius._();

  static const double xs = 8.0;
  static const double sm = 12.0;
  static const double md = 16.0;
  static const double lg = 20.0;
  static const double xl = 24.0;
  static const double xxl = 32.0;
}

// ── Spacing ────────────────────────────────────────────────────────────────────

class AppSpacing {
  AppSpacing._();

  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 12.0;
  static const double lg = 16.0;
  static const double xl = 20.0;
  static const double xxl = 24.0;
  static const double xxxl = 32.0;
}

// ── Shadows ────────────────────────────────────────────────────────────────────

class AppShadows {
  AppShadows._();

  static List<BoxShadow> get card => [
        BoxShadow(
          color: const Color(0xFF0F2A1C).withAlpha(10),
          blurRadius: 10,
          offset: const Offset(0, 2),
        ),
      ];

  static List<BoxShadow> get elevated => [
        BoxShadow(
          color: const Color(0xFF0F2A1C).withAlpha(18),
          blurRadius: 24,
          offset: const Offset(0, 8),
        ),
      ];

  static List<BoxShadow> get primaryGlow => [
        BoxShadow(
          color: chateuPrimary.withAlpha(50),
          blurRadius: 16,
          offset: const Offset(0, 6),
        ),
      ];

  static List<BoxShadow> get overlay => [
        BoxShadow(
          color: Colors.black.withAlpha(30),
          blurRadius: 14,
          offset: const Offset(0, 4),
        ),
      ];
}

// ── Shared Decorations ─────────────────────────────────────────────────────────

class AppDecorations {
  AppDecorations._();

  static BoxDecoration get card => BoxDecoration(
        color: chateuSurface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: chateuBorder),
        boxShadow: AppShadows.card,
      );

  /// Flat tinted panel for secondary content (info rows, empty states).
  static BoxDecoration get muted => BoxDecoration(
        color: chateuSurfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.md),
      );

  static BoxDecoration get sheet => BoxDecoration(
        color: chateuSurface,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppRadius.xl),
        ),
        boxShadow: AppShadows.elevated,
      );

  static BoxDecoration primaryGradient({double radius = AppRadius.lg}) =>
      BoxDecoration(
        gradient: const LinearGradient(
          colors: [chateuPrimary, chateuSecondary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(radius),
        boxShadow: AppShadows.primaryGlow,
      );

  static BoxDecoration tintedBadge(Color color) => BoxDecoration(
        color: color.withAlpha(22),
        borderRadius: BorderRadius.circular(AppRadius.xl),
      );
}

// ── Section Header ─────────────────────────────────────────────────────────────

class AppSectionHeader extends StatelessWidget {
  final String title;
  final Widget? trailing;

  const AppSectionHeader({
    super.key,
    required this.title,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 20,
          decoration: BoxDecoration(
            color: chateuPrimary,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(title, style: AppText.titleLarge),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}

// ── Status Badge ───────────────────────────────────────────────────────────────

class AppStatusBadge extends StatelessWidget {
  final String label;
  final Color color;

  const AppStatusBadge({super.key, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withAlpha(22),
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(color: color.withAlpha(60)),
      ),
      child: Text(
        label,
        style: AppText.caption.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

// ── Primary Button ─────────────────────────────────────────────────────────────

class AppPrimaryButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool isLoading;
  final double height;

  const AppPrimaryButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.isLoading = false,
    this.height = 52,
  }) : assert(height >= 48, 'touch target must be ≥ 48dp');

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: height,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: chateuPrimary,
          disabledBackgroundColor: chateuPrimary.withAlpha(100),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
        ),
        child: isLoading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2.5,
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, color: Colors.white, size: 18),
                    const SizedBox(width: AppSpacing.sm),
                  ],
                  Text(label, style: AppText.labelLarge),
                ],
              ),
      ),
    );
  }
}

// ── Info Chip ──────────────────────────────────────────────────────────────────

class AppInfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const AppInfoChip({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18, color: chateuPrimary),
        const SizedBox(height: AppSpacing.xs),
        Text(
          label,
          style: AppText.caption,
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: AppText.labelMedium.copyWith(color: chateuText),
        ),
      ],
    );
  }
}

// ── Notice Banner ──────────────────────────────────────────────────────────────

class AppNoticeBanner extends StatelessWidget {
  final String text;
  final IconData icon;
  final Color color;

  const AppNoticeBanner({
    super.key,
    required this.text,
    this.icon = Icons.info_outline_rounded,
    this.color = chateuPrimary,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: color.withAlpha(16),
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: color.withAlpha(50)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              text,
              style: AppText.caption.copyWith(
                color: color,
                fontWeight: FontWeight.w500,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── AppBar factory ─────────────────────────────────────────────────────────────

PreferredSizeWidget buildStandardAppBar({
  required BuildContext context,
  required String title,
  List<Widget>? actions,
  bool showBack = true,
  Color backgroundColor = chateuBackground,
}) {
  return AppBar(
    backgroundColor: backgroundColor,
    elevation: 0,
    centerTitle: true,
    leading: showBack
        ? IconButton(
            icon: const Icon(
              Icons.arrow_back_ios_new_rounded,
              color: chateuPrimary,
              size: 20,
            ),
            onPressed: () => Navigator.pop(context),
          )
        : null,
    title: Text(title, style: AppText.titleLarge),
    actions: actions,
  );
}
// ── Staggered entrance ─────────────────────────────────────────────────────────

/// Fades + slides [child] in over a 0.4 slice of [controller] starting at [delay].
class AppFadeSlide extends StatelessWidget {
  final AnimationController controller;
  final double delay;
  final Widget child;

  const AppFadeSlide({
    super.key,
    required this.controller,
    required this.delay,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final curve = CurvedAnimation(
      parent: controller,
      curve: Interval(delay, (delay + 0.4).clamp(0.0, 1.0), curve: Curves.easeOut),
    );
    return FadeTransition(
      opacity: curve,
      child: SlideTransition(
        position: Tween(begin: const Offset(0, 0.08), end: Offset.zero).animate(curve),
        child: child,
      ),
    );
  }
}

// ── ThemeData ──────────────────────────────────────────────────────────────────
//
// Component themes so stock Material widgets (TextField, buttons, Card, chips,
// dialogs…) pick up the design system without per-page styling.

class AppTheme {
  AppTheme._();

  static ThemeData get light {
    final scheme = ColorScheme.fromSeed(
      seedColor: chateuPrimary,
      brightness: Brightness.light,
    ).copyWith(
      primary: chateuPrimary,
      onPrimary: Colors.white,
      secondary: chateuSecondary,
      onSecondary: Colors.white,
      tertiary: chateuAccent,
      onTertiary: chateuText,
      error: chateuError,
      surface: chateuSurface,
      onSurface: chateuText,
      onSurfaceVariant: chateuTextMuted,
      outline: chateuBorder,
      outlineVariant: chateuBorder,
    );

    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppRadius.sm),
    );
    OutlineInputBorder inputBorder(Color c, [double w = 1]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide(color: c, width: w),
        );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: chateuBackground,
      splashFactory: InkSparkle.splashFactory,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      textTheme: const TextTheme(
        headlineMedium: AppText.displayLarge,
        headlineSmall: AppText.displayMedium,
        titleLarge: AppText.titleLarge,
        titleMedium: AppText.titleMedium,
        bodyLarge: AppText.bodyLarge,
        bodyMedium: AppText.bodyMedium,
        labelLarge: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        labelMedium: AppText.labelMedium,
        bodySmall: AppText.caption,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: chateuBackground,
        foregroundColor: chateuText,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 1,
        centerTitle: true,
        titleTextStyle: AppText.titleLarge,
        iconTheme: IconThemeData(color: chateuPrimary),
      ),
      cardTheme: CardThemeData(
        color: chateuSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: const BorderSide(color: chateuBorder),
        ),
      ),
      dividerTheme: const DividerThemeData(color: chateuBorder, thickness: 1, space: 1),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: chateuSurface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        labelStyle: AppText.bodyMedium.copyWith(color: chateuTextMuted),
        floatingLabelStyle: AppText.bodyMedium.copyWith(
            color: chateuPrimary, fontWeight: FontWeight.w600),
        hintStyle: AppText.bodyMedium.copyWith(color: chateuTextSubtle),
        helperStyle: AppText.caption,
        errorStyle: AppText.caption.copyWith(color: chateuError),
        prefixIconColor: chateuTextMuted,
        suffixIconColor: chateuTextMuted,
        border: inputBorder(chateuBorder),
        enabledBorder: inputBorder(chateuBorder),
        focusedBorder: inputBorder(chateuPrimary, 2),
        errorBorder: inputBorder(chateuError),
        focusedErrorBorder: inputBorder(chateuError, 2),
        disabledBorder: inputBorder(chateuBorder.withAlpha(120)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: chateuPrimary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: chateuPrimary.withAlpha(100),
          disabledForegroundColor: Colors.white70,
          elevation: 0,
          minimumSize: const Size(64, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: shape,
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: chateuPrimary,
          minimumSize: const Size(64, 48),
          shape: shape,
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: chateuPrimary,
          side: const BorderSide(color: chateuBorder),
          minimumSize: const Size(64, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: shape,
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: chateuPrimary,
          minimumSize: const Size(48, 48),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: chateuPrimary,
        foregroundColor: Colors.white,
        elevation: 2,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: chateuSurfaceMuted,
        selectedColor: chateuPrimary.withAlpha(30),
        side: BorderSide.none,
        labelStyle: AppText.labelMedium.copyWith(color: chateuText),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.xl)),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: chateuPrimary,
        unselectedLabelColor: chateuTextMuted,
        indicatorColor: chateuPrimary,
        dividerColor: chateuBorder,
        labelStyle: AppText.labelMedium.copyWith(fontSize: 14),
        unselectedLabelStyle: AppText.labelMedium.copyWith(
            fontSize: 14, fontWeight: FontWeight.w500),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: chateuSurface,
        selectedItemColor: chateuPrimary,
        unselectedItemColor: chateuTextMuted,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        unselectedLabelStyle: TextStyle(fontSize: 12),
        elevation: 0,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: chateuSurface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: chateuPrimary.withAlpha(28),
        iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(
            color: s.contains(WidgetState.selected) ? chateuPrimary : chateuTextMuted)),
        labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
            fontSize: 12,
            fontWeight: s.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
            color: s.contains(WidgetState.selected) ? chateuPrimary : chateuTextMuted)),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: chateuSurface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.lg)),
        titleTextStyle: AppText.titleLarge,
        contentTextStyle: AppText.bodyMedium.copyWith(color: chateuTextMuted),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: chateuSurface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: false,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.sm)),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: chateuPrimary),
      listTileTheme: const ListTileThemeData(
        iconColor: chateuPrimary,
        minVerticalPadding: 12,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? Colors.white : null),
        trackColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? chateuPrimary : null),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? chateuPrimary : null),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? chateuPrimary : chateuTextMuted),
      ),
      datePickerTheme: const DatePickerThemeData(
        backgroundColor: chateuSurface,
        surfaceTintColor: Colors.transparent,
      ),
    );
  }
}
