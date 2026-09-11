import 'package:supabase_flutter/supabase_flutter.dart';

/// audit_logger.dart
///
/// Mirrors the web admin dashboard's `auditLogger.js` — writes one row into
/// `system_logs` per resident/tenant action, so HOA staff can see mobile
/// activity (payments submitted, reservations made, reports filed, etc.) the
/// same way admin-side actions are already tracked. The System Logs page's
/// `extractRole` already parses a leading "[ROLE] " tag out of `details` for
/// any role — OWNER/TENANT included — so no changes were needed there
/// beyond adding those two values to its role filter dropdown. The tag
/// values match `profiles.resident_type` ('owner' / 'tenant') exactly, not
/// a separate vocabulary, so the web filter can match on it directly.
///
/// Never throws — a logging failure must never block the actual action the
/// resident/tenant is trying to complete.
Future<void> logAudit(
  String activity,
  String details, {
  String severity = 'info',
}) async {
  try {
    final supabase = Supabase.instance.client;
    final user = supabase.auth.currentUser;

    // Owner vs tenant — mirrors resident_type checks used throughout the
    // rest of the app (see account_page.dart, reserve_page.dart).
    String role = 'OWNER';
    if (user != null) {
      try {
        final profile = await supabase
            .from('profiles')
            .select('resident_type')
            .eq('id', user.id)
            .maybeSingle();
        final type = (profile?['resident_type'] as String?)?.toLowerCase();
        if (type == 'tenant') {
          role = 'TENANT';
        }
      } catch (_) {
        // Keep default role if the profile lookup fails for any reason.
      }
    }

    await supabase.from('system_logs').insert({
      'user_email': user?.email ?? 'unknown',
      'activity': activity,
      'severity': severity,
      'details': '[$role] $details',
    });
  } catch (e) {
    // ignore: avoid_print
    print('[audit_logger] Failed to write log: $e');
  }
}
