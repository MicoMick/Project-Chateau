import 'package:flutter_test/flutter_test.dart';
import 'package:chateau_mobile_app/domain/resident/current_resident.dart';

class FakeProfileSource implements ProfileSource {
  FakeProfileSource(this.rows);
  final Map<String, Map<String, dynamic>> rows;
  int fetches = 0;

  @override
  Future<Map<String, dynamic>?> fetchProfile(String userId) async {
    fetches++;
    return rows[userId];
  }
}

CurrentResident residentFor(FakeProfileSource source, {String? userId = 'u1'}) =>
    CurrentResident(source, currentUserId: () => userId);

void main() {
  test('a Homeowner may pay Dues, vote and manage Tenants', () async {
    final source = FakeProfileSource({
      'u1': {'id': 'u1', 'resident_type': 'owner', 'account_status': 'active'},
    });

    final r = (await residentFor(source).load())!;

    expect(r.isHomeowner, isTrue);
    expect(r.canPayDues, isTrue);
    expect(r.canVote, isTrue);
    expect(r.canManageTenants, isTrue);
  });

  test('a Tenant may not pay Dues, vote or manage Tenants', () async {
    final source = FakeProfileSource({
      'u1': {'id': 'u1', 'resident_type': 'tenant', 'account_status': 'active'},
    });

    final r = (await residentFor(source).load())!;

    expect(r.isHomeowner, isFalse);
    expect(r.canPayDues, isFalse);
    expect(r.canVote, isFalse);
    expect(r.canManageTenants, isFalse);
  });

  test('reads the resident type case-insensitively', () async {
    final source = FakeProfileSource({
      'u1': {'id': 'u1', 'resident_type': 'Owner'},
    });

    expect((await residentFor(source).load())!.isHomeowner, isTrue);
  });

  test('fails closed: a missing or unknown type is treated as a Tenant', () async {
    for (final type in [null, 'landlord']) {
      final source = FakeProfileSource({
        'u1': {'id': 'u1', 'resident_type': type},
      });
      expect((await residentFor(source).load())!.isHomeowner, isFalse,
          reason: 'resident_type $type');
    }
  });

  test('is null when nobody is signed in, without querying', () async {
    final source = FakeProfileSource({});

    expect(await residentFor(source, userId: null).load(), isNull);
    expect(source.fetches, 0);
  });

  test('is null when the signed-in user has no profile row', () async {
    expect(await residentFor(FakeProfileSource({})).load(), isNull);
  });

  test('carries the identity shown in the app', () async {
    final source = FakeProfileSource({
      'u1': {
        'id': 'u1',
        'full_name': 'Maria Santos',
        'avatar_url': 'https://x/avatar.png',
        'resident_type': 'owner',
      },
    });

    final r = (await residentFor(source).load())!;

    expect(r.id, 'u1');
    expect(r.fullName, 'Maria Santos');
    expect(r.avatarUrl, 'https://x/avatar.png');
  });

  test('is active only when account_status is active', () async {
    for (final (status, active) in [
      ('active', true),
      ('pending', false),
      ('disabled', false),
      (null, false),
    ]) {
      final source = FakeProfileSource({
        'u1': {'id': 'u1', 'account_status': status},
      });
      expect((await residentFor(source).load())!.isActive, active,
          reason: 'account_status $status');
    }
  });

  group('Lot address', () {
    Future<String?> lotOf(Map<String, dynamic> row) async =>
        (await residentFor(FakeProfileSource({
          'u1': {'id': 'u1', 'resident_type': 'owner', ...row},
        })).load())!
            .lotAddress;

    test('is built from block, lot and street', () async {
      expect(await lotOf({'block': '52', 'lot': '4', 'street': 'Rue de Paris'}),
          'Blk 52, Lot 4, Rue de Paris');
    });

    test('does not repeat a label already stored in the value', () async {
      expect(await lotOf({'block': 'Blk 52', 'lot': 'Lot. 4'}), 'Blk 52, Lot 4');
      expect(await lotOf({'block': 'block 7', 'lot': '12'}), 'Blk 7, Lot 12');
    });

    test('falls back to the free-text address', () async {
      expect(await lotOf({'address': 'Blk 3 Lot 9, Chateau Real'}),
          'Blk 3 Lot 9, Chateau Real');
    });

    test('is null when nothing is stored', () async {
      expect(await lotOf({}), isNull);
    });
  });

  test("a Tenant's Lot is their Homeowner's Lot", () async {
    final source = FakeProfileSource({
      't1': {
        'id': 't1',
        'full_name': 'Jose Cruz',
        'resident_type': 'tenant',
        'owner_id': 'o1',
        'address': 'stale copy',
      },
      'o1': {'id': 'o1', 'resident_type': 'owner', 'block': '52', 'lot': '4'},
    });

    final r = (await residentFor(source, userId: 't1').load())!;

    expect(r.lotAddress, 'Blk 52, Lot 4');
    expect(r.fullName, 'Jose Cruz');
    expect(r.isHomeowner, isFalse);
  });

  group('per session', () {
    late FakeProfileSource source;
    late CurrentResident current;

    setUp(() {
      source = FakeProfileSource({
        'u1': {'id': 'u1', 'full_name': 'Before', 'resident_type': 'owner'},
      });
      current = residentFor(source);
    });

    test('load() fetches once and then reuses the Resident', () async {
      await current.load();
      await current.load();

      expect(source.fetches, 1);
      expect(current.resident?.fullName, 'Before');
    });

    test('refresh() fetches again, e.g. after an Account edit', () async {
      await current.load();
      source.rows['u1'] = {...source.rows['u1']!, 'full_name': 'After'};

      await current.refresh();

      expect(source.fetches, 2);
      expect(current.resident?.fullName, 'After');
    });

    test('clear() forgets the Resident at sign-out', () async {
      await current.load();

      current.clear();

      expect(current.resident, isNull);
      await current.load();
      expect(source.fetches, 2);
    });
  });
}
