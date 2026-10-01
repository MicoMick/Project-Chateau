import 'package:supabase_flutter/supabase_flutter.dart';

import 'reservations.dart';

/// [ReservationsSource] backed by the Supabase `facilities`,
/// `reservations` and `hoa_settings` tables.
class SupabaseReservationsSource implements ReservationsSource {
  SupabaseReservationsSource(this._client);

  final SupabaseClient _client;

  @override
  Future<List<Map<String, dynamic>>> fetchFacilities() =>
      _client.from('facilities').select().order('name');

  @override
  Future<List<Map<String, dynamic>>> fetchReservationsFrom(String date) =>
      _client.from('reservations').select().gte('date', date);

  @override
  Future<List<Map<String, dynamic>>> fetchMyReservations(String userId) =>
      _client
          .from('reservations')
          .select()
          .eq('user_id', userId)
          .order('created_at', ascending: false)
          .limit(10);

  @override
  Future<List<Map<String, dynamic>>> fetchDatesWithStatus(
          List<String> statuses) =>
      _client.from('reservations').select('date').inFilter('status', statuses);

  @override
  Future<String?> fetchQrCodeUrl() async => (await _client
      .from('hoa_settings')
      .select('photo_url')
      .eq('id', 1)
      .maybeSingle())?['photo_url'] as String?;

  @override
  Future<void> insert(Map<String, dynamic> row) =>
      _client.from('reservations').insert(row);

  @override
  Future<void> update(String id, Map<String, dynamic> fields) =>
      _client.from('reservations').update(fields).eq('id', id);
}
