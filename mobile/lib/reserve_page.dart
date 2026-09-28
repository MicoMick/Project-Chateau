import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb, Uint8List;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:panorama_viewer/panorama_viewer.dart';
import 'app_colors.dart';
import 'domain/format/format.dart';
import 'app_theme.dart';
import 'app_dialogs.dart';
import 'app_services.dart';
import 'audit_logger.dart';
import 'domain/reservations/reservations.dart';
// ─────────────────────────────────────────────────────────────────────────────
// ReservePage
// ─────────────────────────────────────────────────────────────────────────────

class ReservePage extends StatefulWidget {
  const ReservePage({super.key, this.reservations});

  /// Defaults to the app's [reservations]; tests pass their own.
  final Reservations? reservations;

  @override
  State<ReservePage> createState() => _ReservePageState();
}

class _ReservePageState extends State<ReservePage> {
  final _supabase = Supabase.instance.client;
  Reservations get _module => widget.reservations ?? reservations;

  final DateTime _today = DateTime(
    DateTime.now().year,
    DateTime.now().month,
    DateTime.now().day,
  );

  late DateTime _focusedDay;
  late DateTime _selectedDay;

  List<Facility> _facilities = [];
  List<Reservation> _reservations = [];
  bool _isLoading = true;
  String? _error;
  String? _qrImageUrl;

  List<Reservation> _myReservations = [];

