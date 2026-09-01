import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb, Uint8List;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:panorama_viewer/panorama_viewer.dart';
import 'app_colors.dart';
import 'app_theme.dart';
import 'app_dialogs.dart';
// ─────────────────────────────────────────────────────────────────────────────
// Models
// ─────────────────────────────────────────────────────────────────────────────

class _Facility {
  final String id, name, description, category, status, capacity, rate, hours;
  final String? image360Url;
  final bool is360;
  // Total owned (`total_quantity`) vs. currently available (`amount` — the
  // admin app's own approval flow decrements this directly, so this app
  // only reads it, never mutates it). Only meaningful for quantity-based
  // items (Chairs, Tents); null for time-slot facilities like the court.
  final int? totalQuantity;
  final int? availableQuantity;

  const _Facility({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.status,
    required this.capacity,
    required this.rate,
    required this.hours,
    this.image360Url,
    this.is360 = false,
    this.totalQuantity,
    this.availableQuantity,
  });

  bool get isQuantityBased => category.toLowerCase() == 'amenity item';

  factory _Facility.fromMap(Map<String, dynamic> f) => _Facility(
        id: (f['id'] ?? '').toString(),
        name: f['name'] ?? '',
        description: f['description'] ?? '',
        category: f['category'] ?? '',
        status: f['status'] ?? '',
        capacity: (f['capacity'] ?? '').toString(),
        rate: (f['rate'] ?? '').toString(),
        hours: (f['hours'] ?? '').toString(),
        image360Url: f['image_360_url'] as String?,
        is360: f['is_360'] == true,
        totalQuantity: f['total_quantity'] as int?,
        availableQuantity: f['amount'] as int?,
      );
}

class _Reservation {
  final String id, facilityId, userId, status;
  final DateTime date;
  final TimeOfDay startTime, endTime;
  final int? quantity;
  final DateTime? returnedAt;

  const _Reservation({
    required this.id,
    required this.facilityId,
    required this.userId,
    required this.date,
    required this.startTime,
    required this.endTime,
    required this.status,
    this.quantity,
    this.returnedAt,
  });

  // Only pending or approved reservations can be cancelled by the resident
  bool get canCancel {
    final s = status.toLowerCase();
    return s == 'pending' || s == 'approved';
  }

  // Borrowed amenities (quantity-based) awaiting the resident to report a
  // return, so an admin can verify condition/missing count.
  bool get canReturn =>
      quantity != null && status.toLowerCase() == 'approved' && returnedAt == null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ReservePage
// ─────────────────────────────────────────────────────────────────────────────

class ReservePage extends StatefulWidget {
  const ReservePage({super.key});
  @override
  State<ReservePage> createState() => _ReservePageState();
}

class _ReservePageState extends State<ReservePage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  final _supabase = Supabase.instance.client;

  final DateTime _today = DateTime(
    DateTime.now().year,
    DateTime.now().month,
    DateTime.now().day,
  );

  late DateTime _focusedDay;
  late DateTime _selectedDay;

  List<_Facility> _facilities = [];
  List<_Reservation> _reservations = [];
  bool _isLoading = true;
  String? _error;
  String? _qrImageUrl;

  List<_Reservation> _myReservations = [];

