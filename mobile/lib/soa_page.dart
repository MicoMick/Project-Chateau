import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

// ─────────────────────────────────────────────────────────────────────────────
// Statement of Account — generates a downloadable PDF mirroring the design
// produced by the website's printSOA.js (chateau-project/frontend/src/HOA
// Page/Payments/printSOA.js): same letterhead, status banner, monthly due
// breakdown, outstanding charges, payment instructions + QR, and payment
// history — so a resident gets the same document the Treasurer would
// print/email for them, straight to their device.
//
// Note: PDF base fonts don't support the ₱ glyph, so amounts here read
// "PHP 1,234.56" instead of "₱1,234.56" (the website keeps the ₱ symbol,
// since web fonts render it fine).
// ─────────────────────────────────────────────────────────────────────────────

class SoaPaymentEntry {
  final double amount;
  final DateTime dueDate;
  final DateTime? statementDate;
  final DateTime? paidAt;
  final String? referenceNo; // HOA's own reference
  final String? payerReferenceNo; // resident's submitted GCash reference
  final String status;
  final List<dynamic>? lineItems;

  const SoaPaymentEntry({
    required this.amount,
    required this.dueDate,
    this.statementDate,
    this.paidAt,
    this.referenceNo,
    this.payerReferenceNo,
    required this.status,
    this.lineItems,
  });
}

// ── Colors ────────────────────────────────────────────────────────────────────

final _green = PdfColor.fromInt(0xFF006837);
final _greenAccentText = PdfColor.fromInt(0xFFA7F3D0);
final _yellow = PdfColor.fromInt(0xFFFFF200);
final _red = PdfColor.fromInt(0xFFDC2626);
final _redBg = PdfColor.fromInt(0xFFFEF2F2);
final _redBorder = PdfColor.fromInt(0xFFFECACA);
final _redDark = PdfColor.fromInt(0xFFB91C1C);
final _greenBg = PdfColor.fromInt(0xFFF0FDF4);
final _greenBorder = PdfColor.fromInt(0xFFBBF7D0);
final _greenDarkText = PdfColor.fromInt(0xFF166534);
final _amberBg = PdfColor.fromInt(0xFFFFFBEB);
final _amberBorder = PdfColor.fromInt(0xFFF59E0B);
final _amberDark = PdfColor.fromInt(0xFF92400E);
final _amberText = PdfColor.fromInt(0xFF78350F);
final _gray400 = PdfColor.fromInt(0xFF94A3B8);
final _gray500 = PdfColor.fromInt(0xFF64748B);
final _gray800 = PdfColor.fromInt(0xFF0F172A);
final _grayBg = PdfColor.fromInt(0xFFF8FAFC);
final _grayBorder = PdfColor.fromInt(0xFFE2E8F0);
final _rowDivider = PdfColor.fromInt(0xFFF1F5F9);

// ── Line-item breakdown — mirrors paymentUtils.js's buildLineItemBreakdown ──

class _SoaLineItem {
  final String label;
  final String category;
  final String type;
  final double amount;
  const _SoaLineItem(this.label, this.category, this.type, this.amount);
}

const _kBillLineItemsBase = [
  ('Security Guard Salary', 'Salaries', 'Fixed', 22000.0),
  ('Electricity Bill', 'Utilities', 'Variable', 14000.0),
  ('Street Sweeper Salary', 'Maintenance', 'Fixed', 1200.0),
  ('Water Bill', 'Utilities', 'Variable', 400.0),
];

List<_SoaLineItem> _buildLineItemBreakdown(double monthlyDueAmount) {
  final totalBase = _kBillLineItemsBase.fold<double>(0, (s, i) => s + i.$4);
  final items = <_SoaLineItem>[];
  double sumSoFar = 0;
  for (var idx = 0; idx < _kBillLineItemsBase.length; idx++) {
    final item = _kBillLineItemsBase[idx];
    final amount = idx == _kBillLineItemsBase.length - 1
        ? _round2(monthlyDueAmount - sumSoFar)
        : _round2((item.$4 / totalBase) * monthlyDueAmount);
    sumSoFar = _round2(sumSoFar + amount);
    items.add(_SoaLineItem(item.$1, item.$2, item.$3, amount));
  }
  return items;
}

double _round2(double n) => (n * 100).round() / 100;

// ── Formatting helpers ───────────────────────────────────────────────────────

const _kMonthsLong = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const _kMonthsShort = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