  @override
  void initState() {
    super.initState();
    _focusedDay = _today;
    _selectedDay = _today;
    _loadData();
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final snapshot = await _module.load();
      if (!mounted) return;
      setState(() {
        _facilities = snapshot.facilities;
        _reservations = snapshot.upcoming;
        _myReservations = snapshot.mine;
        _qrImageUrl = snapshot.qrCodeUrl;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = e.toString();
      });
    }
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  Future<void> _cancelReservation(Reservation r) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Cancel Reservation',
      message:
          'Are you sure you want to cancel this reservation?\nThis cannot be undone.',
      confirmLabel: 'Cancel Reservation',
      cancelLabel: 'Keep',
      isDanger: true,
      icon: Icons.event_busy_rounded,
    );
    if (!confirmed) return;

    try {
      await _module.cancel(r);
      await logAudit('CANCEL_RESERVATION', 'Cancelled reservation for ${_facilityName(r.facilityId) ?? 'an amenity'}.');
      if (!mounted) return;
      await _loadData();
      if (mounted) _showSnack('Reservation cancelled.', isError: true);
    } catch (e) {
      if (mounted) _showSnack('Failed to cancel: $e', isError: true);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  void _showSnack(String msg, {bool isError = false}) {
    showAppSnack(context, msg,
        type: isError ? SnackType.error : SnackType.success);
  }

  List<Reservation> _reservationsForDay(DateTime day) => _reservations
      .where((r) =>
          r.date.year == day.year &&
          r.date.month == day.month &&
          r.date.day == day.day &&
          r.status != ReservationStatus.rejected &&
          r.status != ReservationStatus.cancelled)
      .toList();

  bool _hasReservation(DateTime day) => _reservationsForDay(day).isNotEmpty;

  List<Reservation> get _myBorrows =>
      _myReservations.where((r) => r.canReturn).toList();

  Color _statusColor(ReservationStatus s) => switch (s) {
        ReservationStatus.pending => chateuWarning,
        ReservationStatus.approved => chateuPrimary,
        ReservationStatus.approvedAndPaid => chateuSecondary,
        // Reported, awaiting an Admin's verification.
        ReservationStatus.returnPending => chateuInfo,
        ReservationStatus.completed => chateuPrimary,
        ReservationStatus.rejected => chateuError,
        ReservationStatus.cancelled => chateuTextMuted,
      };

  String _statusLabel(ReservationStatus s) => switch (s) {
        ReservationStatus.approvedAndPaid => 'Approved & Paid',
        ReservationStatus.returnPending =>
          'Return Pending — Awaiting Verification',
        _ => s.stored,
      };

  String? _facilityName(String id) {
    try {
      return _facilities.firstWhere((f) => f.id == id).name;
    } catch (_) {
      return null;
    }
  }

  void _showImage(Facility facility) {
    final url = facility.image360Url;
    if (url == null || url.isEmpty) {
      _showSnack('No image available for this facility.');
      return;
    }
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => _ImageViewerPage(
          facilityName: facility.name,
          imageUrl: url,
          isPanorama: facility.is360),
    ));
  }

  void _showBookSheet(Facility facility) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _BookSheet(
        facility: facility,
        selectedDate: _selectedDay,
        existingReservations: _reservationsForDay(_selectedDay)
            .where((r) => r.facilityId == facility.id)
            .toList(),
        qrImageUrl: _qrImageUrl,
        reservations: _module,
        onBooked: _loadData,
      ),
    );
  }

  // ── Return borrowed amenities ─────────────────────────────────────────────

  void _showReturnSheet(Reservation r) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ReturnSheet(
        reservation: r,
        facilityName: _facilityName(r.facilityId) ?? 'Amenity',
        reservations: _module,
        onReturned: _loadData,
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return _buildErrorState();

    final dayRes = _reservationsForDay(_selectedDay);
    final currentId = _supabase.auth.currentUser?.id ?? '';

    return RefreshIndicator(
      onRefresh: _loadData,
      child: SingleChildScrollView(
        padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
        physics: const AlwaysScrollableScrollPhysics(),
        child: AppContentWidth(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.xl, AppSpacing.lg, AppSpacing.xxxl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AppSectionHeader(title: "Reserve a Facility"),
                const SizedBox(height: AppSpacing.xs),
                Text("Pick a date and book your slot",
                    style:
                        AppText.bodyMedium.copyWith(color: chateuTextMuted)),
                const SizedBox(height: AppSpacing.lg),

                Container(
                  decoration: AppDecorations.card,
                  child: TableCalendar(
                    firstDay: _today,
                    lastDay: _today.add(const Duration(days: 365)),
                    focusedDay: _focusedDay,
                    availableGestures: AvailableGestures.horizontalSwipe,
                    selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
                    onDaySelected: (selected, focused) {
                      if (selected.isBefore(_today)) return;
                      setState(() {
                        _selectedDay = selected;
                        _focusedDay = focused;
                      });
                    },
                    eventLoader: (day) => _hasReservation(day) ? [1] : [],
                    headerStyle: HeaderStyle(
                      formatButtonVisible: false,
                      titleCentered: true,
                      titleTextStyle: AppText.titleMedium,
                      leftChevronIcon: Icon(Icons.chevron_left_rounded,
                          color: chateuPrimary,
                          semanticLabel: 'Previous month'),
                      rightChevronIcon: Icon(Icons.chevron_right_rounded,
                          color: chateuPrimary, semanticLabel: 'Next month'),
                    ),
                    daysOfWeekStyle: DaysOfWeekStyle(
                      weekdayStyle: AppText.caption
                          .copyWith(fontWeight: FontWeight.w600),
                      weekendStyle: AppText.caption
                          .copyWith(fontWeight: FontWeight.w600),
                    ),
                    calendarStyle: CalendarStyle(
                      defaultTextStyle: AppText.bodyMedium,
                      weekendTextStyle: AppText.bodyMedium,
                      disabledTextStyle: AppText.bodyMedium
                          .copyWith(color: chateuTextSubtle.withAlpha(120)),
                      outsideTextStyle:
                          AppText.bodyMedium.copyWith(color: chateuTextSubtle),
                      todayDecoration: BoxDecoration(
                          color: chateuPrimary.withAlpha(30),
                          shape: BoxShape.circle),
                      todayTextStyle: AppText.bodyMedium.copyWith(
                          color: chateuPrimary, fontWeight: FontWeight.w700),
                      selectedDecoration: const BoxDecoration(
                          color: chateuBrand, shape: BoxShape.circle),
                      selectedTextStyle: AppText.bodyMedium.copyWith(
                          color: chateuOnBrand, fontWeight: FontWeight.w700),
                      markerDecoration: BoxDecoration(
                          color: chateuSecondary, shape: BoxShape.circle),
                    ),
                  ),
                ),

                const SizedBox(height: AppSpacing.xxl),

                // ── Bookings on selected day ─────────────────────────────
                if (dayRes.isNotEmpty) ...[
                  AppSectionHeader(
                    title: isSameDay(_selectedDay, _today)
                        ? "Today's Bookings"
                        : "Bookings on ${_selectedDay.day}/${_selectedDay.month}/${_selectedDay.year}",
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  for (final r in dayRes)
                    _ReservationTile(
                      r: r,
                      facilityName: _facilityName(r.facilityId),
                      color: _statusColor(r.status),
                      isOwn: r.userId == currentId,
                      statusLabel: _statusLabel(r.status),
                      formatTime: time12,
                      onCancel: r.userId == currentId && r.canCancel
                          ? () => _cancelReservation(r)
                          : null,
                    ),
                  const SizedBox(height: AppSpacing.xl),
                ],

                // ── My Borrowed Amenities ────────────────────────────────
                if (_myBorrows.isNotEmpty) ...[
                  const AppSectionHeader(title: "My Borrowed Amenities"),
                  const SizedBox(height: AppSpacing.sm),
                  for (final r in _myBorrows)
                    _BorrowTile(
                      r: r,
                      facilityName: _facilityName(r.facilityId),
                      onReturn: () => _showReturnSheet(r),
                    ),
                  const SizedBox(height: AppSpacing.xl),
                ],

                // ── Available Facilities ─────────────────────────────────
                const AppSectionHeader(title: "Available Facilities"),
                const SizedBox(height: AppSpacing.md),
                if (_facilities.isEmpty)
                  Padding(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Center(
                      child: Text("No facilities found.",
                          style: AppText.bodyMedium
                              .copyWith(color: chateuTextMuted)),
                    ),
                  )
                else
                  for (final facility in _facilities)
                    Builder(builder: (context) {
                      final booked = dayRes
                          .where((r) => r.facilityId == facility.id)
                          .toList();
                      final isFull = facility.isQuantityBased
                          ? (facility.availableQuantity ?? 0) <= 0
                          : booked
                                  .where((r) => r.status.blocksSlot)
                                  .length >=
                              3;
                      return _FacilityCard(
                        facility: facility,
                        bookedCount: booked.length,
                        isFullyBooked: isFull,
                        onTap: isFull ? null : () => _showBookSheet(facility),
                        onImageTap: facility.image360Url?.isNotEmpty == true
                            ? () => _showImage(facility)
                            : null,
                      );
                    }),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
        child: Padding(
      padding: const EdgeInsets.all(AppSpacing.xxl),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.error_outline, color: chateuError, size: 48),
        const SizedBox(height: AppSpacing.md),
        Text('Failed to load facilities.\nPlease try again.',
            textAlign: TextAlign.center,
            style: AppText.bodyMedium.copyWith(color: chateuTextMuted)),
        const SizedBox(height: AppSpacing.lg),
        FilledButton.icon(
          onPressed: _loadData,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text("Retry"),
        ),
      ]),
    ));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reservation Tile (calendar day view)
// ─────────────────────────────────────────────────────────────────────────────

class _ReservationTile extends StatelessWidget {
  final Reservation r;
  final String? facilityName;
  final Color color;
  final bool isOwn;
  final String statusLabel;
  final String Function(TimeOfDay) formatTime;
  final VoidCallback? onCancel;

  const _ReservationTile({
    required this.r,
    required this.facilityName,
    required this.color,
    required this.isOwn,
    required this.statusLabel,
    required this.formatTime,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: onCancel != null ? 0 : AppSpacing.md,
          top: AppSpacing.sm,
          bottom: AppSpacing.sm),
      decoration: AppDecorations.card,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(facilityName ?? 'Unknown Facility',
                    style: AppText.bodyMedium
                        .copyWith(fontWeight: FontWeight.w600)),
                if (!isOwn)
                  Text('Reserved by another resident',
                      style: AppText.caption),
                const SizedBox(height: 6),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                        '${formatTime(r.startTime)} – ${formatTime(r.endTime)}',
                        style: AppText.caption),
                    AppStatusBadge(label: statusLabel, color: color),
                  ],
                ),
              ],
            ),
          ),
          if (onCancel != null)
            IconButton(
              tooltip: 'Cancel reservation',
              onPressed: onCancel,
              icon: Icon(Icons.close_rounded, color: chateuError),
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Borrowed amenity tile — awaiting the resident to report a return
// ─────────────────────────────────────────────────────────────────────────────

class _BorrowTile extends StatelessWidget {
  final Reservation r;
  final String? facilityName;
  final VoidCallback onReturn;

  const _BorrowTile({
    required this.r,
    required this.facilityName,
    required this.onReturn,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.md, AppSpacing.xs, AppSpacing.md),
      decoration: AppDecorations.card,
      child: Row(
        children: [
          Icon(Icons.inventory_2_outlined, color: chateuPrimary, size: 22),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(facilityName ?? 'Amenity',
                    style: AppText.bodyMedium
                        .copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(
                    'Qty: ${r.quantity} • Borrowed ${r.date.day}/${r.date.month}/${r.date.year}'
                    '${r.returnDate != null && !isSameDay(r.returnDate!, r.date) ? ' • Return by ${r.returnDate!.day}/${r.returnDate!.month}/${r.returnDate!.year}' : ''}',
                    style: AppText.caption),
              ],
            ),
          ),
          TextButton(onPressed: onReturn, child: const Text('Return')),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Viewer
// ─────────────────────────────────────────────────────────────────────────────

class _ImageViewerPage extends StatelessWidget {
  final String facilityName, imageUrl;
  final bool isPanorama;
  const _ImageViewerPage(
      {required this.facilityName,
      required this.imageUrl,
      required this.isPanorama});

  @override
  Widget build(BuildContext context) {
    Widget progress(ImageChunkEvent p) => Center(
        child: CircularProgressIndicator(
            value: p.expectedTotalBytes != null
                ? p.cumulativeBytesLoaded / p.expectedTotalBytes!
                : null));

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(isPanorama ? '$facilityName – 360° View' : facilityName,
            style: AppText.titleMedium.copyWith(color: Colors.white)),
        leading: const CloseButton(),
      ),
      body: Stack(children: [
        isPanorama
            ? PanoramaViewer(
                child: Image.network(imageUrl,
                    loadingBuilder: (_, child, p) =>
                        p == null ? child : progress(p),
                    errorBuilder: (_, __, ___) => const _ImageError()))
            : InteractiveViewer(
                minScale: 0.5,
                maxScale: 4.0,
                child: Center(
                    child: Image.network(imageUrl,
                        fit: BoxFit.contain,
                        semanticLabel: facilityName,
                        loadingBuilder: (_, child, p) =>
                            p == null ? child : progress(p),
                        errorBuilder: (_, __, ___) => const _ImageError()))),
        Positioned(
          bottom: MediaQuery.paddingOf(context).bottom + AppSpacing.xxl,
          left: 0,
          right: 0,
          child: Center(
              child: Container(
            padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
            decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(AppRadius.xxl)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(isPanorama ? Icons.swipe : Icons.pinch,
                  color: Colors.white70, size: 16),
              const SizedBox(width: AppSpacing.sm),
              Text(isPanorama ? 'Drag to look around' : 'Pinch to zoom',
                  style: AppText.caption.copyWith(color: Colors.white70)),
            ]),
          )),
        ),
      ]),
    );
  }
}

