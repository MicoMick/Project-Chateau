/// Where the signed-in Resident's profile row comes from.
abstract class ProfileSource {
  Future<Map<String, dynamic>?> fetchProfile(String userId);
}

/// The signed-in Resident: who they are, their Lot, and what they may do.
class Resident {
  const Resident({
    required this.id,
    required this.fullName,
    required this.avatarUrl,
    required this.isHomeowner,
    required this.isActive,
    required this.lotAddress,
  });

  /// [lotRow] is the profile holding the Lot: the Homeowner's, for a Tenant.
  factory Resident._fromRow(
          Map<String, dynamic> row, Map<String, dynamic> lotRow) =>
      Resident(
        id: row['id'] as String,
        fullName: row['full_name'] as String? ?? '',
        avatarUrl: row['avatar_url'] as String?,
        // Fails closed: a missing or unknown type counts as a Tenant.
        isHomeowner:
            (row['resident_type'] as String?)?.toLowerCase() == 'owner',
        isActive: row['account_status'] == 'active',
        lotAddress: _lotAddress(lotRow),
      );

  final String id;
  final String fullName;
  final String? avatarUrl;
  final bool isHomeowner;

  /// Approved by an Admin and not disabled; only active Residents may use the app.
  final bool isActive;

  /// e.g. `Blk 52, Lot 4, Rue de Paris`; null when nothing is stored.
  final String? lotAddress;

  bool get canPayDues => isHomeowner;
  bool get canVote => isHomeowner;
  bool get canManageTenants => isHomeowner;
}

/// Loads the signed-in Resident once per session.
class CurrentResident {
  CurrentResident(this._source, {required String? Function() currentUserId})
      : _currentUserId = currentUserId;

  final ProfileSource _source;
  final String? Function() _currentUserId;

  Resident? _resident;

  /// The Resident from the last [load], or null before loading / after [clear].
  Resident? get resident => _resident;

  /// Fetches the signed-in Resident the first time, then reuses it.
  Future<Resident?> load() async {
    final userId = _currentUserId();
    if (userId == null) return null;
    if (_resident?.id == userId) return _resident;
    return refresh();
  }

  /// Fetches again, e.g. after the Account page saves an edit.
  Future<Resident?> refresh() async {
    final userId = _currentUserId();
    if (userId == null) return _resident = null;
    final row = await _source.fetchProfile(userId);
    if (row == null) return _resident = null;
    final ownerId = row['owner_id'] as String?;
    final ownerRow =
        ownerId == null ? null : await _source.fetchProfile(ownerId);
    return _resident = Resident._fromRow(row, ownerRow ?? row);
  }

  /// Forgets the Resident; call at sign-out.
  void clear() => _resident = null;
}

// Mirrors the web app's paymentUtils.js buildFullAddress: block/lot values
// sometimes already carry their "Blk"/"Lot" label, so strip it first.
final _blockLabel = RegExp(r'^(blk|block)\.?\s*', caseSensitive: false);
final _lotLabel = RegExp(r'^lot\.?\s*', caseSensitive: false);

String _strip(Object? value, RegExp label) =>
    (value as String? ?? '').replaceFirst(label, '').trim();

String? _lotAddress(Map<String, dynamic> row) {
  final block = _strip(row['block'], _blockLabel);
  final lot = _strip(row['lot'], _lotLabel);
  final street = (row['street'] as String? ?? '').trim();
  final parts = [
    if (block.isNotEmpty) 'Blk $block',
    if (lot.isNotEmpty) 'Lot $lot',
    if (street.isNotEmpty) street,
  ];
  if (parts.isNotEmpty) return parts.join(', ');
  final address = (row['address'] as String? ?? '').trim();
  return address.isEmpty ? null : address;
}
