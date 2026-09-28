/// Where a Homeowner's payments and the HOA's dues settings come from.
abstract class DuesSource {
  /// The Homeowner's payments rows, newest due date first.
  Future<List<Map<String, dynamic>>> fetchPayments(String userId);

  /// The `hoa_settings` row (monthly due, GCash QR code), if any.
  Future<Map<String, dynamic>?> fetchSettings();
}

enum PaymentState {
  unpaid('Unpaid'),
  overdue('Overdue'),
  pendingVerification('Pending verification'),
  unconfirmedDues('Unconfirmed dues'),
  paid('Paid');

  const PaymentState(this.label);

  /// The glossary name shown to Residents (see CONTEXT.md).
  final String label;
}

PaymentState _stateOf(String? status) => switch (status) {
      'overdue' => PaymentState.overdue,
      'pending_verification' => PaymentState.pendingVerification,
      'pending' => PaymentState.unconfirmedDues,
      'paid' => PaymentState.paid,
      _ => PaymentState.unpaid,
    };

DateTime? _date(Object? raw) =>
    raw == null ? null : DateTime.parse(raw as String);

/// One monthly bill (or advance payment) and where it stands.
class Payment {
  Payment._fromRow(Map<String, dynamic> row)
      : id = row['id'] as String,
        amount = (row['amount'] as num?)?.toDouble() ?? 0,
        dueDate = DateTime.parse(row['due_date'] as String),
        state = _stateOf(row['status'] as String?),
        paidAt = _date(row['paid_at']),
        statementDate = _date(row['statement_date']),
        referenceNo = row['reference_no'] as String?,
        payerReferenceNo = row['payer_reference_no'] as String?,
        proofUrl = row['proof_url'] as String?,
        lineItems =
            row['line_items'] is List ? row['line_items'] as List : null,
        // Tagged in line_items rather than a column: an advance payment is
        // a payments row the Homeowner creates ahead of any bill.
        isAdvance = row['line_items'] is List &&
            (row['line_items'] as List)
                .any((li) => li is Map && li['label'] == 'Advance Payment');

  final String id;
  final double amount;
  final DateTime dueDate;
  final PaymentState state;
  final bool isAdvance;
  final DateTime? paidAt;

  /// Statement of Account fields: the HOA's statement date and its own
  /// reference, and the per-category breakdown of the bill.
  final DateTime? statementDate;
  final String? referenceNo;
  final List<dynamic>? lineItems;

  /// The GCash reference the Homeowner submitted — not [referenceNo].
  final String? payerReferenceNo;
  final String? proofUrl;

  /// Proof of Payment can be submitted only while the bill is still owed
  /// and nothing has been sent for it yet.
  bool get canSubmitProof =>
      state == PaymentState.unpaid || state == PaymentState.overdue;
}

/// A Homeowner's Dues as of one moment.
class DuesLedger {
  DuesLedger._(this.payments,
      {required this.monthlyDue, required this.qrCodeUrl, required this.asOf});

  /// The HOA's monthly due per Lot.
  final double monthlyDue;

  /// The HOA's GCash QR code image.
  final String? qrCodeUrl;

  /// When this ledger was loaded; advance coverage counts from here.
  final DateTime asOf;

  /// Newest due date first.
  final List<Payment> payments;

  double _sum(PaymentState s) => payments
      .where((p) => p.state == s)
      .fold(0, (total, p) => total + p.amount);

  double get unpaid => _sum(PaymentState.unpaid);
  double get overdue => _sum(PaymentState.overdue);
  double get unconfirmedDues => _sum(PaymentState.unconfirmedDues);

  /// Submitted, awaiting an Admin's verification; shown beside the Balance.
  double get pendingVerification => _sum(PaymentState.pendingVerification);

  /// What the Homeowner owes: Unpaid + Overdue + Unconfirmed dues.
  double get balance => unpaid + overdue + unconfirmedDues;

  /// Every bill not yet paid, pending verification included. The Statement
  /// of Account lists these, as the web app's does.
  List<Payment> get outstanding =>
      payments.where((p) => p.state != PaymentState.paid).toList();

  List<Payment> get paidHistory =>
      payments.where((p) => p.state == PaymentState.paid).toList();

  /// The furthest date a verified advance payment covers, if any.
  DateTime? get advanceCoversUntil {
    final dates = payments
        .where((p) => p.isAdvance && p.state == PaymentState.paid)
        .map((p) => p.dueDate);
    return dates.isEmpty ? null : dates.reduce((a, b) => a.isAfter(b) ? a : b);
  }

  /// Whole months still covered in advance; a partial month is dropped.
  int get advanceMonthsRemaining {
    final until = advanceCoversUntil;
    if (until == null || !until.isAfter(asOf)) return 0;
    final months = (until.year - asOf.year) * 12 +
        (until.month - asOf.month) -
        (until.day < asOf.day ? 1 : 0);
    return months < 0 ? 0 : months;
  }

  double get advanceAmountRemaining => advanceMonthsRemaining * monthlyDue;

  /// The newest outstanding bill, or null when settled.
  Payment? get nextDue {
    final o = outstanding;
    return o.isEmpty ? null : o.first;
  }
}

/// Loads the signed-in Homeowner's Dues.
class Dues {
  Dues(this._source,
      {required String? Function() currentUserId,
      DateTime Function() clock = DateTime.now})
      : _currentUserId = currentUserId,
        _clock = clock;

  final DuesSource _source;
  final String? Function() _currentUserId;
  final DateTime Function() _clock;

  Future<DuesLedger?> load() async {
    final userId = _currentUserId();
    if (userId == null) return null;
    final rows = await _source.fetchPayments(userId);
    final settings = await _source.fetchSettings();
    return DuesLedger._(
      rows.map(Payment._fromRow).toList(),
      monthlyDue: (settings?['monthly_due_amount'] as num?)?.toDouble() ?? 150,
      qrCodeUrl: settings?['photo_url'] as String?,
      asOf: _clock(),
    );
  }
}
