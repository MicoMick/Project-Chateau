# Chateau Mobile App

Flutter client for the Chateau HOA platform — the mobile companion to [`chateau-project/`](../chateau-project).

## Stack

- Flutter (stable channel) / Dart
- [Supabase](https://supabase.com) (`supabase_flutter`) for auth and data — same backend as the web app
- [Mapbox](https://www.mapbox.com/) (`mapbox_maps_flutter`) on Android/iOS, `flutter_map` on web
- Targets: Android, iOS, Web, macOS

## Structure

```
lib/
  main.dart                   Entry point — Supabase init, auth gate
  app_config.dart             Supabase / Mapbox credentials
  login_page.dart / signup_page.dart / account_page.dart
  home_page.dart               Dashboard / announcements
  reserve_page.dart            Facility reservations + calendar
  payment_page.dart            Dues / payments
  report_page.dart             Maintenance & incident reports
  voting_page.dart             HOA elections
  tenant_management_page.dart
  map_page.dart                 Community map (Mapbox)
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
