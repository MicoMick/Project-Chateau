import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'app_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Shared Dialog & Snackbar utilities — v1.0
//
// Use these everywhere so popups are 100% cohesive across the app.
// ─────────────────────────────────────────────────────────────────────────────

// ── Snackbar ──────────────────────────────────────────────────────────────────

enum SnackType { success, error, warning, info }

void showAppSnack(
  BuildContext context,
  String message, {
  SnackType type = SnackType.info,
}) {
  if (!context.mounted) return;

  final Color bg;
  final IconData icon;
  switch (type) {
    case SnackType.success:
      bg   = chateuPrimary;
      icon = Icons.check_circle_rounded;
      break;
    case SnackType.error:
      bg   = const Color(0xFFDC2626);
      icon = Icons.error_rounded;
      break;
    case SnackType.warning:
      bg   = const Color(0xFFD97706);
      icon = Icons.warning_rounded;
      break;
    case SnackType.info:
      bg   = chateuSecondary;
      icon = Icons.info_rounded;
      break;
  }

  ScaffoldMessenger.of(context)
    ..clearSnackBars()
    ..showSnackBar(SnackBar(
      content: Row(children: [
        Icon(icon, color: Colors.white, size: 18),
        const SizedBox(width: 10),
        Expanded(child: Text(message,
            style: AppText.bodyMedium.copyWith(color: Colors.white))),
      ]),
      backgroundColor: bg,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.sm)),
      margin: const EdgeInsets.all(AppSpacing.lg),
      duration: const Duration(seconds: 3),
    ));
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────

Future<bool> showConfirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel  = 'Confirm',
  String cancelLabel   = 'Cancel',
  bool   isDanger      = false,
  IconData? icon,
}) async {
  final result = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _AppConfirmDialog(
      title:         title,
      message:       message,
      confirmLabel:  confirmLabel,
      cancelLabel:   cancelLabel,
      isDanger:      isDanger,
      icon:          icon,
    ),
  );
  return result ?? false;
}

class _AppConfirmDialog extends StatelessWidget {
  final String    title;
  final String    message;
  final String    confirmLabel;
  final String    cancelLabel;
  final bool      isDanger;
  final IconData? icon;

  const _AppConfirmDialog({
    required this.title,
    required this.message,
    required this.confirmLabel,
    required this.cancelLabel,
    required this.isDanger,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final confirmColor = isDanger ? const Color(0xFFDC2626) : chateuPrimary;
    final effectiveIcon = icon ?? (isDanger ? Icons.warning_rounded : Icons.help_outline_rounded);

    return AlertDialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.lg)),
      contentPadding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: confirmColor.withAlpha(16),
            shape: BoxShape.circle,
          ),
          child: Icon(effectiveIcon, color: confirmColor, size: 32),
        ),
        const SizedBox(height: 16),
        Text(title,
            textAlign: TextAlign.center,
            style: AppText.titleLarge),
        const SizedBox(height: 8),
        Text(message,
            textAlign: TextAlign.center,
            style: AppText.bodyMedium.copyWith(color: Colors.grey.shade600)),
        const SizedBox(height: 20),
        Row(children: [
          Expanded(
            child: OutlinedButton(
              onPressed: () => Navigator.pop(context, false),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: Colors.grey.shade300),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.sm)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              child: Text(cancelLabel,
                  style: AppText.labelMedium.copyWith(color: Colors.grey.shade700)),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: confirmColor,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.sm)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              child: Text(confirmLabel,
                  style: AppText.labelMedium.copyWith(color: Colors.white)),
            ),
          ),
        ]),
      ]),
    );
  }
}

// ── Info / Notice Dialog ──────────────────────────────────────────────────────

Future<void> showInfoDialog(
  BuildContext context, {
  required String  title,
  required String  message,
  IconData?        icon,
  Color?           iconColor,
  String           buttonLabel = 'Got it',
}) async {
  await showDialog(
    context: context,
    builder: (_) => _AppInfoDialog(
      title:       title,
      message:     message,
      icon:        icon ?? Icons.info_rounded,
      iconColor:   iconColor ?? chateuPrimary,
      buttonLabel: buttonLabel,
    ),
  );
}

class _AppInfoDialog extends StatelessWidget {
  final String   title;
  final String   message;
  final IconData icon;
  final Color    iconColor;
  final String   buttonLabel;

  const _AppInfoDialog({
    required this.title,
    required this.message,
    required this.icon,
    required this.iconColor,
    required this.buttonLabel,
  });

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.lg)),
      contentPadding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: iconColor.withAlpha(16), shape: BoxShape.circle),
          child: Icon(icon, color: iconColor, size: 32),
        ),
        const SizedBox(height: 16),
        Text(title, textAlign: TextAlign.center, style: AppText.titleLarge),
        const SizedBox(height: 8),
        Text(message,
            textAlign: TextAlign.center,
            style: AppText.bodyMedium.copyWith(color: Colors.grey.shade600)),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: iconColor,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.sm)),
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
            child: Text(buttonLabel,
                style: AppText.labelMedium.copyWith(color: Colors.white)),
          ),
        ),
      ]),
    );
  }
}

// ── Bottom Sheet handle ────────────────────────────────────────────────────────

Widget buildSheetHandle() => Center(
  child: Container(
    width: 40, height: 4,
    margin: const EdgeInsets.only(bottom: AppSpacing.lg),
    decoration: BoxDecoration(
      color: Colors.grey.shade300,
      borderRadius: BorderRadius.circular(2),
    ),
  ),
);
