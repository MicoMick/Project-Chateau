import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:chateau_mobile_app/app_colors.dart';
import 'package:chateau_mobile_app/app_theme.dart';
import 'package:chateau_mobile_app/login_page.dart';
import 'package:chateau_mobile_app/home_page.dart';
import 'package:chateau_mobile_app/notification_page.dart';
import 'package:chateau_mobile_app/push_notifications.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:chateau_mobile_app/app_config.dart';

final navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    publishableKey: AppConfig.supabaseAnonKey,
  );

  await PushNotifications.initialize();

  try {
    await loadThemeMode();
  } catch (_) {} // unreadable prefs → stay on the Light default

  // Push notifications are Android-only — no Firebase Web config exists,
  // so none of this applies (or is safe to touch) on web.
  if (!kIsWeb) {
    void openNotifications() {
      navigatorKey.currentState?.push(
        MaterialPageRoute(builder: (_) => const NotificationPage()),
      );
    }

    // Tapped a push while the app was backgrounded.
    FirebaseMessaging.onMessageOpenedApp.listen((_) => openNotifications());

    // App was launched by tapping a push (was fully terminated).
    final initialMessage =
        await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      WidgetsBinding.instance
          .addPostFrameCallback((_) => openNotifications());
    }
  }

  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    appDark = _wantDark;
    WidgetsBinding.instance.addObserver(this);
    appThemeMode.addListener(_syncAppearance);
  }

  @override
  void dispose() {
    appThemeMode.removeListener(_syncAppearance);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  bool get _wantDark => switch (appThemeMode.value) {
        ThemeMode.dark => true,
        ThemeMode.light => false,
        ThemeMode.system =>
          WidgetsBinding.instance.platformDispatcher.platformBrightness ==
              Brightness.dark,
      };

  @override
  void didChangePlatformBrightness() => _syncAppearance();

  void _syncAppearance() {
    if (_wantDark == appDark) return;
    setState(() => appDark = _wantDark);
    // Color tokens aren't inherited widgets, so mark every element dirty to
    // repaint open screens in the new appearance without losing their state.
    void rebuild(Element e) {
      e.markNeedsBuild();
      e.visitChildren(rebuild);
    }
    (context as Element).visitChildren(rebuild);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      debugShowCheckedModeBanner: false,
      title: 'Chateau Real Estate App',
      theme: AppTheme.current,
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: Supabase.instance.client.auth.onAuthStateChange,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final session = snapshot.data?.session;

        if (session != null) {
          return const HomePage();
        } else {
          return const LandingPage();
        }
      },
    );
  }
}

class LandingPage extends StatelessWidget {
  const LandingPage({super.key});

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final width = size.width;

    bool isMobile = width < 600;
    bool isTablet = width >= 600 && width < 1000;
    bool isWeb = width >= 1000;

    double maxContentWidth = isWeb ? 500 : 420;

    double logoSize = isMobile
        ? 120
        : isTablet
            ? 160
            : 200;

    double subtitleSize = isMobile
        ? 16
        : isTablet
            ? 18
            : 20;

    double buttonHeight = isMobile ? 50 : 60;

    double buttonTextSize = isMobile ? 16 : 18;

    double horizontalPadding = isMobile ? 24 : 40;

    return Scaffold(
      body: Stack(
        children: [
          // Background Image
          Container(
            decoration: const BoxDecoration(
              image: DecorationImage(
                image: AssetImage('assets/chateau.png'),
                fit: BoxFit.cover,
              ),
            ),
          ),

          // Flat scrim so white text reads anywhere on the photo
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF001A0D).withAlpha(170),
            ),
          ),

          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: maxContentWidth),
                  child: Padding(
                    padding:
                        EdgeInsets.symmetric(horizontal: horizontalPadding),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 60),

                        // Logo
                        Image.asset(
                          'assets/logo.png',
                          height: logoSize,
                          semanticLabel: 'Chateau Real',
                          errorBuilder: (context, error, stackTrace) => Icon(
                              Icons.home,
                              size: logoSize,
                              color: Colors.white),
                        ),

                        const SizedBox(height: 40),

                        Text(
                          'Welcome home',
                          textAlign: TextAlign.center,
                          style: AppText.displayLarge.copyWith(
                            color: Colors.white,
                            fontSize: subtitleSize + 12,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          'Build a stronger community with us',
                          textAlign: TextAlign.center,
                          style: AppText.bodyLarge.copyWith(
                            fontSize: subtitleSize,
                            color: Colors.white.withAlpha(215),
                          ),
                        ),

                        const SizedBox(height: AppSpacing.xxxl + AppSpacing.sm),

                        // Button
                        SizedBox(
                          width: double.infinity,
                          height: buttonHeight,
                          child: ElevatedButton(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const LoginPage(),
                                ),
                              );
                            },
                            style: ElevatedButton.styleFrom(
                              shape: RoundedRectangleBorder(
                                borderRadius:
                                    BorderRadius.circular(AppRadius.md),
                              ),
                            ),
                            child: Text(
                              'Sign in',
                              style: AppText.labelLarge
                                  .copyWith(fontSize: buttonTextSize),
                            ),
                          ),
                        ),

                        const SizedBox(height: 60),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
