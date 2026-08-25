# Flutter wrapper
-keep class io.flutter.** { *; }
-keep class io.flutter.embedding.** { *; }

# Supabase / Ktor / OkHttp
-keep class io.ktor.** { *; }
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# Mapbox
-keep class com.mapbox.** { *; }

# Keep all data classes for JSON parsing
-keepclassmembers class * {
    @kotlinx.serialization.SerialName <fields>;
}
