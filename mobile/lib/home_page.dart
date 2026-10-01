import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:intl/intl.dart' show DateFormat;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_colors.dart';
import 'domain/format/format.dart';
import 'app_services.dart';
import 'domain/dues/dues.dart';
import 'domain/resident/current_resident.dart';
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
import 'settings_page.dart';
import 'package:url_launcher/url_launcher.dart';
import 'push_notifications.dart';

// ── HomePage ───────────────────────────────────────────────────────────────────

class HomePage extends StatefulWidget {
  const HomePage({super.key, this.resident});

  /// Defaults to the app's [currentResident]; tests pass their own.
  final CurrentResident? resident;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _selectedIndex = 0;
  final supabase = Supabase.instance.client;

  String? _avatarUrl;
  String _displayName = "Chateau Resident";
  Resident? _resident; // null while loading → treated as a Tenant

  @override
  void initState() {
    super.initState();
    _loadProfile();
    PushNotifications.registerToken();
  }

  Future<void> _loadProfile() async {
    try {
      final resident = await (widget.resident ?? currentResident).load();
      if (mounted && resident != null) {
        setState(() {
          _resident = resident;
          _avatarUrl = resident.avatarUrl;
          _displayName = resident.fullName.isNotEmpty
              ? resident.fullName
              : "Chateau Resident";
        });
      }
    } catch (_) {}
  }

