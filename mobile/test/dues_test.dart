import 'package:flutter_test/flutter_test.dart';
import 'package:chateau_mobile_app/domain/dues/dues.dart';

class FakeDuesSource implements DuesSource {
  FakeDuesSource(this.payments, {this.settings});
  final List<Map<String, dynamic>> payments;
  final Map<String, dynamic>? settings;

  @override
  Future<List<Map<String, dynamic>>> fetchPayments(String userId) async =>
      payments;

  @override
  Future<Map<String, dynamic>?> fetchSettings() async => settings;
}

Map<String, dynamic> row(String status,
        {double amount = 150,
        String due = '2026-01-15',
        String id = 'p',
        bool advance = false}) =>
    {
      'id': id,
      'amount': amount,
      'due_date': due,
      'status': status,
      'created_at': '2026-01-01T00:00:00',
      if (advance)
        'line_items': [
          {'label': 'Advance Payment'}
        ],
    };

Future<DuesLedger> ledgerOf(List<Map<String, dynamic>> payments,
        {DateTime? now, Map<String, dynamic>? settings}) async =>
    (await Dues(FakeDuesSource(payments, settings: settings),
            currentUserId: () => 'u1',
            clock: () => now ?? DateTime(2026, 1, 15))
        .load())!;

void main() {
  test('reads each stored status as a Payment state', () async {
    final ledger = await ledgerOf([
      row('unpaid', id: 'a'),
      row('overdue', id: 'b'),
      row('pending_verification', id: 'c'),
      row('pending', id: 'd'),
      row('paid', id: 'e'),
    ]);

    expect(ledger.payments.map((p) => p.state), [
      PaymentState.unpaid,
      PaymentState.overdue,
      PaymentState.pendingVerification,
      PaymentState.unconfirmedDues,
      PaymentState.paid,
    ]);
  });

  test('an unknown or missing status is Unpaid', () async {
    final ledger = await ledgerOf([row('weird'), {...row('x'), 'status': null}]);

    expect(ledger.payments.map((p) => p.state),
        [PaymentState.unpaid, PaymentState.unpaid]);
  });

  group('Balance', () {
    late DuesLedger ledger;
    setUp(() async {
      ledger = await ledgerOf([
        row('unpaid', amount: 150),
        row('overdue', amount: 300),
        row('pending', amount: 450),
        row('pending_verification', amount: 600),
        row('paid', amount: 1000),
      ]);
    });

    test('is Unpaid + Overdue + Unconfirmed dues', () {
      expect(ledger.balance, 900);
    });

    test('keeps payments pending verification beside it, not inside', () {
      expect(ledger.pendingVerification, 600);
    });

    test('breaks down by state for the home card', () {
      expect(ledger.unpaid, 150);
      expect(ledger.overdue, 300);
      expect(ledger.unconfirmedDues, 450);
    });

    test('outstanding (for the Statement of Account) is everything not paid',
        () {
      expect(ledger.outstanding.map((p) => p.amount), [150, 300, 450, 600]);
      expect(ledger.paidHistory.map((p) => p.amount), [1000]);
    });
  });

  test('nextDue is the newest outstanding bill; null when settled', () async {
    final ledger = await ledgerOf([
      row('paid', due: '2026-03-15', id: 'mar'),
      row('unpaid', due: '2026-02-15', id: 'feb'),
      row('overdue', due: '2026-01-15', id: 'jan'),
    ]);
    expect(ledger.nextDue?.id, 'feb');

    expect((await ledgerOf([row('paid')])).nextDue, isNull);
  });

  test('proof can be submitted only for Unpaid or Overdue', () async {
    final ledger = await ledgerOf([
      row('unpaid'),
      row('overdue'),
      row('pending_verification'),
      row('pending'),
      row('paid'),
    ]);

    expect(ledger.payments.map((p) => p.canSubmitProof),
        [true, true, false, false, false]);
  });

  group('advance coverage', () {
    Future<int> monthsAhead(String coveredUntil, DateTime now) async =>
        (await ledgerOf([row('paid', due: coveredUntil, advance: true)],
                now: now))
            .advanceMonthsRemaining;

    test('counts whole months until the furthest paid advance', () async {
      expect(await monthsAhead('2026-04-15', DateTime(2026, 1, 15)), 3);
      expect(await monthsAhead('2026-04-14', DateTime(2026, 1, 15)), 2);
    });

    test('drops a partial month: Jan 31 to Feb 28 is 0', () async {
      expect(await monthsAhead('2026-02-28', DateTime(2026, 1, 31)), 0);
    });

    test('is 0 on the covered-until day and after it', () async {
      expect(await monthsAhead('2026-01-15', DateTime(2026, 1, 15)), 0);
      expect(await monthsAhead('2025-12-15', DateTime(2026, 1, 15)), 0);
    });

    test('ignores advances not yet verified and ordinary bills', () async {
      final ledger = await ledgerOf([
        row('pending_verification', due: '2026-06-15', advance: true),
        row('paid', due: '2026-05-15'),
      ], now: DateTime(2026, 1, 15));

      expect(ledger.advanceCoversUntil, isNull);
      expect(ledger.advanceMonthsRemaining, 0);
    });

    test('the amount ahead is months × the monthly due', () async {
      final ledger = await ledgerOf(
          [row('paid', due: '2026-04-15', advance: true)],
          now: DateTime(2026, 1, 15),
          settings: {'monthly_due_amount': 200});

      expect(ledger.advanceCoversUntil, DateTime(2026, 4, 15));
      expect(ledger.advanceAmountRemaining, 600);
    });
  });

  test('reads the monthly due and GCash QR from the HOA settings', () async {
    final ledger = await ledgerOf([],
        settings: {'monthly_due_amount': 175, 'photo_url': 'https://x/qr.png'});

    expect(ledger.monthlyDue, 175);
    expect(ledger.qrCodeUrl, 'https://x/qr.png');
  });

  test('the monthly due falls back to ₱150 without settings', () async {
    expect((await ledgerOf([])).monthlyDue, 150);
  });

  test('is null when nobody is signed in', () async {
    final dues = Dues(FakeDuesSource([]), currentUserId: () => null);
    expect(await dues.load(), isNull);
  });

  test('each state has its glossary label', () {
    expect(PaymentState.values.map((s) => s.label), [
      'Unpaid',
      'Overdue',
      'Pending verification',
      'Unconfirmed dues',
      'Paid',
    ]);
  });

  test('carries the Statement of Account details', () async {
    final ledger = await ledgerOf([
      {
        ...row('paid'),
        'paid_at': '2026-01-20T09:30:00',
        'statement_date': '2026-01-01',
        'reference_no': 'HOA-0001',
        'payer_reference_no': 'GC123',
        'proof_url': 'https://x/proof.png',
        'line_items': [
          {'label': 'Monthly Dues', 'amount': 150}
        ],
      },
      row('unpaid'),
    ]);
    final paid = ledger.payments.first, unpaid = ledger.payments.last;

    expect(paid.paidAt, DateTime(2026, 1, 20, 9, 30));
    expect(paid.statementDate, DateTime(2026, 1, 1));
    expect(paid.referenceNo, 'HOA-0001');
    expect(paid.payerReferenceNo, 'GC123');
    expect(paid.proofUrl, 'https://x/proof.png');
    expect(paid.lineItems, hasLength(1));
    expect(paid.isAdvance, isFalse);
    expect(unpaid.paidAt, isNull);
    expect(unpaid.lineItems, isNull);
  });
}
