import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'app_colors.dart';

// Type, spacing, radius and shared widgets. Colors live in app_colors.dart.
// Type scale: 28 / 22 / 18 / 16 / 14 / 12 — same-size roles differ by weight
// (title 16 w600 vs body 16 w400; label 14 w600 vs body 14 w400).
// Platform font, nothing under 12sp, ≥ 48dp touch targets. Prefer these
// tokens over raw values in pages.

// ── Typography ─────────────────────────────────────────────────────────────────

class AppText {
  AppText._();

  static TextStyle get displayLarge => TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w800,
        color: chateuText,
        letterSpacing: -0.5,
        height: 1.2,
      );

  static TextStyle get displayMedium => TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w800,
        color: chateuText,
        letterSpacing: -0.3,
      );

  static TextStyle get titleLarge => TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: chateuText,
        letterSpacing: -0.2,
      );

  static TextStyle get titleMedium => TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: chateuText,
      );

  static TextStyle get bodyLarge => TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: chateuText,
        height: 1.55,
      );

  static TextStyle get bodyMedium => TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: chateuText,
        height: 1.5,
      );

  static TextStyle get labelLarge => TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: chateuOnBrand,
        letterSpacing: 0.2,
      );

  static TextStyle get labelMedium => TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.2,
      );

  static TextStyle get caption => TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        color: chateuTextMuted,
        height: 1.4,
      );
}

// ── Appearance setting ─────────────────────────────────────────────────────────

const _themeModeKey = 'theme_mode';

/// The user's Light / Dark / System choice (Settings). Light by default;
/// [MyApp] listens and repaints the app when it changes.
final appThemeMode = ValueNotifier<ThemeMode>(ThemeMode.light);

Future<void> loadThemeMode() async {
  final prefs = await SharedPreferences.getInstance();
  appThemeMode.value =
      ThemeMode.values.asNameMap()[prefs.getString(_themeModeKey)] ??
          ThemeMode.light;
}

Future<void> setThemeMode(ThemeMode mode) async {
  appThemeMode.value = mode;
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_themeModeKey, mode.name);
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

  // Shadows barely read on dark surfaces; borders carry the edge there.
  static List<BoxShadow> get card => appDark
      ? const []
      : [
          BoxShadow(
            color: const Color(0xFF0F2A1C).withAlpha(10),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ];

  static List<BoxShadow> get elevated => appDark
      ? const []
      : [
          BoxShadow(
            color: const Color(0xFF0F2A1C).withAlpha(18),
            blurRadius: 24,
            offset: const Offset(0, 8),
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
}

// ── Content width ──────────────────────────────────────────────────────────────

/// Caps content at a readable width on tablets, desktop and web; a no-op on
/// phones.
class AppContentWidth extends StatelessWidget {
  final Widget child;
  final double maxWidth;

  const AppContentWidth({super.key, required this.child, this.maxWidth = 720});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}

/// Horizontal padding that centres a lazy list at [maxWidth] on wide screens
/// (for ListView.builder bodies, where [AppContentWidth] can't wrap items).
EdgeInsets appListPadding(BuildContext context,
    {double maxWidth = 720, double top = 0, double bottom = 0}) {
  final w = MediaQuery.sizeOf(context).width;
  final side =
      w > maxWidth + 2 * AppSpacing.lg ? (w - maxWidth) / 2 : AppSpacing.lg;
  // Plus the system nav bar: Android draws apps edge-to-edge beneath it.
  return EdgeInsets.fromLTRB(
      side, top, side, bottom + MediaQuery.paddingOf(context).bottom);
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
        Expanded(
          child: Semantics(
            header: true,
            child: Text(title, style: AppText.titleLarge),
          ),
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
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
        ),
        child: isLoading
            ? SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  color: chateuOnBrand,
                  strokeWidth: 2.5,
                  semanticsLabel: 'Loading',
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, color: chateuOnBrand, size: 18),
                    const SizedBox(width: AppSpacing.sm),
                  ],
                  Flexible(
                    child: Text(label,
                        style: AppText.labelLarge,
                        overflow: TextOverflow.ellipsis),
                  ),
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
    return MergeSemantics(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: chateuPrimary),
          const SizedBox(height: AppSpacing.xs),
          Text(label, style: AppText.caption),
          const SizedBox(height: 2),
          Text(
            value,
            style: AppText.labelMedium.copyWith(color: chateuText),
          ),
        ],
      ),
    );
  }
}

// ── Notice Banner ──────────────────────────────────────────────────────────────

class AppNoticeBanner extends StatelessWidget {
  final String text;
  final IconData icon;
  final Color? color;

