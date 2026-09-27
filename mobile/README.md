# Chateau Mobile App

Flutter client for the Chateau HOA platform — the mobile companion to [`chateau-project/`](../chateau-project).

## Stack

- Flutter (stable channel) / Dart
- [Supabase](https://supabase.com) (`supabase_flutter`) for auth and data — same backend as the web app
- `flutter_map` with [Mapbox](https://www.mapbox.com/) raster tiles + Directions API (token in `app_config.dart`)
- Firebase Cloud Messaging (`firebase_messaging` + `flutter_local_notifications`) for push — Android only
- `pdf` / `printing` for the downloadable Statement of Account
- Targets: Android, iOS, Web, macOS

## Structure

```
lib/
  main.dart                   Entry point — Supabase + push init, auth gate, landing page
  app_config.dart             Supabase / Mapbox credentials
  app_colors.dart             Color tokens (brand, neutrals, semantic)
  app_theme.dart              Type/spacing/radius tokens, shared widgets, AppTheme.light
  app_dialogs.dart            Shared snackbars, confirm/info dialogs, sheet handle
  audit_logger.dart           Logs resident/tenant actions to `system_logs`
  push_notifications.dart     FCM token registration + foreground notifications
  login_page.dart / signup_page.dart / account_page.dart
  home_page.dart               Dashboard / announcements
  reserve_page.dart            Facility reservations + calendar
  payment_page.dart            Dues / payments
  soa_page.dart                Statement of Account PDF generation
  report_page.dart             Maintenance & incident reports
  voting_page.dart             HOA elections
  tenant_management_page.dart
  map_page.dart                 Community map + navigation (flutter_map)
  notification_page.dart, aboutus_page.dart
```

## Quick start

**Prerequisites**
- [Flutter SDK](https://docs.flutter.dev/get-started/install) (stable channel)
- For Android: Android SDK + cmdline-tools — see [ANDROID_SETUP.md](ANDROID_SETUP.md)
- For web: any Chromium-based browser

```bash
flutter pub get
flutter run -d chrome   # web — fastest way to see it running
flutter run              # pick a connected device/emulator
```

Android-specific setup (SDK, emulator, physical device, release APK builds, troubleshooting) is documented in [ANDROID_SETUP.md](ANDROID_SETUP.md).

## Configuration

Supabase and Mapbox credentials live in `lib/app_config.dart`. The Supabase key is a publishable/anon key — safe to ship client-side since it's scoped by Row-Level Security policies in the Supabase dashboard. The Mapbox token should be restricted to this app's bundle ID / allowed URLs in the Mapbox dashboard.

## Design system

All styling goes through the tokens in `lib/app_colors.dart` and `lib/app_theme.dart`. Don't hardcode hex colors or font sizes in pages.

- **Colors:** `chateuPrimary` / `chateuSecondary` / `chateuAccent` (brand, matches the web app), neutrals `chateuSurface`, `chateuSurfaceMuted`, `chateuBorder`, `chateuTextMuted`, `chateuTextSubtle`, and semantic `chateuSuccess` / `chateuWarning` / `chateuError` / `chateuInfo`. Every text color meets WCAG AA (4.5:1) on white.
- **Type & layout:** `AppText.*` (nothing under 12sp), `AppSpacing.*` (8dp grid), `AppRadius.*`, `AppShadows.*`, `AppDecorations.card` / `.sheet`, `AppFadeSlide`.
- **Components:** `AppTheme.light` themes stock Material widgets (inputs, buttons, cards, chips, tabs, dialogs, nav bars), so a plain `TextField` or `ElevatedButton` already looks right. Shared widgets: `AppPrimaryButton`, `AppSectionHeader`, `AppStatusBadge`, `AppNoticeBanner`, `AppInfoChip`, `buildStandardAppBar`.
- Keep touch targets at least 48dp.

The direction came from the [UI/UX Pro Max](https://www.npmjs.com/package/ui-ux-pro-max-cli) skill (`uipro init --ai claude`, installed at `.claude/skills/ui-ux-pro-max/`). Query it for new screens, for example:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "form validation errors" --domain ux
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "list performance" --stack flutter
```
