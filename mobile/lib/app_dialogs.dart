import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'app_theme.dart';

// Shared snackbars and dialogs, so feedback looks the same on every screen.

// ── Snackbar ──────────────────────────────────────────────────────────────────

enum SnackType { success, error, warning, info, neutral }

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
      bg = chateuBrand;
      icon = Icons.check_circle_rounded;
      break;
    case SnackType.error:
      bg = chateuError;
      icon = Icons.error_rounded;
      break;
    case SnackType.warning:
      bg = chateuWarning;
      icon = Icons.warning_rounded;
      break;
    case SnackType.info:
      bg = chateuInfo;
      icon = Icons.info_rounded;
      break;
    case SnackType.neutral:
      bg = chateuSurfaceMuted;
      icon = Icons.info_outline_rounded;
      break;
  }

  final fg = switch (type) {
    SnackType.success => chateuOnBrand,
    SnackType.neutral => chateuText,
    _ => chateuOnColor,
  };

  ScaffoldMessenger.of(context)
    ..clearSnackBars()
    ..showSnackBar(SnackBar(
      content: Row(children: [
        Icon(icon, color: fg, size: 18),
        const SizedBox(width: 10),
        Expanded(
            child:
                Text(message, style: AppText.bodyMedium.copyWith(color: fg))),
      ]),
      backgroundColor: bg,
      margin: const EdgeInsets.all(AppSpacing.lg),
      duration: const Duration(seconds: 3),
    ));
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────

/// Material alert dialog. [icon] is accepted for call-site compatibility but
/// only shown for destructive confirmations, where it earns the attention.
Future<bool> showConfirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Confirm',
  String cancelLabel = 'Cancel',
  bool isDanger = false,
  IconData? icon,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      icon: isDanger
          ? Icon(icon ?? Icons.warning_rounded, color: chateuError)
          : null,
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text(cancelLabel),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: isDanger
              ? FilledButton.styleFrom(
                  backgroundColor: chateuError, foregroundColor: chateuOnColor)
              : null,
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result ?? false;
}

// ── Info / Notice Dialog ──────────────────────────────────────────────────────

Future<void> showInfoDialog(
  BuildContext context, {
  required String title,
  required String message,
  IconData? icon,
  Color? iconColor,
  String buttonLabel = 'Got it',
}) async {
  await showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      icon: icon == null ? null : Icon(icon, color: iconColor ?? chateuPrimary),
      title: Text(title),
      content: Text(message),
      actions: [
        FilledButton(
          onPressed: () => Navigator.pop(ctx),
          child: Text(buttonLabel),
        ),
      ],
    ),
  );
}

// ── Bottom Sheet handle ────────────────────────────────────────────────────────

/// Material 3 drag handle (32×4, on-surface-variant at 40%) for sheets that
/// draw their own surface.
Widget buildSheetHandle() => Center(
      child: Container(
        width: 32,
        height: 4,
        margin: const EdgeInsets.only(bottom: AppSpacing.lg),
        decoration: BoxDecoration(
          color: chateuTextMuted.withAlpha(102),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