  const AppNoticeBanner({
    super.key,
    required this.text,
    this.icon = Icons.info_outline_rounded,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? chateuPrimary;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: c.withAlpha(16),
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: c.withAlpha(50)),
      ),
      child: Row(
        children: [
          Icon(icon, color: c, size: 16),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              text,
              style: AppText.labelMedium
                  .copyWith(color: c, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}

// ── AppBar factory ─────────────────────────────────────────────────────────────

/// Back / close buttons come from [AppBar] itself, so they match the platform
/// and carry screen-reader labels.
PreferredSizeWidget buildStandardAppBar({
  required BuildContext context,
  required String title,
  List<Widget>? actions,
  bool showBack = true,
}) {
  return AppBar(
    automaticallyImplyLeading: showBack,
    title: Text(title),
    actions: actions,
  );
}

// ── ThemeData ──────────────────────────────────────────────────────────────────
//
// Component themes so stock Material widgets (TextField, buttons, Card, chips,
// dialogs…) pick up the design system without per-page styling. Built from
// the tokens, so it follows [appDark].

class AppTheme {
  AppTheme._();

  static ThemeData get current {
    final brightness = appDark ? Brightness.dark : Brightness.light;
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF006837),
      brightness: brightness,
    ).copyWith(
      primary: chateuPrimary,
      onPrimary: chateuOnColor,
      secondary: chateuSecondary,
      onSecondary: chateuOnColor,
      tertiary: chateuAccent,
      onTertiary: const Color(0xFF1A1A1A),
      error: chateuError,
      onError: chateuOnColor,
      surface: chateuSurface,
      onSurface: chateuText,
      onSurfaceVariant: chateuTextMuted,
      outline: chateuBorder,
      outlineVariant: chateuBorder,
    );

    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppRadius.sm),
    );
    OutlineInputBorder inputBorder(Color c, [double w = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide(color: c, width: w),
        );
    const buttonText = TextStyle(fontSize: 16, fontWeight: FontWeight.w600);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: chateuBackground,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      textTheme: TextTheme(
        headlineMedium: AppText.displayLarge,
        headlineSmall: AppText.displayMedium,
        titleLarge: AppText.titleLarge,
        titleMedium: AppText.titleMedium,
        bodyLarge: AppText.bodyLarge,
        bodyMedium: AppText.bodyMedium,
        labelLarge: buttonText,
        labelMedium: AppText.labelMedium,
        bodySmall: AppText.caption,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: chateuBackground,
        foregroundColor: chateuText,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 1,
        centerTitle: true,
        titleTextStyle: AppText.titleLarge,
        iconTheme: IconThemeData(color: chateuPrimary),
        actionsIconTheme: IconThemeData(color: chateuPrimary),
      ),
      cardTheme: CardThemeData(
        color: chateuSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: BorderSide(color: chateuBorder),
        ),
      ),
      dividerTheme:
          DividerThemeData(color: chateuBorder, thickness: 1, space: 1),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: chateuSurface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        labelStyle: AppText.bodyMedium.copyWith(color: chateuTextMuted),
        floatingLabelStyle: AppText.bodyMedium
            .copyWith(color: chateuPrimary, fontWeight: FontWeight.w600),
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
          backgroundColor: chateuBrand,
          foregroundColor: chateuOnBrand,
          disabledBackgroundColor: chateuBrand.withAlpha(appDark ? 90 : 100),
          disabledForegroundColor: chateuOnBrand.withAlpha(180),
          elevation: 0,
          minimumSize: const Size(64, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: shape,
          textStyle: buttonText,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: chateuBrand,
          foregroundColor: chateuOnBrand,
          minimumSize: const Size(64, 48),
          shape: shape,
          textStyle: buttonText,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: chateuPrimary,
          side: BorderSide(color: chateuBorder),
          minimumSize: const Size(64, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: shape,
          textStyle: buttonText,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: chateuPrimary,
          minimumSize: const Size(48, 48),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: chateuBrand,
        foregroundColor: chateuOnBrand,
        elevation: 2,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: chateuSurfaceMuted,
        selectedColor: chateuPrimary.withAlpha(30),
        side: BorderSide.none,
        labelStyle: AppText.labelMedium.copyWith(color: chateuText),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.xl)),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: chateuPrimary,
        unselectedLabelColor: chateuTextMuted,
        indicatorColor: chateuPrimary,
        dividerColor: chateuBorder,
        labelStyle: AppText.labelMedium,
        unselectedLabelStyle: AppText.labelMedium
            .copyWith(fontWeight: FontWeight.w500),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: chateuSurface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: chateuPrimary.withAlpha(28),
        iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(
            color: s.contains(WidgetState.selected)
                ? chateuPrimary
                : chateuTextMuted)),
        labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
            fontSize: 12,
            fontWeight: s.contains(WidgetState.selected)
                ? FontWeight.w600
                : FontWeight.w500,
            color: s.contains(WidgetState.selected)
                ? chateuPrimary
                : chateuTextMuted)),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: chateuSurface,
        indicatorColor: chateuPrimary.withAlpha(28),
        selectedIconTheme: IconThemeData(color: chateuPrimary),
        unselectedIconTheme: IconThemeData(color: chateuTextMuted),
        selectedLabelTextStyle: TextStyle(
            fontSize: 12, fontWeight: FontWeight.w600, color: chateuPrimary),
        unselectedLabelTextStyle: TextStyle(
            fontSize: 12, fontWeight: FontWeight.w500, color: chateuTextMuted),
      ),
      drawerTheme: DrawerThemeData(
        backgroundColor: chateuSurface,
        surfaceTintColor: Colors.transparent,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: chateuSurface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg)),
        titleTextStyle: AppText.titleLarge,
        contentTextStyle: AppText.bodyMedium.copyWith(color: chateuTextMuted),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: chateuSurface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: false,
        shape: const RoundedRectangleBorder(
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.sm)),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: chateuPrimary),
      listTileTheme: ListTileThemeData(
        iconColor: chateuPrimary,
        textColor: chateuText,
        minVerticalPadding: 12,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? chateuOnColor : null),
        trackColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? chateuPrimary : null),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? chateuPrimary : null),
        checkColor: WidgetStatePropertyAll(chateuOnColor),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith((s) =>
            s.contains(WidgetState.selected) ? chateuPrimary : chateuTextMuted),
      ),
      datePickerTheme: DatePickerThemeData(
        backgroundColor: chateuSurface,
        surfaceTintColor: Colors.transparent,
      ),
      timePickerTheme: TimePickerThemeData(
        backgroundColor: chateuSurface,
      ),
    );
  }
}