  Future<void> _handleLogout() async {
    if (mounted && (Scaffold.maybeOf(context)?.isDrawerOpen ?? false)) {
      Navigator.of(context).pop();
    }

    final confirm = await showConfirmDialog(
      context,
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmLabel: 'Sign Out',
      cancelLabel: 'Cancel',
      isDanger: true,
      icon: Icons.logout_rounded,
    );

    if (confirm == true) {
      try {
        await PushNotifications.unregisterToken();
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

  // Tabs are built on first visit and then kept alive, so switching back
  // doesn't refetch data or reset scroll (the map keeps its tiles).
  final Set<int> _visitedTabs = {0};

  static const _destinations = [
    (icon: Icons.home_outlined, selected: Icons.home_rounded, label: 'Home'),
    (
      icon: Icons.chat_bubble_outline,
      selected: Icons.chat_bubble_rounded,
      label: 'Report'
    ),
    (icon: Icons.map_outlined, selected: Icons.map_rounded, label: 'Map'),
    (
      icon: Icons.event_available_outlined,
      selected: Icons.event_available_rounded,
      label: 'Reserve'
    ),
  ];

  Widget _tab(int index) {
    switch (index) {
      case 1:
        return const ReportPage();
      case 2:
        return const MapPage();
      case 3:
        return const ReservePage();
      default:
        return HomeDashboard(
          resident: _resident,
          displayName: _displayName,
          onOpenTab: _selectTab,
        );
    }
  }

  void _selectTab(int index) => setState(() {
        _selectedIndex = index;
        _visitedTabs.add(index);
      });

  @override
  Widget build(BuildContext context) {
    final user = supabase.auth.currentUser;
    final wide = MediaQuery.sizeOf(context).width >= 600;

    final body = IndexedStack(
      index: _selectedIndex,
      children: [
        for (var i = 0; i < _destinations.length; i++)
          _visitedTabs.contains(i) ? _tab(i) : const SizedBox.shrink(),
      ],
    );

    return SafeArea(
      top: false,
      bottom: false,
      child: Scaffold(
        drawer: _buildDrawer(user, _resident),
        appBar: _buildAppBar(),
        body: wide
            ? Row(children: [
                NavigationRail(
                  selectedIndex: _selectedIndex,
                  onDestinationSelected: _selectTab,
                  labelType: NavigationRailLabelType.all,
                  destinations: [
                    for (final d in _destinations)
                      NavigationRailDestination(
                        icon: Icon(d.icon),
                        selectedIcon: Icon(d.selected),
                        label: Text(d.label),
                      ),
                  ],
                ),
                const VerticalDivider(width: 1),
                Expanded(child: body),
              ])
            : body,
        bottomNavigationBar: wide
            ? null
            : NavigationBar(
                selectedIndex: _selectedIndex,
                onDestinationSelected: _selectTab,
                destinations: [
                  for (final d in _destinations)
                    NavigationDestination(
                      icon: Icon(d.icon),
                      selectedIcon: Icon(d.selected),
                      label: d.label,
                    ),
                ],
              ),
      ),
    );
  }

  // ── Drawer ────────────────────────────────────────────────────────────────

  Widget _buildDrawer(User? user, Resident? resident) {
    // resident == null → still loading; show no Homeowner-only tiles yet,
    // so they never flash then disappear for a Tenant.
    final role = resident == null
        ? null
        : resident.isHomeowner
            ? 'Homeowner'
            : 'Tenant';

    void open(Widget page, {VoidCallback? then}) async {
      Navigator.pop(context);
      await Navigator.push(context, MaterialPageRoute(builder: (_) => page));
      then?.call();
    }

    return Drawer(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Account card: who's signed in; tapping opens My Account
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md, AppSpacing.lg, AppSpacing.md, AppSpacing.xs),
              child: Material(
                color: chateuSurfaceMuted,
                borderRadius: BorderRadius.circular(AppRadius.lg),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => open(const AccountPage(), then: _loadProfile),
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    child: Row(
                      children: [
                        ClipOval(
                          child: SizedBox(
                              width: 52,
                              height: 52,
                              child: _buildDrawerAvatar()),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _displayName,
                                style: AppText.titleMedium,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                user?.email ?? '',
                                style: AppText.caption,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (role != null) ...[
                                const SizedBox(height: 6),
                                AppStatusBadge(
                                    label: role, color: chateuPrimary),
                              ],
                            ],
                          ),
                        ),
                        Icon(Icons.chevron_right_rounded,
                            color: chateuTextMuted),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),

          // ── Destinations, grouped
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.sm),
              children: [
                if (resident?.canPayDues ?? false) ...[
                  _drawerSection('Account'),
                  _drawerTile(
                    icon: Icons.receipt_long_outlined,
                    label: "Payments",
                    onTap: () => open(const PaymentPage()),
                  ),
                ],
                if (resident?.canManageTenants ?? false)
                  _drawerTile(
                    icon: Icons.people_alt_outlined,
                    label: "Tenant Management",
                    onTap: () => open(const TenantManagementPage()),
                  ),
                if (resident?.canVote ?? false) ...[
                  _drawerSection('Community'),
                  _drawerTile(
                    icon: Icons.how_to_vote_outlined,
                    label: "Voting",
                    onTap: () => open(const VotingPage()),
                  ),
                ],
                _drawerSection('App'),
                _drawerTile(
                  icon: Icons.settings_outlined,
                  label: "Settings",
                  onTap: () => open(const SettingsPage()),
                ),
                _drawerTile(
                  icon: Icons.info_outline_rounded,
                  label: "About Us",
                  onTap: () => open(const AboutPage()),
                ),
              ],
            ),
          ),

          // ── Footer
          const Divider(height: 1),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.sm),
              child: _drawerTile(
                icon: Icons.logout_rounded,
                label: "Sign Out",
                color: chateuError,
                onTap: _handleLogout,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── AppBar ────────────────────────────────────────────────────────────────

  PreferredSizeWidget _buildAppBar() {
    final buttonStyle = IconButton.styleFrom(
      backgroundColor: Colors.white.withAlpha(34),
      foregroundColor: chateuOnBrand,
    );
    return AppBar(
      backgroundColor: chateuBrand,
      elevation: 0,
      scrolledUnderElevation: 0,
      systemOverlayStyle: SystemUiOverlayStyle.light,
      flexibleSpace: CustomPaint(
        painter: LotPlanPainter(color: Colors.white.withAlpha(22)),
      ),
      leading: Builder(
        builder: (context) => Center(
          child: IconButton(
            tooltip: 'Open menu',
            style: buttonStyle,
            icon: const Icon(Icons.grid_view_rounded),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
      ),
      title: Image.asset(
        'assets/logo.png',
        height: 30,
        semanticLabel: 'Chateau Real',
        errorBuilder: (c, e, s) => Text(
          "CHATEAU",
          style: AppText.titleLarge.copyWith(color: chateuLogoYellow),
        ),
      ),
      centerTitle: true,
      actions: [
        IconButton(
          tooltip: 'Notifications',
          style: buttonStyle,
          icon: const Icon(Icons.notifications_none_outlined),
          onPressed: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (c) => const NotificationPage()),
          ),
        ),
        const SizedBox(width: AppSpacing.xs),
      ],
      // Signature rule in the logo's colors: dark green, with a short
      // yellow segment under the wordmark.
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(2),
        child: SizedBox(
          height: 2,
          child: Stack(
            children: [
              const Positioned.fill(
                  child: ColoredBox(color: Color(0xFF004D29))),
              Center(child: Container(width: 48, color: chateuLogoYellow)),
            ],
          ),
        ),
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Widget _drawerSection(String label) => Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xs),
        child: Text(label,
            style: AppText.caption.copyWith(fontWeight: FontWeight.w600)),
      );

  Widget _drawerTile({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color? color,
  }) {
    return ListTile(
      leading: Icon(icon, color: color ?? chateuPrimary),
      title: Text(
        label,
        style: AppText.bodyLarge.copyWith(
          color: color,
          fontWeight: FontWeight.w500,
        ),
      ),
      shape: const StadiumBorder(),
      onTap: onTap,
    );
  }

  Widget _buildDrawerAvatar() {
    if (_avatarUrl != null && _avatarUrl!.isNotEmpty) {
      return Image.network(
        _avatarUrl!,
        width: 60,
        height: 60,
        cacheWidth: 180,
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
      color: chateuBrand,
      alignment: Alignment.center,
      child: Text(
        initials,
        style: AppText.displayMedium.copyWith(color: chateuOnBrand),
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
        Text(label, style: AppText.caption.copyWith(color: chateuTextMuted)),
      ],
    );
  }
}

// ── Hero quick action ─────────────────────────────────────────────────────────

class _HeroAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _HeroAction(
      {required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Padding(
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xs, vertical: AppSpacing.xs),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: chateuOnBrand.withAlpha(26),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(icon, color: chateuOnBrand, size: 22),
              ),
              const SizedBox(height: 6),
              Text(label,
                  style: AppText.caption.copyWith(
                      color: chateuOnBrand, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

// ── HomeDashboard ──────────────────────────────────────────────────────────────

class HomeDashboard extends StatefulWidget {
  final Resident? resident;

  /// Defaults to the app's [dues]; tests pass their own.
  final Dues? dues;
  final String displayName;
  final ValueChanged<int> onOpenTab;
  const HomeDashboard({
    super.key,
    this.resident,
    this.dues,
    required this.displayName,
    required this.onOpenTab,
  });

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

  DuesLedger? _ledger;
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
    // Skip the balance only for a known Tenant: the Resident may still be
    // loading here, and showBalance hides it until they're known.
    if (widget.resident?.canPayDues ?? true) {
      _loadBalance();
    } else {
      _balanceLoading = false;
    }
    _loadAnnouncements(reset: true);
  }

  Future<void> _loadReservedDates() async {
    try {
      final dates = await reservations.reservedDates();
      if (mounted) setState(() => _reservedDates = dates);
    } catch (_) {}
  }

  bool _isReserved(DateTime day) {
    return _reservedDates.contains(dateKey(day));
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

  Color _categoryColor(String? category) => announcementCategoryColor(category);

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
          const BoxDecoration(color: chateuBrand, shape: BoxShape.circle);
      textColor = chateuOnBrand;
    } else if (isToday) {
      circleDecoration = BoxDecoration(
          color: chateuPrimary.withAlpha(24),
          shape: BoxShape.circle,
          border: Border.all(color: chateuPrimary, width: 2));
      textColor = chateuPrimary;
    }

    // Event days: soft tint of the first category color (the dots below carry
    // the category), text stays dark for readability.
    if (hasRanges && !isSelected && !isToday) {
      circleDecoration = BoxDecoration(
        shape: BoxShape.circle,
        color:
            _categoryColor(ranges.first['category'] as String?).withAlpha(24),
      );
      textColor = chateuText;
    }

    final label = [
      DateFormat('MMMM d').format(day),
      if (isToday) 'today',
      if (hasRanges)
        '${ranges.length} announcement${ranges.length == 1 ? '' : 's'}',
    ].join(', ');

    return Semantics(
      label: label,
      selected: isSelected,
      excludeSemantics: true,
      child: SizedBox(
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
                  ],
                ),
              ),
            ] else
              const SizedBox(height: 9),
          ],
        ),
      ),
    );
  }

  // ── Day announcements bottom sheet ─────────────────────────────────────────

  void _showDayAnnouncementsSheet(
      DateTime day, List<Map<String, dynamic>> ranges) {
    final dateLabel = shortDate(day);

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        minChildSize: 0.3,
        maxChildSize: 0.92,
        builder: (sheetCtx, scrollController) => Container(
          decoration: BoxDecoration(
            color: chateuSurface,
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
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
                          color: chateuBorder,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        Icon(Icons.calendar_today_rounded,
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
                  padding: EdgeInsets.fromLTRB(
                      AppSpacing.xl,
                      AppSpacing.md,
                      AppSpacing.xl,
                      AppSpacing.xxxl + MediaQuery.paddingOf(context).bottom),
                  itemCount: ranges.length,
                  itemBuilder: (_, i) {
                    final r = ranges[i];
                    final color = _categoryColor(r['category'] as String);
                    final isEmergency = r['is_emergency'] == true;
                    return Container(
                      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: chateuSurface,
                        borderRadius: BorderRadius.circular(AppRadius.md),
                        border: Border.all(
                          color: isEmergency
                              ? chateuError.withAlpha(120)
                              : color.withAlpha(60),
                          width: isEmergency ? 1.5 : 1,
                        ),
                        boxShadow: AppShadows.card,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(AppSpacing.md),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    AppStatusBadge(
                                      label: r['category'] as String,
                                      color: color,
                                    ),
                                    if (isEmergency) ...[
                                      const SizedBox(width: AppSpacing.sm),
                                      AppStatusBadge(
                                        label: 'Emergency',
                                        color: chateuError,
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
                                        .copyWith(color: chateuTextMuted),
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
    try {
      final ledger = await (widget.dues ?? dues).load();
      if (mounted) {
        setState(() {
          _ledger = ledger;
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
      final todayStr = dateKey(today);

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

  Future<void> _refreshDashboard() => Future.wait([
        _loadReservedDates(),
        _loadAnnouncementRanges(),
        if (widget.resident?.canPayDues ?? true) _loadBalance(),
        _loadAnnouncements(reset: true),
      ]);

  // ── Build ─────────────────────────────────────────────────────────────────

  String get _balanceStatus {
    final l = _ledger;
    if (l == null) return 'No dues pending';
    final parts = [
      if (l.overdue > 0) '${peso(l.overdue)} overdue',
      if (l.unpaid > 0) '${peso(l.unpaid)} unpaid',
      if (l.unconfirmedDues > 0) '${peso(l.unconfirmedDues)} unconfirmed dues',
      // Sent, not yet verified: beside the Balance, not inside it.
      if (l.pendingVerification > 0)
        '${peso(l.pendingVerification)} pending verification',
    ];
    return parts.isEmpty ? 'No dues pending' : parts.join(' · ');
  }

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  Widget _buildHero(bool showBalance) {
    const on = chateuOnBrand;
    final soft = on.withAlpha(235);
    final firstName = widget.displayName.split(' ').first;
    final balance = _ledger?.balance ?? 0;
    final overdue = (_ledger?.overdue ?? 0) > 0;

    void openPayments() => Navigator.push(
        context, MaterialPageRoute(builder: (_) => const PaymentPage()));
    void openNotifications() => Navigator.push(
        context, MaterialPageRoute(builder: (_) => const NotificationPage()));

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        // A step lighter than the brand-green header above it (white 5:1).
        color: const Color(0xFF1A7F4D),
        borderRadius: BorderRadius.circular(AppRadius.xl),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(appDark ? 90 : 40),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: CustomPaint(
        painter: LotPlanPainter(color: on.withAlpha(20)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.xl, AppSpacing.xl, AppSpacing.xl, AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Greeting
              Text(_greeting, style: AppText.bodyMedium.copyWith(color: soft)),
              const SizedBox(height: 2),
              Semantics(
                header: true,
                child: Text(firstName,
                    style: AppText.displayLarge.copyWith(color: on)),
              ),

              // ── Balance (homeowners)
              if (showBalance) ...[
                const SizedBox(height: AppSpacing.xl),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("Balance due",
                              style: AppText.caption.copyWith(
                                  color: soft, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 2),
                          _balanceLoading
                              ? const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 8),
                                  child: SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: on),
                                  ),
                                )
                              : Text(
                                  peso(balance),
                                  style: AppText.displayMedium.copyWith(
                                    color: on,
                                    fontSize: 26,
                                    fontFeatures: const [
                                      FontFeature.tabularFigures()
                                    ],
                                  ),
                                ),
                          if (!_balanceLoading)
                            Row(
                              children: [
                                if (overdue) ...[
                                  const Icon(Icons.warning_amber_rounded,
                                      size: 14, color: Color(0xFFF4DD03)),
                                  const SizedBox(width: 4),
                                ],
                                Flexible(
                                  child: Text(
                                    _balanceStatus,
                                    style: AppText.caption.copyWith(
                                      color: overdue ? on : soft,
                                      fontWeight:
                                          overdue ? FontWeight.w700 : null,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: on,
                        foregroundColor: const Color(0xFF1A7F4D),
                      ),
                      onPressed: openPayments,
                      child: Text(balance > 0 ? "Pay now" : "Payments"),
                    ),
                  ],
                ),
              ],

              // ── Quick actions
              const SizedBox(height: AppSpacing.lg),
              Divider(color: on.withAlpha(40), height: 1),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                alignment: WrapAlignment.spaceAround,
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  _HeroAction(
                      icon: Icons.chat_bubble_outline,
                      label: 'Report',
                      onTap: () => widget.onOpenTab(1)),
                  _HeroAction(
                      icon: Icons.map_outlined,
                      label: 'Map',
                      onTap: () => widget.onOpenTab(2)),
                  _HeroAction(
                      icon: Icons.event_available_outlined,
                      label: 'Reserve',
                      onTap: () => widget.onOpenTab(3)),
                  !(widget.resident?.canPayDues ?? false)
                      ? _HeroAction(
                          icon: Icons.notifications_none_outlined,
                          label: 'Alerts',
                          onTap: openNotifications)
                      : _HeroAction(
                          icon: Icons.receipt_long_outlined,
                          label: 'Bills',
                          onTap: openPayments),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const hPad = AppSpacing.lg;
    // Emergency announcements always pinned first.
    final sorted = [
      ..._announcements.where((a) => a['is_emergency'] == true),
      ..._announcements.where((a) => a['is_emergency'] != true),
    ];

    final showBalance = widget.resident?.canPayDues ?? false;

    return RefreshIndicator(
      onRefresh: _refreshDashboard,
      child: SingleChildScrollView(
        padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          children: [
            AppContentWidth(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: hPad),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: AppSpacing.md),

                    // showBalance is false while the Resident loads, so the
                    // balance never flashes for Tenants.
                    _buildHero(showBalance),
                    const SizedBox(height: AppSpacing.xxl),

                    const AppSectionHeader(title: "HOA Calendar"),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.md,
                      runSpacing: AppSpacing.xs,
                      children: [
                        _LegendDot(color: chateuPrimary, label: "General"),
                        _LegendDot(color: chateuSecondary, label: "Financial"),
                        _LegendDot(color: chateuInfo, label: "Event"),
                        _LegendDot(
                            color: chateuMaintenance, label: "Maintenance"),
                        _LegendDot(color: chateuError, label: "Election"),
                        _LegendDot(color: chateuTextMuted, label: "Security"),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Container(
                      decoration: AppDecorations.card,
                      child: _buildCalendar(),
                    ),

                    const SizedBox(height: AppSpacing.xxl),
                    const AppSectionHeader(title: "Announcements"),
                    const SizedBox(height: AppSpacing.md),

                    if (_announcementsLoading)
                      const Padding(
                        padding:
                            EdgeInsets.symmetric(vertical: AppSpacing.xxxl),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else if (_announcements.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            vertical: AppSpacing.xxxl),
                        child: Center(
                          child: Text(
                            "No announcements yet",
                            style: AppText.bodyMedium
                                .copyWith(color: chateuTextMuted),
                          ),
                        ),
                      )
                    else ...[
                      for (final a in sorted) _AnnouncementCard(data: a),
                      if (_hasMore)
                        Center(
                          child: _loadingMore
                              ? const Padding(
                                  padding: EdgeInsets.all(AppSpacing.md),
                                  child: SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2),
                                  ),
                                )
                              : OutlinedButton(
                                  onPressed: _loadAnnouncements,
                                  child: const Text("Load more"),
                                ),
                        ),
                    ],

                    const SizedBox(height: AppSpacing.xxxl),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCalendar() {
    return TableCalendar(
      firstDay: DateTime.utc(2020, 1, 1),
      lastDay: DateTime.utc(2030, 12, 31),
      focusedDay: _focusedDay,
      selectedDayPredicate: (day) =>
          _selectedDay != null && isSameDay(_selectedDay!, day),
      calendarFormat: CalendarFormat.month,
      availableGestures: AvailableGestures.horizontalSwipe,
      headerStyle: HeaderStyle(
        formatButtonVisible: false,
        titleCentered: true,
        titleTextStyle: AppText.titleMedium,
        leftChevronIcon: Icon(Icons.chevron_left_rounded,
            color: chateuPrimary, semanticLabel: 'Previous month'),
        rightChevronIcon: Icon(Icons.chevron_right_rounded,
            color: chateuPrimary, semanticLabel: 'Next month'),
      ),
      daysOfWeekStyle: DaysOfWeekStyle(
        weekdayStyle: AppText.caption.copyWith(fontWeight: FontWeight.w600),
        weekendStyle: AppText.caption
            .copyWith(color: chateuPrimary, fontWeight: FontWeight.w600),
      ),
      calendarStyle: CalendarStyle(
        // Reservation dot marker
        markerDecoration: BoxDecoration(
          color: chateuSecondary,
          shape: BoxShape.circle,
        ),
        defaultTextStyle: AppText.bodyMedium,
        weekendTextStyle: AppText.bodyMedium.copyWith(color: chateuPrimary),
        outsideTextStyle: AppText.bodyMedium.copyWith(color: chateuTextSubtle),
      ),
      eventLoader: (day) => _isReserved(day) ? [day] : [],
      onPageChanged: (day) => setState(() => _focusedDay = day),
      onDaySelected: (selected, focused) {
        setState(() {
          _selectedDay = selected;
          _focusedDay = focused;
        });
        final ranges = _rangesForDay(selected);
        if (ranges.isNotEmpty) {
          _showDayAnnouncementsSheet(selected, ranges);
        }
      },
      // Custom cells: tint + category dots for announcement ranges
      calendarBuilders: CalendarBuilders(
        defaultBuilder: (ctx, day, focusedDay) =>
            _buildDayCell(ctx, day, isToday: false, isSelected: false),
        todayBuilder: (ctx, day, focusedDay) =>
            _buildDayCell(ctx, day, isToday: true, isSelected: false),
        selectedBuilder: (ctx, day, focusedDay) =>
            _buildDayCell(ctx, day, isToday: false, isSelected: true),
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

  static Color _categoryColor(String? category) =>
      announcementCategoryColor(category);

  static String _formatDate(String? raw) => shortDateFromRaw(raw);

  @override
  Widget build(BuildContext context) {
    final a = widget.data;
    final isEmergency = a['is_emergency'] == true;
    final color = _categoryColor(a['category'] as String?);
    final dateStr = _formatDate(a['created_at'] as String?);

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      decoration: BoxDecoration(
        color: chateuSurface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: isEmergency
            ? Border.all(
                color: chateuError.withAlpha(120),
                width: 1.5,
              )
            : Border.all(color: chateuBorder),
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
                      color: chateuError,
                      borderRadius: BorderRadius.circular(AppRadius.xxl),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.warning_rounded,
                            color: chateuOnColor, size: 14),
                        const SizedBox(width: 4),
                        Text(
                          "Emergency",
                          style: AppText.caption.copyWith(
                            color: chateuOnColor,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                AppStatusBadge(
                  label: a['category'] as String? ?? 'General',
                  color: color,
                ),
                const Spacer(),
                Text(
                  dateStr,
                  style: AppText.caption.copyWith(color: chateuTextMuted),
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
                    color: chateuTextMuted,
                  ),
                ),
                if (a['author_name'] != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      Icon(Icons.person_outline,
                          size: 13, color: chateuTextSubtle),
                      const SizedBox(width: 4),
                      Text(
                        a['author_name'] as String,
                        style:
                            AppText.caption.copyWith(color: chateuTextSubtle),
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
                  color: chateuSurfaceMuted,
                  borderRadius: const BorderRadius.vertical(
                      bottom: Radius.circular(AppRadius.md)),
                  border: Border(top: BorderSide(color: chateuSurfaceMuted)),
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
                        color: chateuTextMuted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 3),
                    Icon(
                      _expanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      size: 16,
                      color: chateuTextMuted,
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
      final mq = MediaQuery.of(context);
      return Semantics(
        button: true,
        label: 'View full image',
        child: GestureDetector(
          onTap: () => _openFullscreen(context),
          child: Container(
            margin: const EdgeInsets.fromLTRB(
                AppSpacing.md, 0, AppSpacing.md, AppSpacing.sm),
            height: 180,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.sm),
              color: chateuSurfaceMuted,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.sm),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    url,
                    fit: BoxFit.cover,
                    cacheWidth: (mq.size.width * mq.devicePixelRatio).round(),
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
                              color: chateuTextSubtle, size: 32),
                          const SizedBox(height: AppSpacing.xs),
                          Text("Could not load image",
                              style: AppText.caption
                                  .copyWith(color: chateuTextSubtle)),
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
                              style: AppText.caption
                                  .copyWith(color: Colors.white)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    if (isPdf) {
      return _FileTile(
        url: url,
        icon: Icons.picture_as_pdf_rounded,
        iconColor: chateuError,
        label: url.split('/').last.split('?').first,
        onTap: () => _confirmOpenPdf(context, url),
      );
    }

    // External link
    return _FileTile(
      url: url,
      icon: Icons.link_rounded,
      iconColor: chateuInfo,
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
    final confirmed = await showConfirmDialog(
      context,
      title: 'Open PDF',
      message:
          'Open this PDF in your browser?\n\n${url.split('/').last.split('?').first}',
      confirmLabel: 'Open PDF',
      icon: Icons.picture_as_pdf_rounded,
    );

    if (confirmed == true) {
      final uri = Uri.tryParse(url);
      if (uri != null) {
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else if (context.mounted) {
          showAppSnack(context, 'Could not open PDF', type: SnackType.error);
        }
      }
    }
  }

  static Future<void> _confirmOpenLink(BuildContext context, String url) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Open Link',
      message: 'You are about to open an external link:\n\n$url',
      confirmLabel: 'Open',
      icon: Icons.open_in_new_rounded,
    );

    if (confirmed == true) {
      final uri = Uri.tryParse(url);
      if (uri != null && context.mounted) {
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else if (context.mounted) {
          showAppSnack(context, 'Could not open link', type: SnackType.error);
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, 0, AppSpacing.md, AppSpacing.sm),
      child: Material(
        color: iconColor.withAlpha(10),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          side: BorderSide(color: iconColor.withAlpha(40)),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          child: Container(
            constraints: const BoxConstraints(minHeight: 48),
            padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md, vertical: AppSpacing.sm),
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
        iconTheme: const IconThemeData(color: Colors.white),
        leading: const CloseButton(),
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
                      color: isPdf ? chateuError : chateuInfo,
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
                    const SizedBox(height: AppSpacing.xxl),
                    ElevatedButton.icon(
                      onPressed: () async {
                        final uri = Uri.tryParse(url);
                        if (uri != null && await canLaunchUrl(uri)) {
                          await launchUrl(uri,
                              mode: LaunchMode.externalApplication);
                        }
                      },
                      icon: const Icon(Icons.open_in_new_rounded, size: 16),
                      label: Text(isPdf ? "Open PDF" : "Open Link"),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
