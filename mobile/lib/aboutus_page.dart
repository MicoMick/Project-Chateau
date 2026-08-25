import 'package:flutter/material.dart';
import 'app_colors.dart';

class AboutPage extends StatefulWidget {
  const AboutPage({super.key});

  @override
  State<AboutPage> createState() => _AboutPageState();
}

class _AboutPageState extends State<AboutPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final screenW = mq.size.width;
    final isWide = screenW > 600;
    final hPad = isWide ? screenW * 0.08 : 20.0;

    return Scaffold(
      backgroundColor: chateuBackground,
      appBar: AppBar(
        backgroundColor: chateuBackground,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: chateuPrimary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          "About Us",
          style: TextStyle(
            color: chateuText,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        child: Column(
          children: [
            // ── Hero Banner ───────────────────────────────────────────
            _FadeSlide(
              controller: _animController,
              delay: 0.0,
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [chateuPrimary, chateuSecondary],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Stack(
                  children: [
                    // Decorative circles
                    Positioned(
                      top: -40,
                      right: -40,
                      child: Container(
                        width: 180,
                        height: 180,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withAlpha(15),
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: -20,
                      left: -20,
                      child: Container(
                        width: 120,
                        height: 120,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withAlpha(10),
                        ),
                      ),
                    ),

                    Padding(
                      padding: EdgeInsets.symmetric(
                              horizontal: hPad, vertical: 36)
                          .copyWith(bottom: 40),
                      child: Column(
                        children: [
                          // Logo
                          Container(
                            width: 90,
                            height: 90,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black
                                      .withAlpha(40),
                                  blurRadius: 20,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: ClipOval(
                              child: Image.asset(
                                'assets/logo.png',
                                fit: BoxFit.contain,
                                errorBuilder: (_, __, ___) =>
                                    const Icon(
                                  Icons.home_rounded,
                                  size: 50,
                                  color: chateuPrimary,
                                ),
                              ),
                            ),
                          ),

                          const SizedBox(height: 16),

                          const Text(
                            'Chateau Real HOA',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              letterSpacing: 1.5,
                            ),
                          ),

                          const SizedBox(height: 10),

                          Text(
                            'Your trusted homeowners association dedicated to maintaining property values, fostering community spirit, and ensuring a safe, beautiful neighborhood for all residents.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.white.withAlpha(200),
                              height: 1.6,
                            ),
                          ),

                          const SizedBox(height: 20),

                          // Platform pills
                          Row(
                            mainAxisAlignment:
                                MainAxisAlignment.center,
                            children: [
                              _PlatformPill(
                                icon: Icons.computer_rounded,
                                label: "Web for Admin",
                              ),
                              const SizedBox(width: 10),
                              _PlatformPill(
                                icon:
                                    Icons.phone_android_rounded,
                                label: "Mobile for Residents",
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            Padding(
              padding: EdgeInsets.symmetric(horizontal: hPad)
                  .copyWith(top: 28, bottom: 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── About Us Section ──────────────────────────────
                  _FadeSlide(
                    controller: _animController,
                    delay: 0.1,
                    child: Column(
                      crossAxisAlignment:
                          CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 4,
                              height: 28,
                              decoration: BoxDecoration(
                                color: chateuPrimary,
                                borderRadius:
                                    BorderRadius.circular(2),
                              ),
                            ),
                            const SizedBox(width: 10),
                            const Text(
                              'About Us',
                              style: TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w800,
                                color: chateuText,
                                letterSpacing: -0.3,
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 14),

                        Container(
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius:
                                BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color:
                                    Colors.black.withAlpha(10),
                                blurRadius: 12,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Text(
                            'We are committed to providing a reliable and transparent platform that supports effective community management and strengthens communication within our homeowners association. CHATEAU REAL HOA MANAGEMENT SOFTWARE bridges the gap between residents and administrators, making HOA management seamless, modern, and accessible to everyone.',
                            style: TextStyle(
                              fontSize: 14,
                              height: 1.7,
                              color: Colors.grey.shade700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 28),

                  // ── Features Section ──────────────────────────────
                  _FadeSlide(
                    controller: _animController,
                    delay: 0.18,
                    child: Row(
                      children: [
                        Container(
                          width: 4,
                          height: 28,
                          decoration: BoxDecoration(
                            color: chateuPrimary,
                            borderRadius:
                                BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(width: 10),
                        const Text(
                          'What We Offer',
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            color: chateuText,
                            letterSpacing: -0.3,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Features grid
                  GridView.count(
                    shrinkWrap: true,
                    physics:
                        const NeverScrollableScrollPhysics(),
                    crossAxisCount: isWide ? 3 : 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.1,
                    children: [
                      _FeatureCard(
                        controller: _animController,
                        delay: 0.22,
                        icon: Icons.person_rounded,
                        color: chateuPrimary,
                        title: "Profile Management",
                        desc:
                            "Secure accounts with role-based access for all residents.",
                      ),
                      _FeatureCard(
                        controller: _animController,
                        delay: 0.26,
                        icon: Icons.event_available_rounded,
                        color: const Color(0xFF3B82F6),
                        title: "Facility Reservation",
                        desc:
                            "Book community amenities easily with conflict detection.",
                      ),
                      _FeatureCard(
                        controller: _animController,
                        delay: 0.30,
                        icon: Icons.payments_rounded,
                        color: chateuAccent,
                        title: "Payment Tracking",
                        desc:
                            "Track HOA dues and view full payment history.",
                      ),
                      _FeatureCard(
                        controller: _animController,
                        delay: 0.34,
                        icon: Icons.report_rounded,
                        color: const Color(0xFFDC2626),
                        title: "Issue Reporting",
                        desc:
                            "Submit and track community issues with photo proof.",
                      ),
                      _FeatureCard(
                        controller: _animController,
                        delay: 0.38,
                        icon: Icons.notifications_rounded,
                        color: const Color(0xFF8B5CF6),
                        title: "Announcements",
                        desc:
                            "Stay informed with real-time HOA notifications.",
                      ),
                      _FeatureCard(
                        controller: _animController,
                        delay: 0.42,
                        icon: Icons.calendar_month_rounded,
                        color: chateuSecondary,
                        title: "HOA Calendar",
                        desc:
                            "View community events and important HOA dates.",
                      ),
                    ],
                  ),

                  const SizedBox(height: 28),

                  // ── Mission section ───────────────────────────────
                  _FadeSlide(
                    controller: _animController,
                    delay: 0.46,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            chateuPrimary.withAlpha(15),
                            chateuSecondary.withAlpha(10),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: chateuPrimary.withAlpha(40),
                        ),
                      ),
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: chateuPrimary.withAlpha(20),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                                Icons.flag_rounded,
                                color: chateuPrimary,
                                size: 24),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            "Our Mission",
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: chateuText,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            "To empower homeowners and administrators with a smart, unified platform that makes community living easier, more transparent, and more connected.",
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13,
                              height: 1.6,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // ── Version footer ─────────────────────────────────
                  _FadeSlide(
                    controller: _animController,
                    delay: 0.5,
                    child: Center(
                      child: Column(
                        children: [
                          Text(
                            "Chateau Real HOA Management Software",
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: chateuPrimary
                                  .withAlpha(160),
                              letterSpacing: 2,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "Version 1.0.0  •  © 2026 All Rights Reserved",
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey.shade400,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Platform Pill ──────────────────────────────────────────────────────────────

class _PlatformPill extends StatelessWidget {
  final IconData icon;
  final String label;

  const _PlatformPill({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(30),
        borderRadius: BorderRadius.circular(20),
        border:
            Border.all(color: Colors.white.withAlpha(80), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: Colors.white,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Feature Card ───────────────────────────────────────────────────────────────

class _FeatureCard extends StatelessWidget {
  final AnimationController controller;
  final double delay;
  final IconData icon;
  final Color color;
  final String title;
  final String desc;

  const _FeatureCard({
    required this.controller,
    required this.delay,
    required this.icon,
    required this.color,
    required this.title,
    required this.desc,
  });

  @override
  Widget build(BuildContext context) {
    return _FadeSlide(
      controller: controller,
      delay: delay,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(10),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withAlpha(22),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 10),
            Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 12,
                color: chateuText,
              ),
            ),
            const SizedBox(height: 4),
            Expanded(
              child: Text(
                desc,
                style: TextStyle(
                  fontSize: 10,
                  color: Colors.grey.shade500,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Animation Helper ───────────────────────────────────────────────────────────

class _FadeSlide extends StatelessWidget {
  final AnimationController controller;
  final double delay;
  final Widget child;

  const _FadeSlide({
    required this.controller,
    required this.delay,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final fade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: controller,
        curve: Interval(delay, (delay + 0.4).clamp(0.0, 1.0),
            curve: Curves.easeOut),
      ),
    );
    final slide =
        Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
            .animate(
      CurvedAnimation(
        parent: controller,
        curve: Interval(delay, (delay + 0.4).clamp(0.0, 1.0),
            curve: Curves.easeOut),
      ),
    );
    return FadeTransition(
        opacity: fade,
        child: SlideTransition(position: slide, child: child));
  }
}