String _fmtCurrency(num n) {
  final fixed = n.toStringAsFixed(2);
  final parts = fixed.split('.');
  final isNegative = parts[0].startsWith('-');
  final digits = isNegative ? parts[0].substring(1) : parts[0];
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
    buffer.write(digits[i]);
  }
  return '${isNegative ? '-' : ''}PHP ${buffer.toString()}.${parts[1]}';
}

String _fmtDate(DateTime? d) =>
    d == null ? '-' : '${_kMonthsShort[d.month]} ${d.day}, ${d.year}';
String _fmtDateLong(DateTime? d) =>
    d == null ? '-' : '${_kMonthsLong[d.month]} ${d.day}, ${d.year}';
String _fmtMonth(DateTime? d) =>
    d == null ? '-' : '${_kMonthsLong[d.month]} ${d.year}';
String _fmtMonthAbbr(DateTime? d) => d == null ? '-' : _kMonthsShort[d.month];

String _fmtPaidPeriod(SoaPaymentEntry p, double monthlyDueAmount) {
  final months = monthlyDueAmount > 0
      ? (p.amount / monthlyDueAmount).round().clamp(1, 999999)
      : 1;
  if (months > 1) {
    final end = p.dueDate;
    final start = DateTime(end.year, end.month - (months - 1), end.day);
    return start.year == end.year
        ? '${_fmtMonthAbbr(start)} to ${_fmtMonthAbbr(end)} ${end.year}'
        : '${_fmtMonthAbbr(start)} ${start.year} to ${_fmtMonthAbbr(end)} ${end.year}';
  }
  return _fmtMonth(p.dueDate);
}

// ── Section builders ─────────────────────────────────────────────────────────

pw.Widget _letterhead(String soaRef, DateTime today) => pw.Container(
      color: _green,
      padding: const pw.EdgeInsets.all(16),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text('OFFICIAL DOCUMENT',
                  style: pw.TextStyle(
                      fontSize: 7,
                      color: _greenAccentText,
                      fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 3),
              pw.Text('Statement of Account',
                  style: pw.TextStyle(
                      fontSize: 17,
                      color: PdfColors.white,
                      fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 3),
              pw.Text(
                  'Chateau Real Executive Village Homeowners Association Inc. (CREVHAI)',
                  style: pw.TextStyle(fontSize: 8, color: _greenAccentText)),
            ],
          ),
          pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.end,
            children: [
              pw.Text('REFERENCE NO.',
                  style: pw.TextStyle(
                      fontSize: 7,
                      color: _greenAccentText,
                      fontWeight: pw.FontWeight.bold)),
              pw.Text(soaRef,
                  style: pw.TextStyle(
                      fontSize: 11, color: _yellow, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 4),
              pw.Text('Issued: ${_fmtDateLong(today)}',
                  style: pw.TextStyle(fontSize: 8, color: _greenAccentText)),
            ],
          ),
        ],
      ),
    );

pw.Widget _statusBar(bool isSettled, double totalDue, DateTime? earliestDueDate) =>
    pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      decoration: pw.BoxDecoration(
        color: isSettled ? _greenBg : _redBg,
        border: pw.Border(
            bottom: pw.BorderSide(
                color: isSettled ? _greenBorder : _redBorder, width: 1.5)),
      ),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(
                  isSettled
                      ? 'ACCOUNT STATUS: FULLY SETTLED'
                      : 'ACCOUNT STATUS: PAYMENT REQUIRED',
                  style: pw.TextStyle(
                      fontSize: 9,
                      fontWeight: pw.FontWeight.bold,
                      color: isSettled ? _greenDarkText : _redDark)),
              if (!isSettled)
                pw.Padding(
                  padding: const pw.EdgeInsets.only(top: 3),
                  child: pw.Text(
                      'Payment due on or before ${_fmtDateLong(earliestDueDate)}',
                      style: pw.TextStyle(fontSize: 9, color: _redDark)),
                ),
            ],
          ),
          if (!isSettled)
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.end,
              children: [
                pw.Text('TOTAL AMOUNT DUE',
                    style: pw.TextStyle(
                        fontSize: 7,
                        fontWeight: pw.FontWeight.bold,
                        color: _redDark)),
                pw.Text(_fmtCurrency(totalDue),
                    style: pw.TextStyle(
                        fontSize: 15, fontWeight: pw.FontWeight.bold, color: _red)),
              ],
            ),
        ],
      ),
    );

