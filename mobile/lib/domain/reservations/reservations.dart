import 'package:flutter/material.dart' show TimeOfDay;

import '../format/format.dart';

/// Where a Reservation stands. [stored] is the exact spelling the web
/// admin writes; reading accepts any capitalisation.
enum ReservationStatus {
  pending('Pending'),
  approved('Approved'),
  approvedAndPaid('Approved and Paid'),
  rejected('Rejected'),
  cancelled('Cancelled'),
  returnPending('Return Pending'),
  completed('Completed');

  const ReservationStatus(this.stored);

  final String stored;

  /// Unknown or missing values read as Pending, so nothing crashes.
  static ReservationStatus parse(String? raw) {
    final s = raw?.toLowerCase();
    if (s == 'canceled') return cancelled;
    return values.firstWhere((v) => v.stored.toLowerCase() == s,
        orElse: () => pending);
  }

  /// A Facility time slot held by a Reservation in this status can't be
  /// booked again, so two Residents never both pay for the same hour.
  bool get blocksSlot =>
      this == pending || this == approved || this == approvedAndPaid;
}

/// Where Facilities and Reservations are read from and written to.
abstract class ReservationsSource {
  Future<List<Map<String, dynamic>>> fetchFacilities();

  /// Every Reservation on or after [date] (`yyyy-MM-dd`), for availability.
  Future<List<Map<String, dynamic>>> fetchReservationsFrom(String date);

  /// The signed-in Resident's most recent Reservations.
  Future<List<Map<String, dynamic>>> fetchMyReservations(String userId);

  /// `date` of every Reservation whose status is one of [statuses].
  Future<List<Map<String, dynamic>>> fetchDatesWithStatus(
      List<String> statuses);

  /// The HOA's GCash QR code, for the court fee.
  Future<String?> fetchQrCodeUrl();

  Future<void> insert(Map<String, dynamic> row);
  Future<void> update(String id, Map<String, dynamic> fields);
}

/// A Facility (reserved by time slot) or an Amenity (reserved by quantity).
class Facility {
  Facility.fromRow(Map<String, dynamic> f)
      : id = (f['id'] ?? '').toString(),
        name = f['name'] as String? ?? '',
        description = f['description'] as String? ?? '',
        category = f['category'] as String? ?? '',
        status = f['status'] as String? ?? '',
        capacity = (f['capacity'] ?? '').toString(),
        rate = (f['rate'] ?? '').toString(),
        hours = (f['hours'] ?? '').toString(),
        image360Url = f['image_360_url'] as String?,
        is360 = f['is_360'] == true,
        totalQuantity = f['total_quantity'] as int?,
        availableQuantity = f['amount'] as int?;

  final String id, name, description, category, status, capacity, rate, hours;
  final String? image360Url;
  final bool is360;

  /// For Amenities: total owned vs currently available. The web admin's
  /// approval flow updates `amount`; this app only reads it.
  final int? totalQuantity;
  final int? availableQuantity;

  /// An Amenity (chairs, tents) is reserved by quantity, not time slot.
  bool get isQuantityBased => category.toLowerCase() == 'amenity item';

  // ponytail: the court is recognised by name; move the fee to facility
  // data once the web app stores a structured rate.
  bool get _isCourt => name.toLowerCase().contains('court');
}

TimeOfDay _time(Object? raw) {
  final p = (raw as String? ?? '00:00').split(':');
  return TimeOfDay(
      hour: int.tryParse(p[0]) ?? 0,
      minute: p.length > 1 ? int.tryParse(p[1]) ?? 0 : 0);
}

DateTime? _date(Object? raw) =>
    raw == null ? null : DateTime.parse(raw as String);

class Reservation {
  Reservation.fromRow(Map<String, dynamic> r)
      : id = (r['id'] ?? '').toString(),
        facilityId = (r['facility_id'] ?? '').toString(),
        userId = (r['user_id'] ?? '').toString(),
        date = DateTime.parse(r['date'] as String),
        startTime = _time(r['start_time']),
        endTime = _time(r['end_time']),
        status = ReservationStatus.parse(r['status'] as String?),
        quantity = r['quantity'] as int?,
        returnedAt = _date(r['returned_at']),
        returnDate = _date(r['return_date']);

  final String id, facilityId, userId;
  final DateTime date;
  final TimeOfDay startTime, endTime;
  final ReservationStatus status;
  final int? quantity;
  final DateTime? returnedAt;

  /// When a borrowed Amenity is due back; null means the same day.
  final DateTime? returnDate;

  /// A Resident may cancel only before it's decided or used.
  bool get canCancel =>
      status == ReservationStatus.pending ||
      status == ReservationStatus.approved;

  /// A borrowed Amenity the Resident still has to report as returned.
  bool get canReturn =>
      quantity != null &&
      status == ReservationStatus.approved &&
      returnedAt == null;
}

/// What the Reserve page shows.
class ReservationsSnapshot {
  const ReservationsSnapshot({
    required this.facilities,
    required this.upcoming,
    required this.mine,
    required this.qrCodeUrl,
  });

  final List<Facility> facilities;

  /// Everyone's Reservations from today on, for availability.
  final List<Reservation> upcoming;

  /// The signed-in Resident's recent Reservations.
  final List<Reservation> mine;
  final String? qrCodeUrl;
}

/// What a Resident is asking to book.
class BookingRequest {
  const BookingRequest({
    required this.facility,
    required this.date,
    required this.start,
    required this.end,
    this.quantity = 1,
    DateTime? returnDate,
  }) : returnDate = returnDate ?? date;

  final Facility facility;
  final DateTime date;
  final TimeOfDay start, end;
  final int quantity;
  final DateTime returnDate;
}

