import 'dart:convert';

import 'package:chateau_mobile_app/domain/reservations/reservations.dart';
import 'package:chateau_mobile_app/domain/reservations/supabase_reservations_source.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  test('GCash submission uses existing reservation columns only', () async {
    var saved = false;
    final client = SupabaseClient('https://test.supabase.co', 'test',
        httpClient: MockClient((request) async {
      expect(request.method, 'PATCH');
      expect(request.url.path, '/rest/v1/reservations');
      expect(request.url.queryParameters['id'], 'eq.r1');
      final fields = jsonDecode(request.body) as Map<String, dynamic>;
      if (fields.containsKey('payment_method')) {
        return http.Response(
            jsonEncode({
              'code': 'PGRST204',
              'message': "Could not find the payment_method column"
            }),
            400,
            headers: {'content-type': 'application/json'},
            request: request);
      }
      expect(fields, {
        'payment_status': 'Pending',
        'reference_no': 'GC123',
        'proof_url': 'https://test/proof.png'
      });
      saved = true;
      return http.Response('', 204, request: request);
    }));
    addTearDown(client.dispose);
    final module = Reservations(SupabaseReservationsSource(client),
        currentUserId: () => 'resident-1');
    await module.submitPayment(
        Reservation.fromRow({
          'id': 'r1',
          'facility_id': 'court',
          'user_id': 'resident-1',
          'date': '2026-10-19',
          'status': 'Approved',
          'fee': 150,
          'payment_status': 'Unpaid',
        }),
        reference: ' GC123 ',
        proofUrl: 'https://test/proof.png');
    expect(saved, isTrue);
  });
}