pw.Widget _acctInfo(
  String residentName,
  String fullAddress,
  int monthsUnpaidCount,
  double monthlyDueAmount,
) =>
    pw.Container(
      decoration:
          pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: _grayBorder))),
      child: pw.Row(
        children: [
          pw.Expanded(
            child: pw.Container(
              padding: const pw.EdgeInsets.all(13),
              decoration: pw.BoxDecoration(
                  border: pw.Border(right: pw.BorderSide(color: _rowDivider))),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text('ACCOUNT HOLDER',
                      style: pw.TextStyle(
                          fontSize: 7, color: _gray400, fontWeight: pw.FontWeight.bold)),
                  pw.SizedBox(height: 4),
                  pw.Text(residentName,
                      style: pw.TextStyle(
                          fontSize: 11, fontWeight: pw.FontWeight.bold, color: _gray800)),
                  pw.SizedBox(height: 2),
                  pw.Text(fullAddress.isEmpty ? 'N/A' : fullAddress,
                      style: pw.TextStyle(fontSize: 9, color: _gray500)),
                ],
              ),
            ),
          ),
          pw.Expanded(
            child: pw.Container(
              padding: const pw.EdgeInsets.all(13),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text('BILLING SUMMARY',
                      style: pw.TextStyle(
                          fontSize: 7, color: _gray400, fontWeight: pw.FontWeight.bold)),
                  pw.SizedBox(height: 4),
                  pw.Text(
                      monthsUnpaidCount > 0
                          ? '$monthsUnpaidCount month${monthsUnpaidCount != 1 ? 's' : ''} unpaid'
                          : 'No outstanding balance',
                      style: pw.TextStyle(
                          fontSize: 11,
                          fontWeight: pw.FontWeight.bold,
                          color: monthsUnpaidCount > 0 ? _red : _greenDarkText)),
                  pw.SizedBox(height: 2),
                  pw.Text('Monthly due: ${_fmtCurrency(monthlyDueAmount)}',
                      style: pw.TextStyle(fontSize: 9, color: _gray500)),
                ],
              ),
            ),
          ),
        ],
      ),
    );

pw.Widget _sectionHeader(String text) => pw.Container(
      margin: const pw.EdgeInsets.only(top: 14, bottom: 6),
      padding: const pw.EdgeInsets.only(bottom: 3),
      decoration:
          pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: _green, width: 1.5))),
      child: pw.Text(text.toUpperCase(),
          style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: _green)),
    );

pw.Widget _totalBar(String label, String value, {required PdfColor bg, required PdfColor fg}) =>
    pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      color: bg,
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(label, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
          pw.Text(value,
              style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12, color: fg)),
        ],
      ),
    );

pw.Widget _breakdownTable(List<_SoaLineItem> items, int months, double totalDue) {
  final headers = ['Item', 'Category', 'Per Month', '× $months Month${months != 1 ? 's' : ''}'];
  final data = items
      .map((i) => [
            i.type.isNotEmpty ? '${i.label} (${i.type})' : i.label,
            i.category,
            _fmtCurrency(i.amount),
            _fmtCurrency(i.amount * months),
          ])
      .toList();
  return pw.Column(children: [
    pw.TableHelper.fromTextArray(
      headers: headers,
      data: data,
      headerStyle:
          pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 8),
      headerDecoration: pw.BoxDecoration(color: _green),
      cellStyle: const pw.TextStyle(fontSize: 8.5),
      cellAlignments: {2: pw.Alignment.centerRight, 3: pw.Alignment.centerRight},
      border: null,
      rowDecoration: pw.BoxDecoration(
          border: pw.Border(bottom: pw.BorderSide(color: _rowDivider, width: 0.5))),
      cellPadding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
    ),
    _totalBar('Total:', _fmtCurrency(totalDue), bg: _greenBg, fg: _green),
  ]);
}

