import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_colors.dart';
import 'app_theme.dart';
import 'app_dialogs.dart';
import 'main.dart';
import 'notification_page.dart';
import 'report_page.dart';
import 'account_page.dart';
import 'reserve_page.dart';
import 'map_page.dart';
import 'aboutus_page.dart';
import 'voting_page.dart';
import 'payment_page.dart';
import 'tenant_management_page.dart';
import 'package:url_launcher/url_launcher.dart';

// ── HomePage ───────────────────────────────────────────────────────────────────

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _selectedIndex = 0;
  final supabase = Supabase.instance.client;

  String? _avatarUrl;
  String _displayName = "Chateau Resident";
  String? _residentType; // 'tenant' | 'homeowner' | null (loading)

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final user = supabase.auth.currentUser;
    if (user == null) return;
    try {
      final data = await supabase
          .from('profiles')
          .select('full_name, avatar_url, resident_type')
          .eq('id', user.id)
          .maybeSingle();
      if (mounted && data != null) {
        setState(() {
          _avatarUrl = data['avatar_url'] as String?;
          final fullName = data['full_name'] as String? ?? '';
          _displayName = fullName.isNotEmpty ? fullName : "Chateau Resident";
          _residentType = data['resident_type'] as String?;
        });
      }
    } catch (_) {}
  }

  Widget _getBody(int index) {
    switch (index) {
      case 0:
        return HomeDashboard(residentType: _residentType);
      case 1:
        return const ReportPage();
      case 2:
        return const MapPage();
      case 3:
        return const ReservePage();
      default:
        return HomeDashboard(residentType: _residentType);
    }
  }

  // Returns a stream that emits the total notification count (personal + broadcast).
  // Supabase's .stream() doesn't support OR filters, so we poll on any
  // personal-notification change and then fetch the full OR count manually.
  Stream<int> _getUnreadCount() {
    final userId = supabase.auth.currentUser?.id;
    if (userId == null) return Stream.value(0);

    // Use the personal stream as a trigger; on each tick re-query both types.
    return supabase
        .from('notifications')
        .stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .asyncMap((_) async {
          try {
            final data = await supabase
                .from('notifications')
                .select('id')
                .or('user_id.eq.$userId,user_id.is.null');
            return (data as List).length;
          } catch (_) {
            return 0;
          }
        });
  }

  Future<void> _handleLogout() async {
    if (mounted && (Scaffold.maybeOf(context)?.isDrawerOpen ?? false)) {
      Navigator.of(context).pop();
    }

    final confirm = await showConfirmDialog(
      context,
      title:        'Sign Out',
      message:      'Are you sure you want to sign out?',
      confirmLabel: 'Sign Out',
      cancelLabel:  'Cancel',
      isDanger:     true,
      icon:         Icons.logout_rounded,
    );

    if (confirm == true) {
      try {
        await supabase.auth.signOut();
        if (mounted) {
          // Clear all routes and go back to root to let AuthGate handle the redirect
          Navigator.of(context, rootNavigator: true).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const LandingPage()),
            (_) => false,
          );
        }
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = supabase.auth.currentUser;

    return Scaffold(
      backgroundColor: chateuBackground,
      drawer: _buildDrawer(user, _residentType),
      appBar: _buildAppBar(),
      body: _getBody(_selectedIndex),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  // ── Drawer ────────────────────────────────────────────────────────────────

  Widget _buildDrawer(User? user, String? residentType) {
    // residentType == null → profile still loading; treat same as tenant
    // to avoid the Payments tile flashing then disappearing.
    final isTenant = residentType == null || residentType == 'tenant';
    return Drawer(
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.only(
          topRight: Radius.circular(AppRadius.xl),
          bottomRight: Radius.circular(AppRadius.xl),
        ),
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Header ────────────────────────────────────────────────
            UserAccountsDrawerHeader(
              margin: EdgeInsets.zero,
              decoration: const BoxDecoration(color: chateuPrimary),
              currentAccountPicture: CircleAvatar(
                backgroundColor: Colors.white.withAlpha(50),
                child: Padding(
                  padding: const EdgeInsets.all(3.0),
                  child: CircleAvatar(
                    radius: 34,
                    backgroundColor: Colors.white,
                    child: ClipOval(child: _buildDrawerAvatar()),
                  ),
                ),
              ),
              accountName: Text(
                _displayName,
                style: AppText.titleMedium.copyWith(color: Colors.white),
              ),
              accountEmail: Text(
                user?.email ?? '',
                style: AppText.caption.copyWith(
                  color: Colors.white.withAlpha(180),
                ),
              ),
            ),

            // ── Scrollable nav items ───────────────────────────────────
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                child: Column(
                  children: [
                    _drawerTile(
                      icon: Icons.account_circle_outlined,
                      label: "My Account",
                      onTap: () async {
                        Navigator.pop(context);
                        await Navigator.push(
                          context,
                          MaterialPageRoute(builder: (c) => const AccountPage()),
                        );
                        _loadProfile();
                      },
                    ),
                    if (!isTenant) ...[
                      _drawerTile(
                        icon: Icons.how_to_vote_outlined,
                        label: "Voting",
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (c) => const VotingPage()),
                          );
                        },
                      ),
                      _drawerTile(
                        icon: Icons.payment_rounded,
                        label: "Payments",
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (c) => const PaymentPage()),
                          );
                        },
                      ),
                      _drawerTile(
                        icon: Icons.people_alt_outlined,
                        label: "Tenant Management",
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (c) => const TenantManagementPage()),
                          );
                        },
                      ),
                    ],
                    _drawerTile(
                      icon: Icons.info_outline_rounded,
                      label: "About Us",
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (c) => const AboutPage()),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),

            // ── Fixed footer: Sign Out always visible ─────────────────
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md, vertical: AppSpacing.sm),
              child: ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.red.withAlpha(15),
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                  ),
                  child: const Icon(Icons.logout_rounded,
                      color: Colors.red, size: 20),
                ),
                title: Text(
                  "Sign Out",
                  style: AppText.bodyLarge.copyWith(
                    color: Colors.red,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.sm)),
                onTap: _handleLogout,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── AppBar ────────────────────────────────────────────────────────────────

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: chateuBackground,
      elevation: 0,
      leading: Builder(
        builder: (context) => IconButton(
          icon: const Icon(
            Icons.grid_view_rounded,
            color: chateuSecondary,
            size: 26,
          ),
          onPressed: () => Scaffold.of(context).openDrawer(),
        ),
      ),
      title: Image.asset(
        'assets/logo.png',
        height: 38,
        errorBuilder: (c, e, s) => Text(
          "CHATEAU",
          style: AppText.titleLarge.copyWith(color: chateuPrimary),
        ),
      ),
      centerTitle: true,
      actions: [
        StreamBuilder<int>(
          stream: _getUnreadCount(),
          builder: (context, snapshot) {
            final count = snapshot.data ?? 0;
            return Stack(
              alignment: Alignment.center,
              children: [
                IconButton(
                  icon: Icon(
                    count > 0
                        ? Icons.notifications_rounded
                        : Icons.notifications_none_outlined,
                    color: chateuSecondary,
                    size: 26,
                  ),
                  onPressed: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (c) => const NotificationPage()),
                    );
                  },
                ),
              ],
            );
          },
        ),
      ],
    );
  }

  // ── Bottom Nav ────────────────────────────────────────────────────────────

  Widget _buildBottomNav() {
    return BottomNavigationBar(
      currentIndex: _selectedIndex,
      onTap: (index) => setState(() => _selectedIndex = index),
      type: BottomNavigationBarType.fixed,
      backgroundColor: Colors.white,
      selectedItemColor: chateuPrimary,
      unselectedItemColor: Colors.grey.shade400,
      selectedLabelStyle: AppText.caption.copyWith(fontWeight: FontWeight.w700),
      unselectedLabelStyle: AppText.caption,
      elevation: 8,
      items: const [
        BottomNavigationBarItem(
          icon: Icon(Icons.home_outlined),
          activeIcon: Icon(Icons.home_rounded),
          label: "Home",
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.chat_bubble_outline),
          activeIcon: Icon(Icons.chat_bubble_rounded),
          label: "Report",
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.map_outlined),
          activeIcon: Icon(Icons.map_rounded),
          label: "Map",
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.event_available_outlined),
          activeIcon: Icon(Icons.event_available_rounded),
          label: "Reserve",
        ),
      ],
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Widget _drawerTile({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color? color,
  }) {
    final c = color ?? chateuSecondary;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      child: ListTile(
        leading: Icon(icon, color: c, size: 22),
        title: Text(
          label,
          style: AppText.bodyLarge.copyWith(
            color: c,
            fontWeight: FontWeight.w500,
          ),
        ),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.sm)),
        onTap: onTap,
      ),
    );
  }

  Widget _buildDrawerAvatar() {
    if (_avatarUrl != null && _avatarUrl!.isNotEmpty) {
      return Image.network(
        _avatarUrl!,
        width: 60,
        height: 60,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _defaultAvatar(),
      );
    }
    return _defaultAvatar();
  }

  Widget _defaultAvatar() {
    final initials = _displayName.isNotEmpty
        ? _displayName
            .trim()
            .split(' ')
            .where((e) => e.isNotEmpty)
            .map((e) => e[0])
            .take(2)
            .join()
            .toUpperCase()
        : '?';
    return Container(
      width: 60,
      height: 60,
      color: chateuSecondary,
      alignment: Alignment.center,
      child: Text(
        initials,
        style: AppText.displayMedium.copyWith(
          fontSize: 22,
          color: Colors.white,
        ),
      ),
    );
  }
}