  @override
  void initState() {
    super.initState();
    _focusedDay = _today;
    _selectedDay = _today;
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
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
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final currentUserId = _supabase.auth.currentUser?.id;

      final facilitiesRaw =
          await _supabase.from('facilities').select().order('name');

      // All upcoming reservations (for availability check)
      final reservationsRaw = await _supabase
          .from('reservations')
          .select()
          .gte('date', _today.toIso8601String().split('T').first);

      // Current user's ALL reservations (for notification panel)
      List myRaw = [];
      if (currentUserId != null) {
        myRaw = await _supabase
            .from('reservations')
            .select()
            .eq('user_id', currentUserId)
            .order('created_at', ascending: false)
            .limit(10);
      }

      final hoaSettings = await _supabase
          .from('hoa_settings')
          .select('photo_url')
          .eq('id', 1)
          .maybeSingle();

      setState(() {
        _facilities =
            (facilitiesRaw as List).map((f) => _Facility.fromMap(f)).toList();

        _reservations = _parseReservations(reservationsRaw as List);
        _myReservations = _parseReservations(myRaw);
        _qrImageUrl = hoaSettings?['photo_url'] as String?;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = e.toString();
      });
    }
  }

  List<_Reservation> _parseReservations(List raw) => raw.map((r) {
        final sp = (r['start_time'] as String? ?? '00:00').split(':');
        final ep = (r['end_time'] as String? ?? '00:00').split(':');
        return _Reservation(
          id: (r['id'] ?? '').toString(),
          facilityId: (r['facility_id'] ?? '').toString(),
          userId: (r['user_id'] ?? '').toString(),
          date: DateTime.parse(r['date']),
          startTime: TimeOfDay(
              hour: int.tryParse(sp[0]) ?? 0, minute: int.tryParse(sp[1]) ?? 0),
          endTime: TimeOfDay(
              hour: int.tryParse(ep[0]) ?? 0, minute: int.tryParse(ep[1]) ?? 0),
          status: r['status'] ?? 'Pending',
          quantity: r['quantity'] as int?,
          returnedAt: r['returned_at'] != null
              ? DateTime.parse(r['returned_at'])
              : null,
        );
      }).toList();

  // ── Cancel ────────────────────────────────────────────────────────────────

  Future<void> _cancelReservation(_Reservation r) async {
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
      await _supabase
          .from('reservations')
          .update({'status': 'Cancelled'}).eq('id', r.id);
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

  List<_Reservation> _reservationsForDay(DateTime day) => _reservations
      .where((r) =>
          r.date.year == day.year &&
          r.date.month == day.month &&
          r.date.day == day.day &&
          r.status.toLowerCase() != 'rejected' &&
          r.status.toLowerCase() != 'cancelled' &&
          r.status.toLowerCase() != 'canceled')
      .toList();

  bool _hasReservation(DateTime day) => _reservationsForDay(day).isNotEmpty;

  List<_Reservation> get _myBorrows =>
      _myReservations.where((r) => r.canReturn).toList();

  Color _statusColor(String s) {
    switch (s.toLowerCase()) {
      case 'pending':
        return chateuAccent; // amber
      case 'approved':
        return chateuPrimary; // #006837
      case 'approved and paid':
        return chateuSecondary; // #007D42
      case 'return pending':
        return const Color(0xFF2563EB); // blue — reported, awaiting admin verification
      case 'completed':
        return chateuPrimary; // #006837 (with yellow accent label)
      case 'rejected':
        return const Color(0xFFDC2626); // red
      case 'cancelled':
      case 'canceled':
        return Colors.grey;
      default:
        return chateuAccent;
    }
  }

  String _statusLabel(String s) {
    switch (s.toLowerCase()) {
      case 'approved':
        return 'Approved';
      case 'approved and paid':
        return 'Approved & Paid';
      case 'return pending':
        return 'Return Pending — Awaiting Verification';
      case 'completed':
        return 'Completed';
      case 'rejected':
        return 'Rejected';
      case 'cancelled':
      case 'canceled':
        return 'Cancelled';
      default:
        return 'Pending';
    }
  }

  String _formatTime(TimeOfDay t) {
    final h = t.hour;
    final m = t.minute.toString().padLeft(2, '0');
    final period = h >= 12 ? 'PM' : 'AM';
    final dh = h > 12 ? h - 12 : (h == 0 ? 12 : h);
    return '$dh:$m $period';
  }

  String? _facilityName(String id) {
    try {
      return _facilities.firstWhere((f) => f.id == id).name;
    } catch (_) {
      return null;
    }
  }

  void _showImage(_Facility facility) {
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

  void _showBookSheet(_Facility facility) {
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
        onBooked: _loadData,
      ),
    );
  }

  // ── Return borrowed amenities ─────────────────────────────────────────────

  void _showReturnSheet(_Reservation r) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ReturnSheet(
        reservation: r,
        facilityName: _facilityName(r.facilityId) ?? 'Amenity',
        onReturned: _loadData,
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final isWide = mq.size.width > 600;
    final hPad = isWide ? mq.size.width * 0.08 : AppSpacing.lg;
    final dayRes = _reservationsForDay(_selectedDay);
    final currentId = _supabase.auth.currentUser?.id ?? '';

    return Container(
      color: chateuBackground,
      child: SafeArea(
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: chateuPrimary))
            : _error != null
                ? _buildErrorState()
                : SingleChildScrollView(
                    physics: const BouncingScrollPhysics(),
                    padding: EdgeInsets.symmetric(horizontal: hPad)
                        .copyWith(bottom: AppSpacing.xxxl),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: AppSpacing.xl),

                        // ── Header ───────────────────────────────────────────
                        _FadeSlide(
                          controller: _animController,
                          delay: 0.0,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text("Reserve a Facility",
                                        style: AppText.displayMedium),
                                    const SizedBox(height: AppSpacing.xs),
                                    Text("Pick a date and book your slot",
                                        style: AppText.bodyMedium.copyWith(
                                            color: Colors.grey.shade500)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: AppSpacing.xl),

                        // ── Calendar ─────────────────────────────────────────
                        _FadeSlide(
                          controller: _animController,
                          delay: 0.08,
                          child: Container(
                            decoration: BoxDecoration(
                              color: chateuPrimary,
                              borderRadius: BorderRadius.circular(AppRadius.lg),
                              boxShadow: AppShadows.primaryGlow,
                            ),
                            child: TableCalendar(
                              firstDay: _today,
                              lastDay: _today.add(const Duration(days: 365)),
                              focusedDay: _focusedDay,
                              selectedDayPredicate: (day) =>
                                  isSameDay(_selectedDay, day),
                              onDaySelected: (selected, focused) {
                                if (selected.isBefore(_today)) return;
                                setState(() {
                                  _selectedDay = selected;
                                  _focusedDay = focused;
                                });
                              },
                              eventLoader: (day) =>
                                  _hasReservation(day) ? [1] : [],
                              headerStyle: HeaderStyle(
                                formatButtonVisible: false,
                                titleCentered: true,
                                titleTextStyle: AppText.titleMedium
                                    .copyWith(color: Colors.white),
                                leftChevronIcon: const Icon(Icons.chevron_left,
                                    color: Colors.white),
                                rightChevronIcon: const Icon(
                                    Icons.chevron_right,
                                    color: Colors.white),
                              ),
                              daysOfWeekStyle: DaysOfWeekStyle(
                                weekdayStyle: AppText.caption
                                    .copyWith(color: Colors.white70),
                                weekendStyle: AppText.caption
                                    .copyWith(color: Colors.white70),
                              ),
                              calendarStyle: CalendarStyle(
                                defaultTextStyle: AppText.bodyMedium
                                    .copyWith(color: Colors.white),
                                weekendTextStyle: AppText.bodyMedium
                                    .copyWith(color: Colors.white),
                                disabledTextStyle: AppText.bodyMedium.copyWith(
                                    color: Colors.white.withAlpha(40)),
                                outsideTextStyle: AppText.bodyMedium.copyWith(
                                    color: Colors.white.withAlpha(80)),
                                todayDecoration: BoxDecoration(
                                    color: Colors.white.withAlpha(50),
                                    shape: BoxShape.circle),
                                todayTextStyle: AppText.bodyMedium.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700),
                                selectedDecoration: const BoxDecoration(
                                    color: chateuSecondary,
                                    shape: BoxShape.circle),
                                selectedTextStyle: AppText.bodyMedium.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700),
                                markerDecoration: const BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle),
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: AppSpacing.xl),

                        // ── Bookings on selected day ──────────────────────────
                        if (dayRes.isNotEmpty) ...[
                          _FadeSlide(
                            controller: _animController,
                            delay: 0.14,
                            child: AppSectionHeader(
                              title: isSameDay(_selectedDay, _today)
                                  ? "Today's Bookings"
                                  : "Bookings on ${_selectedDay.day}/${_selectedDay.month}/${_selectedDay.year}",
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          ...dayRes.map((r) {
                            final isOwn = r.userId == currentId;
                            return _ReservationTile(
                              r: r,
                              facilityName: _facilityName(r.facilityId),
                              color: _statusColor(r.status),
                              isOwn: isOwn,
                              statusLabel: _statusLabel(r.status),
                              formatTime: _formatTime,
                              onCancel: isOwn && r.canCancel
                                  ? () => _cancelReservation(r)
                                  : null,
                            );
                          }),
                          const SizedBox(height: AppSpacing.lg),
                        ],

                        // ── My Borrowed Amenities ─────────────────────────────
                        if (_myBorrows.isNotEmpty) ...[
                          _FadeSlide(
                            controller: _animController,
                            delay: 0.16,
                            child: const AppSectionHeader(
                                title: "My Borrowed Amenities"),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          ..._myBorrows.map((r) => _BorrowTile(
                                r: r,
                                facilityName: _facilityName(r.facilityId),
                                onReturn: () => _showReturnSheet(r),
                              )),
                          const SizedBox(height: AppSpacing.lg),
                        ],

                        // ── Available Facilities ──────────────────────────────
                        _FadeSlide(
                          controller: _animController,
                          delay: 0.18,
                          child: const AppSectionHeader(
                              title: "Available Facilities"),
                        ),
                        const SizedBox(height: AppSpacing.md),

                        if (_facilities.isEmpty)
                          Center(
                              child: Padding(
                            padding: const EdgeInsets.all(AppSpacing.xl),
                            child: Text("No facilities found.",
                                style: AppText.bodyMedium
                                    .copyWith(color: Colors.grey.shade400)),
                          ))
                        else
                          ..._facilities.asMap().entries.map((e) {
                            final idx = e.key;
                            final facility = e.value;
                            final booked = _reservationsForDay(_selectedDay)
                                .where((r) => r.facilityId == facility.id)
                                .toList();
                            final isFull = facility.isQuantityBased
                                ? (facility.availableQuantity ?? 0) <= 0
                                : booked
                                        .where((r) =>
                                            r.status.toLowerCase() ==
                                            'approved')
                                        .length >=
                                    3;
                            return _FadeSlide(
                              controller: _animController,
                              delay: 0.22 + idx * 0.06,
                              child: _FacilityCard(
                                facility: facility,
                                bookedCount: booked.length,
                                isFullyBooked: isFull,
                                onTap: isFull
                                    ? null
                                    : () => _showBookSheet(facility),
                                onImageTap:
                                    facility.image360Url?.isNotEmpty == true
                                        ? () => _showImage(facility)
                                        : null,
                              ),
                            );
                          }),
                      ],
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
        const Icon(Icons.error_outline,
            color: Color(0xFFDC2626), size: 48),
        const SizedBox(height: AppSpacing.md),
        Text('Failed to load facilities.\nPlease try again.',
            textAlign: TextAlign.center,
            style: AppText.bodyMedium.copyWith(color: Colors.grey.shade600)),
        const SizedBox(height: AppSpacing.lg),
        AppPrimaryButton(
            label: "Retry",
            icon: Icons.refresh_rounded,
            onPressed: _loadData,
            height: 46),
      ]),
    ));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reservation Tile (calendar day view)