class _ImageError extends StatelessWidget {
  const _ImageError();
  @override
  Widget build(BuildContext context) => Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.broken_image_outlined,
            color: Colors.white54, size: 48),
        const SizedBox(height: AppSpacing.sm),
        Text('Could not load image',
            style: AppText.bodyMedium.copyWith(color: Colors.white70)),
      ]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Facility Card
// ─────────────────────────────────────────────────────────────────────────────

class _FacilityCard extends StatelessWidget {
  final Facility facility;
  final int bookedCount;
  final bool isFullyBooked;
  final VoidCallback? onTap, onImageTap;

  const _FacilityCard({
    required this.facility,
    required this.bookedCount,
    required this.isFullyBooked,
    this.onTap,
    this.onImageTap,
  });

  IconData get _icon {
    switch (facility.category.toLowerCase()) {
      case 'amenity facility':
        return Icons.sports_basketball_rounded;
      case 'amenity item':
        return Icons.chair_rounded;
      default:
        return Icons.place_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final muted = isFullyBooked;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Material(
        color: muted ? chateuSurfaceMuted : chateuSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: BorderSide(color: chateuBorder),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Icon(_icon,
                          color: muted ? chateuTextMuted : chateuPrimary,
                          size: 24),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          Text(facility.name,
                              style: AppText.titleMedium.copyWith(
                                  color:
                                      muted ? chateuTextMuted : chateuText)),
                          const SizedBox(height: 2),
                          Text(facility.description,
                              style: AppText.caption,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis),
                          const SizedBox(height: AppSpacing.sm),
                          AppStatusBadge(
                              label: facility.category,
                              color: muted ? chateuTextMuted : chateuPrimary),
                        ])),
                    if (onImageTap != null)
                      TextButton.icon(
                        onPressed: onImageTap,
                        icon: Icon(
                            facility.is360
                                ? Icons.view_in_ar_rounded
                                : Icons.image_rounded,
                            size: 18),
                        label: Text(facility.is360 ? '360°' : 'Photo'),
                      ),
                  ]),
                  if (facility.isQuantityBased ||
                      facility.capacity.isNotEmpty ||
                      facility.rate.isNotEmpty ||
                      facility.hours.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.md),
                    const Divider(height: 1),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.md,
                      runSpacing: AppSpacing.xs,
                      children: [
                        if (facility.isQuantityBased)
                          _Chip(
                              icon: Icons.inventory_2_outlined,
                              label:
                                  '${facility.availableQuantity ?? 0} of ${facility.totalQuantity ?? 0} available'),
                        if (facility.capacity.isNotEmpty)
                          _Chip(
                              icon: Icons.people_outline_rounded,
                              label: facility.capacity),
                        if (facility.rate.isNotEmpty)
                          _Chip(
                              icon: Icons.payments_outlined,
                              label: facility.rate),
                        if (facility.hours.isNotEmpty)
                          _Chip(
                              icon: Icons.schedule_rounded,
                              label: facility.hours),
                      ],
                    ),
                  ],
                  if (isFullyBooked) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                        facility.isQuantityBased
                            ? 'None currently available'
                            : 'Fully booked for this day',
                        style: AppText.caption.copyWith(
                            color: chateuError, fontWeight: FontWeight.w600)),
                  ],
                ]),
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _Chip({required this.icon, required this.label});
  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 14, color: chateuTextMuted),
      const SizedBox(width: 4),
      Flexible(child: Text(label, style: AppText.caption)),
    ]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Book Sheet — simple form only (no payment option)