// ── Legend Dot ────────────────────────────────────────────────────────────────

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(label,
            style: AppText.caption.copyWith(color: Colors.grey.shade500)),
      ],
    );
  }
}

// ── HomeDashboard ──────────────────────────────────────────────────────────────

class HomeDashboard extends StatefulWidget {
  final String? residentType;
  const HomeDashboard({super.key, this.residentType});

  @override
  State<HomeDashboard> createState() => _HomeDashboardState();
}

class _HomeDashboardState extends State<HomeDashboard> {
  final supabase = Supabase.instance.client;

  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;
  Set<String> _reservedDates = {};
  // Each entry: {start: DateTime, end: DateTime, category: String}
  List<Map<String, dynamic>> _announcementRanges = [];

  double _balance = 0.0;        // sum of unpaid payments
  double _pendingBalance = 0.0; // sum of pending_verification payments
  double _overdueBalance = 0.0; // sum of overdue payments
  bool _balanceLoading = true;

  static const int _pageSize = 5;
  List<Map<String, dynamic>> _announcements = [];
  bool _announcementsLoading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _loadReservedDates();
    _loadAnnouncementRanges();
    // Only load balance for non-tenants
    if (widget.residentType != 'tenant') {
      _loadBalance();
    } else {
      _balanceLoading = false;
    }
    _loadAnnouncements(reset: true);
  }

  Future<void> _loadReservedDates() async {
    try {
      final data = await supabase
          .from('reservations')
          .select('date')
          .eq('status', 'approved');
      final dates = <String>{};
      for (final row in (data as List)) {
        if (row['date'] != null) {
          dates.add(row['date'].toString().split('T').first);
        }
      }
      if (mounted) setState(() => _reservedDates = dates);
    } catch (_) {}
  }

  bool _isReserved(DateTime day) {
    final key =
        '${day.year}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
    return _reservedDates.contains(key);
  }

  Future<void> _loadAnnouncementRanges() async {
    try {
      final data = await supabase
          .from('announcements')
          .select(
              'id, title, content, start_date, end_date, category, is_emergency')
          .or('status.eq.published,status.eq.active')
          .not('start_date', 'is', null)
          .not('end_date', 'is', null);

      final ranges = <Map<String, dynamic>>[];
      for (final row in (data as List)) {
        try {
          ranges.add({
            'start': DateTime.parse(row['start_date']),
            'end': DateTime.parse(row['end_date']),
            'category': row['category'] ?? 'General',
            'title': row['title'] ?? '',
            'content': row['content'] ?? '',
            'is_emergency': row['is_emergency'] ?? false,
          });
        } catch (_) {}
      }
      if (mounted) setState(() => _announcementRanges = ranges);
    } catch (_) {}
  }

  // All ranges covering this day
  List<Map<String, dynamic>> _rangesForDay(DateTime day) {
    final d = DateTime(day.year, day.month, day.day);
    return _announcementRanges.where((r) {
      final start = DateTime((r['start'] as DateTime).year,
          (r['start'] as DateTime).month, (r['start'] as DateTime).day);
      final end = DateTime((r['end'] as DateTime).year,
          (r['end'] as DateTime).month, (r['end'] as DateTime).day);
      return !d.isBefore(start) && !d.isAfter(end);
    }).toList();
  }

  Color _categoryColor(String? category) {
    switch ((category ?? '').toLowerCase()) {
      case 'event':
        return const Color(0xFF3B82F6);
      case 'maintenance':
        return const Color(0xFFFF8C42);
      case 'election':
        return const Color(0xFFDC2626);
      case 'security':
        return const Color(0xFF6B7280);
      case 'financial':
        return chateuSecondary;
      default: // General
        return chateuPrimary;
    }
  }

  // ── Day cell builder ─────────────────────────────────────────────────────

  Widget _buildDayCell(BuildContext ctx, DateTime day,
      {required bool isToday, required bool isSelected}) {
    final ranges = _rangesForDay(day);
    final hasRanges = ranges.isNotEmpty;

    // Base circle decoration for today / selected / normal
    BoxDecoration? circleDecoration;
    Color textColor = AppText.bodyMedium.color ?? chateuText;

    if (isSelected) {
      circleDecoration =
          const BoxDecoration(color: chateuPrimary, shape: BoxShape.circle);
      textColor = Colors.white;
    } else if (isToday) {
      circleDecoration = BoxDecoration(
          color: chateuPrimary.withAlpha(30), shape: BoxShape.circle);
      textColor = chateuPrimary;
    }

    // If there are events and no special state, use the first category
    // color for the ring but keep text dark for readability
    final dominantColor =
        hasRanges ? _categoryColor(ranges.first['category'] as String?) : null;

    if (hasRanges && !isSelected && !isToday) {
      circleDecoration = BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: dominantColor!, width: 2),
      );
      // Keep text same as dominant color
      textColor = dominantColor;
    }

    return SizedBox(
      width: 40,
      height: 46,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Day number circle
          Container(
            width: 32,
            height: 32,
            decoration: circleDecoration,
            child: Center(
              child: Text(
                '${day.day}',
                style: AppText.bodyMedium.copyWith(
                  color: textColor,
                  fontWeight: (isToday || isSelected || hasRanges)
                      ? FontWeight.w700
                      : FontWeight.w400,
                ),
              ),
            ),
          ),
          // Category dots — show up to 3
          if (hasRanges) ...[
            const SizedBox(height: 3),
            SizedBox(
              height: 9,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Show up to 3 unique-category dots
                  ...ranges
                      .fold<List<String>>([], (acc, r) {
                        final cat = r['category'] as String? ?? '';
                        if (!acc.contains(cat)) acc.add(cat);
                        return acc;
                      })
                      .take(3)
                      .map((cat) {
                        final color = _categoryColor(cat);
                        return Container(
                          width: 6,
                          height: 6,
                          margin: const EdgeInsets.symmetric(horizontal: 1.5),
                          decoration: BoxDecoration(
                            color: color,
                            shape: BoxShape.circle,
                          ),
                        );
                      }),
                  // "+N" if more than 3 unique categories
                  if (ranges.map((r) => r['category']).toSet().length > 3)
                    Padding(
                      padding: const EdgeInsets.only(left: 2),
                      child: Text(
                        '+',
                        style: TextStyle(
                          fontSize: 8,
                          fontWeight: FontWeight.w800,
                          color: Colors.grey.shade500,
                          height: 1,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ] else
            const SizedBox(height: 9),
        ],
      ),
    );
  }

  // ── Day announcements bottom sheet ─────────────────────────────────────────

  void _showDayAnnouncementsSheet(
      DateTime day, List<Map<String, dynamic>> ranges) {
    const months = [
      '',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final dateLabel = '${months[day.month]} ${day.day}, ${day.year}';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        minChildSize: 0.3,
        maxChildSize: 0.92,
        builder: (sheetCtx, scrollController) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius:
                BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
          ),
          child: Column(
            children: [
              // Fixed header
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.xl, AppSpacing.sm, AppSpacing.xl, 0),
                child: Column(
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
                        const Icon(Icons.calendar_today_rounded,
                            color: chateuPrimary, size: 18),
                        const SizedBox(width: AppSpacing.sm),
                        Text(dateLabel, style: AppText.titleMedium),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.sm, vertical: 3),
                          decoration: BoxDecoration(
                            color: chateuPrimary.withAlpha(18),
                            borderRadius: BorderRadius.circular(AppRadius.xxl),
                          ),
                          child: Text(
                            '${ranges.length} event${ranges.length > 1 ? 's' : ''}',
                            style: AppText.caption.copyWith(
                              color: chateuPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    const Divider(height: 1),
                  ],
                ),
              ),
              // Scrollable cards list
              Expanded(
                child: ListView.builder(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(AppSpacing.xl,
                      AppSpacing.md, AppSpacing.xl, AppSpacing.xxxl),
                  itemCount: ranges.length,
                  itemBuilder: (_, i) {
                    final r = ranges[i];
                    final color = _categoryColor(r['category'] as String);
                    final isEmergency = r['is_emergency'] == true;
                    return Container(
                      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(AppRadius.md),
                        border: Border.all(
                          color: isEmergency
                              ? const Color(0xFFDC2626).withAlpha(120)
                              : color.withAlpha(60),
                          width: isEmergency ? 1.5 : 1,
                        ),
                        boxShadow: AppShadows.card,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            height: 3,
                            decoration: BoxDecoration(
                              color: color,
                              borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(AppRadius.md)),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(AppSpacing.md),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    AppStatusBadge(
                                      label: (r['category'] as String)
                                          .toUpperCase(),
                                      color: color,
                                    ),
                                    if (isEmergency) ...[
                                      const SizedBox(width: AppSpacing.sm),
                                      AppStatusBadge(
                                        label: 'EMERGENCY',
                                        color: const Color(0xFFDC2626),
                                      ),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: AppSpacing.sm),
                                Text(r['title'] as String,
                                    style: AppText.titleMedium),
                                if ((r['content'] as String).isNotEmpty) ...[
                                  const SizedBox(height: AppSpacing.xs),
                                  Text(
                                    r['content'] as String,
                                    style: AppText.bodyMedium
                                        .copyWith(color: Colors.grey.shade600),
                                  ),
                                ],
                              ],
                            ),
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
    );
  }

  Future<void> _loadBalance() async {
    final user = supabase.auth.currentUser;
    if (user == null) {
      setState(() => _balanceLoading = false);
      return;
    }
    try {
      final data = await supabase
          .from('payments')
          .select('amount, status')
          .eq('user_id', user.id)
          .inFilter('status', ['unpaid', 'overdue', 'pending_verification']);

      double unpaid = 0.0;
      double pending = 0.0;
      double overdue = 0.0;
      for (final row in (data as List)) {
        final amount = (row['amount'] as num?)?.toDouble() ?? 0.0;
        if (row['status'] == 'pending_verification') {
          pending += amount;
        } else if (row['status'] == 'overdue') {
          overdue += amount;
        } else {
          unpaid += amount;
        }
      }
      if (mounted) {
        setState(() {
          _balance = unpaid;
          _pendingBalance = pending;
          _overdueBalance = overdue;
          _balanceLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _balanceLoading = false);
    }
  }

  Future<void> _loadAnnouncements({bool reset = false}) async {
    if (reset) {
      setState(() {
        _announcementsLoading = true;
        _announcements = [];
        _currentPage = 0;
        _hasMore = true;
      });
    } else {
      setState(() => _loadingMore = true);
    }

    try {
      final from = _currentPage * _pageSize;
      final to = from + _pageSize - 1;

      final today = DateTime.now();
      final todayStr =
          '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

      final data = await supabase
          .from('announcements')
          .select()
          .or('status.eq.published,status.eq.active')
          // Only show announcements whose end_date is today or in the future
          // (or has no end_date at all)
          .or('end_date.is.null,end_date.gte.$todayStr')
          .order('created_at', ascending: false)
          .range(from, to);

      final results = List<Map<String, dynamic>>.from(data);

      if (mounted) {
        setState(() {
          _announcements.addAll(results);
          _hasMore = results.length == _pageSize;
          _currentPage++;
          _announcementsLoading = false;
          _loadingMore = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _announcementsLoading = false;
          _loadingMore = false;
          _hasMore = false;
        });
      }
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final screenW = mq.size.width;
    final hPad = screenW > 600 ? screenW * 0.06 : AppSpacing.lg;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: AppSpacing.md),

          // ── Balance Card ──────────────────────────────────────────
          // Guard: residentType == null means profile is still loading.
          // Only render once we know for certain the user is NOT a tenant
          // to prevent a 1-frame flicker for tenants.
          if (widget.residentType != null &&
              widget.residentType != 'tenant') ...[
            AnimatedOpacity(
              opacity: 1.0,
              duration: const Duration(milliseconds: 350),
              curve: Curves.easeOut,
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: hPad),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  decoration:
                      AppDecorations.primaryGradient(radius: AppRadius.lg),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "Account Balance",
                              style: AppText.caption.copyWith(
                                color: Colors.white.withAlpha(200),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            _balanceLoading
                                ? const SizedBox(
                                    height: 32,
                                    child: Align(
                                      alignment: Alignment.centerLeft,
                                      child: SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          color: Colors.white,
                                          strokeWidth: 2,
                                        ),
                                      ),
                                    ),
                                  )
                                : Text(
                                    "₱ ${(_balance + _pendingBalance + _overdueBalance).toStringAsFixed(2)}",
                                    style: AppText.displayLarge.copyWith(
                                      color: Colors.white,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                            const SizedBox(height: AppSpacing.sm),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.sm, vertical: 3),
                              decoration: BoxDecoration(
                                color: Colors.white.withAlpha(30),
                                borderRadius:
                                    BorderRadius.circular(AppRadius.xxl),
                              ),
                              child: Text(
                                _balanceLoading
                                    ? "Loading..."
                                    : (_overdueBalance > 0 && _pendingBalance > 0)
                                        ? "₱${_overdueBalance.toStringAsFixed(2)} overdue · ₱${_pendingBalance.toStringAsFixed(2)} pending"
                                        : _overdueBalance > 0
                                            ? "₱${_overdueBalance.toStringAsFixed(2)} overdue"
                                            : _balance > 0 && _pendingBalance > 0
                                                ? "₱${_balance.toStringAsFixed(2)} unpaid · ₱${_pendingBalance.toStringAsFixed(2)} pending"
                                                : _balance > 0
                                                    ? "₱${_balance.toStringAsFixed(2)} unpaid dues"
                                                    : _pendingBalance > 0
                                                        ? "₱${_pendingBalance.toStringAsFixed(2)} pending verification"
                                                        : "No dues pending ✓",
                                style: AppText.caption.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      GestureDetector(
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const PaymentPage()),
                        ),
                        child: Container(
                          padding: const EdgeInsets.all(AppSpacing.md + 2),
                          decoration: BoxDecoration(
                            color: Colors.white.withAlpha(30),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.account_balance_wallet_rounded,
                            color: Colors.white,
                            size: 28,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
          ],

          // ── Calendar Header ───────────────────────────────────────
          Padding(
            padding: EdgeInsets.symmetric(horizontal: hPad),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AppSectionHeader(title: "HOA Calendar"),
                const SizedBox(height: AppSpacing.sm),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _LegendDot(color: chateuPrimary, label: "General"),
                      const SizedBox(width: AppSpacing.md),
                      _LegendDot(color: chateuSecondary, label: "Financial"),
                      const SizedBox(width: AppSpacing.md),
                      _LegendDot(color: Color(0xFF3B82F6), label: "Event"),
                      const SizedBox(width: AppSpacing.md),
                      _LegendDot(
                          color: Color(0xFFFF8C42), label: "Maintenance"),
                      const SizedBox(width: AppSpacing.md),
                      _LegendDot(color: const Color(0xFFDC2626), label: "Election"),
                      const SizedBox(width: AppSpacing.md),
                      _LegendDot(color: Color(0xFF6B7280), label: "Security"),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          // ── Calendar ──────────────────────────────────────────────
          Padding(
            padding: EdgeInsets.symmetric(horizontal: hPad),
            child: Container(
              decoration: AppDecorations.card,
              child: TableCalendar(
                firstDay: DateTime.utc(2020, 1, 1),
                lastDay: DateTime.utc(2030, 12, 31),
                focusedDay: _focusedDay,
                selectedDayPredicate: (day) =>
                    _selectedDay != null && isSameDay(_selectedDay!, day),
                calendarFormat: CalendarFormat.month,
                headerStyle: HeaderStyle(
                  formatButtonVisible: false,
                  titleCentered: true,
                  titleTextStyle: AppText.titleMedium,
                  leftChevronIcon: const Icon(
                    Icons.chevron_left_rounded,
                    color: chateuPrimary,
                  ),
                  rightChevronIcon: const Icon(
                    Icons.chevron_right_rounded,
                    color: chateuPrimary,
                  ),
                ),
                calendarStyle: CalendarStyle(
                  todayDecoration: BoxDecoration(
                    color: chateuPrimary.withAlpha(30),
                    shape: BoxShape.circle,
                  ),
                  todayTextStyle: AppText.bodyMedium.copyWith(
                    color: chateuPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                  selectedDecoration: const BoxDecoration(
                    color: chateuPrimary,
                    shape: BoxShape.circle,
                  ),
                  selectedTextStyle:
                      AppText.bodyMedium.copyWith(color: Colors.white),
                  // Reservation dot marker
                  markerDecoration: const BoxDecoration(
                    color: chateuSecondary,
                    shape: BoxShape.circle,
                  ),
                  defaultTextStyle: AppText.bodyMedium,
                  weekendTextStyle:
                      AppText.bodyMedium.copyWith(color: chateuPrimary),
                  outsideTextStyle: AppText.bodyMedium.copyWith(
                    color: Colors.grey.shade300,
                  ),
                  // Range styling (used by calendarBuilders below)
                  rangeHighlightColor: const Color(0xFF3B82F6).withAlpha(40),
                ),
                eventLoader: (day) => _isReserved(day) ? [day] : [],
                onPageChanged: (day) => setState(() => _focusedDay = day),
                onDaySelected: (selected, focused) {
                  setState(() {
                    _selectedDay = selected;
                    _focusedDay = focused;
                  });
                  // Show bottom sheet if this day has announcements
                  final ranges = _rangesForDay(selected);
                  if (ranges.isNotEmpty) {
                    _showDayAnnouncementsSheet(selected, ranges);
                  }
                },
                // Custom builder — stacks colored strips for multiple ranges
                calendarBuilders: CalendarBuilders(
                  defaultBuilder: (ctx, day, focusedDay) => _buildDayCell(
                      ctx, day,
                      isToday: false, isSelected: false),
                  todayBuilder: (ctx, day, focusedDay) =>
                      _buildDayCell(ctx, day, isToday: true, isSelected: false),
                  selectedBuilder: (ctx, day, focusedDay) =>
                      _buildDayCell(ctx, day, isToday: false, isSelected: true),
                ),
              ),
            ),
          ),

          const SizedBox(height: AppSpacing.xl),

          // ── Announcements Header ──────────────────────────────────
          Padding(
            padding: EdgeInsets.symmetric(horizontal: hPad),
            child: const AppSectionHeader(title: "Announcements"),
          ),

          const SizedBox(height: AppSpacing.md),

          // ── Announcements List ────────────────────────────────────
          if (_announcementsLoading)
            Padding(
              padding: EdgeInsets.symmetric(
                  horizontal: hPad, vertical: AppSpacing.xxxl),
              child: const Center(
                child: CircularProgressIndicator(color: chateuPrimary),
              ),
            )
          else if (_announcements.isEmpty)
            Padding(
              padding: EdgeInsets.symmetric(
                  horizontal: hPad, vertical: AppSpacing.xxxl),
              child: Center(
                child: Text(
                  "No announcements yet",
                  style: AppText.bodyMedium.copyWith(
                    color: Colors.grey.shade400,
                  ),
                ),
              ),
            )
          else ...[
            // Emergency announcements always pinned first
            ...List.generate(
              _announcements.length,
              (i) {
                final sorted = [
                  ..._announcements.where((a) => a['is_emergency'] == true),
                  ..._announcements.where((a) => a['is_emergency'] != true),
                ];
                return Padding(
                  padding: EdgeInsets.symmetric(horizontal: hPad),
                  child: _AnnouncementCard(data: sorted[i]),
                );
              },
            ),
            Padding(
              padding: EdgeInsets.symmetric(
                  horizontal: hPad, vertical: AppSpacing.md),
              child: _hasMore
                  ? AppPrimaryButton(
                      label: "Load More",
                      icon: Icons.expand_more_rounded,
                      isLoading: _loadingMore,
                      onPressed: _loadAnnouncements,
                      height: 46,
                    )
                  : Center(
                      child: Text(
                        "— All announcements loaded —",
                        style: AppText.caption.copyWith(
                          color: Colors.grey.shade400,
                        ),
                      ),
                    ),
            ),
          ],

          const SizedBox(height: AppSpacing.xxxl),
        ],
      ),
    );
  }
}
// ── Announcement Card (expandable + attachment) ────────────────────────────────

class _AnnouncementCard extends StatefulWidget {
  final Map<String, dynamic> data;
  const _AnnouncementCard({required this.data});

  @override
  State<_AnnouncementCard> createState() => _AnnouncementCardState();
}

class _AnnouncementCardState extends State<_AnnouncementCard> {
  bool _expanded = false;

  bool get _hasAttachment {
    final url = widget.data['attachment_url'] as String?;
    return url != null && url.isNotEmpty && url != 'EMPTY';
  }

  String get _attachmentUrl => widget.data['attachment_url'] as String;

  bool get _isImage {
    final url = _attachmentUrl.toLowerCase();
    return url.contains('.jpg') ||
        url.contains('.jpeg') ||
        url.contains('.png') ||
        url.contains('.gif') ||
        url.contains('.webp');
  }

  bool get _isPdf {
    return _attachmentUrl.toLowerCase().contains('.pdf');
  }

  static Color _categoryColor(String? category) {
    switch ((category ?? '').toLowerCase()) {
      case 'event':
        return const Color(0xFF3B82F6);
      case 'maintenance':
        return const Color(0xFFFF8C42);
      case 'election':
        return const Color(0xFFDC2626);
      case 'security':
        return const Color(0xFF6B7280);
      case 'financial':
        return chateuSecondary;
      default:
        return chateuPrimary;
    }
  }

  static String _formatDate(String? raw) {
    if (raw == null) return '';
    try {
      final d = DateTime.parse(raw);
      const months = [
        '',
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      return '${months[d.month]} ${d.day}, ${d.year}';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.data;
    final isEmergency = a['is_emergency'] == true;
    final color = _categoryColor(a['category'] as String?);
    final dateStr = _formatDate(a['created_at'] as String?);

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: isEmergency
            ? Border.all(
                color: const Color(0xFFDC2626).withAlpha(120),
                width: 1.5,
              )
            : null,
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header strip ──────────────────────────────────────────
          Container(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.sm),
            decoration: BoxDecoration(
              color: color.withAlpha(16),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(AppRadius.md),
              ),
            ),
            child: Row(
              children: [
                if (isEmergency)
                  Container(
                    margin: const EdgeInsets.only(right: AppSpacing.sm),
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDC2626),
                      borderRadius: BorderRadius.circular(AppRadius.xxl),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.warning_rounded,
                            color: Colors.white, size: 11),
                        const SizedBox(width: 3),
                        Text(
                          "EMERGENCY",
                          style: AppText.caption.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 9,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                AppStatusBadge(
                  label: (a['category'] as String? ?? 'General').toUpperCase(),
                  color: color,
                ),
                const Spacer(),
                Text(
                  dateStr,
                  style: AppText.caption.copyWith(color: Colors.grey.shade500),
                ),
              ],
            ),
          ),

          // ── Body ──────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  a['title'] as String? ?? "Announcement",
                  style: AppText.titleMedium,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  a['content'] as String? ?? '',
                  maxLines: _expanded ? null : 3,
                  overflow:
                      _expanded ? TextOverflow.visible : TextOverflow.ellipsis,
                  style: AppText.bodyMedium.copyWith(
                    color: Colors.grey.shade600,
                  ),
                ),
                if (a['author_name'] != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      Icon(Icons.person_outline,
                          size: 13, color: Colors.grey.shade400),
                      const SizedBox(width: 4),
                      Text(
                        a['author_name'] as String,
                        style: AppText.caption
                            .copyWith(color: Colors.grey.shade400),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          // ── Attachment (shown when expanded) ──────────────────────
          if (_expanded && _hasAttachment)
            _AttachmentPreview(
                url: _attachmentUrl, isImage: _isImage, isPdf: _isPdf),

          // ── Footer: only shown when there is an attachment ─────────
          if (_hasAttachment)
            InkWell(
              onTap: () => setState(() => _expanded = !_expanded),
              borderRadius: const BorderRadius.vertical(
                  bottom: Radius.circular(AppRadius.md)),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: const BorderRadius.vertical(
                      bottom: Radius.circular(AppRadius.md)),
                  border: Border(top: BorderSide(color: Colors.grey.shade100)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.attach_file_rounded, size: 14, color: color),
                    const SizedBox(width: 4),
                    Text(
                      _isPdf
                          ? "PDF attached"
                          : _isImage
                              ? "Photo attached"
                              : "File attached",
                      style: AppText.caption.copyWith(
                        color: color,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      _expanded ? "Hide" : "View",
                      style: AppText.caption.copyWith(
                        color: Colors.grey.shade500,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 3),
                    Icon(
                      _expanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      size: 16,
                      color: Colors.grey.shade500,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Attachment Preview ─────────────────────────────────────────────────────────

class _AttachmentPreview extends StatelessWidget {
  final String url;
  final bool isImage;
  final bool isPdf;

  const _AttachmentPreview({
    required this.url,
    required this.isImage,
    required this.isPdf,
  });

  @override
  Widget build(BuildContext context) {
    if (isImage) {
      return GestureDetector(
        onTap: () => _openFullscreen(context),
        child: Container(
          margin: const EdgeInsets.fromLTRB(
              AppSpacing.md, 0, AppSpacing.md, AppSpacing.sm),
          height: 180,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            color: Colors.grey.shade100,
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.network(
                  url,
                  fit: BoxFit.cover,
                  loadingBuilder: (_, child, progress) {
                    if (progress == null) return child;
                    return Center(
                      child: CircularProgressIndicator(
                        value: progress.expectedTotalBytes != null
                            ? progress.cumulativeBytesLoaded /
                                progress.expectedTotalBytes!
                            : null,
                        color: chateuPrimary,
                        strokeWidth: 2,
                      ),
                    );
                  },
                  errorBuilder: (_, __, ___) => Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.broken_image_outlined,
                            color: Colors.grey.shade400, size: 32),
                        const SizedBox(height: AppSpacing.xs),
                        Text("Could not load image",
                            style: AppText.caption
                                .copyWith(color: Colors.grey.shade400)),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  bottom: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(AppRadius.xxl),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.fullscreen_rounded,
                            color: Colors.white, size: 14),
                        const SizedBox(width: 3),
                        Text("View full",
                            style:
                                AppText.caption.copyWith(color: Colors.white)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (isPdf) {
      return _FileTile(
        url: url,
        icon: Icons.picture_as_pdf_rounded,
        iconColor: const Color(0xFFDC2626),
        label: url.split('/').last.split('?').first,
        onTap: () => _confirmOpenPdf(context, url),
      );
    }

    // External link
    return _FileTile(
      url: url,
      icon: Icons.link_rounded,
      iconColor: const Color(0xFF3B82F6),
      label: url,
      onTap: () => _confirmOpenLink(context, url),
    );
  }

  void _openFullscreen(BuildContext context) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) =>
          _AttachmentFullscreen(url: url, isImage: isImage, isPdf: isPdf),
    ));
  }

  static Future<void> _confirmOpenPdf(BuildContext context, String url) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md)),
        title: Text("Open PDF", style: AppText.titleMedium),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Open this PDF in your browser?", style: AppText.bodyMedium),
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: const Color(0xFFDC2626).withAlpha(14),
                borderRadius: BorderRadius.circular(AppRadius.xs),
              ),
              child: Row(
                children: [
                  const Icon(Icons.picture_as_pdf_rounded,
                      color: Color(0xFFDC2626), size: 16),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      url.split('/').last.split('?').first,
                      style:
                          AppText.caption.copyWith(color: Colors.grey.shade700),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text("Cancel",
                style: AppText.labelMedium.copyWith(color: Colors.grey)),
          ),
          ElevatedButton.icon(
            onPressed: () => Navigator.pop(ctx, true),
            icon: const Icon(Icons.open_in_new_rounded,
                color: Colors.white, size: 16),
            label: Text("Open PDF",
                style: AppText.labelMedium.copyWith(color: Colors.white)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              elevation: 0,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.sm)),
            ),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final uri = Uri.tryParse(url);
      if (uri != null) {
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Could not open PDF',
                  style: AppText.bodyMedium.copyWith(color: Colors.white)),
              backgroundColor: const Color(0xFFDC2626),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    }
  }

  static Future<void> _confirmOpenLink(BuildContext context, String url) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md)),
        title: Text("Open Link", style: AppText.titleMedium),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("You are about to open an external link:",
                style: AppText.bodyMedium),
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(AppRadius.xs),
              ),
              child: Text(
                url,
                style: AppText.caption.copyWith(color: Colors.grey.shade700),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text("Cancel",
                style: AppText.labelMedium.copyWith(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: chateuPrimary,
              elevation: 0,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.sm)),
            ),
            child: Text("Open",
                style: AppText.labelMedium.copyWith(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final uri = Uri.tryParse(url);
      if (uri != null && context.mounted) {
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Could not open link',
                  style: AppText.bodyMedium.copyWith(color: Colors.white)),
              backgroundColor: const Color(0xFFDC2626),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    }
  }
}

// ── File Tile ──────────────────────────────────────────────────────────────────

class _FileTile extends StatelessWidget {
  final String url;
  final IconData icon;
  final Color iconColor;
  final String label;
  final VoidCallback onTap;

  const _FileTile({
    required this.url,
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.fromLTRB(
            AppSpacing.md, 0, AppSpacing.md, AppSpacing.sm),
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md, vertical: AppSpacing.sm),
        decoration: BoxDecoration(
          color: iconColor.withAlpha(10),
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(color: iconColor.withAlpha(40)),
        ),
        child: Row(
          children: [
            Icon(icon, color: iconColor, size: 20),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                label.isNotEmpty ? label : "Attachment",
                style: AppText.bodyMedium.copyWith(
                  color: iconColor,
                  fontWeight: FontWeight.w600,
                ),
                overflow: TextOverflow.ellipsis,
                maxLines: 2,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Icon(Icons.open_in_new_rounded, color: iconColor, size: 16),
          ],
        ),
      ),
    );
  }
}

