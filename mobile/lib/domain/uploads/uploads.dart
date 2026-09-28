import 'dart:typed_data';

import 'package:image_picker/image_picker.dart' show XFile;

/// Where evidence files are stored.
abstract class EvidenceStorage {
  Future<void> upload(String bucket, String path, Uint8List bytes,
      {String? contentType});
  String publicUrl(String bucket, String path);
}

/// What a file is evidence of. Each kind has its storage bucket and path
/// shape; the storage security rules check the uid segment in the path.
class Evidence {
  const Evidence._(this.bucket, this._prefix,
      {this.uidAfterPrefix = false, this.isVideo = false});

  /// Proof of Payment for one bill.
  const Evidence.paymentProof(String paymentId)
      : this._('payment-proofs', '$paymentId/');

  /// Proof of Payment for Dues paid in advance.
  const Evidence.advanceProof() : this._('payment-proofs', 'advance/');

  /// Proof of Payment for a court Reservation's fee.
  const Evidence.reservationFeeProof()
      : this._('payment-proofs', 'reservations/');

  /// An Amenity's condition at pick-up.
  const Evidence.conditionPhoto()
      : this._('borrow-condition-photos', 'reservations/');

  /// An Amenity's condition at return.
  const Evidence.returnPhoto()
      : this._('borrow-condition-photos', 'reservations/return-');

  const Evidence.reportPhoto() : this._('report-photos', '');
  const Evidence.reportVideo() : this._('report-videos', '', isVideo: true);
  const Evidence.avatar() : this._('avatars', 'avatar_');

  /// A Move-In Clearance document, e.g. `barangay-clearance`. This bucket's
  /// rules expect `folder/uid/…`, not `uid/…`.
  const Evidence.moveInDocument(String folder)
      : this._('move-in-docs', '$folder/', uidAfterPrefix: true);

  final String bucket;
  final String _prefix;
  final bool uidAfterPrefix;
  final bool isVideo;

  String _path(String uid, int stamp, String ext) =>
      uidAfterPrefix ? '$_prefix$uid/$stamp.$ext' : '$uid/$_prefix$stamp.$ext';
}

/// Stores evidence files and returns their public URLs.
class Uploads {
  Uploads(this._storage,
      {required String? Function() currentUserId,
      DateTime Function() clock = DateTime.now})
      : _currentUserId = currentUserId,
        _clock = clock;

  final EvidenceStorage _storage;
  final String? Function() _currentUserId;
  final DateTime Function() _clock;

  /// Uploads [file] as [evidence] under the signed-in user's uid — the
  /// uid the storage rules check (a Homeowner adding a Tenant's documents
  /// is the one signed in). Old files are kept: names are timestamped.
  Future<String> store(Evidence evidence, XFile file) async {
    final uid = _currentUserId();
    if (uid == null) throw StateError('Not signed in');
    final ext = _extension(file, fallback: evidence.isVideo ? 'mp4' : 'jpg');
    final path = evidence._path(uid, _clock().millisecondsSinceEpoch, ext);
    await _storage.upload(evidence.bucket, path, await file.readAsBytes(),
        contentType: evidence.isVideo ? 'video/mp4' : null);
    return _storage.publicUrl(evidence.bucket, path);
  }
}

// A picked file has a real path on a phone but only a name on the web.
String _extension(XFile file, {required String fallback}) {
  for (final candidate in [file.name, file.path]) {
    final base = candidate.split('/').last;
    if (base.contains('.')) return base.split('.').last.toLowerCase();
  }
  return fallback;
}
