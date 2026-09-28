import 'package:flutter/material.dart' show TimeOfDay;
import 'package:flutter_test/flutter_test.dart';
import 'package:chateau_mobile_app/domain/format/format.dart';

void main() {
  group('peso', () {
    test('shows two decimals with thousands separators', () {
      expect(peso(1500), '₱1,500.00');
    });

    test('shows zero and small amounts with two decimals', () {
      expect(peso(0), '₱0.00');
      expect(peso(150), '₱150.00');
    });

    test('puts the minus sign before the peso sign', () {
      expect(peso(-50), '-₱50.00');
    });

    test('rounds to the centavo, carrying into the peso', () {
      expect(peso(99.999), '₱100.00');
      expect(peso(1234567.891), '₱1,234,567.89');
    });
  });

  group('dates', () {
    test('shortDate shows abbreviated month, day without padding, year', () {
      expect(shortDate(DateTime(2026, 1, 5)), 'Jan 5, 2026');
      expect(shortDate(DateTime(2026, 12, 31)), 'Dec 31, 2026');
    });

    test('dateKey is the zero-padded database date', () {
      expect(dateKey(DateTime(2026, 1, 5)), '2026-01-05');
      expect(dateKey(DateTime(2026, 11, 30, 23, 59)), '2026-11-30');
    });

    test('shortDateFromRaw formats a database timestamp', () {
      expect(shortDateFromRaw('2026-03-09T08:00:00'), 'Mar 9, 2026');
      expect(shortDateFromRaw('2026-03-09'), 'Mar 9, 2026');
    });

    test('shortDateFromRaw gives empty for null and the raw text if unparseable', () {
      expect(shortDateFromRaw(null), '');
      expect(shortDateFromRaw('next week'), 'next week');
    });
  });

  group('times', () {
    test('time12 uses a 12-hour clock with AM/PM', () {
      expect(time12(const TimeOfDay(hour: 9, minute: 5)), '9:05 AM');
      expect(time12(const TimeOfDay(hour: 13, minute: 5)), '1:05 PM');
    });

    test('time12 shows midnight as 12 AM and noon as 12 PM', () {
      expect(time12(const TimeOfDay(hour: 0, minute: 0)), '12:00 AM');
      expect(time12(const TimeOfDay(hour: 12, minute: 0)), '12:00 PM');
    });

    test('dbTime is the zero-padded 24-hour database time', () {
      expect(dbTime(const TimeOfDay(hour: 9, minute: 5)), '09:05');
      expect(dbTime(const TimeOfDay(hour: 23, minute: 30)), '23:30');
    });
  });

  group('isValidPhPhone', () {
    test('accepts 09 and +639 mobile numbers', () {
      expect(isValidPhPhone('09123456789'), isTrue);
      expect(isValidPhPhone('+639123456789'), isTrue);
    });

    test('ignores spaces, dashes and brackets', () {
      expect(isValidPhPhone('0912 345 6789'), isTrue);
      expect(isValidPhPhone('(0912)-345-6789'), isTrue);
    });

    test('rejects an empty number', () {
      expect(isValidPhPhone(''), isFalse);
      expect(isValidPhPhone('   '), isFalse);
    });

    test('rejects wrong lengths and landlines', () {
      expect(isValidPhPhone('0912345678'), isFalse);
      expect(isValidPhPhone('091234567890'), isFalse);
      expect(isValidPhPhone('0284567890'), isFalse);
    });
  });
}
