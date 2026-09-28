import 'package:supabase_flutter/supabase_flutter.dart';

import 'dues.dart';

/// [DuesSource] backed by the Supabase `payments` and `hoa_settings` tables.
class SupabaseDuesSource implements DuesSource {
  SupabaseDuesSource(this._client);

  final SupabaseClient _client;

  @override
  Future<List<Map<String, dynamic>>> fetchPayments(String userId) => _client
      .from('payments')
      .select()
      .eq('user_id', userId)
      .order('due_date', ascending: false);

  @override
  Future<Map<String, dynamic>?> fetchSettings() => _client
      .from('hoa_settings')
      .select('photo_url, monthly_due_amount')
      .eq('id', 1)
      .maybeSingle();
}