// ─────────────────────────────────────────────────────────────────────────────

class _BookSheet extends StatefulWidget {
  final Facility facility;
  final DateTime selectedDate;
  final List<Reservation> existingReservations;
  final String? qrImageUrl;
  final Reservations reservations;
  final VoidCallback onBooked;

  const _BookSheet({
    required this.facility,
    required this.selectedDate,
    required this.existingReservations,
    this.qrImageUrl,
    required this.reservations,
    required this.onBooked,
  });

  @override
  State<_BookSheet> createState() => _BookSheetState();
}

class _BookSheetState extends State<_BookSheet> {
  final _supabase = Supabase.instance.client;
  final _picker = ImagePicker();
  final _referenceCtrl = TextEditingController();
  TimeOfDay _startTime = const TimeOfDay(hour: 8, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 9, minute: 0);
  bool _isSubmitting = false;
  int _quantity = 1;

  // Expected return date for borrowed (quantity-based) items — defaults to
  // the booking day itself; residents can push it out for multi-day events.
  late DateTime _returnDate;

  XFile? _proofFile;
  Uint8List? _proofBytes;

  XFile? _conditionPhotoFile;
  Uint8List? _conditionPhotoBytes;

  int get _maxQuantity => widget.facility.availableQuantity ?? 0;

  @override
  void initState() {
    super.initState();
    _returnDate = widget.selectedDate;
  }

