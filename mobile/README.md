# Chateau Mobile App

Flutter client for the Chateau HOA platform — the mobile companion to [`chateau-project/`](../chateau-project). Residents (homeowners and tenants) use it to pay dues, reserve facilities, report issues, vote and follow announcements; admins work in the web app. Product context — users, flows, principles — lives in [PRODUCT.md](PRODUCT.md).

## What's new in v0.2.0

A full UI refactor on top of the same features and backend:

- **Appearance setting** — Light / Dark / System under *Settings* (drawer); Light by default, remembered between launches.
- **Home** — brand-green header with the logo, a hero panel (greeting, balance with *Pay now*, quick actions for Report / Map / Reserve / Bills), then the HOA calendar and announcements.
- **Drawer** — account card (tap for My Account) and grouped sections; tenants only see what applies to them.
- **Native Android feel** — Material 3 navigation bar (rail on tablets), standard dialogs, chips and back buttons; content clears the Android nav buttons edge-to-edge.
- **Accessibility** — every icon button labelled for TalkBack, ≥ 48dp touch targets, text contrast checked in both themes (`test/theme_test.dart`), calendar days announce their events.
- **Performance** — tabs stay alive after first visit, lazy lists, images decoded at display size, GPS stops when navigation closes.

## Stack

- Flutter (stable channel) / Dart
- [Supabase](https://supabase.com) (`supabase_flutter`) for auth and data — same backend as the web app
- `flutter_map` with [Mapbox](https://www.mapbox.com/) raster tiles + Directions API (token in `app_config.dart`)
- Firebase Cloud Messaging (`firebase_messaging` + `flutter_local_notifications`) for push — Android only
- `pdf` / `printing` for the downloadable Statement of Account
- Targets: **Android** (design target, push notifications); iOS and Web also build

## Structure

```
lib/
  main.dart                   Entry point — Supabase + push init, auth gate, landing page
  app_config.dart             Supabase / Mapbox credentials
  app_colors.dart             Color tokens (brand, neutrals, semantic)
  app_theme.dart              Type/spacing/radius tokens, shared widgets, AppTheme.current, appearance setting
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
  notification_page.dart, aboutus_page.dart, settings_page.dart
test/
  theme_test.dart              Contrast of every text token, both themes
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

- **Colors:** `chateuPrimary` / `chateuSecondary` / `chateuAccent` (brand, matches the web app), `chateuOnColor` (text on any filled color), neutrals `chateuBackground`, `chateuSurface`, `chateuSurfaceMuted`, `chateuBorder`, `chateuText`, `chateuTextMuted`, `chateuTextSubtle`, and semantic `chateuSuccess` / `chateuWarning` / `chateuError` / `chateuInfo`. Tokens resolve for light or dark (`appDark`), which `MyApp` keeps in sync with the Light / Dark / System choice in Settings (`appThemeMode`, saved with `shared_preferences`, Light by default), so they aren't `const`. Filled surfaces use the logo green `chateuBrand` with `chateuOnBrand` text in both appearances. Every text token meets WCAG AA on every surface in both appearances — `test/theme_test.dart` checks it.
- **Type & layout:** `AppText.*` (nothing under 12sp), `AppSpacing.*` (8dp grid), `AppRadius.*`, `AppShadows.*`, `AppDecorations.card` / `.muted` / `.sheet`. Wrap page content in `AppContentWidth` (or pad lazy lists with `appListPadding`) so it doesn't stretch on tablet, web and desktop.
- **Components:** `AppTheme.current` themes stock Material widgets (inputs, buttons, cards, chips, dialogs, navigation bar/rail), so a plain `TextField(decoration: InputDecoration(labelText: …))` or `FilledButton` already looks right. Shared widgets: `AppPrimaryButton`, `AppSectionHeader`, `AppStatusBadge`, `AppNoticeBanner`, `AppInfoChip`, `AppUploadTile`, `buildStandardAppBar`; dialogs and snackbars via `showConfirmDialog` / `showInfoDialog` / `showAppSnack`.
- Every icon-only button needs a `tooltip` (it is the screen-reader label). Let `AppBar` draw back/close/menu buttons itself.
- Keep touch targets at least 48dp.

The direction came from the [UI/UX Pro Max](https://www.npmjs.com/package/ui-ux-pro-max-cli) skill (`uipro init --ai claude`, installed at `.claude/skills/ui-ux-pro-max/`). Query it for new screens, for example:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "form validation errors" --domain ux
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "list performance" --stack flutter
```