// ─────────────────────────────────────────────────────────────────────────────

class _ReservationTile extends StatelessWidget {
  final _Reservation r;
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
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        color: color.withAlpha(12),
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: color.withAlpha(60)),
      ),
      child: Row(
        children: [
          Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: AppSpacing.sm),
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
                        style: AppText.caption
                            .copyWith(color: Colors.grey.shade500)),
                ]),
          ),
          Text('${formatTime(r.startTime)} – ${formatTime(r.endTime)}',
              style: AppText.caption.copyWith(color: Colors.grey.shade600)),
          const SizedBox(width: AppSpacing.sm),
          AppStatusBadge(label: statusLabel, color: color),
          if (onCancel != null) ...[
            const SizedBox(width: AppSpacing.xs),
            GestureDetector(
              onTap: onCancel,
              child: Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                    color: const Color(0xFFDC2626).withAlpha(20),
                    shape: BoxShape.circle),
                child: const Icon(Icons.close_rounded,
                    size: 13, color: Color(0xFFDC2626)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Borrowed amenity tile — awaiting the resident to report a return
// ─────────────────────────────────────────────────────────────────────────────

class _BorrowTile extends StatelessWidget {
  final _Reservation r;
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
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: AppDecorations.card,
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: chateuPrimary.withAlpha(20),
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: const Icon(Icons.inventory_2_outlined,
                color: chateuPrimary, size: 20),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(facilityName ?? 'Amenity',
                    style: AppText.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text('Qty: ${r.quantity} • Borrowed ${r.date.day}/${r.date.month}/${r.date.year}',
                    style: AppText.caption.copyWith(color: Colors.grey.shade500)),
              ],
            ),
          ),
          TextButton.icon(
            onPressed: onReturn,
            icon: const Icon(Icons.assignment_return_rounded,
                size: 16, color: chateuPrimary),
            label: const Text('Return',
                style: TextStyle(color: chateuPrimary, fontSize: 12)),
          ),
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
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(isPanorama ? '$facilityName – 360° View' : facilityName,
            style: AppText.titleMedium.copyWith(color: Colors.white)),
        leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.of(context).pop()),
      ),
      body: Stack(children: [
        isPanorama
            ? PanoramaViewer(
                child: Image.network(imageUrl,
                    loadingBuilder: (_, child, p) => p == null
                        ? child
                        : Center(
                            child: CircularProgressIndicator(
                                value: p.expectedTotalBytes != null
                                    ? p.cumulativeBytesLoaded /
                                        p.expectedTotalBytes!
                                    : null,
                                color: chateuPrimary)),
                    errorBuilder: (_, __, ___) => const _ImageError()))
            : InteractiveViewer(
                minScale: 0.5,
                maxScale: 4.0,
                child: Center(
                    child: Image.network(imageUrl,
                        fit: BoxFit.contain,
                        loadingBuilder: (_, child, p) => p == null
                            ? child
                            : Center(
                                child: CircularProgressIndicator(
                                    value: p.expectedTotalBytes != null
                                        ? p.cumulativeBytesLoaded /
                                            p.expectedTotalBytes!
                                        : null,
                                    color: chateuPrimary)),
                        errorBuilder: (_, __, ___) => const _ImageError()))),
        Positioned(
          bottom: AppSpacing.xxl,
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
            style: AppText.bodyMedium.copyWith(color: Colors.white54)),
      ]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Facility Card
// ─────────────────────────────────────────────────────────────────────────────

class _FacilityCard extends StatelessWidget {
  final _Facility facility;
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
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: AppSpacing.md),
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: isFullyBooked ? Colors.grey.shade100 : Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
              color: isFullyBooked
                  ? Colors.grey.shade200
                  : chateuPrimary.withAlpha(40)),
          boxShadow: AppShadows.card,
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                  color: isFullyBooked
                      ? Colors.grey.shade200
                      : chateuPrimary.withAlpha(18),
                  borderRadius: BorderRadius.circular(AppRadius.sm)),
              child: Icon(_icon,
                  color: isFullyBooked ? Colors.grey.shade400 : chateuPrimary,
                  size: 24),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(facility.name,
                      style: AppText.titleMedium.copyWith(
                          color: isFullyBooked
                              ? Colors.grey.shade400
                              : chateuText)),
                  const SizedBox(height: 2),
                  Text(facility.description,
                      style:
                          AppText.caption.copyWith(color: Colors.grey.shade500),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: AppSpacing.sm),
                  AppStatusBadge(
                      label: facility.category,
                      color:
                          isFullyBooked ? Colors.grey.shade400 : chateuPrimary),
                ])),
            if (onImageTap != null) ...[
              const SizedBox(width: AppSpacing.sm),
              GestureDetector(
                onTap: onImageTap,
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                      color: chateuPrimary.withAlpha(14),
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                      border: Border.all(color: chateuPrimary.withAlpha(40))),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(
                        facility.is360
                            ? Icons.view_in_ar_rounded
                            : Icons.image_rounded,
                        color: chateuPrimary,
                        size: 18),
                    const SizedBox(height: 2),
                    Text(facility.is360 ? '360°' : 'Photo',
                        style: AppText.caption.copyWith(
                            fontWeight: FontWeight.w700, color: chateuPrimary)),
                  ]),
                ),
              ),
            ],
          ]),
          if (facility.isQuantityBased ||
              facility.capacity.isNotEmpty ||
              facility.rate.isNotEmpty ||
              facility.hours.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            const Divider(height: 1),
            const SizedBox(height: AppSpacing.sm),
            Row(children: [
              if (facility.isQuantityBased) ...[
                _Chip(
                    icon: Icons.inventory_2_outlined,
                    label:
                        '${facility.availableQuantity ?? 0} of ${facility.totalQuantity ?? 0} available',
                    disabled: isFullyBooked),
                const SizedBox(width: AppSpacing.sm),
              ],
              if (facility.capacity.isNotEmpty)
                _Chip(
                    icon: Icons.people_outline_rounded,
                    label: facility.capacity,
                    disabled: isFullyBooked),
              if (facility.rate.isNotEmpty) ...[
                const SizedBox(width: AppSpacing.sm),
                _Chip(
                    icon: Icons.attach_money_rounded,
                    label: facility.rate,
                    disabled: isFullyBooked),
              ],
              if (facility.hours.isNotEmpty) ...[
                const SizedBox(width: AppSpacing.sm),
                _Chip(
                    icon: Icons.schedule_rounded,
                    label: facility.hours,
                    disabled: isFullyBooked),
              ],
            ]),
          ],
          if (isFullyBooked) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm, vertical: 5),
              decoration: BoxDecoration(
                  color: Colors.grey.shade200,
                  borderRadius: BorderRadius.circular(AppRadius.xs)),
              child: Text(
                  facility.isQuantityBased
                      ? 'None currently available'
                      : 'Fully booked for this day',
                  style: AppText.caption.copyWith(
                      color: Colors.grey.shade500,
                      fontWeight: FontWeight.w500)),
            ),
          ],
        ]),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool disabled;
  const _Chip(
      {required this.icon, required this.label, required this.disabled});
  @override
  Widget build(BuildContext context) {
    final c = disabled ? Colors.grey.shade400 : Colors.grey.shade600;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 12, color: c),
      const SizedBox(width: 3),
      Text(label,
          style: AppText.caption.copyWith(color: c),
          maxLines: 1,
          overflow: TextOverflow.ellipsis),
    ]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Book Sheet — simple form only (no payment option)