  @override
  void dispose() {
    _referenceCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickProof() async {
    final file = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (file == null || !mounted) return;
    if (kIsWeb) {
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      setState(() {
        _proofFile = file;
        _proofBytes = bytes;
      });
    } else {
      setState(() => _proofFile = file);
    }
  }

  Future<void> _pickConditionPhoto() async {
    final file = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (file == null || !mounted) return;
    if (kIsWeb) {
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      setState(() {
        _conditionPhotoFile = file;
        _conditionPhotoBytes = bytes;
      });
    } else {
      setState(() => _conditionPhotoFile = file);
    }
  }

  // The booking rules (clashes, pick-up/return times, quantity, court fee)
  // live in the Reservations module; the sheet only shows the result.
  BookingRequest get _request => BookingRequest(
        facility: widget.facility,
        date: widget.selectedDate,
        start: _startTime,
        end: _endTime,
        quantity: _quantity,
        returnDate: _returnDate,
      );

  BookingCheck get _check =>
      widget.reservations.check(_request, existing: widget.existingReservations);

  String? get conflictReason => _check.problem;
  bool get _hasConflict => conflictReason != null;
  double? get _courtFee => _check.fee;

  int get _durationMinutes {
    final s = _startTime.hour * 60 + _startTime.minute;
    final e = _endTime.hour * 60 + _endTime.minute;
    return e > s ? e - s : 0;
  }

  Future<void> _submit() async {
    final fee = _courtFee;
    final reference = _referenceCtrl.text.trim();

    if (fee != null) {
      if (reference.isEmpty) {
        showAppSnack(context, 'Transaction Reference Number is required.',
            type: SnackType.error);
        return;
      }
      if (_proofFile == null) {
        showAppSnack(context, 'Please upload your GCash proof of payment.',
            type: SnackType.error);
        return;
      }
    }

    if (widget.facility.isQuantityBased) {
      if (_conditionPhotoFile == null) {
        showAppSnack(context,
            'Please attach a photo showing the item\'s current condition.',
            type: SnackType.error);
        return;
      }
    }

    setState(() => _isSubmitting = true);
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) throw Exception('Not authenticated');

      String? proofUrl;
      if (fee != null && _proofFile != null) {
        final ext = kIsWeb
            ? 'jpg'
            : (_proofFile!.path.contains('.')
                ? _proofFile!.path.split('.').last
                : 'jpg');
        final path =
            '$userId/reservations/${DateTime.now().millisecondsSinceEpoch}.$ext';
        if (kIsWeb) {
          await _supabase.storage.from('payment-proofs').uploadBinary(
              path, _proofBytes!,
              fileOptions: const FileOptions(upsert: true));
        } else {
          await _supabase.storage.from('payment-proofs').upload(
              path, File(_proofFile!.path),
              fileOptions: const FileOptions(upsert: true));
        }
        proofUrl = _supabase.storage.from('payment-proofs').getPublicUrl(path);
      }

      String? conditionPhotoUrl;
      if (widget.facility.isQuantityBased && _conditionPhotoFile != null) {
        final ext = kIsWeb
            ? 'jpg'
            : (_conditionPhotoFile!.path.contains('.')
                ? _conditionPhotoFile!.path.split('.').last
                : 'jpg');
        final path =
            '$userId/reservations/${DateTime.now().millisecondsSinceEpoch}.$ext';
        if (kIsWeb) {
          await _supabase.storage.from('borrow-condition-photos').uploadBinary(
              path, _conditionPhotoBytes!,
              fileOptions: const FileOptions(upsert: true));
        } else {
          await _supabase.storage.from('borrow-condition-photos').upload(
              path, File(_conditionPhotoFile!.path),
              fileOptions: const FileOptions(upsert: true));
        }
        conditionPhotoUrl =
            _supabase.storage.from('borrow-condition-photos').getPublicUrl(path);
      }

      await widget.reservations.book(
        _request,
        fee: fee,
        reference: fee != null ? reference : null,
        proofUrl: proofUrl,
        conditionPhotoUrl: conditionPhotoUrl,
      );

      await logAudit(
        'NEW_RESERVATION',
        'Reserved ${widget.facility.name} for ${widget.selectedDate.toIso8601String().split('T').first}'
        '${widget.facility.isQuantityBased ? ' — $_quantity unit(s)' : ''}.',
      );

      if (mounted) {
        Navigator.of(context).pop();
        widget.onBooked();
        showAppSnack(
            context,
            fee != null
                ? 'Reservation submitted! GCash payment of ${peso(fee)} is awaiting verification.'
                : 'Reservation submitted! Awaiting admin approval.',
            type: SnackType.success);
      }
    } catch (e) {
      if (mounted) {
        showAppSnack(context, 'Failed to submit: $e', type: SnackType.error);
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final approvedSlots = widget.existingReservations
        .where((r) => r.status.blocksSlot)
        .toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
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
              bottom:
                  MediaQuery.of(context).viewInsets.bottom +
                  MediaQuery.paddingOf(context).bottom +
                  AppSpacing.xxl),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: AppSpacing.sm),
            buildSheetHandle(),

            Text(widget.facility.name, style: AppText.titleLarge),
            const SizedBox(height: AppSpacing.xs),
            Text(widget.facility.description,
                style:
                    AppText.bodyMedium.copyWith(color: chateuTextMuted)),

            const SizedBox(height: AppSpacing.lg),