/// The outcome of checking a [BookingRequest]: a [problem] to show, or
/// none; and the court [fee], if one applies.
class BookingCheck {
  const BookingCheck({this.problem, this.fee});
  final String? problem;
  final double? fee;
}

int _minutes(TimeOfDay t) => t.hour * 60 + t.minute;

bool _sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

/// Facility and Amenity Reservations: the booking rules and the reads and
/// writes behind them.
class Reservations {
  Reservations(this._source,
      {required String? Function() currentUserId,
      DateTime Function() clock = DateTime.now})
      : _currentUserId = currentUserId,
        _clock = clock;

  final ReservationsSource _source;
  final String? Function() _currentUserId;
  final DateTime Function() _clock;

  Future<ReservationsSnapshot> load() async {
    final userId = _currentUserId();
    final facilities = await _source.fetchFacilities();
    final upcoming = await _source.fetchReservationsFrom(dateKey(_clock()));
    final mine = userId == null
        ? const <Map<String, dynamic>>[]
        : await _source.fetchMyReservations(userId);
    return ReservationsSnapshot(
      facilities: facilities.map(Facility.fromRow).toList(),
      upcoming: upcoming.map(Reservation.fromRow).toList(),
      mine: mine.map(Reservation.fromRow).toList(),
      qrCodeUrl: await _source.fetchQrCodeUrl(),
    );
  }

  /// Days (`yyyy-MM-dd`) with an Approved Reservation, for the home calendar.
  Future<Set<String>> reservedDates() async {
    final rows = await _source.fetchDatesWithStatus([
      ReservationStatus.approved.stored,
      ReservationStatus.approvedAndPaid.stored,
    ]);
    return {
      for (final r in rows)
        if (r['date'] != null) r['date'].toString().split('T').first,
    };
  }

  /// Stores [request] as a Pending Reservation. A court booking carries its
  /// [fee] with the GCash [reference] and [proofUrl]; an Amenity carries
  /// its quantity, return date and [conditionPhotoUrl].
  Future<void> book(BookingRequest request,
      {double? fee,
      String? reference,
      String? proofUrl,
      String? conditionPhotoUrl}) {
    final userId = _currentUserId();
    if (userId == null) throw StateError('Not signed in');
    final amenity = request.facility.isQuantityBased;
    return _source.insert({
      'facility_id': request.facility.id,
      'user_id': userId,
      'date': dateKey(request.date),
      'start_time': dbTime(request.start),
      'end_time': dbTime(request.end),
      'status': ReservationStatus.pending.stored,
      if (fee != null) 'fee': fee,
      if (fee != null) 'payment_status': 'pending_verification',
      if (fee != null) 'reference_no': reference,
      if (proofUrl != null) 'proof_url': proofUrl,
      if (amenity) 'quantity': request.quantity,
      if (amenity) 'return_date': dateKey(request.returnDate),
      if (conditionPhotoUrl != null)
        'borrow_condition_photo_url': conditionPhotoUrl,
    });
  }

  Future<void> cancel(Reservation r) =>
      _source.update(r.id, {'status': ReservationStatus.cancelled.stored});

  /// Reports a borrowed Amenity as returned, with the return [details]
  /// (condition, notes, photo) for the Admin to verify.
  Future<void> reportReturn(String id, Map<String, dynamic> details) =>
      _source.update(
          id, {'status': ReservationStatus.returnPending.stored, ...details});

  /// Checks [request] against [existing] Reservations of the same Facility
  /// on that day.
  BookingCheck check(BookingRequest request,
      {List<Reservation> existing = const []}) {
    final s = _minutes(request.start), e = _minutes(request.end);
    final now = _clock();
    final startPassed =
        _sameDay(request.date, now) && s <= now.hour * 60 + now.minute;

    if (request.facility.isQuantityBased) {
      return _checkAmenity(request, s, e, startPassed);
    }

    if (e <= s) {
      return const BookingCheck(problem: 'End time must be after start time.');
    }
    final fee = _courtFee(request.facility, e - s);
    if (startPassed) {
      return BookingCheck(
          problem: 'Start time has already passed for today.', fee: fee);
    }
    for (final r in existing) {
      if (!r.status.blocksSlot) continue;
      if (s < _minutes(r.endTime) && e > _minutes(r.startTime)) {
        return BookingCheck(
            problem: 'This slot overlaps an existing booking.', fee: fee);
      }
    }
    return BookingCheck(fee: fee);
  }

  // Amenities have no exclusive time slot: availability is the quantity
  // on hand, and pending requests don't reduce it (the Admin checks stock
  // at approval). The times are pick-up and return, so a later-day return
  // may read "earlier" than pick-up.
  BookingCheck _checkAmenity(
      BookingRequest request, int start, int end, bool pickUpPassed) {
    final f = request.facility;
    final available = f.availableQuantity ?? 0;
    if (_sameDay(request.returnDate, request.date) && end <= start) {
      return const BookingCheck(
          problem: 'Return time must be after pick-up time.');
    }
    if (pickUpPassed) {
      return const BookingCheck(
          problem: 'Pick-up time has already passed for today.');
    }
    if (available <= 0) {
      return BookingCheck(
          problem: 'None of ${f.name} are currently available.');
    }
    if (request.quantity < 1 || request.quantity > available) {
      return BookingCheck(
          problem: 'Only $available available — adjust the quantity.');
    }
    return const BookingCheck();
  }

  double? _courtFee(Facility f, int minutes) {
    if (!f._isCourt || minutes <= 0) return null;
    final hours = (minutes / 60).ceil();
    return 150.0 + (hours - 1) * 50;
  }
}
