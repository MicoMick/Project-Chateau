import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:chateau_mobile_app/aboutus_page.dart';
import 'package:chateau_mobile_app/app_colors.dart';
import 'package:chateau_mobile_app/app_theme.dart';

double _contrast(Color a, Color b) {
  final la = a.computeLuminance(), lb = b.computeLuminance();
  final hi = la > lb ? la : lb, lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}

void main() {
  for (final dark in [false, true]) {
    final mode = dark ? 'dark' : 'light';

    test('$mode: text tokens meet WCAG AA on every surface', () {
      appDark = dark;
      final surfaces = {
        'background': chateuBackground,
        'surface': chateuSurface,
        'surfaceMuted': chateuSurfaceMuted,
      };
      final texts = {
        'text': chateuText,
        'textMuted': chateuTextMuted,
        'textSubtle': chateuTextSubtle,
        'primary': chateuPrimary,
        'error': chateuError,
        'warning': chateuWarning,
        'info': chateuInfo,
        'success': chateuSuccess,
        'maintenance': chateuMaintenance,
      };
      for (final s in surfaces.entries) {
        for (final t in texts.entries) {
          expect(_contrast(t.value, s.value), greaterThanOrEqualTo(4.5),
              reason: '${t.key} on ${s.key}');
        }
      }
      // Labels on filled buttons / snackbars.
      for (final fill in [chateuPrimary, chateuError, chateuInfo]) {
        expect(_contrast(chateuOnColor, fill), greaterThanOrEqualTo(4.5));
      }
      expect(_contrast(chateuOnBrand, chateuBrand), greaterThanOrEqualTo(4.5));
    });

    testWidgets('$mode: About page builds on the theme', (tester) async {
      appDark = dark;
      await tester.pumpWidget(
          MaterialApp(theme: AppTheme.current, home: const AboutPage()));
      expect(find.text('Chateau Real HOA'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
