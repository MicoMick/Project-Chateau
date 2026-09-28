import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:chateau_mobile_app/domain/uploads/uploads.dart';

class Upload {
  Upload(this.bucket, this.path, this.bytes, this.contentType);
  final String bucket, path;
  final Uint8List bytes;
  final String? contentType;
}

class FakeStorage implements EvidenceStorage {
  final uploads = <Upload>[];

  @override
  Future<void> upload(String bucket, String path, Uint8List bytes,
          {String? contentType}) async =>
      uploads.add(Upload(bucket, path, bytes, contentType));

  @override
  String publicUrl(String bucket, String path) => 'https://cdn/$bucket/$path';
}

XFile file(String name) =>
    XFile.fromData(Uint8List.fromList([1, 2, 3]),
        name: name, path: '/picked/$name');

void main() {
  late FakeStorage storage;
  late Uploads uploads;

  setUp(() {
    storage = FakeStorage();
    uploads = Uploads(storage,
        currentUserId: () => 'u1',
        clock: () => DateTime.fromMillisecondsSinceEpoch(1700000000000));
  });

  test('stores a Proof of Payment under the bill and returns its URL',
      () async {
    final url =
        await uploads.store(Evidence.paymentProof('bill9'), file('gcash.png'));

    final u = storage.uploads.single;
    expect(u.bucket, 'payment-proofs');
    expect(u.path, 'u1/bill9/1700000000000.png');
    expect(u.bytes, [1, 2, 3]);
    expect(url, 'https://cdn/payment-proofs/u1/bill9/1700000000000.png');
  });

  test('keeps each kind in its bucket with its existing path shape', () async {
    final cases = {
      Evidence.advanceProof(): ('payment-proofs', 'u1/advance/1700000000000.png'),
      Evidence.reservationFeeProof():
          ('payment-proofs', 'u1/reservations/1700000000000.png'),
      Evidence.conditionPhoto():
          ('borrow-condition-photos', 'u1/reservations/1700000000000.png'),
      Evidence.returnPhoto():
          ('borrow-condition-photos', 'u1/reservations/return-1700000000000.png'),
      Evidence.reportPhoto(): ('report-photos', 'u1/1700000000000.png'),
      Evidence.avatar(): ('avatars', 'u1/avatar_1700000000000.png'),
    };
    for (final MapEntry(key: evidence, value: (bucket, path)) in cases.entries) {
      await uploads.store(evidence, file('x.png'));
      expect((storage.uploads.last.bucket, storage.uploads.last.path),
          (bucket, path));
    }
  });

  test('Move-In Clearance documents put the folder before the uid', () async {
    await uploads.store(
        Evidence.moveInDocument('barangay-clearance'), file('doc.jpeg'));

    expect(storage.uploads.single.bucket, 'move-in-docs');
    expect(storage.uploads.single.path,
        'barangay-clearance/u1/1700000000000.jpeg');
  });

  test('Report videos are stored as video/mp4', () async {
    await uploads.store(Evidence.reportVideo(), file('clip.mp4'));

    expect(storage.uploads.single.bucket, 'report-videos');
    expect(storage.uploads.single.contentType, 'video/mp4');
  });

  test('a file without an extension falls back to jpg, or mp4 for video',
      () async {
    await uploads.store(Evidence.reportPhoto(), file('photo'));
    await uploads.store(Evidence.reportVideo(), file('clip'));

    expect(storage.uploads[0].path, endsWith('.jpg'));
    expect(storage.uploads[1].path, endsWith('.mp4'));
  });

  test('refuses to upload when nobody is signed in', () async {
    final anonymous = Uploads(storage, currentUserId: () => null);

    expect(() => anonymous.store(Evidence.avatar(), file('me.png')),
        throwsStateError);
    expect(storage.uploads, isEmpty);
  });
}
