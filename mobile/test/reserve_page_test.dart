import 'dart:convert';

import 'package:chateau_mobile_app/app_theme.dart';
import 'package:chateau_mobile_app/app_colors.dart';
import 'package:chateau_mobile_app/domain/format/format.dart';
import 'package:chateau_mobile_app/domain/reservations/reservations.dart';
import 'package:chateau_mobile_app/reserve_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'reservations_test.dart' show FakeReservationsSource;

void main() {
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    await Supabase.initialize(
      url: 'https://test.supabase.co',
      publishableKey: 'test',
      httpClient: MockClient((request) async => http.Response(
          jsonEncode({
            'access_token': 'test-token',
            'refresh_token': 'test-refresh',
            'token_type': 'bearer',
            'expires_in': 3600,
            'user': {
              'id': 'resident-1',
              'aud': 'authenticated',
              'email': 'resident@test.com',
              'created_at': DateTime.now().toIso8601String(),
              'app_metadata': {},
              'user_metadata': {}
            },
          }),
          200,
          headers: {'content-type': 'application/json'})),
    );
    await Supabase.instance.client.auth.signInWithPassword(
        email: 'resident@test.com', password: 'test-password');
  });
  tearDownAll(() => Supabase.instance.dispose());

  Future<void> open(WidgetTester tester, String status,
      {bool dark = false}) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    appDark = dark;
    addTearDown(() => appDark = false);
    final row = <String, dynamic>{
      'id': 'r1',
      'facility_id': 'court',
      'user_id': 'resident-1',
      'date': dateKey(DateTime.now()),
      'start_time': '07:00',
      'end_time': '08:00',
      'status': status,
      'fee': 150,
      'payment_status': 'Unpaid'
    };
    final source = FakeReservationsSource()
      ..facilities = [
        {'id': 'court', 'name': 'Basketball Court'}
      ]
      ..upcoming = [row]
      ..mine = [row];
    await tester.pumpWidget(MaterialApp(
        theme: AppTheme.current,
        home: Scaffold(
            body: ReservePage(
                reservations:
                    Reservations(source, currentUserId: () => 'resident-1')))));
    await tester.pumpAndSettle();
  }

  testWidgets('pending status is Pending Approval without payment instructions',
      (tester) async {
    await open(tester, 'Pending');
    expect(find.text('Pending Approval'), findsOneWidget);
    expect(find.textContaining('payment opens after approval'), findsNothing);
    expect(find.text('Pay'), findsNothing);
  });

  for (final dark in [false, true]) {
    testWidgets('Pay is filled and its sheet is opaque (dark: $dark)',
        (tester) async {
      await open(tester, 'Approved', dark: dark);
      final pay = find.widgetWithText(FilledButton, 'Pay');
      expect(pay, findsOneWidget);
      await tester.ensureVisible(pay);
      await tester.tap(pay);
      await tester.pumpAndSettle();
      final heading = find.text('Reservation payment');
      expect(heading, findsOneWidget);
      final surface = tester.widget<Material>(
          find.ancestor(of: heading, matching: find.byType(Material)).first);
      expect(surface.color?.a, 1,
          reason: 'Payment sheet must hide the calendar underneath');
      expect(tester.takeException(), isNull);
      expect(find.byType(DropdownButtonFormField<String>), findsNothing);
      expect(find.text('Cash / in person'), findsNothing);
      expect(find.text('Proof of Payment *'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
