import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb, Uint8List;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_colors.dart';
import 'app_theme.dart';
import 'app_dialogs.dart';

// ── Models ─────────────────────────────────────────────────────────────────────

class _Payment {
  final String id;
  final double amount;
  final DateTime dueDate;
  final String status;
  // The payer's own GCash transaction reference — distinct from
  // `reference_no`, which is the HOA's internal reference for the bill and
  // must not be overwritten by what the resident submits.
  final String? payerReferenceNo;
  final String? proofUrl;
  final DateTime? paidAt;
  final DateTime createdAt;
  // Tagged via line_items rather than a dedicated column, so this needs no
  // schema change — an advance payment is just a payments row a resident
  // creates themselves ahead of any bill existing for it yet.
  final bool isAdvance;

  const _Payment({
    required this.id,
    required this.amount,
    required this.dueDate,
    required this.status,
    this.payerReferenceNo,
    this.proofUrl,
    this.paidAt,
    required this.createdAt,
    this.isAdvance = false,
  });

  bool get isPaid => status == 'paid';
  bool get isPending => status == 'pending_verification';
  bool get isUnpaid => status == 'unpaid';
  bool get isOverdue => status == 'overdue';
  bool get canSubmitPayment => isUnpaid || isOverdue;
}

// ── Page ───────────────────────────────────────────────────────────────────────

class PaymentPage extends StatefulWidget {
  const PaymentPage({super.key});

  @override
  State<PaymentPage> createState() => _PaymentPageState();
}

