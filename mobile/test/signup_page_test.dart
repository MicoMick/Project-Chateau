import 'package:chateau_mobile_app/app_theme.dart';
import 'package:chateau_mobile_app/signup_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    await Supabase.initialize(
        url: 'https://test.supabase.co', publishableKey: 'test');
  });
  tearDownAll(() => Supabase.instance.dispose());

  for (final width in [320.0, 390.0, 800.0]) {
    testWidgets('signup steps stay horizontal at width $width with large text',
        (tester) async {
      tester.view.physicalSize = Size(width, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(MaterialApp(
          theme: AppTheme.current,
          home: MediaQuery(
              data: MediaQueryData(
                  size: Size(width, 900),
                  textScaler: const TextScaler.linear(1.3)),
              child: const SignupPage())));
      await tester.pumpAndSettle();
      final centers = [
        for (final step in ['1', '2', '3', '4'])
          tester.getCenter(find.text(step))
      ];
      expect(centers.map((p) => p.dy).toSet(), hasLength(1));
      expect(centers.map((p) => p.dx),
          orderedEquals([...centers.map((p) => p.dx)]..sort()));
      expect(tester.takeException(), isNull);
    });
  }
}
