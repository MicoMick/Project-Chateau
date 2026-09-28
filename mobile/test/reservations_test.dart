import 'package:flutter/material.dart' show TimeOfDay;
import 'package:flutter_test/flutter_test.dart';
import 'package:chateau_mobile_app/domain/reservations/reservations.dart';

class FakeReservationsSource implements ReservationsSource {
  final inserted = <Map<String, dynamic>>[];
  final updated = <String, Map<String, dynamic>>{};
  List<Map<String, dynamic>> facilities = [];
  List<Map<String, dynamic>> upcoming = [];
  List<Map<String, dynamic>> mine = [];
  List<Map<String, dynamic>> datedRows = [];
  List<String>? askedStatuses;
  String? qr;

  @override
  Future<List<Map<String, dynamic>>> fetchFacilities() async => facilities;
  @override
  Future<List<Map<String, dynamic>>> fetchReservationsFrom(String date) async =>
      upcoming;
  @override
  Future<List<Map<String, dynamic>>> fetchMyReservations(String userId) async =>
      mine;
  @override
  Future<List<Map<String, dynamic>>> fetchDatesWithStatus(
      List<String> statuses) async {
    askedStatuses = statuses;
    return datedRows;
  }
  @override
  Future<String?> fetchQrCodeUrl() async => qr;
  @override
  Future<void> insert(Map<String, dynamic> row) async => inserted.add(row);
  @override
  Future<void> update(String id, Map<String, dynamic> fields) async =>
      updated[id] = fields;
}

final court = Facility.fromRow(
    {'id': 'court', 'name': 'Covered Court', 'category': 'Amenity Facility'});
final hall = Facility.fromRow(
    {'id': 'hall', 'name': 'Clubhouse', 'category': 'Amenity Facility'});
final chairs = Facility.fromRow({
  'id': 'chairs',
  'name': 'Chairs',
  'category': 'Amenity Item',
  'amount': 20,
  'total_quantity': 50,
});

Reservation booked(String status, String start, String end,
        {String facility = 'court'}) =>
    Reservation.fromRow({
      'id': 'r-$status-$start',
      'facility_id': facility,
      'user_id': 'someone',
      'date': '2026-03-10',
      'start_time': start,
      'end_time': end,
      'status': status,
    });

TimeOfDay t(int h, [int m = 0]) => TimeOfDay(hour: h, minute: m);

final day = DateTime(2026, 3, 10);

Reservations module({DateTime? now, FakeReservationsSource? source}) =>
    Reservations(source ?? FakeReservationsSource(),
        currentUserId: () => 'u1', clock: () => now ?? DateTime(2026, 3, 1, 8));

BookingCheck check(Facility f, TimeOfDay start, TimeOfDay end,
        {List<Reservation> existing = const [],
        DateTime? now,
        int quantity = 1,
        DateTime? returnDate}) =>
    module(now: now).check(
      BookingRequest(
          facility: f,
          date: day,
          start: start,
          end: end,
          quantity: quantity,
          returnDate: returnDate ?? day),
      existing: existing,
    );

