import 'package:supabase_flutter/supabase_flutter.dart';

import 'domain/resident/current_resident.dart';
import 'domain/resident/supabase_profile_source.dart';

// Composition root (see docs/adr/0001): the app's Supabase-backed modules.
// Pages take these as constructor defaults; tests pass in-memory ones.

final currentResident = CurrentResident(
  SupabaseProfileSource(Supabase.instance.client),
  currentUserId: () => Supabase.instance.client.auth.currentUser?.id,
);
