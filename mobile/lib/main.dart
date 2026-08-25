import 'package:flutter/material.dart';
import 'package:chateau_mobile_app/app_colors.dart';
import 'package:chateau_mobile_app/login_page.dart';
import 'package:chateau_mobile_app/home_page.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:chateau_mobile_app/app_config.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    publishableKey: AppConfig.supabaseAnonKey,
  );

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Chateau Real Estate App',
      theme: ThemeData(
        brightness: Brightness.light,
        useMaterial3: true,
        colorScheme: ColorScheme.light(
          primary: chateuPrimary,
          secondary: chateuSecondary,
          surface: chateuBackground,
          onSurface: chateuText,
          onPrimary: Colors.white,
          onSecondary: Colors.white,
        ),
        scaffoldBackgroundColor: chateuBackground,
        appBarTheme: const AppBarTheme(backgroundColor: chateuPrimary),
      ),
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

          // Overlay
          Container(color: Colors.black.withAlpha(110)),

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

                        // Subtitle
                        Text(
                          'Build a stronger community with us',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: subtitleSize,
                            color: Colors.white70,
                            fontWeight: FontWeight.w300,
                          ),
                        ),

                        const SizedBox(height: 40),

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
                              backgroundColor: chateuPrimary,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: Text(
                              'Join Now',
                              style: TextStyle(
                                fontSize: buttonTextSize,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
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