            // Info chips
            if (widget.facility.capacity.isNotEmpty ||
                widget.facility.rate.isNotEmpty ||
                widget.facility.hours.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                decoration: AppDecorations.muted,
                child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      if (widget.facility.capacity.isNotEmpty)
                        AppInfoChip(
                            icon: Icons.people_outline_rounded,
                            label: "Capacity",
                            value: widget.facility.capacity),
                      if (widget.facility.rate.isNotEmpty)
                        AppInfoChip(
                            icon: Icons.attach_money_rounded,
                            label: "Rate",
                            value: widget.facility.rate),
                      if (widget.facility.hours.isNotEmpty)
                        AppInfoChip(
                            icon: Icons.schedule_rounded,
                            label: "Hours",
                            value: widget.facility.hours),
                    ]),
              ),

            const SizedBox(height: AppSpacing.lg),

            // Date display
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                  color: chateuPrimary.withAlpha(10),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  border: Border.all(color: chateuPrimary.withAlpha(30))),
              child: Row(children: [
                Icon(Icons.calendar_today_rounded,
                    size: 16, color: chateuPrimary),
                const SizedBox(width: AppSpacing.sm),
                Text(
                    '${widget.selectedDate.day}/${widget.selectedDate.month}/${widget.selectedDate.year}',
                    style: AppText.labelMedium.copyWith(color: chateuPrimary)),
              ]),
            ),

            if (widget.facility.isQuantityBased) ...[
              const SizedBox(height: AppSpacing.lg),
              Text("How Many Do You Need?",
                  style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
              const SizedBox(height: AppSpacing.sm),
              Container(
                padding: const EdgeInsets.all(AppSpacing.xs),
                decoration: AppDecorations.muted,
                child: Row(children: [
                  IconButton(
                    tooltip: 'Fewer',
                    icon: Icon(Icons.remove_circle_outline_rounded,
                        color: chateuPrimary),
                    onPressed: _quantity > 1
                        ? () => setState(() => _quantity--)
                        : null,
                  ),
                  Expanded(
                    child: Center(
                      child: Text('$_quantity',
                          style: AppText.titleMedium
                              .copyWith(fontWeight: FontWeight.w700)),
                    ),
                  ),
                  IconButton(
                    tooltip: 'More',
                    icon: Icon(Icons.add_circle_outline_rounded,
                        color: chateuPrimary),
                    onPressed: _quantity < _maxQuantity
                        ? () => setState(() => _quantity++)
                        : null,
                  ),
                ]),
              ),
              const SizedBox(height: 4),
              Text(
                  _maxQuantity > 0
                      ? '$_maxQuantity of ${widget.facility.totalQuantity ?? 0} currently available'
                      : 'None currently available',
                  style: AppText.caption.copyWith(
                      color: _maxQuantity > 0
                          ? chateuTextMuted
                          : chateuError)),

              const SizedBox(height: AppSpacing.lg),
              Text('Item Condition Photo *',
                  style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
              const SizedBox(height: 4),
              Text(
                'A photo of the item as you\'re receiving it — this protects '
                'you if there\'s ever a dispute about its condition on return.',
                style: AppText.caption.copyWith(color: chateuTextMuted),
              ),
              const SizedBox(height: AppSpacing.sm),
              AppUploadTile(
                onTap: _pickConditionPhoto,
                hasFile: _conditionPhotoFile != null,
                label: _conditionPhotoFile != null
                    ? _conditionPhotoFile!.name
                    : 'Upload a photo of the item\'s condition',
              ),

              const SizedBox(height: AppSpacing.lg),
              Text("When Will You Return It?",
                  style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
              const SizedBox(height: 4),
              Text(
                'Borrowing for a multi-day event? Push the return date out.',
                style: AppText.caption.copyWith(color: chateuTextMuted),
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(children: [
                Expanded(
                  child: _DateOptionChip(
                    label: 'Same Day',
                    selected: isSameDay(_returnDate, widget.selectedDate),
                    onTap: () =>
                        setState(() => _returnDate = widget.selectedDate),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: _DateOptionChip(
                    label: 'Tomorrow',
                    selected: isSameDay(_returnDate,
                        widget.selectedDate.add(const Duration(days: 1))),
                    onTap: () => setState(() => _returnDate =
                        widget.selectedDate.add(const Duration(days: 1))),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: _DateOptionChip(
                    label: 'Choose Date',
                    selected: _returnDate.isAfter(
                        widget.selectedDate.add(const Duration(days: 1))),
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _returnDate.isAfter(widget.selectedDate)
                            ? _returnDate
                            : widget.selectedDate
                                .add(const Duration(days: 2)),
                        firstDate: widget.selectedDate,
                        lastDate:
                            widget.selectedDate.add(const Duration(days: 30)),
                      );
                      if (picked != null && mounted) {
                        setState(() => _returnDate = picked);
                      }
                    },
                  ),
                ),
              ]),
              if (!isSameDay(_returnDate, widget.selectedDate)) ...[
                const SizedBox(height: 4),
                Text(
                    'Returning on ${_returnDate.month}/${_returnDate.day}/${_returnDate.year}',
                    style: AppText.caption.copyWith(color: chateuPrimary)),
              ],
            ],

            const SizedBox(height: AppSpacing.lg),

            Text("Select Time",
                style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
            const SizedBox(height: AppSpacing.sm),

            Row(children: [
              Expanded(
                  child: _TimePicker(
                      label: widget.facility.isQuantityBased
                          ? "Pick-up Time"
                          : "Start Time",
                      time: _startTime,
                      onTap: () async {
                        final t = await showTimePicker(
                            context: context,
                            initialTime: _startTime,);
                        if (t != null && mounted) setState(() => _startTime = t);
                      })),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                  child: _TimePicker(
                      label: widget.facility.isQuantityBased
                          ? "Return Time"
                          : "End Time",
                      time: _endTime,
                      onTap: () async {
                        final t = await showTimePicker(
                            context: context,
                            initialTime: _endTime,);
                        if (t != null && mounted) setState(() => _endTime = t);
                      })),
            ]),

            if (_hasConflict) ...[
              const SizedBox(height: AppSpacing.sm),
              AppNoticeBanner(
                  text: conflictReason ?? 'Please choose a different slot.',
                  icon: Icons.warning_amber_rounded,
                  color: chateuError),
            ],

            // Approved taken slots
            if (approvedSlots.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.lg),
              Text("Already booked on this day",
                  style: AppText.labelMedium
                      .copyWith(color: chateuTextMuted)),
              const SizedBox(height: AppSpacing.sm),
              ...approvedSlots.map((r) => Container(
                    margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                    decoration: BoxDecoration(
                        color: chateuSurfaceMuted,
                        borderRadius: BorderRadius.circular(AppRadius.xs)),
                    child: Row(children: [
                      Icon(Icons.lock_clock_rounded,
                          size: 14, color: chateuPrimary),
                      const SizedBox(width: AppSpacing.sm),
                      Text('${time12(r.startTime)} – ${time12(r.endTime)}',
                          style: AppText.caption
                              .copyWith(color: chateuTextMuted)),
                      const Spacer(),
                      Text('Approved — Taken',
                          style: AppText.caption.copyWith(
                              fontWeight: FontWeight.w700,
                              color: chateuPrimary)),
                    ]),
                  )),
            ],

            const SizedBox(height: AppSpacing.xl),

            // Court fee breakdown
            if (_courtFee != null) ...[
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                    color: chateuPrimary.withAlpha(12),
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    border: Border.all(color: chateuPrimary.withAlpha(50))),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Icon(Icons.payments_rounded,
                        color: chateuPrimary, size: 16),
                    const SizedBox(width: AppSpacing.sm),
                    Text('Court Fee',
                        style: AppText.labelMedium.copyWith(color: chateuPrimary)),
                    const Spacer(),
                    Text(peso(_courtFee!),
                        style: AppText.titleMedium.copyWith(color: chateuPrimary)),
                  ]),
                  const SizedBox(height: 4),
                  Text(
                    '₱150 for the first hour, +₱50 for each additional hour '
                    '(${(_durationMinutes / 60).ceil()} hr${(_durationMinutes / 60).ceil() > 1 ? 's' : ''} booked)',
                    style: AppText.caption.copyWith(color: chateuTextMuted),
                  ),
                ]),
              ),
              const SizedBox(height: AppSpacing.md),
            ],

            // ── GCash QR payment (facilities with a fee, e.g. the court) ──────
            if (_courtFee != null) ...[
              Text('Pay via GCash',
                  style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
              const SizedBox(height: AppSpacing.sm),

              Center(
                child: Container(
                  width: 200,
                  height: 200,
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
                          cacheWidth: 600,
                          semanticLabel: 'GCash QR code',
                          errorBuilder: (_, __, ___) => _qrPlaceholder(),
                        ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Center(
                child: Text('Scan with your GCash app to pay ${peso(_courtFee!)}',
                    style:
                        AppText.caption.copyWith(color: chateuTextMuted)),
              ),

              const SizedBox(height: AppSpacing.lg),

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
                    'Your reservation and GCash payment will be reviewed by the HOA admin. You\'ll be notified once both are verified.',
              ),
            ] else
              AppNoticeBanner(
                icon: Icons.info_outline_rounded,
                text: 'Your reservation will be reviewed by the HOA admin before it is approved.',
              ),

            const SizedBox(height: AppSpacing.xl),

            AppPrimaryButton(
              label: "Submit Reservation",
              isLoading: _isSubmitting,
              onPressed: (_hasConflict || _isSubmitting) ? null : _submit,
            ),
          ]),
        ),
      ),
    );
  }

  Widget _qrPlaceholder() => Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.qr_code_2_rounded, size: 88, color: Colors.black26),
          const SizedBox(height: AppSpacing.sm),
          const Text('GCash QR not yet added',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Color(0xFF5B6B61))),
        ],
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Return Borrowed Amenities sheet
// ─────────────────────────────────────────────────────────────────────────────

