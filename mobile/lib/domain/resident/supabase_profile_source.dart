import 'package:supabase_flutter/supabase_flutter.dart';

import 'current_resident.dart';

/// [ProfileSource] backed by the Supabase `profiles` table.
class SupabaseProfileSource implements ProfileSource {
  SupabaseProfileSource(this._client);

  final SupabaseClient _client;

  @override
  Future<Map<String, dynamic>?> fetchProfile(String userId) => _client
      .from('profiles')
      .select(
          'id, full_name, avatar_url, resident_type, account_status, owner_id, block, lot, street, address')
      .eq('id', userId)
      .maybeSingle();
}