class _PaymentPageState extends State<PaymentPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  final _supabase = Supabase.instance.client;

  List<_Payment> _payments = [];
  bool _isLoading = true;
  String _userName = '';
  String? _qrImageUrl;
  double _monthlyDue = 150;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..forward();
    _loadData();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  Future<void> _loadData() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    try {
      final profile = await _supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();

      final paymentsRaw = await _supabase
          .from('payments')
          .select()
          .eq('user_id', user.id)
          .order('due_date', ascending: false);

      final hoaSettings = await _supabase
          .from('hoa_settings')
          .select('photo_url, monthly_due_amount')
          .eq('id', 1)
          .maybeSingle();

      if (mounted) {
        setState(() {
          _userName = profile?['full_name'] as String? ?? '';
          _qrImageUrl = hoaSettings?['photo_url'] as String?;
          _monthlyDue =
              (hoaSettings?['monthly_due_amount'] as num?)?.toDouble() ?? 150;

          _payments = (paymentsRaw as List).map((p) {
            final lineItems = p['line_items'];
            return _Payment(
              id: p['id'],
              amount: (p['amount'] as num?)?.toDouble() ?? 0.0,
              dueDate: DateTime.parse(p['due_date']),
              status: p['status'] ?? 'unpaid',
              payerReferenceNo: p['payer_reference_no'],
              proofUrl: p['proof_url'],
              paidAt: p['paid_at'] != null
                  ? DateTime.parse(p['paid_at'])
                  : null,
              createdAt: DateTime.parse(p['created_at']),
              isAdvance: lineItems is List &&
                  lineItems.any((li) => li is Map && li['label'] == 'Advance Payment'),
            );
          }).toList();

          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _Payment? get _latestUnpaid {
    try {
      return _payments.firstWhere((p) => p.isUnpaid || p.isOverdue || p.isPending);
    } catch (_) {
      return null;
    }
  }

  // Outstanding balance = all unpaid + overdue + pending amounts
  double get _outstandingBalance =>
      _payments.where((p) => p.isUnpaid || p.isOverdue || p.isPending).fold(0, (sum, p) => sum + p.amount);

  // ── Advance payment ─────────────────────────────────────────────────────
  // Derived purely from date math against confirmed advance payments — no
  // dependency on how/when the admin side generates each month's actual
  // bill, so it just counts down on its own as time passes.

  // Furthest date any *verified* advance payment currently covers through.
  DateTime? get _advanceCoversUntil {
    final advancePaid = _payments.where((p) => p.isPaid && p.isAdvance);
    if (advancePaid.isEmpty) return null;
    return advancePaid.map((p) => p.dueDate).reduce((a, b) => a.isAfter(b) ? a : b);
  }

  int get _advanceMonthsRemaining {
    final until = _advanceCoversUntil;
    if (until == null) return 0;
    final now = DateTime.now();
    if (!until.isAfter(now)) return 0;
    final months = (until.year - now.year) * 12 +
        (until.month - now.month) -
        (until.day < now.day ? 1 : 0);
    return months < 0 ? 0 : months;
  }

  double get _advanceAmountRemaining => _advanceMonthsRemaining * _monthlyDue;

  void _showAdvancePaySheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AdvancePaySheet(
        monthlyDue: _monthlyDue,
        qrImageUrl: _qrImageUrl,
        coversFrom: _advanceCoversUntil,
        onSubmitted: _loadData,
      ),
    );
  }

  String _formatDate(DateTime d) =>
      '${_monthName(d.month)} ${d.day}, ${d.year}';

  String _formatDateTime(DateTime d) {
    final h = d.hour > 12 ? d.hour - 12 : (d.hour == 0 ? 12 : d.hour);
    final m = d.minute.toString().padLeft(2, '0');
    final period = d.hour >= 12 ? 'PM' : 'AM';
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')} $h:$m $period';
  }

  String _monthName(int m) {
    const months = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return months[m];
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'paid':
        return chateuPrimary;
      case 'pending_verification':
        return chateuAccent;
      case 'overdue':
        return const Color(0xFFB45309); // amber-700
      default:
        return const Color(0xFFDC2626);
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'pending_verification':
        return 'Pending';
      case 'overdue':
        return 'Overdue';
      default:
        return 'Unpaid';
    }
  }

  // ── GCash payment sheet ───────────────────────────────────────────────────

  void _showPaySheet(_Payment payment) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PaySheet(
        payment: payment,
        qrImageUrl: _qrImageUrl,
        onSubmitted: _loadData,
      ),
    );
  }

  // ── View All Bills sheet ──────────────────────────────────────────────────

  void _showAllBills() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (_, scrollController) => SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: AppSpacing.lg),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: chateuPrimary.withAlpha(20),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.receipt_long_rounded,
                          color: chateuPrimary, size: 18),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text("All Bills", style: AppText.titleMedium),
                  ],
                ),
                if (_advanceMonthsRemaining > 0) ...[
                  const SizedBox(height: AppSpacing.md),
                  AppNoticeBanner(
                    icon: Icons.event_available_rounded,
                    text:
                        'You have ₱${_advanceAmountRemaining.toStringAsFixed(2)} paid in advance '
                        '($_advanceMonthsRemaining month${_advanceMonthsRemaining > 1 ? 's' : ''} ahead).',
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                Expanded(
                  child: _payments.isEmpty
                      ? Center(
                          child: Text(
                            "No bills found.",
                            style: AppText.bodyMedium
                                .copyWith(color: Colors.grey.shade400),
                          ),
                        )
                      : ListView.builder(
                          controller: scrollController,
                          itemCount: _payments.length,
                          itemBuilder: (context, index) {
                            final p = _payments[index];
                            final color = _statusColor(p.status);
                            return Container(
                              margin:
                                  const EdgeInsets.only(bottom: AppSpacing.sm),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.md,
                                  vertical: AppSpacing.md),
                              decoration: BoxDecoration(
                                color: color.withAlpha(10),
                                borderRadius:
                                    BorderRadius.circular(AppRadius.sm),
                                border: Border.all(color: color.withAlpha(40)),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          "Due: ${_formatDate(p.dueDate)}",
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: AppText.bodyMedium.copyWith(
                                              fontWeight: FontWeight.w600),
                                        ),
                                        if (p.payerReferenceNo != null)
                                          Text(
                                            "Ref: ${p.payerReferenceNo}",
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: AppText.caption.copyWith(
                                                color: Colors.grey.shade500),
                                          ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: AppSpacing.sm),
                                  Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.end,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        "₱${p.amount.toStringAsFixed(2)}",
                                        style: AppText.titleMedium
                                            .copyWith(color: color),
                                      ),
                                      const SizedBox(height: 4),
                                      AppStatusBadge(
                                        label: _statusLabel(p.status),
                                        color: color,
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final screenW = MediaQuery.of(context).size.width;
    final hPad = screenW > 600 ? screenW * 0.08 : AppSpacing.lg;
    final unpaid = _latestUnpaid;

    return Scaffold(
      backgroundColor: chateuBackground,
      appBar: buildStandardAppBar(
        context: context,
        title: 'Payments',
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: chateuPrimary))
          : SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: EdgeInsets.symmetric(horizontal: hPad)
                  .copyWith(bottom: AppSpacing.xxxl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: AppSpacing.xl),

                  // ── Bill Summary Card ─────────────────────────────
                  _FadeSlide(
                    controller: _animController,
                    delay: 0.0,
                    child: Container(
                      width: double.infinity,
                      decoration: AppDecorations.primaryGradient(
                          radius: AppRadius.lg),
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.xl),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Account name + due date
                            Row(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        "Account Name",
                                        style: AppText.caption.copyWith(
                                          color:
                                              Colors.white.withAlpha(180),
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        _userName.isNotEmpty
                                            ? _userName
                                            : "Resident",
                                        style: AppText.titleMedium
                                            .copyWith(color: Colors.white),
                                      ),
                                    ],
                                  ),
                                ),
                                if (unpaid != null)
                                  Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        "Payment Due",
                                        style: AppText.caption.copyWith(
                                          color:
                                              Colors.white.withAlpha(180),
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        _formatDate(unpaid.dueDate),
                                        style: AppText.titleMedium
                                            .copyWith(color: Colors.white),
                                      ),
                                    ],
                                  ),
                              ],
                            ),

                            const SizedBox(height: AppSpacing.lg),
                            Divider(
                                color: Colors.white.withAlpha(40)),
                            const SizedBox(height: AppSpacing.md),

                            _BillRow(
                              label: "Monthly Fee",
                              value: unpaid != null
                                  ? "₱ ${unpaid.amount.toStringAsFixed(2)}"
                                  : "₱ 0.00",
                      
                              valueColor: Colors.white,
                            ),

                            const SizedBox(height: AppSpacing.md),
                            Divider(
                                color: Colors.white.withAlpha(40)),
                            const SizedBox(height: AppSpacing.md),

                            _BillRow(
                              label: "Total Amount Due",
                              value:
                                  "₱ ${_outstandingBalance.toStringAsFixed(2)}",
                              labelStyle: AppText.titleMedium
                                  .copyWith(color: Colors.white),
                              valueStyle: AppText.displayMedium
                                  .copyWith(color: Colors.white),
                            ),

                            if (_advanceMonthsRemaining > 0) ...[
                              const SizedBox(height: AppSpacing.md),
                              Divider(color: Colors.white.withAlpha(40)),
                              const SizedBox(height: AppSpacing.md),
                              _BillRow(
                                label:
                                    "Advance Paid ($_advanceMonthsRemaining mo. ahead)",
                                value:
                                    "₱ ${_advanceAmountRemaining.toStringAsFixed(2)}",
                                valueColor: Colors.greenAccent.shade100,
                              ),
                            ],

                            const SizedBox(height: AppSpacing.xl),

                            Row(children: [
                              if (unpaid != null && unpaid.canSubmitPayment) ...[
                                Expanded(
                                  child: ElevatedButton(
                                    onPressed: () => _showPaySheet(unpaid),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.white,
                                      foregroundColor: chateuPrimary,
                                      elevation: 0,
                                      shape: RoundedRectangleBorder(
                                        borderRadius:
                                            BorderRadius.circular(AppRadius.sm),
                                      ),
                                      padding: const EdgeInsets.symmetric(
                                          vertical: AppSpacing.md),
                                    ),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        const Icon(Icons.qr_code_2_rounded,
                                            size: 18),
                                        const SizedBox(width: AppSpacing.sm),
                                        Text("Pay via GCash",
                                            style: AppText.labelMedium
                                                .copyWith(color: chateuPrimary)),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.sm),
                              ],
                              // View Bill button
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: _showAllBills,
                                  style: OutlinedButton.styleFrom(
                                    side: const BorderSide(
                                        color: Colors.white54),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(
                                          AppRadius.sm),
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                        vertical: AppSpacing.md),
                                  ),
                                  child: Text(
                                    "View Bill",
                                    style:
                                        AppText.labelLarge,
                                  ),
                                ),
                              ),
                            ]),

                            const SizedBox(height: AppSpacing.sm),
                            SizedBox(
                              width: double.infinity,
                              child: TextButton.icon(
                                onPressed: _showAdvancePaySheet,
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                      vertical: AppSpacing.sm),
                                ),
                                icon: const Icon(Icons.event_available_rounded,
                                    size: 16, color: Colors.white),
                                label: Text("Pay in Advance",
                                    style: AppText.labelMedium
                                        .copyWith(color: Colors.white)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: AppSpacing.xxl + 4),

                  // ── Transaction History ───────────────────────────
                  _FadeSlide(
                    controller: _animController,
                    delay: 0.16,
                    child: const AppSectionHeader(
                        title: "Transaction History"),
                  ),

                  const SizedBox(height: AppSpacing.md),

                  if (_payments.isEmpty)
                    Center(
                      child: Padding(
                        padding:
                            const EdgeInsets.all(AppSpacing.xxl),
                        child: Column(
                          children: [
                            Icon(Icons.receipt_long_rounded,
                                size: 48,
                                color: Colors.grey.shade300),
                            const SizedBox(height: AppSpacing.md),
                            Text(
                              "No transactions yet",
                              style: AppText.bodyMedium.copyWith(
                                  color: Colors.grey.shade400),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    ..._payments.asMap().entries.map((e) {
                      final index = e.key;
                      final p = e.value;
                      final color = _statusColor(p.status);
                      return _FadeSlide(
                        controller: _animController,
                        delay: 0.2 + index * 0.05,
                        child: Container(
                          margin: const EdgeInsets.only(
                              bottom: AppSpacing.sm),
                          padding:
                              const EdgeInsets.all(AppSpacing.md),
                          decoration: AppDecorations.card,
                          child: Row(
                            children: [
                              // Status icon
                              Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: color.withAlpha(25),
                                  borderRadius: BorderRadius.circular(
                                      AppRadius.sm),
                                ),
                                child: Icon(
                                  p.isPaid
                                      ? Icons.check_circle_rounded
                                      : p.isPending
                                          ? Icons.hourglass_top_rounded
                                          : Icons.receipt_rounded,
                                  color: color,
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.md),

                              // Description
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      p.isPaid
                                          ? "Payment Success"
                                          : p.isPending
                                              ? "Payment Pending"
                                              : p.isOverdue
                                                  ? "Overdue Bill"
                                                  : "Monthly Due",
                                      style: AppText.bodyMedium
                                          .copyWith(
                                              fontWeight:
                                                  FontWeight.w700),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      p.isPaid && p.paidAt != null
                                          ? _formatDateTime(p.paidAt!)
                                          : "Due: ${_formatDate(p.dueDate)}",
                                      style: AppText.caption.copyWith(
                                          color: Colors.grey.shade500),
                                    ),
                                  ],
                                ),
                              ),

                              const SizedBox(width: AppSpacing.sm),

                              // Amount + badge
                              Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    "₱${p.amount.toStringAsFixed(2)}",
                                    style: AppText.titleMedium
                                        .copyWith(color: color),
                                  ),
                                  const SizedBox(height: AppSpacing.xs),
                                  AppStatusBadge(
                                    label: _statusLabel(p.status),
                                    color: color,
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}

// ── Bill Row ───────────────────────────────────────────────────────────────────

class _BillRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  final TextStyle? labelStyle;
  final TextStyle? valueStyle;

  const _BillRow({
    required this.label,
    required this.value,
    this.valueColor,
    this.labelStyle,
    this.valueStyle,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: labelStyle ??
              AppText.caption.copyWith(
                color: Colors.white.withAlpha(180),
              ),
        ),
        Text(
          value,
          style: valueStyle ??
              AppText.bodyMedium.copyWith(
                fontWeight: FontWeight.w600,
                color: valueColor ?? Colors.white,
              ),
        ),
      ],
    );
  }
}

// ── Animation helper ───────────────────────────────────────────────────────────

class _FadeSlide extends StatelessWidget {
  final AnimationController controller;
  final double delay;
  final Widget child;

  const _FadeSlide({
    required this.controller,
    required this.delay,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final fade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: controller,
        curve: Interval(delay, (delay + 0.4).clamp(0.0, 1.0),
            curve: Curves.easeOut),
      ),
    );
    final slide =
        Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
            .animate(
      CurvedAnimation(
        parent: controller,
        curve: Interval(delay, (delay + 0.4).clamp(0.0, 1.0),
            curve: Curves.easeOut),
      ),
    );
    return FadeTransition(
        opacity: fade,
        child: SlideTransition(position: slide, child: child));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GCash Pay Sheet — static QR + proof upload + mandatory reference number
// ─────────────────────────────────────────────────────────────────────────────

class _PaySheet extends StatefulWidget {
  final _Payment payment;
  final String? qrImageUrl;
  final VoidCallback onSubmitted;

  const _PaySheet(
      {required this.payment, this.qrImageUrl, required this.onSubmitted});

  @override
  State<_PaySheet> createState() => _PaySheetState();
}

class _PaySheetState extends State<_PaySheet> {
  final _supabase = Supabase.instance.client;
  final _picker = ImagePicker();
  final _referenceCtrl = TextEditingController();

  XFile? _newProofFile;
  Uint8List? _newProofBytes;
  bool _isSubmitting = false;

  bool get _hasExistingProof =>
      widget.payment.proofUrl != null && widget.payment.proofUrl!.isNotEmpty;
  bool get _hasNewProof => _newProofFile != null;

  @override
  void dispose() {
    _referenceCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickProof() async {
    final file = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (file == null) return;
    if (kIsWeb) {
      final bytes = await file.readAsBytes();
      setState(() {
        _newProofFile = file;
        _newProofBytes = bytes;
      });
    } else {
      setState(() => _newProofFile = file);
    }
  }

  Future<void> _submit() async {
    final reference = _referenceCtrl.text.trim();
    if (reference.isEmpty) {
      showAppSnack(context, 'Transaction Reference Number is required.',
          type: SnackType.error);
      return;
    }
    if (!_hasNewProof && !_hasExistingProof) {
      showAppSnack(context, 'Please upload your proof of payment.',
          type: SnackType.error);
      return;
    }

    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;

    setState(() => _isSubmitting = true);
    try {
      String? proofUrl = widget.payment.proofUrl;

      if (_hasNewProof) {
        final ext = kIsWeb
            ? 'jpg'
            : (_newProofFile!.path.contains('.')
                ? _newProofFile!.path.split('.').last
                : 'jpg');
        final path =
            '$userId/${widget.payment.id}/${DateTime.now().millisecondsSinceEpoch}.$ext';
        if (kIsWeb) {
          await _supabase.storage.from('payment-proofs').uploadBinary(
              path, _newProofBytes!,
              fileOptions: const FileOptions(upsert: true));
        } else {
          await _supabase.storage.from('payment-proofs').upload(
              path, File(_newProofFile!.path),
              fileOptions: const FileOptions(upsert: true));
        }
        proofUrl = _supabase.storage.from('payment-proofs').getPublicUrl(path);
      }

      await _supabase.from('payments').update({
        'status': 'pending_verification',
        'payer_reference_no': reference,
        'proof_url': proofUrl,
        'submitted_at': DateTime.now().toIso8601String(),
      }).eq('id', widget.payment.id);

      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onSubmitted();
      showAppSnack(context,
          'Payment submitted! Awaiting admin verification.',
          type: SnackType.success);
    } catch (e) {
      if (mounted) {
        showAppSnack(context, 'Failed to submit payment: $e',
            type: SnackType.error);
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (_, scrollController) => Container(
        decoration: AppDecorations.sheet,
        child: SingleChildScrollView(
          controller: scrollController,
          padding: EdgeInsets.only(
              left: AppSpacing.xl,
              right: AppSpacing.xl,
              top: AppSpacing.sm,
              bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.xxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              buildSheetHandle(),
              Text('Pay via GCash', style: AppText.titleLarge),
              const SizedBox(height: AppSpacing.xs),
              Text('Amount Due: ₱${widget.payment.amount.toStringAsFixed(2)}',
                  style: AppText.bodyMedium.copyWith(
                      color: chateuPrimary, fontWeight: FontWeight.w700)),
              const SizedBox(height: AppSpacing.lg),

              // ── GCash QR code (uploaded by the HOA admin) ────────────────
              Center(
                child: Container(
                  width: 220,
                  height: 220,
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: widget.qrImageUrl == null || widget.qrImageUrl!.isEmpty
                      ? _qrPlaceholder()
                      : Image.network(
                          widget.qrImageUrl!,
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => _qrPlaceholder(),
                        ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Center(
                child: Text('Scan with your GCash app to pay',
                    style:
                        AppText.caption.copyWith(color: Colors.grey.shade500)),
              ),

              const SizedBox(height: AppSpacing.xl),

              Text('Proof of Payment *',
                  style: AppText.labelMedium.copyWith(color: chateuText)),
              const SizedBox(height: AppSpacing.sm),
              GestureDetector(
                onTap: _pickProof,
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: chateuBackground,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    border: Border.all(
                        color: (_hasNewProof || _hasExistingProof)
                            ? chateuPrimary.withAlpha(80)
                            : Colors.black12),
                  ),
                  child: Row(children: [
                    Icon(
                      (_hasNewProof || _hasExistingProof)
                          ? Icons.check_circle_rounded
                          : Icons.upload_file_rounded,
                      size: 20,
                      color: (_hasNewProof || _hasExistingProof)
                          ? chateuPrimary
                          : Colors.black38,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        _hasNewProof
                            ? _newProofFile!.name
                            : _hasExistingProof
                                ? 'Proof already on file — tap to replace'
                                : 'Upload screenshot of payment confirmation',
                        style: AppText.caption.copyWith(
                            color: (_hasNewProof || _hasExistingProof)
                                ? chateuPrimary
                                : Colors.grey.shade500),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ]),
                ),
              ),

              const SizedBox(height: AppSpacing.lg),

              Text('Transaction Reference Number *',
                  style: AppText.labelMedium.copyWith(color: chateuText)),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: _referenceCtrl,
                style: const TextStyle(fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'e.g. 1234567890123',
                  hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                  prefixIcon: const Icon(Icons.confirmation_number_rounded,
                      size: 18, color: chateuPrimary),
                  filled: true,
                  fillColor: chateuBackground,
                  isDense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none),
                ),
              ),

              const SizedBox(height: AppSpacing.lg),

              AppNoticeBanner(
                icon: Icons.info_outline_rounded,
                text:
                    'Your payment will be marked "Pending" until an HOA admin verifies the reference number and proof of payment.',
              ),

              const SizedBox(height: AppSpacing.xl),

              AppPrimaryButton(
                label: 'Submit Payment',
                icon: Icons.check_circle_rounded,
                isLoading: _isSubmitting,
                onPressed: _isSubmitting ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _qrPlaceholder() => Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.qr_code_2_rounded, size: 96, color: Colors.grey.shade300),
          const SizedBox(height: AppSpacing.sm),
          Text('GCash QR not yet added',
              textAlign: TextAlign.center,
              style: AppText.caption.copyWith(color: Colors.grey.shade400)),
        ],
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Advance Pay Sheet — prepay up to 12 months ahead. Self-contained: creates
// its own payments row (tagged via line_items) rather than depending on
// whatever generates each month's regular bill.
// ─────────────────────────────────────────────────────────────────────────────

class _AdvancePaySheet extends StatefulWidget {
  final double monthlyDue;
  final String? qrImageUrl;
  final DateTime? coversFrom;
  final VoidCallback onSubmitted;

  const _AdvancePaySheet({
    required this.monthlyDue,
    this.qrImageUrl,
    this.coversFrom,
    required this.onSubmitted,
  });

  @override
  State<_AdvancePaySheet> createState() => _AdvancePaySheetState();
}

class _AdvancePaySheetState extends State<_AdvancePaySheet> {
  static const _maxMonths = 12;

  final _supabase = Supabase.instance.client;
  final _picker = ImagePicker();
  final _referenceCtrl = TextEditingController();
  int _months = 1;
  XFile? _proofFile;
  Uint8List? _proofBytes;
  bool _isSubmitting = false;

  double get _total => _months * widget.monthlyDue;

  DateTime get _coversUntil {
    final now = DateTime.now();
    final base = (widget.coversFrom != null && widget.coversFrom!.isAfter(now))
        ? widget.coversFrom!
        : now;
    return DateTime(base.year, base.month + _months, base.day);
  }

  @override
  void dispose() {
    _referenceCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickProof() async {
    final file = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (file == null) return;
    if (kIsWeb) {
      final bytes = await file.readAsBytes();
      setState(() {
        _proofFile = file;
        _proofBytes = bytes;
      });
    } else {
      setState(() => _proofFile = file);
    }
  }

  Future<void> _submit() async {
    final reference = _referenceCtrl.text.trim();
    if (reference.isEmpty) {
      showAppSnack(context, 'Transaction Reference Number is required.',
          type: SnackType.error);
      return;
    }
    if (_proofFile == null) {
      showAppSnack(context, 'Please upload your proof of payment.',
          type: SnackType.error);
      return;
    }

    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;

    setState(() => _isSubmitting = true);
    try {
      final ext = kIsWeb
          ? 'jpg'
          : (_proofFile!.path.contains('.')
              ? _proofFile!.path.split('.').last
              : 'jpg');
      final path =
          '$userId/advance/${DateTime.now().millisecondsSinceEpoch}.$ext';
      if (kIsWeb) {
        await _supabase.storage.from('payment-proofs').uploadBinary(
            path, _proofBytes!,
            fileOptions: const FileOptions(upsert: true));
      } else {
        await _supabase.storage.from('payment-proofs').upload(
            path, File(_proofFile!.path),
            fileOptions: const FileOptions(upsert: true));
      }
      final proofUrl = _supabase.storage.from('payment-proofs').getPublicUrl(path);

      await _supabase.from('payments').insert({
        'user_id': userId,
        'amount': _total,
        'due_date': _coversUntil.toIso8601String().split('T').first,
        'status': 'pending_verification',
        'payer_reference_no': reference,
        'proof_url': proofUrl,
        'submitted_at': DateTime.now().toIso8601String(),
        'line_items': [
          {'label': 'Advance Payment', 'months': _months},
        ],
      });

      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onSubmitted();
      showAppSnack(context,
          'Advance payment submitted! Awaiting admin verification.',
          type: SnackType.success);
    } catch (e) {
      if (mounted) {
        showAppSnack(context, 'Failed to submit advance payment: $e',
            type: SnackType.error);
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (_, scrollController) => Container(
        decoration: AppDecorations.sheet,
        child: SingleChildScrollView(
          controller: scrollController,
          padding: EdgeInsets.only(
              left: AppSpacing.xl,
              right: AppSpacing.xl,
              top: AppSpacing.sm,
              bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.xxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              buildSheetHandle(),
              Text('Pay in Advance', style: AppText.titleLarge),
              const SizedBox(height: AppSpacing.xs),
              Text('Prepay up to 12 months of your monthly due.',
                  style: AppText.bodyMedium.copyWith(color: Colors.grey.shade500)),

              const SizedBox(height: AppSpacing.lg),
              Text('Number of Months',
                  style: AppText.labelMedium.copyWith(color: chateuText)),
              const SizedBox(height: AppSpacing.sm),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                decoration: BoxDecoration(
                  color: chateuBackground,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Row(children: [
                  IconButton(
                    icon: const Icon(Icons.remove_circle_outline_rounded,
                        color: chateuPrimary),
                    onPressed:
                        _months > 1 ? () => setState(() => _months--) : null,
                  ),
                  Expanded(
                    child: Center(
                      child: Text('$_months month${_months > 1 ? 's' : ''}',
                          style: AppText.titleMedium
                              .copyWith(fontWeight: FontWeight.w700)),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline_rounded,
                        color: chateuPrimary),
                    onPressed: _months < _maxMonths
                        ? () => setState(() => _months++)
                        : null,
                  ),
                ]),
              ),
              const SizedBox(height: 4),
              Text('Covers through ${_coversUntil.month}/${_coversUntil.day}/${_coversUntil.year}',
                  style: AppText.caption.copyWith(color: Colors.grey.shade500)),

              const SizedBox(height: AppSpacing.lg),
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: chateuPrimary.withAlpha(12),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  border: Border.all(color: chateuPrimary.withAlpha(50)),
                ),
                child: Row(children: [
                  Text('Total Amount',
                      style: AppText.labelMedium.copyWith(color: chateuPrimary)),
                  const Spacer(),
                  Text('₱${_total.toStringAsFixed(2)}',
                      style: AppText.titleMedium.copyWith(color: chateuPrimary)),
                ]),
              ),

              const SizedBox(height: AppSpacing.xl),

              Center(
                child: Container(
                  width: 220,
                  height: 220,
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: widget.qrImageUrl == null || widget.qrImageUrl!.isEmpty
                      ? _qrPlaceholder()
                      : Image.network(
                          widget.qrImageUrl!,
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => _qrPlaceholder(),
                        ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Center(
                child: Text('Scan with your GCash app to pay ₱${_total.toStringAsFixed(2)}',
                    style:
                        AppText.caption.copyWith(color: Colors.grey.shade500)),
              ),

              const SizedBox(height: AppSpacing.xl),

              Text('Proof of Payment *',
                  style: AppText.labelMedium.copyWith(color: chateuText)),
              const SizedBox(height: AppSpacing.sm),
              GestureDetector(
                onTap: _pickProof,
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: chateuBackground,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    border: Border.all(
                        color: _proofFile != null
                            ? chateuPrimary.withAlpha(80)
                            : Colors.black12),
                  ),
                  child: Row(children: [
                    Icon(
                      _proofFile != null
                          ? Icons.check_circle_rounded
                          : Icons.upload_file_rounded,
                      size: 20,
                      color: _proofFile != null ? chateuPrimary : Colors.black38,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        _proofFile != null
                            ? _proofFile!.name
                            : 'Upload screenshot of payment confirmation',
                        style: AppText.caption.copyWith(
                            color: _proofFile != null
                                ? chateuPrimary
                                : Colors.grey.shade500),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ]),
                ),
              ),

              const SizedBox(height: AppSpacing.lg),

              Text('Transaction Reference Number *',
                  style: AppText.labelMedium.copyWith(color: chateuText)),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: _referenceCtrl,
                style: const TextStyle(fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'e.g. 1234567890123',
                  hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                  prefixIcon: const Icon(Icons.confirmation_number_rounded,
                      size: 18, color: chateuPrimary),
                  filled: true,
                  fillColor: chateuBackground,
                  isDense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none),
                ),
              ),

              const SizedBox(height: AppSpacing.lg),

              AppNoticeBanner(
                icon: Icons.info_outline_rounded,
                text:
                    'Your advance payment will be marked "Pending" until an HOA admin verifies it.',
              ),

              const SizedBox(height: AppSpacing.xl),

              AppPrimaryButton(
                label: 'Submit Advance Payment',
                icon: Icons.check_circle_rounded,
                isLoading: _isSubmitting,
                onPressed: _isSubmitting ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _qrPlaceholder() => Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.qr_code_2_rounded, size: 96, color: Colors.grey.shade300),
          const SizedBox(height: AppSpacing.sm),
          Text('GCash QR not yet added',
              textAlign: TextAlign.center,
              style: AppText.caption.copyWith(color: Colors.grey.shade400)),
        ],
      );
}