// ─────────────────────────────────────────────────────────────────────────────

class _BookSheet extends StatefulWidget {
  final _Facility facility;
  final DateTime selectedDate;
  final List<_Reservation> existingReservations;
  final String? qrImageUrl;
  final VoidCallback onBooked;

  const _BookSheet({
    required this.facility,
    required this.selectedDate,
    required this.existingReservations,
    this.qrImageUrl,
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

  XFile? _proofFile;
  Uint8List? _proofBytes;

  XFile? _conditionPhotoFile;
  Uint8List? _conditionPhotoBytes;

  int get _maxQuantity => widget.facility.availableQuantity ?? 0;

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

  Future<void> _pickConditionPhoto() async {
    final file = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (file == null) return;
    if (kIsWeb) {
      final bytes = await file.readAsBytes();
      setState(() {
        _conditionPhotoFile = file;
        _conditionPhotoBytes = bytes;
      });
    } else {
      setState(() => _conditionPhotoFile = file);
    }
  }

  // ── Conflict — only APPROVED slots block new bookings ────────────────────
  String? get conflictReason {
    final s = _startTime.hour * 60 + _startTime.minute;
    final e = _endTime.hour * 60 + _endTime.minute;
    if (e <= s) return 'End time must be after start time.';

    final now = DateTime.now();
    final isToday = widget.selectedDate.year == now.year &&
        widget.selectedDate.month == now.month &&
        widget.selectedDate.day == now.day;
    if (isToday && s <= now.hour * 60 + now.minute) {
      return 'Start time has already passed for today.';
    }

    for (final r in widget.existingReservations) {
      // Only APPROVED slots block new bookings
      if (r.status.toLowerCase() != 'approved') continue;
      final rs = r.startTime.hour * 60 + r.startTime.minute;
      final re = r.endTime.hour * 60 + r.endTime.minute;
      if (s < re && e > rs) {
        return 'This slot overlaps with an already-approved booking.';
      }
    }
    return null;
  }

  bool get _hasConflict => conflictReason != null;

  // ── Court pricing: ₱150 for the first hour, +₱50 per additional hour
  // (partial hours round up to the next full hour) ─────────────────────────
  bool get _isCourtFacility => widget.facility.name.toLowerCase().contains('court');

  int get _durationMinutes {
    final s = _startTime.hour * 60 + _startTime.minute;
    final e = _endTime.hour * 60 + _endTime.minute;
    return e > s ? e - s : 0;
  }

  double? get _courtFee {
    if (!_isCourtFacility || _durationMinutes <= 0) return null;
    final hours = (_durationMinutes / 60).ceil();
    if (hours <= 1) return 150;
    return 150 + (hours - 1) * 50;
  }

  String _fmt(TimeOfDay t) {
    final h = t.hour;
    final m = t.minute.toString().padLeft(2, '0');
    final p = h >= 12 ? 'PM' : 'AM';
    final d = h > 12 ? h - 12 : (h == 0 ? 12 : h);
    return '$d:$m $p';
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
      if (_maxQuantity <= 0) {
        showAppSnack(context, 'None of ${widget.facility.name} are currently available.',
            type: SnackType.error);
        return;
      }
      if (_quantity < 1 || _quantity > _maxQuantity) {
        showAppSnack(context, 'Only $_maxQuantity available — adjust the quantity.',
            type: SnackType.error);
        return;
      }
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

      await _supabase.from('reservations').insert({
        'facility_id': widget.facility.id,
        'user_id': userId,
        'date': widget.selectedDate.toIso8601String().split('T').first,
        'start_time':
            '${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}',
        'end_time':
            '${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')}',
        'status': 'Pending',
        if (fee != null) 'fee': fee,
        if (fee != null) 'payment_status': 'pending_verification',
        if (fee != null) 'reference_no': reference,
        if (proofUrl != null) 'proof_url': proofUrl,
        if (widget.facility.isQuantityBased) 'quantity': _quantity,
        if (conditionPhotoUrl != null) 'borrow_condition_photo_url': conditionPhotoUrl,
      });

      if (mounted) {
        Navigator.of(context).pop();
        widget.onBooked();
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Row(children: [
            const Icon(Icons.check_circle_rounded,
                color: Colors.white, size: 18),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
                child: Text(
                    fee != null
                        ? 'Reservation submitted! GCash payment of ₱${fee.toStringAsFixed(0)} is awaiting verification.'
                        : 'Reservation submitted! Awaiting admin approval.',
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w600))),
          ]),
          backgroundColor: chateuPrimary,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.sm)),
          margin: const EdgeInsets.all(AppSpacing.lg),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to submit: $e',
              style: const TextStyle(color: Colors.white)),
          backgroundColor: const Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.sm)),
          margin: const EdgeInsets.all(AppSpacing.lg),
        ));
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final approvedSlots = widget.existingReservations
        .where((r) => r.status.toLowerCase() == 'approved')
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
                  MediaQuery.of(context).viewInsets.bottom + AppSpacing.xxl),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // Handle
            Center(
                child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(
                  top: AppSpacing.sm, bottom: AppSpacing.lg),
              decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2)),
            )),

            Text(widget.facility.name, style: AppText.titleLarge),
            const SizedBox(height: AppSpacing.xs),
            Text(widget.facility.description,
                style:
                    AppText.bodyMedium.copyWith(color: Colors.grey.shade500)),

            const SizedBox(height: AppSpacing.lg),

            // Info chips
            if (widget.facility.capacity.isNotEmpty ||
                widget.facility.rate.isNotEmpty ||
                widget.facility.hours.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                decoration: BoxDecoration(
                    color: chateuBackground,
                    borderRadius: BorderRadius.circular(AppRadius.sm)),
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
                const Icon(Icons.calendar_today_rounded,
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
                    icon: const Icon(Icons.add_circle_outline_rounded,
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
                          ? Colors.grey.shade500
                          : const Color(0xFFDC2626))),

              const SizedBox(height: AppSpacing.lg),
              Text('Item Condition Photo *',
                  style: AppText.labelMedium.copyWith(color: chateuText)),
              const SizedBox(height: 4),
              Text(
                'A photo of the item as you\'re receiving it — this protects '
                'you if there\'s ever a dispute about its condition on return.',
                style: AppText.caption.copyWith(color: Colors.grey.shade500),
              ),
              const SizedBox(height: AppSpacing.sm),
              GestureDetector(
                onTap: _pickConditionPhoto,
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: chateuBackground,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    border: Border.all(
                        color: _conditionPhotoFile != null
                            ? chateuPrimary.withAlpha(80)
                            : Colors.black12),
                  ),
                  child: Row(children: [
                    Icon(
                      _conditionPhotoFile != null
                          ? Icons.check_circle_rounded
                          : Icons.camera_alt_rounded,
                      size: 20,
                      color: _conditionPhotoFile != null
                          ? chateuPrimary
                          : Colors.black38,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        _conditionPhotoFile != null
                            ? _conditionPhotoFile!.name
                            : 'Upload a photo of the item\'s condition',
                        style: AppText.caption.copyWith(
                            color: _conditionPhotoFile != null
                                ? chateuPrimary
                                : Colors.grey.shade500),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ]),
                ),
              ),
            ],

            const SizedBox(height: AppSpacing.lg),

            Text("Select Time",
                style: AppText.labelMedium.copyWith(color: chateuText)),
            const SizedBox(height: AppSpacing.sm),

            Row(children: [
              Expanded(
                  child: _TimePicker(
                      label: "Start Time",
                      time: _startTime,
                      onTap: () async {
                        final t = await showTimePicker(
                            context: context,
                            initialTime: _startTime,
                            builder: (ctx, child) => Theme(
                                data: Theme.of(ctx).copyWith(
                                    colorScheme: const ColorScheme.light(
                                        primary: chateuPrimary)),
                                child: child!));
                        if (t != null) setState(() => _startTime = t);
                      })),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                  child: _TimePicker(
                      label: "End Time",
                      time: _endTime,
                      onTap: () async {
                        final t = await showTimePicker(
                            context: context,
                            initialTime: _endTime,
                            builder: (ctx, child) => Theme(
                                data: Theme.of(ctx).copyWith(
                                    colorScheme: const ColorScheme.light(
                                        primary: chateuPrimary)),
                                child: child!));
                        if (t != null) setState(() => _endTime = t);
                      })),
            ]),

            if (_hasConflict) ...[
              const SizedBox(height: AppSpacing.sm),
              AppNoticeBanner(
                  text: conflictReason ?? 'Please choose a different slot.',
                  icon: Icons.warning_amber_rounded,
                  color: const Color(0xFFDC2626)),
            ],

            // Approved taken slots
            if (approvedSlots.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.lg),
              Text("Already approved on this day",
                  style: AppText.labelMedium
                      .copyWith(color: Colors.grey.shade500)),
              const SizedBox(height: AppSpacing.sm),
              ...approvedSlots.map((r) => Container(
                    margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                    decoration: BoxDecoration(
                        color: chateuPrimary.withAlpha(14),
                        borderRadius: BorderRadius.circular(AppRadius.xs),
                        border: Border.all(color: chateuPrimary.withAlpha(50))),
                    child: Row(children: [
                      Icon(Icons.lock_clock_rounded,
                          size: 14, color: chateuPrimary),
                      const SizedBox(width: AppSpacing.sm),
                      Text('${_fmt(r.startTime)} – ${_fmt(r.endTime)}',
                          style: AppText.caption
                              .copyWith(color: Colors.grey.shade700)),
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
            if (_isCourtFacility && _courtFee != null) ...[
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                    color: chateuPrimary.withAlpha(12),
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    border: Border.all(color: chateuPrimary.withAlpha(50))),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    const Icon(Icons.payments_rounded,
                        color: chateuPrimary, size: 16),
                    const SizedBox(width: AppSpacing.sm),
                    Text('Court Fee',
                        style: AppText.labelMedium.copyWith(color: chateuPrimary)),
                    const Spacer(),
                    Text('₱${_courtFee!.toStringAsFixed(0)}',
                        style: AppText.titleMedium.copyWith(color: chateuPrimary)),
                  ]),
                  const SizedBox(height: 4),
                  Text(
                    '₱150 for the first hour, +₱50 for each additional hour '
                    '(${(_durationMinutes / 60).ceil()} hr${(_durationMinutes / 60).ceil() > 1 ? 's' : ''} booked)',
                    style: AppText.caption.copyWith(color: Colors.grey.shade600),
                  ),
                ]),
              ),
              const SizedBox(height: AppSpacing.md),
            ],

            // ── GCash QR payment (facilities with a fee, e.g. the court) ──────
            if (_isCourtFacility && _courtFee != null) ...[
              Text('Pay via GCash',
                  style: AppText.labelMedium.copyWith(color: chateuText)),
              const SizedBox(height: AppSpacing.sm),

              Center(
                child: Container(
                  width: 200,
                  height: 200,
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
                child: Text('Scan with your GCash app to pay ₱${_courtFee!.toStringAsFixed(0)}',
                    style:
                        AppText.caption.copyWith(color: Colors.grey.shade500)),
              ),

              const SizedBox(height: AppSpacing.lg),

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
                      color: _proofFile != null
                          ? chateuPrimary
                          : Colors.black38,
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
              icon: Icons.event_available_rounded,
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
          Icon(Icons.qr_code_2_rounded, size: 88, color: Colors.grey.shade300),
          const SizedBox(height: AppSpacing.sm),
          Text('GCash QR not yet added',
              textAlign: TextAlign.center,
              style: AppText.caption.copyWith(color: Colors.grey.shade400)),
        ],
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Return Borrowed Amenities sheet
// ─────────────────────────────────────────────────────────────────────────────

class _ReturnSheet extends StatefulWidget {
  final _Reservation reservation;
  final String facilityName;
  final VoidCallback onReturned;

  const _ReturnSheet({
    required this.reservation,
    required this.facilityName,
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
    if (file == null) return;
    if (kIsWeb) {
      final bytes = await file.readAsBytes();
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
      await _supabase.from('reservations').update({
        'status': 'Return Pending',
        'returned_at': DateTime.now().toIso8601String(),
        'return_condition': _condition,
        'return_missing_qty': _missingQty,
        'return_notes': _notesCtrl.text.trim().isEmpty
            ? null
            : _notesCtrl.text.trim(),
        'return_condition_photo_url': photoUrl,
      }).eq('id', widget.reservation.id);

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
              bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.xxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              buildSheetHandle(),
              Text('Return Borrowed Amenities', style: AppText.titleLarge),
              const SizedBox(height: AppSpacing.xs),
              Text('${widget.facilityName} • Borrowed qty: $_borrowedQty',
                  style: AppText.bodyMedium.copyWith(color: Colors.grey.shade500)),

              const SizedBox(height: AppSpacing.lg),
              Text('Condition',
                  style: AppText.labelMedium.copyWith(color: chateuText)),
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
                    icon: const Icon(Icons.add_circle_outline_rounded,
                        color: chateuPrimary),
                    onPressed: _missingQty < _borrowedQty
                        ? () => setState(() => _missingQty++)
                        : null,
                  ),
                ]),
              ),

              const SizedBox(height: AppSpacing.lg),
              Text('Condition Photo *',
                  style: AppText.labelMedium.copyWith(color: chateuText)),
              const SizedBox(height: 4),
              Text(
                'A photo of the item as you\'re returning it.',
                style: AppText.caption.copyWith(color: Colors.grey.shade500),
              ),
              const SizedBox(height: AppSpacing.sm),
              GestureDetector(
                onTap: _pickPhoto,
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: chateuBackground,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    border: Border.all(
                        color: _photoFile != null
                            ? chateuPrimary.withAlpha(80)
                            : Colors.black12),
                  ),
                  child: Row(children: [
                    Icon(
                      _photoFile != null
                          ? Icons.check_circle_rounded
                          : Icons.camera_alt_rounded,
                      size: 20,
                      color: _photoFile != null ? chateuPrimary : Colors.black38,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        _photoFile != null
                            ? _photoFile!.name
                            : 'Upload a photo of the item\'s condition',
                        style: AppText.caption.copyWith(
                            color: _photoFile != null
                                ? chateuPrimary
                                : Colors.grey.shade500),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ]),
                ),
              ),

              const SizedBox(height: AppSpacing.lg),
              Text('Notes (optional)',
                  style: AppText.labelMedium.copyWith(color: chateuText)),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: _notesCtrl,
                maxLines: 3,
                style: const TextStyle(fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'e.g. one chair leg is bent',
                  hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                  filled: true,
                  fillColor: chateuBackground,
                  contentPadding: const EdgeInsets.all(AppSpacing.md),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none),
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
                icon: Icons.assignment_return_rounded,
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
    final color = label == 'Damaged' ? const Color(0xFFDC2626) : chateuPrimary;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        decoration: BoxDecoration(
          color: isSelected ? color.withAlpha(20) : chateuBackground,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(
              color: isSelected ? color : Colors.black12,
              width: isSelected ? 1.5 : 1),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: isSelected ? color : Colors.grey.shade400, size: 20),
          const SizedBox(height: 4),
          Text(label,
              style: AppText.labelMedium.copyWith(
                  color: isSelected ? color : Colors.grey.shade500,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500)),
        ]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Time Picker widget
