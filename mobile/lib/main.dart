import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
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

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      debugShowCheckedModeBanner: false,
      title: 'Chateau Real Estate App',
      theme: AppTheme.light,
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

          // Scrim — lighter at the top so the photo reads, dark behind the text
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withAlpha(60),
                  Colors.black.withAlpha(140),
                  const Color(0xFF002814).withAlpha(230),
                ],
                stops: const [0, 0.5, 1],
              ),
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
                              'Join Now',
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
