import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:printing/printing.dart';
import 'app_colors.dart';
import 'domain/format/format.dart';
import 'app_theme.dart';
import 'app_dialogs.dart';
import 'app_services.dart';
import 'audit_logger.dart';
import 'domain/dues/dues.dart';
import 'domain/resident/current_resident.dart';
import 'domain/uploads/uploads.dart';
import 'soa_page.dart';

// ── Page ───────────────────────────────────────────────────────────────────────

class PaymentPage extends StatefulWidget {
  const PaymentPage({super.key, this.resident, this.dues});

  /// Defaults to the app's [currentResident]; tests pass their own.
  final CurrentResident? resident;

  /// Defaults to the app's [dues]; tests pass their own.
  final Dues? dues;

  @override
  State<PaymentPage> createState() => _PaymentPageState();
}

class _PaymentPageState extends State<PaymentPage> {
  final _supabase = Supabase.instance.client;

  DuesLedger? _ledger;
  bool _isLoading = true;
  String _userName = '';
  String _fullAddress = '';

  List<Payment> get _payments => _ledger?.payments ?? const [];
  String? get _qrImageUrl => _ledger?.qrCodeUrl;
  double get _monthlyDue => _ledger?.monthlyDue ?? 150;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  Future<void> _loadData() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    try {
      final resident = await (widget.resident ?? currentResident).load();

      final ledger = await (widget.dues ?? dues).load();

      if (mounted) {
        setState(() {
          _userName = resident?.fullName ?? '';
          _fullAddress = resident?.lotAddress ?? '';
          _ledger = ledger;

          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ── Statement of Account ─────────────────────────────────────────────────

  Future<void> _downloadStatementOfAccount() async {
    final userId = _supabase.auth.currentUser?.id ?? '';
    final unpaidList = _ledger?.outstanding ?? const <Payment>[];
    final paidHistory = _ledger?.paidHistory ?? const <Payment>[];

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );

    // The loading dialog closes before sharing starts, so a sharePdf failure
    // must not pop again — that would close this page instead.
    var dialogOpen = true;
    try {
      final bytes = await generateSoaPdf(
        residentId: userId,
        residentName: _userName.isNotEmpty ? _userName : 'Resident',
        fullAddress: _fullAddress,
        unpaidList: unpaidList,
        paidHistory: paidHistory,
        monthlyDueAmount: _monthlyDue,
        qrCodeUrl: _qrImageUrl,
      );
      if (mounted) Navigator.of(context, rootNavigator: true).pop();
      dialogOpen = false;
      await Printing.sharePdf(
          bytes: bytes, filename: 'Statement-of-Account.pdf');
    } catch (e) {
      if (mounted) {
        if (dialogOpen) Navigator.of(context, rootNavigator: true).pop();
        showAppSnack(context, 'Could not generate Statement of Account: $e',
            type: SnackType.error);
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  DateTime? get _advanceCoversUntil => _ledger?.advanceCoversUntil;
  int get _advanceMonthsRemaining => _ledger?.advanceMonthsRemaining ?? 0;
  double get _advanceAmountRemaining => _ledger?.advanceAmountRemaining ?? 0;

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

  String _formatDateTime(DateTime d) =>
      '${dateKey(d)} ${time12(TimeOfDay.fromDateTime(d))}';

  Color _statusColor(PaymentState state) => switch (state) {
        PaymentState.paid => chateuPrimary,
        PaymentState.pendingVerification => chateuInfo,
        PaymentState.unconfirmedDues => chateuTextMuted,
        PaymentState.overdue => chateuWarning,
        PaymentState.unpaid => chateuError,
      };

  // ── GCash payment sheet ───────────────────────────────────────────────────

  void _showPaySheet(Payment payment) {
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
                buildSheetHandle(),
                Text("All Bills", style: AppText.titleLarge),
                if (_advanceMonthsRemaining > 0) ...[
                  const SizedBox(height: AppSpacing.md),
                  AppNoticeBanner(
                    icon: Icons.event_available_rounded,
                    text:
                        'You have ${peso(_advanceAmountRemaining)} paid in advance '
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
                                .copyWith(color: chateuTextMuted),
                          ),
                        )
                      : ListView.builder(
                          controller: scrollController,
                          itemCount: _payments.length,
                          itemBuilder: (context, index) {
                            final p = _payments[index];
                            final color = _statusColor(p.state);
                            return Container(
                              margin:
                                  const EdgeInsets.only(bottom: AppSpacing.sm),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.md,
                                  vertical: AppSpacing.md),
                              decoration: BoxDecoration(
                                color: chateuSurface,
                                borderRadius:
                                    BorderRadius.circular(AppRadius.sm),
                                border: Border.all(color: chateuBorder),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          "Due: ${shortDate(p.dueDate)}",
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
                                                color: chateuTextMuted),
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
                                        peso(p.amount),
                                        style: AppText.titleMedium,
                                      ),
                                      const SizedBox(height: 4),
                                      AppStatusBadge(
                                        label: p.state.label,
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

  Widget _buildSummary(Payment? unpaid) {
    final divider = const Padding(
      padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Divider(),
    );
    return Container(
      width: double.infinity,
      decoration: AppDecorations.card,
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _LabeledValue(
                  label: "Account Name",
                  value: _userName.isNotEmpty ? _userName : "Resident",
                ),
              ),
              if (unpaid != null)
                _LabeledValue(
                  label: "Payment Due",
                  value: shortDate(unpaid.dueDate),
                  end: true,
                ),
            ],
          ),
          divider,
          _BillRow(
            label: "Monthly Fee",
            value: unpaid != null
                ? peso(unpaid.amount)
                : peso(0),
          ),
          divider,
          _BillRow(
            label: "Total Amount Due",
            value: peso(_ledger?.balance ?? 0),
            labelStyle: AppText.titleMedium,
            valueStyle: AppText.displayMedium.copyWith(
                fontFeatures: const [FontFeature.tabularFigures()]),
          ),
          // Sent but not yet verified by an Admin: shown beside the
          // Balance, not inside it (CONTEXT.md).
          if ((_ledger?.pendingVerification ?? 0) > 0) ...[
            divider,
            _BillRow(
              label: "Pending verification",
              value: peso(_ledger!.pendingVerification),
              valueColor: chateuInfo,
            ),
          ],
          if (_advanceMonthsRemaining > 0) ...[
            divider,
            _BillRow(
              label: "Advance Paid ($_advanceMonthsRemaining mo. ahead)",
              value: peso(_advanceAmountRemaining),
              valueColor: chateuSuccess,
            ),
          ],
          const SizedBox(height: AppSpacing.xl),
          Row(children: [
            if (unpaid != null && unpaid.canSubmitProof) ...[
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _showPaySheet(unpaid),
                  icon: const Icon(Icons.qr_code_2_rounded, size: 18),
                  label: const Text("Pay via GCash"),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
            ],
            Expanded(
              child: OutlinedButton(
                onPressed: _showAllBills,
                child: const Text("View Bill"),
              ),
            ),
          ]),
          const SizedBox(height: AppSpacing.xs),
          Center(
            child: TextButton.icon(
              onPressed: _showAdvancePaySheet,
              icon: const Icon(Icons.event_available_rounded, size: 18),
              label: const Text("Pay in Advance"),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentRow(Payment p) {
    final color = _statusColor(p.state);
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: AppDecorations.card,
      child: Row(
        children: [
          Icon(
            switch (p.state) {
              PaymentState.paid => Icons.check_circle_rounded,
              PaymentState.pendingVerification ||
              PaymentState.unconfirmedDues =>
                Icons.hourglass_top_rounded,
              _ => Icons.receipt_rounded,
            },
            color: color,
            size: 22,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  switch (p.state) {
                    PaymentState.paid => "Payment Success",
                    PaymentState.pendingVerification => "Pending verification",
                    PaymentState.unconfirmedDues => "Unconfirmed dues",
                    PaymentState.overdue => "Overdue Bill",
                    PaymentState.unpaid => "Monthly Due",
                  },
                  style: AppText.bodyMedium
                      .copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  p.state == PaymentState.paid && p.paidAt != null
                      ? _formatDateTime(p.paidAt!)
                      : "Due: ${shortDate(p.dueDate)}",
                  style: AppText.caption,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(peso(p.amount),
                  style: AppText.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              AppStatusBadge(label: p.state.label, color: color),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final unpaid = _ledger?.nextDue;
    // Summary, spacing, header, then one row per payment (or the empty state).
    const headerCount = 3;

    return Scaffold(
      appBar: buildStandardAppBar(
        context: context,
        title: 'Payments',
        actions: [
          IconButton(
            icon: const Icon(Icons.description_outlined),
            tooltip: 'Statement of Account',
            onPressed: _isLoading ? null : _downloadStatementOfAccount,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: appListPadding(context,
                    top: AppSpacing.xl, bottom: AppSpacing.xxxl),
                itemCount:
                    headerCount + (_payments.isEmpty ? 1 : _payments.length),
                itemBuilder: (context, i) {
                  if (i == 0) return _buildSummary(unpaid);
                  if (i == 1) return const SizedBox(height: AppSpacing.xxl);
                  if (i == 2) {
                    return const Padding(
                      padding: EdgeInsets.only(bottom: AppSpacing.md),
                      child: AppSectionHeader(title: "Transaction History"),
                    );
                  }
                  if (_payments.isEmpty) {
                    return Padding(
                      padding: const EdgeInsets.all(AppSpacing.xxl),
                      child: Text(
                        "No transactions yet",
                        textAlign: TextAlign.center,
                        style: AppText.bodyMedium
                            .copyWith(color: chateuTextMuted),
                      ),
                    );
                  }
                  return _buildPaymentRow(_payments[i - headerCount]);
                },
              ),
            ),
    );
  }
}

// ── Labeled value / Bill Row ───────────────────────────────────────────────────

class _LabeledValue extends StatelessWidget {
  final String label;
  final String value;
  final bool end;

  const _LabeledValue(
      {required this.label, required this.value, this.end = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment:
          end ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        Text(label, style: AppText.caption),
        const SizedBox(height: 2),
        Text(value, style: AppText.titleMedium),
      ],
    );
  }
}

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
      children: [
        Expanded(
          child: Text(label,
              style: labelStyle ??
                  AppText.bodyMedium.copyWith(color: chateuTextMuted)),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          value,
          style: valueStyle ??
              AppText.bodyMedium.copyWith(
                fontWeight: FontWeight.w600,
                color: valueColor ?? chateuText,
              ),
        ),
      ],
    );
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// GCash Pay Sheet — static QR + proof upload + mandatory reference number
// ─────────────────────────────────────────────────────────────────────────────

class _PaySheet extends StatefulWidget {
  final Payment payment;
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
    if (file == null || !mounted) return;
    setState(() => _newProofFile = file);
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
        proofUrl = await uploads.store(
            Evidence.paymentProof(widget.payment.id), _newProofFile!);
      }

      await _supabase.from('payments').update({
        'status': 'pending_verification',
        'payer_reference_no': reference,
        'proof_url': proofUrl,
        'submitted_at': DateTime.now().toIso8601String(),
      }).eq('id', widget.payment.id);

      await logAudit(
        'SUBMIT_PAYMENT_PROOF',
        'Submitted proof of payment for ${peso(widget.payment.amount)} — reference #$reference.',
      );

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
              bottom: MediaQuery.of(context).viewInsets.bottom +
                  MediaQuery.paddingOf(context).bottom +
                  AppSpacing.xxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              buildSheetHandle(),
              Text('Pay via GCash', style: AppText.titleLarge),
              const SizedBox(height: AppSpacing.xs),
              Text('Amount Due: ${peso(widget.payment.amount)}',
                  style: AppText.bodyMedium.copyWith(
                      color: chateuPrimary, fontWeight: FontWeight.w700)),
              const SizedBox(height: AppSpacing.lg),

              // ── GCash QR code (uploaded by the HOA admin) ────────────────
              Center(
                child: Container(
                  width: 220,
                  height: 220,
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  // Always white: QR scanners need a light quiet zone.
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(color: chateuBorder),
                  ),
                  child: widget.qrImageUrl == null || widget.qrImageUrl!.isEmpty
                      ? _qrPlaceholder()
                      : Image.network(
                          widget.qrImageUrl!,
                          fit: BoxFit.contain,
                          cacheWidth: 660,
                          semanticLabel: 'GCash QR code',
                          errorBuilder: (_, __, ___) => _qrPlaceholder(),
                        ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Center(
                child: Text('Scan with your GCash app to pay',
                    style:
                        AppText.caption.copyWith(color: chateuTextMuted)),
              ),

              const SizedBox(height: AppSpacing.xl),

              Text('Proof of Payment *',
                  style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
              const SizedBox(height: AppSpacing.sm),
              AppUploadTile(
                onTap: _pickProof,
                hasFile: _hasNewProof || _hasExistingProof,
                label: _hasNewProof
                    ? _newProofFile!.name
                    : _hasExistingProof
                        ? 'Proof already on file — tap to replace'
                        : 'Upload screenshot of payment confirmation',
              ),

              const SizedBox(height: AppSpacing.lg),

              TextField(
                controller: _referenceCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Transaction Reference Number *',
                  hintText: 'e.g. 1234567890123',
                  prefixIcon:
                      Icon(Icons.confirmation_number_rounded, size: 18),
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
          const Icon(Icons.qr_code_2_rounded, size: 96, color: Colors.black26),
          const SizedBox(height: AppSpacing.sm),
          const Text('GCash QR not yet added',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Color(0xFF5B6B61))),
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
    if (file == null || !mounted) return;
    setState(() => _proofFile = file);
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
      final proofUrl =
          await uploads.store(const Evidence.advanceProof(), _proofFile!);

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

      await logAudit(
        'SUBMIT_ADVANCE_PAYMENT',
        'Submitted advance payment for ${peso(_total)} — covers $_months month(s), reference #$reference.',
      );

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
              bottom: MediaQuery.of(context).viewInsets.bottom +
                  MediaQuery.paddingOf(context).bottom +
                  AppSpacing.xxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              buildSheetHandle(),
              Text('Pay in Advance', style: AppText.titleLarge),
              const SizedBox(height: AppSpacing.xs),
              Text('Prepay up to 12 months of your monthly due.',
                  style: AppText.bodyMedium.copyWith(color: chateuTextMuted)),

              const SizedBox(height: AppSpacing.lg),
              Text('Number of Months',
                  style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
              const SizedBox(height: AppSpacing.sm),
              Container(
                padding: const EdgeInsets.all(AppSpacing.xs),
                decoration: BoxDecoration(
                  color: chateuSurfaceMuted,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Row(children: [
                  IconButton(
                    tooltip: 'Fewer months',
                    icon: Icon(Icons.remove_circle_outline_rounded,
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
                    tooltip: 'More months',
                    icon: Icon(Icons.add_circle_outline_rounded,
                        color: chateuPrimary),
                    onPressed: _months < _maxMonths
                        ? () => setState(() => _months++)
                        : null,
                  ),
                ]),
              ),
              const SizedBox(height: 4),
              Text('Covers through ${_coversUntil.month}/${_coversUntil.day}/${_coversUntil.year}',
                  style: AppText.caption.copyWith(color: chateuTextMuted)),

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
                  Text(peso(_total),
                      style: AppText.titleMedium.copyWith(color: chateuPrimary)),
                ]),
              ),

              const SizedBox(height: AppSpacing.xl),

              Center(
                child: Container(
                  width: 220,
                  height: 220,
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  // Always white: QR scanners need a light quiet zone.
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(color: chateuBorder),
                  ),
                  child: widget.qrImageUrl == null || widget.qrImageUrl!.isEmpty
                      ? _qrPlaceholder()
                      : Image.network(
                          widget.qrImageUrl!,
                          fit: BoxFit.contain,
                          cacheWidth: 660,
                          semanticLabel: 'GCash QR code',
                          errorBuilder: (_, __, ___) => _qrPlaceholder(),
                        ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Center(
                child: Text('Scan with your GCash app to pay ${peso(_total)}',
                    style:
                        AppText.caption.copyWith(color: chateuTextMuted)),
              ),

              const SizedBox(height: AppSpacing.xl),

              Text('Proof of Payment *',
                  style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
              const SizedBox(height: AppSpacing.sm),
              AppUploadTile(
                onTap: _pickProof,
                hasFile: _proofFile != null,
                label: _proofFile != null
                    ? _proofFile!.name
                    : 'Upload screenshot of payment confirmation',
              ),

              const SizedBox(height: AppSpacing.lg),

              TextField(
                controller: _referenceCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Transaction Reference Number *',
                  hintText: 'e.g. 1234567890123',
                  prefixIcon:
                      Icon(Icons.confirmation_number_rounded, size: 18),
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
          const Icon(Icons.qr_code_2_rounded, size: 96, color: Colors.black26),
          const SizedBox(height: AppSpacing.sm),
          const Text('GCash QR not yet added',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Color(0xFF5B6B61))),
        ],
      );
}