pw.Widget _outstandingTable(List<SoaPaymentEntry> unpaidDesc, double totalDue) {
  final headers = ['Period', 'Description', 'Stmt. Date', 'Due Date', 'Ref #', 'Status', 'Amount'];
  final data = unpaidDesc
      .map((p) => [
            _fmtMonth(p.dueDate),
            'Monthly HOA Dues',
            _fmtDate(p.statementDate),
            _fmtDate(p.dueDate),
            p.referenceNo ?? '-',
            p.status.isEmpty ? 'Unpaid' : p.status,
            _fmtCurrency(p.amount),
          ])
      .toList();
  return pw.Column(children: [
    pw.TableHelper.fromTextArray(
      headers: headers,
      data: data,
      headerStyle:
          pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 8),
      headerDecoration: pw.BoxDecoration(color: _green),
      cellStyle: const pw.TextStyle(fontSize: 8),
      cellAlignments: {5: pw.Alignment.center, 6: pw.Alignment.centerRight},
      border: null,
      rowDecoration: pw.BoxDecoration(
          border: pw.Border(bottom: pw.BorderSide(color: _rowDivider, width: 0.5))),
      cellPadding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
    ),
    _totalBar('Total Amount Due:', _fmtCurrency(totalDue), bg: _redBg, fg: _red),
  ]);
}

pw.Widget _historyTable(List<SoaPaymentEntry> paidChrono, double monthlyDueAmount) {
  if (paidChrono.isEmpty) {
    return pw.Text('No payment history on record yet.',
        style: pw.TextStyle(fontSize: 9, color: _gray400, fontStyle: pw.FontStyle.italic));
  }
  final headers = ['Period', 'Date Paid', 'Your Ref #', 'HOA Ref #', 'Amount'];
  final data = paidChrono
      .map((p) => [
            _fmtPaidPeriod(p, monthlyDueAmount),
            _fmtDate(p.paidAt),
            p.payerReferenceNo ?? '-',
            p.referenceNo ?? '-',
            _fmtCurrency(p.amount),
          ])
      .toList();
  return pw.TableHelper.fromTextArray(
    headers: headers,
    data: data,
    headerStyle:
        pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 8),
    headerDecoration: pw.BoxDecoration(color: _green),
    cellStyle: const pw.TextStyle(fontSize: 8),
    cellAlignments: {4: pw.Alignment.centerRight},
    border: null,
    rowDecoration: pw.BoxDecoration(
        border: pw.Border(bottom: pw.BorderSide(color: _rowDivider, width: 0.5))),
    cellPadding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
  );
}

pw.Widget _payBox(String soaRef, DateTime? earliestDueDate, pw.MemoryImage? qrImage) =>
    pw.Container(
      margin: const pw.EdgeInsets.symmetric(vertical: 10),
      padding: const pw.EdgeInsets.all(12),
      decoration: pw.BoxDecoration(
          color: _amberBg, border: pw.Border.all(color: _amberBorder, width: 1.2)),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text('PAYMENT INSTRUCTIONS',
              style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, color: _amberDark)),
          pw.SizedBox(height: 5),
          pw.Text(
              'Please settle your outstanding balance on or before ${_fmtDateLong(earliestDueDate)} '
              'to avoid late penalties. Payments may be made at the HOA Office or through your '
              'designated HOA Treasurer. Present this document as your billing reference — '
              'Ref. No. $soaRef.',
              style: pw.TextStyle(fontSize: 9, color: _amberText, lineSpacing: 2)),
          if (qrImage != null) ...[
            pw.SizedBox(height: 10),
            pw.Center(
              child: pw.Column(children: [
                pw.Container(
                  width: 110,
                  height: 110,
                  decoration: pw.BoxDecoration(border: pw.Border.all(color: _grayBorder)),
                  child: pw.Image(qrImage),
                ),
                pw.SizedBox(height: 4),
                pw.Text('Scan this QR Code to pay directly',
                    style:
                        pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, color: _amberDark)),
              ]),
            ),
          ],
        ],
      ),
    );

pw.Widget _settledBanner() => pw.Container(
      margin: const pw.EdgeInsets.only(bottom: 14),
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
          color: _greenBg, border: pw.Border.all(color: _greenBorder, width: 1.2)),
      child: pw.Center(
        child: pw.Column(children: [
          pw.Text('Account Fully Settled',
              style:
                  pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold, color: _greenDarkText)),
          pw.SizedBox(height: 4),
          pw.Text('No outstanding dues. Thank you for your prompt payments!',
              style: pw.TextStyle(fontSize: 9, color: _greenDarkText)),
        ]),
      ),
    );

