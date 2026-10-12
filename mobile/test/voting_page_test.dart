import 'dart:convert';

import 'package:chateau_mobile_app/app_theme.dart';
import 'package:chateau_mobile_app/voting_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    await Supabase.initialize(
      url: 'https://test.supabase.co',
      publishableKey: 'test',
      httpClient: MockClient((request) async {
        expect(request.url.path, '/rest/v1/candidates');
        expect(request.url.queryParameters['election_id'], 'eq.election-1');
        return http.Response(
          jsonEncode([
            {
              'id': 'candidate-1',
              'full_name': 'Test Candidate',
              'position': 'President',
            },
          ]),
          200,
          request: request,
          headers: {'content-type': 'application/json'},
        );
      }),
    );
  });
  tearDownAll(() => Supabase.instance.dispose());

  testWidgets('candidate is visible and selectable above the submit bar',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.current,
      home: const ElectionDetailPage(election: {
        'id': 'election-1',
        'title': 'Test election',
        'status': 'active',
      }),
    ));
    await tester.pumpAndSettle();

    final candidate = find.text('Test Candidate');
    expect(candidate.hitTestable(), findsOneWidget);
    expect(tester.getRect(candidate).bottom,
        lessThan(tester.getRect(find.text('Submit My Vote')).top));
    await tester.tap(candidate);
    await tester.pump();
    expect(find.text('1 of 1 positions selected'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
