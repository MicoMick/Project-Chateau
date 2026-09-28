import 'dart:typed_data';

import 'package:supabase_flutter/supabase_flutter.dart';

import 'uploads.dart';

/// [EvidenceStorage] backed by Supabase Storage buckets.
class SupabaseEvidenceStorage implements EvidenceStorage {
  SupabaseEvidenceStorage(this._client);

  final SupabaseClient _client;

  @override
  Future<void> upload(String bucket, String path, Uint8List bytes,
          {String? contentType}) =>
      _client.storage.from(bucket).uploadBinary(path, bytes,
          fileOptions: FileOptions(upsert: true, contentType: contentType));

  @override
  String publicUrl(String bucket, String path) =>
      _client.storage.from(bucket).getPublicUrl(path);
}
