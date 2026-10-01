import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:chateau_mobile_app/app_config.dart';
import 'package:chateau_mobile_app/app_theme.dart';
import 'package:chateau_mobile_app/settings_page.dart';

void main() {
  Future<void> open(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
        MaterialApp(theme: AppTheme.current, home: const SettingsPage()));
  }

  testWidgets('shows notifications, change password and the version',
      (tester) async {
    await open(tester);

    expect(find.text('Push notifications'), findsOneWidget);
    expect(find.text('Change password'), findsOneWidget);
    expect(find.text('Chateau Real · Version ${AppConfig.appVersion}'),
        findsOneWidget);
  });

  testWidgets('the password sheet explains a problem before calling Supabase',
      (tester) async {
    await open(tester);
    await tester.tap(find.text('Change password'));
    await tester.pumpAndSettle();

    await tester.enterText(find.widgetWithText(TextField, 'Current password'),
        'oldpass123');
    await tester.enterText(
        find.widgetWithText(TextField, 'New password (at least 8 characters)'),
        'newpass456');
    await tester.enterText(
        find.widgetWithText(TextField, 'Confirm new password'), 'different1');
    await tester.tap(find.text('Save password'));
    await tester.pump();

    expect(find.text('Passwords do not match.'), findsOneWidget);
  });
}