class _ReturnSheet extends StatefulWidget {
  final Reservation reservation;
  final String facilityName;
  final Reservations reservations;
  final VoidCallback onReturned;

  const _ReturnSheet({
    required this.reservation,
    required this.facilityName,
    required this.reservations,
    required this.onReturned,
  });

  @override
  State<_ReturnSheet> createState() => _ReturnSheetState();
}

class _ReturnSheetState extends State<_ReturnSheet> {
  final _supabase = Supabase.instance.client;
  final _picker = ImagePicker();
  final _notesCtrl = TextEditingController();
  String _condition = 'Good';
  int _missingQty = 0;
  bool _isSubmitting = false;

  XFile? _photoFile;
  Uint8List? _photoBytes;

  int get _borrowedQty => widget.reservation.quantity ?? 0;

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final file = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (file == null || !mounted) return;
    if (kIsWeb) {
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      setState(() {
        _photoFile = file;
        _photoBytes = bytes;
      });
    } else {
      setState(() => _photoFile = file);
    }
  }

  Future<void> _submit() async {
    if (_photoFile == null) {
      showAppSnack(context,
          'Please attach a photo showing the item\'s condition on return.',
          type: SnackType.error);
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) throw Exception('Not authenticated');

      final ext = kIsWeb
          ? 'jpg'
          : (_photoFile!.path.contains('.')
              ? _photoFile!.path.split('.').last
              : 'jpg');
      final path =
          '$userId/reservations/return-${DateTime.now().millisecondsSinceEpoch}.$ext';
      if (kIsWeb) {
        await _supabase.storage.from('borrow-condition-photos').uploadBinary(
            path, _photoBytes!,
            fileOptions: const FileOptions(upsert: true));
      } else {
        await _supabase.storage.from('borrow-condition-photos').upload(
            path, File(_photoFile!.path),
            fileOptions: const FileOptions(upsert: true));
      }
      final photoUrl =
          _supabase.storage.from('borrow-condition-photos').getPublicUrl(path);

      // Not 'Completed' yet — an HOA admin still has to verify this return
      // (confirm condition, restock the item) before it's actually done.
      await widget.reservations.reportReturn(widget.reservation.id, {
        'returned_at': DateTime.now().toIso8601String(),
        'return_condition': _condition,
        'return_missing_qty': _missingQty,
        'return_notes': _notesCtrl.text.trim().isEmpty
            ? null
            : _notesCtrl.text.trim(),
        'return_condition_photo_url': photoUrl,
      });

      await logAudit(
        'RETURN_BORROWED_ITEM',
        'Submitted return for ${widget.facilityName} — condition: $_condition${_missingQty > 0 ? ', $_missingQty missing/damaged unit(s)' : ''}.',
      );

      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onReturned();
      showAppSnack(context,
          'Return submitted — awaiting admin verification.',
          type: SnackType.success);
    } catch (e) {
      if (mounted) {
        showAppSnack(context, 'Failed to submit return: $e',
            type: SnackType.error);
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      minChildSize: 0.4,
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
              Text('Return Borrowed Amenities', style: AppText.titleLarge),
              const SizedBox(height: AppSpacing.xs),
              Text('${widget.facilityName} • Borrowed qty: $_borrowedQty',
                  style: AppText.bodyMedium.copyWith(color: chateuTextMuted)),

              const SizedBox(height: AppSpacing.lg),
              Text('Condition',
                  style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
              const SizedBox(height: AppSpacing.sm),
              Row(children: [
                Expanded(
                  child: _ConditionChip(
                    label: 'Good',
                    icon: Icons.check_circle_outline_rounded,
                    isSelected: _condition == 'Good',
                    onTap: () => setState(() => _condition = 'Good'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: _ConditionChip(
                    label: 'Damaged',
                    icon: Icons.warning_amber_rounded,
                    isSelected: _condition == 'Damaged',
                    onTap: () => setState(() => _condition = 'Damaged'),
                  ),
                ),
              ]),

              const SizedBox(height: AppSpacing.lg),
              Text('Missing Quantity',
                  style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
              const SizedBox(height: AppSpacing.sm),
              Container(
                padding: const EdgeInsets.all(AppSpacing.xs),
                decoration: AppDecorations.muted,
                child: Row(children: [
                  IconButton(
                    tooltip: 'Fewer missing',
                    icon: Icon(Icons.remove_circle_outline_rounded,
                        color: chateuPrimary),
                    onPressed: _missingQty > 0
                        ? () => setState(() => _missingQty--)
                        : null,
                  ),
                  Expanded(
                    child: Center(
                      child: Text('$_missingQty of $_borrowedQty',
                          style: AppText.titleMedium
                              .copyWith(fontWeight: FontWeight.w700)),
                    ),
                  ),
                  IconButton(
                    tooltip: 'More missing',
                    icon: Icon(Icons.add_circle_outline_rounded,
                        color: chateuPrimary),
                    onPressed: _missingQty < _borrowedQty
                        ? () => setState(() => _missingQty++)
                        : null,
                  ),
                ]),
              ),

              const SizedBox(height: AppSpacing.lg),
              Text('Condition Photo *',
                  style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
              const SizedBox(height: 4),
              Text(
                'A photo of the item as you\'re returning it.',
                style: AppText.caption.copyWith(color: chateuTextMuted),
              ),
              const SizedBox(height: AppSpacing.sm),
              AppUploadTile(
                onTap: _pickPhoto,
                hasFile: _photoFile != null,
                label: _photoFile != null
                    ? _photoFile!.name
                    : 'Upload a photo of the item\'s condition',
              ),

              const SizedBox(height: AppSpacing.lg),
              TextField(
                controller: _notesCtrl,
                minLines: 3,
                maxLines: 5,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Notes (optional)',
                  hintText: 'e.g. one chair leg is bent',
                  alignLabelWithHint: true,
                ),
              ),

              const SizedBox(height: AppSpacing.lg),
              AppNoticeBanner(
                icon: Icons.info_outline_rounded,
                text:
                    'An HOA admin will verify this return before it\'s marked complete.',
              ),

              const SizedBox(height: AppSpacing.xl),
              AppPrimaryButton(
                label: 'Submit Return',
                isLoading: _isSubmitting,
                onPressed: _isSubmitting ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConditionChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _ConditionChip({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = label == 'Damaged' ? chateuError : chateuPrimary;
    return ChoiceChip(
      avatar: Icon(icon, size: 18, color: isSelected ? color : null),
      label: SizedBox(width: double.infinity, child: Text(label)),
      selected: isSelected,
      showCheckmark: false,
      selectedColor: color.withAlpha(30),
      onSelected: (_) => onTap(),
    );
  }
}

class _DateOptionChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _DateOptionChip(
      {required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) => ChoiceChip(
        label: SizedBox(
            width: double.infinity,
            child: Text(label, textAlign: TextAlign.center)),
        selected: selected,
        showCheckmark: false,
        onSelected: (_) => onTap(),
      );
}

class _TimePicker extends StatelessWidget {
  final String label;
  final TimeOfDay time;
  final VoidCallback onTap;
  const _TimePicker(
      {required this.label, required this.time, required this.onTap});


  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        child: InputDecorator(
          decoration: InputDecoration(
            labelText: label,
            prefixIcon: const Icon(Icons.access_time_rounded, size: 18),
          ),
          child: Text(time12(time), style: AppText.titleMedium),
        ),
      );
}
