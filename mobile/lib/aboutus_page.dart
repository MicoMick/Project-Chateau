import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'app_theme.dart';

class AboutPage extends StatelessWidget {
  const AboutPage({super.key});

  static const _features = [
    (
      icon: Icons.person_rounded,
      title: "Profile Management",
      desc: "Secure accounts with role-based access for all residents.",
    ),
    (
      icon: Icons.event_available_rounded,
      title: "Facility Reservation",
      desc: "Book community amenities easily with conflict detection.",
    ),
    (
      icon: Icons.payments_rounded,
      title: "Payment Tracking",
      desc: "Track HOA dues and view full payment history.",
    ),
    (
      icon: Icons.report_rounded,
      title: "Issue Reporting",
      desc: "Submit and track community issues with photo proof.",
    ),
    (
      icon: Icons.notifications_rounded,
      title: "Announcements",
      desc: "Stay informed with real-time HOA notifications.",
    ),
    (
      icon: Icons.calendar_month_rounded,
      title: "HOA Calendar",
      desc: "View community events and important HOA dates.",
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final muted = AppText.bodyLarge.copyWith(color: chateuTextMuted);

    return Scaffold(
      appBar: AppBar(title: const Text("About Us")),
      body: SingleChildScrollView(
        padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
        child: AppContentWidth(
          maxWidth: 640,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.xl, AppSpacing.lg,
                AppSpacing.xl, AppSpacing.xxxl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Identity block, centered under the logo.
                Center(
                  child: Column(
                    children: [
                      Image.asset(
                        'assets/logo.png',
                        height: 96,
                        semanticLabel: 'Chateau Real',
                        errorBuilder: (_, __, ___) => Icon(Icons.home_rounded,
                            size: 56, color: chateuPrimary),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Semantics(
                        header: true,
                        child: Text('Chateau Real HOA',
                            textAlign: TextAlign.center,
                            style: AppText.displayLarge),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        'Your trusted homeowners association dedicated to maintaining property values, fostering community spirit, and ensuring a safe, beautiful neighborhood for all residents.',
                        textAlign: TextAlign.center,
                        style: muted,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        'Web for Admin · Mobile for Residents',
                        textAlign: TextAlign.center,
                        style: AppText.labelMedium
                            .copyWith(color: chateuPrimary),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: AppSpacing.xxxl),
                const AppSectionHeader(title: 'About Us'),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'We are committed to providing a reliable and transparent platform that supports effective community management and strengthens communication within our homeowners association. Chateau Real HOA Management Software bridges the gap between residents and administrators, making HOA management seamless, modern, and accessible to everyone.',
                  style: muted,
                ),

                const SizedBox(height: AppSpacing.xxxl),
                const AppSectionHeader(title: 'What We Offer'),
                const SizedBox(height: AppSpacing.xs),
                for (final f in _features)
                  MergeSemantics(
                    child: Padding(
                      padding:
                          const EdgeInsets.symmetric(vertical: AppSpacing.md),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(f.icon, color: chateuPrimary, size: 22),
                          const SizedBox(width: AppSpacing.lg),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(f.title, style: AppText.titleMedium),
                                const SizedBox(height: 2),
                                Text(f.desc,
                                    style: AppText.bodyMedium
                                        .copyWith(color: chateuTextMuted)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                const SizedBox(height: AppSpacing.xxl),
                const AppSectionHeader(title: 'Our Mission'),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  "To empower homeowners and administrators with a smart, unified platform that makes community living easier, more transparent, and more connected.",
                  style: muted,
                ),

                const SizedBox(height: AppSpacing.xxxl),
                const Divider(),
                const SizedBox(height: AppSpacing.lg),
                Text("Chateau Real HOA Management Software",
                    style: AppText.labelMedium.copyWith(color: chateuText)),
                const SizedBox(height: AppSpacing.xs),
                Text("Version 1.0.0  •  © 2026 All Rights Reserved",
                    style: AppText.caption),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