// ── Upload tile ────────────────────────────────────────────────────────────────

/// Tap-to-pick row for proof photos and documents.
class AppUploadTile extends StatelessWidget {
  final bool hasFile;
  final String label;
  final VoidCallback? onTap;
  final VoidCallback? onRemove;

  const AppUploadTile({
    super.key,
    required this.hasFile,
    required this.label,
    this.onTap,
    this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final c = hasFile ? chateuPrimary : chateuTextMuted;
    return Material(
      color: chateuSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.sm),
        side: BorderSide(
            color: hasFile ? chateuPrimary.withAlpha(120) : chateuBorder),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 52),
          child: Padding(
            padding: EdgeInsets.only(
                left: AppSpacing.md,
                right: onRemove != null && hasFile ? 0 : AppSpacing.md),
            child: Row(children: [
              Icon(
                hasFile
                    ? Icons.check_circle_rounded
                    : Icons.upload_file_rounded,
                size: 20,
                color: c,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  label,
                  style: AppText.bodyMedium.copyWith(color: c),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 2,
                ),
              ),
              if (onRemove != null && hasFile)
                IconButton(
                  tooltip: 'Remove file',
                  onPressed: onRemove,
                  icon: Icon(Icons.close_rounded,
                      size: 20, color: chateuTextMuted),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}

// ── Lot-plan texture ───────────────────────────────────────────────────────────

/// Hairline parcel grid — blocks of lots split by streets, tilted like a
/// site plan. Gives the brand fills some material without gradients.
class LotPlanPainter extends CustomPainter {
  final Color color;
  const LotPlanPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    const lotW = 26.0, lotH = 18.0, street = 12.0;
    const lotsPerBlock = 4, rowsPerBlock = 2;
    const blockW = lotW * lotsPerBlock + street;
    const blockH = lotH * rowsPerBlock + street;

    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    canvas.save();
    canvas.clipRect(Offset.zero & size);
    canvas.translate(size.width / 2, size.height / 2);
    canvas.rotate(-0.21); // ~12°
    final reach = size.longestSide;
    for (var by = -reach; by < reach; by += blockH) {
      for (var bx = -reach; bx < reach; bx += blockW) {
        for (var r = 0; r < rowsPerBlock; r++) {
          for (var c = 0; c < lotsPerBlock; c++) {
            canvas.drawRect(
                Rect.fromLTWH(bx + c * lotW, by + r * lotH, lotW, lotH), paint);
          }
        }
      }
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(LotPlanPainter old) => old.color != color;
}
