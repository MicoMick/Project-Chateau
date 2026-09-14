import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const _channelId = 'chateau_announcements';
const _channelName = 'Announcements';
const _channelDescription = 'New HOA announcements and important updates';

final FlutterLocalNotificationsPlugin _localNotifications =
    FlutterLocalNotificationsPlugin();

// Must be a top-level (or static) function — Firebase runs this in its own
// background isolate, which needs Firebase re-initialized before use.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

// ── Push notifications ────────────────────────────────────────────────────────
// Registers this device with Firebase Cloud Messaging and stores its token in
// Supabase (`device_tokens`) so the backend can push to it when an admin
// publishes a new announcement. Foreground messages arrive silently on
// Android by default, so we surface them ourselves via a local notification.
class PushNotifications {
  static final _supabase = Supabase.instance.client;

  static Future<void> initialize() async {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidInit);
    await _localNotifications.initialize(initSettings);

    const channel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: _channelDescription,
      importance: Importance.high,
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Foreground messages don't show a system notification on Android by
    // default — the app has to display one itself.
    FirebaseMessaging.onMessage.listen((message) {
      final notification = message.notification;
      if (notification == null) return;
      _localNotifications.show(
        notification.hashCode,
        notification.title,
        notification.body,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: _channelDescription,
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
          ),
        ),
      );
    });
  }

  // Call once a resident is signed in — registers this device to receive
  // pushes, and keeps the token fresh if Firebase ever rotates it.
  static Future<void> registerToken() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _saveToken(userId, token);
    } catch (_) {}
    FirebaseMessaging.instance.onTokenRefresh.listen((token) {
      final uid = _supabase.auth.currentUser?.id;
      if (uid != null) _saveToken(uid, token);
    });
  }

  static Future<void> _saveToken(String userId, String token) async {
    try {
      await _supabase.from('device_tokens').upsert({
        'user_id': userId,
        'token': token,
        'platform': 'android',
        'updated_at': DateTime.now().toIso8601String(),
      }, onConflict: 'token');
    } catch (_) {}
  }

  // Call on sign-out so a shared/reset device stops receiving this
  // resident's pushes.
  static Future<void> unregisterToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await _supabase.from('device_tokens').delete().eq('token', token);
      }
    } catch (_) {}
  }
}