void main() {
  group('ReservationStatus', () {
    test('reads any capitalisation and writes the web app spelling', () {
      expect(ReservationStatus.parse('approved'), ReservationStatus.approved);
      expect(ReservationStatus.parse('APPROVED AND PAID'),
          ReservationStatus.approvedAndPaid);
      expect(ReservationStatus.parse('return pending'),
          ReservationStatus.returnPending);
      expect(ReservationStatus.approved.stored, 'Approved');
      expect(ReservationStatus.approvedAndPaid.stored, 'Approved and Paid');
      expect(ReservationStatus.returnPending.stored, 'Return Pending');
      expect(ReservationStatus.cancelled.stored, 'Cancelled');
    });

    test("accepts the 'Canceled' spelling", () {
      expect(ReservationStatus.parse('Canceled'), ReservationStatus.cancelled);
    });

    test('an unknown or missing status is Pending', () {
      expect(ReservationStatus.parse('on hold'), ReservationStatus.pending);
      expect(ReservationStatus.parse(null), ReservationStatus.pending);
    });

    test('Pending, Approved and Approved and paid block a time slot', () {
      expect(
          ReservationStatus.values.where((s) => s.blocksSlot),
          [
            ReservationStatus.pending,
            ReservationStatus.approved,
            ReservationStatus.approvedAndPaid,
          ]);
    });
  });

  group('booking a Facility time slot', () {
    test('a free slot has no problem', () {
      expect(check(hall, t(9), t(11)).problem, isNull);
    });

    test('the end must be after the start', () {
      expect(check(hall, t(11), t(9)).problem,
          'End time must be after start time.');
      expect(check(hall, t(9), t(9)).problem,
          'End time must be after start time.');
    });

    test('a start time already past today is refused', () {
      expect(check(hall, t(9), t(10), now: DateTime(2026, 3, 10, 9, 30)).problem,
          'Start time has already passed for today.');
      expect(check(hall, t(10), t(11), now: DateTime(2026, 3, 10, 9, 30)).problem,
          isNull);
    });

    test('overlapping a Pending, Approved or Approved and paid booking is refused',
        () {
      for (final status in ['Pending', 'Approved', 'Approved and Paid']) {
        expect(
            check(court, t(9), t(11), existing: [booked(status, '10:00', '12:00')])
                .problem,
            'This slot overlaps an existing booking.',
            reason: status);
      }
    });

    test('Rejected or Cancelled bookings free the slot', () {
      expect(
          check(court, t(9), t(11), existing: [
            booked('Rejected', '10:00', '12:00'),
            booked('Cancelled', '09:00', '11:00'),
          ]).problem,
          isNull);
    });

    test('back-to-back bookings do not overlap', () {
      expect(
          check(court, t(11), t(12), existing: [booked('Approved', '09:00', '11:00')])
              .problem,
          isNull);
    });
  });

  group('court fee', () {
    test('is ₱150 for the first hour and ₱50 per extra hour, rounded up', () {
      expect(check(court, t(9), t(10)).fee, 150);
      expect(check(court, t(9), t(10, 1)).fee, 200);
      expect(check(court, t(9), t(11)).fee, 200);
      expect(check(court, t(9), t(11, 30)).fee, 250);
    });

    test('applies only to the court', () {
      expect(check(hall, t(9), t(11)).fee, isNull);
    });

    test('is still shown when the slot clashes, so the Resident sees the price',
        () {
      final c = check(court, t(9), t(10),
          existing: [booked('Approved', '09:00', '10:00')]);
      expect(c.problem, isNotNull);
      expect(c.fee, 150);
    });

    test('is null when the times are invalid', () {
      expect(check(court, t(11), t(9)).fee, isNull);
    });
  });

  group('borrowing an Amenity', () {
    test('has no time-slot clash and no fee', () {
      final c = check(chairs, t(9), t(17),
          existing: [booked('Approved', '09:00', '17:00', facility: 'chairs')]);
      expect(c.problem, isNull);
      expect(c.fee, isNull);
    });

    test('a same-day return must come after pick-up', () {
      expect(check(chairs, t(11), t(9)).problem,
          'Return time must be after pick-up time.');
    });

    test('a later-day return may read earlier than pick-up', () {
      expect(
          check(chairs, t(11), t(6), returnDate: DateTime(2026, 3, 11)).problem,
          isNull);
    });

    test('a pick-up time already past today is refused', () {
      expect(
          check(chairs, t(9), t(17), now: DateTime(2026, 3, 10, 10)).problem,
          'Pick-up time has already passed for today.');
    });

    test('the quantity must be between 1 and what is available', () {
      expect(check(chairs, t(9), t(17), quantity: 20).problem, isNull);
      expect(check(chairs, t(9), t(17), quantity: 21).problem,
          'Only 20 available — adjust the quantity.');
      expect(check(chairs, t(9), t(17), quantity: 0).problem,
          'Only 20 available — adjust the quantity.');
    });

    test('nothing available is refused', () {
      final none = Facility.fromRow(
          {'id': 'tents', 'name': 'Tents', 'category': 'Amenity Item', 'amount': 0});
      expect(check(none, t(9), t(17)).problem,
          'None of Tents are currently available.');
    });
  });

  group('writes', () {
    late FakeReservationsSource source;
    late Reservations reservations;
    setUp(() {
      source = FakeReservationsSource();
      reservations = module(source: source);
    });

    test('booking the court stores a Pending Reservation with the fee', () async {
      await reservations.book(
        BookingRequest(facility: court, date: day, start: t(9, 5), end: t(11)),
        fee: 200,
        reference: 'GC123',
        proofUrl: 'https://x/proof.png',
      );

      expect(source.inserted.single, {
        'facility_id': 'court',
        'user_id': 'u1',
        'date': '2026-03-10',
        'start_time': '09:05',
        'end_time': '11:00',
        'status': 'Pending',
        'fee': 200.0,
        'payment_status': 'pending_verification',
        'reference_no': 'GC123',
        'proof_url': 'https://x/proof.png',
      });
    });

    test('borrowing an Amenity stores the quantity, return date and photo',
        () async {
      await reservations.book(
        BookingRequest(
            facility: chairs,
            date: day,
            start: t(9),
            end: t(17),
            quantity: 10,
            returnDate: DateTime(2026, 3, 12)),
        conditionPhotoUrl: 'https://x/before.png',
      );

      expect(source.inserted.single, {
        'facility_id': 'chairs',
        'user_id': 'u1',
        'date': '2026-03-10',
        'start_time': '09:00',
        'end_time': '17:00',
        'status': 'Pending',
        'quantity': 10,
        'return_date': '2026-03-12',
        'borrow_condition_photo_url': 'https://x/before.png',
      });
    });

    test('cancelling writes the web app spelling', () async {
      await reservations.cancel(booked('Pending', '09:00', '10:00'));

      expect(source.updated.values.single, {'status': 'Cancelled'});
    });

    test('reporting a return marks it Return Pending with the details',
        () async {
      await reservations.reportReturn('r1', {'return_notes': 'ok'});

      expect(source.updated['r1'], {'status': 'Return Pending', 'return_notes': 'ok'});
    });
  });

  test('only Pending or Approved Reservations can be cancelled', () {
    expect(
        ['Pending', 'Approved', 'Approved and Paid', 'Rejected', 'Completed']
            .map((s) => booked(s, '09:00', '10:00').canCancel),
        [true, true, false, false, false]);
  });

  test('only an Approved, unreturned Amenity can be returned', () {
    Reservation borrow(String status, {String? returnedAt}) => Reservation.fromRow({
          'id': 'b',
          'facility_id': 'chairs',
          'date': '2026-03-10',
          'status': status,
          'quantity': 5,
          'returned_at': returnedAt,
        });

    expect(borrow('Approved').canReturn, isTrue);
    expect(borrow('approved').canReturn, isTrue);
    expect(borrow('Approved', returnedAt: '2026-03-11T10:00:00').canReturn, isFalse);
    expect(borrow('Pending').canReturn, isFalse);
    expect(booked('Approved', '09:00', '10:00').canReturn, isFalse);
  });

  group('reads', () {
    test('load gathers Facilities, bookings from today, mine and the QR', () async {
      final source = FakeReservationsSource()
        ..facilities = [
          {'id': 'court', 'name': 'Covered Court'}
        ]
        ..upcoming = [
          {'id': 'a', 'facility_id': 'court', 'date': '2026-03-10', 'status': 'approved'}
        ]
        ..mine = [
          {'id': 'b', 'facility_id': 'court', 'date': '2026-03-11', 'status': 'Pending'}
        ]
        ..qr = 'https://x/qr.png';

      final snapshot = await module(source: source).load();

      expect(snapshot.facilities.single.name, 'Covered Court');
      expect(snapshot.upcoming.single.status, ReservationStatus.approved);
      expect(snapshot.mine.single.id, 'b');
      expect(snapshot.qrCodeUrl, 'https://x/qr.png');
    });

    test('reserved dates are the days with an Approved Reservation', () async {
      final source = FakeReservationsSource()
        ..datedRows = [
          {'date': '2026-03-10'},
          {'date': '2026-03-10T00:00:00'},
          {'date': '2026-03-12'},
          {'date': null},
        ];

      final dates = await module(source: source).reservedDates();

      expect(dates, {'2026-03-10', '2026-03-12'});
      expect(source.askedStatuses, ['Approved', 'Approved and Paid']);
    });
  });
}
