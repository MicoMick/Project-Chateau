/// app_config.dart
///
/// Centralizes all third-party API credentials.
///
/// ── SECURITY NOTE ───────────────────────────────────────────────────────────
/// These values are compiled into the app binary and are NOT truly secret for
/// a mobile/web app — anyone who decompiles the APK/IPA can read them.
/// They are safe to keep here because:
///   • Supabase anon key  → protected by Row-Level Security (RLS) policies in
///                          the Supabase dashboard. Never disable RLS.
///   • Mapbox public key  → scoped to allowed URLs/bundle IDs in the Mapbox
///                          dashboard. Add your app's bundle ID there.
///
/// To further harden production:
///   1. Move these to a .env file + flutter_dotenv (never commit the .env).
///   2. Or use --dart-define at build time:
///        flutter build apk --dart-define=SUPABASE_URL=https://...
///      then read via: const String.fromEnvironment('SUPABASE_URL')
/// ────────────────────────────────────────────────────────────────────────────
library;

class AppConfig {
  AppConfig._();

  // ── Supabase ──────────────────────────────────────────────────────────────
  static const String supabaseUrl =
      'https://kroyvjpqvkqlednegpfo.supabase.co';

  static const String supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtyb3l2anBxdmtxbGVkbmVncGZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTE1OTksImV4cCI6MjA4ODc4NzU5OX0'
      '.5WFn3dvF4YXF35a5n2-2lwuzOTwOMNFHhQeUj2F2k1s';

  // ── Mapbox ────────────────────────────────────────────────────────────────
  // Restrict this token in the Mapbox dashboard to your app's bundle ID /
  // allowed URLs so it cannot be used from other origins.
  static const String mapboxToken =
      'pk.eyJ1Ijoia21hbmlwaXMiLCJhIjoiY21wN3piaGY0MDE3aTJxczYyZjhjc29zOSJ9'
      '.xPFcwtecfqJBjLenYDo6NA';
}