// ─────────────────────────────────────────────────────────────────────────────

class _TimePicker extends StatelessWidget {
  final String label;
  final TimeOfDay time;
  final VoidCallback onTap;
  const _TimePicker(
      {required this.label, required this.time, required this.onTap});

  String get _fmt {
    final h = time.hour;
    final m = time.minute.toString().padLeft(2, '0');
    final p = h >= 12 ? 'PM' : 'AM';
    final d = h > 12 ? h - 12 : (h == 0 ? 12 : h);
    return '$d:$m $p';
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md, vertical: AppSpacing.md),
          decoration: BoxDecoration(
              color: chateuBackground,
              borderRadius: BorderRadius.circular(AppRadius.sm),
              border: Border.all(color: chateuPrimary.withAlpha(60))),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label,
                style: AppText.caption.copyWith(
                    color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
            const SizedBox(height: AppSpacing.xs),
            Row(children: [
              const Icon(Icons.access_time_rounded,
                  size: 16, color: chateuPrimary),
              const SizedBox(width: AppSpacing.sm),
              Text(_fmt, style: AppText.titleMedium),
            ]),
          ]),
        ),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// FadeSlide animation helper
// ─────────────────────────────────────────────────────────────────────────────

class _FadeSlide extends StatelessWidget {
  final AnimationController controller;
  final double delay;
  final Widget child;
  const _FadeSlide(
      {required this.controller, required this.delay, required this.child});

  @override
  Widget build(BuildContext context) {
    final fade = Tween<double>(begin: 0, end: 1).animate(CurvedAnimation(
        parent: controller,
        curve: Interval(delay, (delay + 0.4).clamp(0.0, 1.0),
            curve: Curves.easeOut)));
    final slide = Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
        .animate(CurvedAnimation(
            parent: controller,
            curve: Interval(delay, (delay + 0.4).clamp(0.0, 1.0),
                curve: Curves.easeOut)));
    return FadeTransition(
        opacity: fade, child: SlideTransition(position: slide, child: child));
  }
}