// ── Attachment Fullscreen ──────────────────────────────────────────────────────

class _AttachmentFullscreen extends StatelessWidget {
  final String url;
  final bool isImage;
  final bool isPdf;

  const _AttachmentFullscreen({
    required this.url,
    required this.isImage,
    required this.isPdf,
  });

  @override
  Widget build(BuildContext context) {
    String title;
    if (isImage) {
      title = "Photo";
    } else if (isPdf) {
      title = "PDF Document";
    } else {
      title = "Link";
    }

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(title,
            style: AppText.titleMedium.copyWith(color: Colors.white)),
      ),
      body: isImage
          ? InteractiveViewer(
              minScale: 0.5,
              maxScale: 5.0,
              child: Center(
                child: Image.network(
                  url,
                  fit: BoxFit.contain,
                  loadingBuilder: (_, child, progress) {
                    if (progress == null) return child;
                    return Center(
                      child: CircularProgressIndicator(
                        value: progress.expectedTotalBytes != null
                            ? progress.cumulativeBytesLoaded /
                                progress.expectedTotalBytes!
                            : null,
                        color: chateuPrimary,
                      ),
                    );
                  },
                  errorBuilder: (_, __, ___) => Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.broken_image_outlined,
                            color: Colors.white54, size: 48),
                        const SizedBox(height: AppSpacing.md),
                        Text("Could not load image",
                            style: AppText.bodyMedium
                                .copyWith(color: Colors.white54)),
                      ],
                    ),
                  ),
                ),
              ),
            )
          : Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xxl),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isPdf ? Icons.picture_as_pdf_rounded : Icons.link_rounded,
                      color: isPdf
                          ? const Color(0xFFDC2626)
                          : const Color(0xFF3B82F6),
                      size: 64,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      isPdf ? url.split('/').last.split('?').first : url,
                      style: AppText.bodyMedium.copyWith(color: Colors.white70),
                      textAlign: TextAlign.center,
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    const SizedBox(height: AppSpacing.xl),
                    ElevatedButton.icon(
                      onPressed: () async {
                        final uri = Uri.tryParse(url);
                        if (uri != null && await canLaunchUrl(uri)) {
                          await launchUrl(uri,
                              mode: LaunchMode.externalApplication);
                        }
                      },
                      icon: const Icon(Icons.open_in_new_rounded,
                          color: Colors.white, size: 16),
                      label: Text(
                        isPdf ? "Open PDF" : "Open Link",
                        style:
                            AppText.labelMedium.copyWith(color: Colors.white),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: chateuPrimary,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}