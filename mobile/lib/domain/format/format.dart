import 'package:flutter/material.dart' show TimeOfDay;
import 'package:intl/intl.dart';

final _peso = NumberFormat.currency(locale: 'en_PH', symbol: '₱', decimalDigits: 2);

/// Peso amount for on-screen UI, e.g. `₱1,500.00`. The Statement of Account
/// PDF keeps its own `PHP` formatter: the PDF font has no ₱ glyph.
String peso(num amount) => _peso.format(amount);

final _shortDate = DateFormat('MMM d, y');
final _dateKey = DateFormat('yyyy-MM-dd');

/// Display date, e.g. `Jan 5, 2026`.
String shortDate(DateTime d) => _shortDate.format(d);

/// Date as stored in the database, e.g. `2026-01-05`.
String dateKey(DateTime d) => _dateKey.format(d);

/// [shortDate] for a raw database value: `''` for null, the raw text
/// unchanged if it isn't a date.
String shortDateFromRaw(String? raw) {
  if (raw == null) return '';
  final d = DateTime.tryParse(raw);
  return d == null ? raw : shortDate(d);
}

final _time12 = DateFormat('h:mm a');
final _dbTime = DateFormat('HH:mm');

DateTime _onEpochDay(TimeOfDay t) => DateTime(2000, 1, 1, t.hour, t.minute);

/// Display time, e.g. `9:05 AM`.
String time12(TimeOfDay t) => _time12.format(_onEpochDay(t));

/// Time as stored in the database, e.g. `09:05`.
String dbTime(TimeOfDay t) => _dbTime.format(_onEpochDay(t));

final _phoneSeparators = RegExp(r'[\s\-\(\)]');
final _phMobile = RegExp(r'^(09\d{9}|\+639\d{9})$');

/// A PH mobile number: `09` + 9 digits or `+639` + 9 digits. Spaces, dashes
/// and brackets are ignored. Empty is invalid; a form where the phone is
/// optional decides that itself.
bool isValidPhPhone(String phone) =>
    _phMobile.hasMatch(phone.replaceAll(_phoneSeparators, ''));