pw.Widget _footer(String soaRef, DateTime today) => pw.Container(
      margin: const pw.EdgeInsets.only(top: 18),
      padding: const pw.EdgeInsets.all(13),
      decoration: pw.BoxDecoration(
          color: _grayBg, border: pw.Border(top: pw.BorderSide(color: _grayBorder, width: 1.5))),
      child: pw.Text(
        'This is an official Statement of Account issued by the Chateau Real Executive Village '
        'Homeowners Association Inc. (CREVHAI) on ${_fmtDateLong(today)}. This document is '
        'system-generated and is valid without a manual signature. For disputes or inquiries, '
        'please contact the HOA Treasurer\'s office within 5 business days. Ref. No.: $soaRef.',
        style: pw.TextStyle(fontSize: 7.5, color: _gray400, lineSpacing: 1.5),
      ),
    );

// ── Entry point ───────────────────────────────────────────────────────────────

Future<Uint8List> generateSoaPdf({
  required String residentId,
  required String residentName,
  required String fullAddress,
  required List<SoaPaymentEntry> unpaidList,
  required List<SoaPaymentEntry> paidHistory,
  required double monthlyDueAmount,
  String? qrCodeUrl,
  bool showOutstanding = true,
  bool showHistory = true,
}) async {
  final unpaidAsc = [...unpaidList]..sort((a, b) => a.dueDate.compareTo(b.dueDate));
  final unpaidDesc = unpaidAsc.reversed.toList();
  final totalDue = unpaidAsc.fold<double>(0, (s, p) => s + p.amount);
  final today = DateTime.now();
  final isSettled = unpaidAsc.isEmpty;
  final monthsUnpaidCount = unpaidAsc.length;
  final earliestDueDate = isSettled ? null : unpaidAsc.first.dueDate;

  final paidHistoryChrono = [...paidHistory]..sort((a, b) => b.dueDate.compareTo(a.dueDate));
  final capped = paidHistoryChrono.take(12).toList()
    ..sort((a, b) => a.dueDate.compareTo(b.dueDate));

  final soaRef = 'SOA-${today.year}${today.month.toString().padLeft(2, '0')}'
      '-${residentId.length >= 6 ? residentId.substring(0, 6).toUpperCase() : residentId.toUpperCase()}';

  final sampleLineItems = () {
    for (final p in unpaidAsc) {
      if (p.lineItems != null && p.lineItems!.isNotEmpty) {
        return p.lineItems!
            .whereType<Map>()
            .map((li) => _SoaLineItem(
                  (li['label'] ?? '').toString(),
                  (li['category'] ?? '').toString(),
                  (li['type'] ?? '').toString(),
                  (li['amount'] as num? ?? 0).toDouble(),
                ))
            .toList();
      }
    }
    return _buildLineItemBreakdown(monthlyDueAmount);
  }();

  pw.MemoryImage? qrImage;
  if (qrCodeUrl != null && qrCodeUrl.isNotEmpty) {
    try {
      final res = await http.get(Uri.parse(qrCodeUrl)).timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) qrImage = pw.MemoryImage(res.bodyBytes);
    } catch (_) {}
  }

  final doc = pw.Document();
  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: pw.EdgeInsets.zero,
      build: (context) => [
        _letterhead(soaRef, today),
        _statusBar(isSettled, totalDue, earliestDueDate),
        _acctInfo(residentName, fullAddress, monthsUnpaidCount, monthlyDueAmount),
        pw.Padding(
          padding: const pw.EdgeInsets.symmetric(horizontal: 16),
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              if (showOutstanding) ...[
                if (!isSettled) ...[
                  _sectionHeader(
                      'Monthly Due Breakdown — What Your ${_fmtCurrency(monthlyDueAmount)}/month Covers'),
                  pw.Text(
                      '* Fixed costs are charged at the same rate every month. Variable costs are estimates based on actual utility bills.',
                      style: pw.TextStyle(
                          fontSize: 8, color: _gray400, fontStyle: pw.FontStyle.italic)),
                  pw.SizedBox(height: 6),
                  _breakdownTable(sampleLineItems, monthsUnpaidCount, totalDue),
                  _sectionHeader('Outstanding Charges'),
                  _outstandingTable(unpaidDesc, totalDue),
                  _payBox(soaRef, earliestDueDate, qrImage),
                ] else
                  _settledBanner(),
              ],
              if (showHistory) ...[
                _sectionHeader('Past Recent Payment History'),
                _historyTable(capped, monthlyDueAmount),
              ],
            ],
          ),
        ),
        _footer(soaRef, today),
      ],
    ),
  );

  return doc.save();
}
