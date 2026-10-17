import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_colors.dart';
import 'app_theme.dart';
import 'app_dialogs.dart';
import 'attachment_preview.dart';

// ── Announcement resolution ────────────────
const _kImportantPrefix = 'IMPORTANT: ';
const _kNewAnnouncementPrefix = 'New Announcement: ';
const _kAnnouncementPrefix = 'Announcement: ';

const _kMonthsLong = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const _kMonthsShort = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

String _announcementTitleFor(String notifTitle) {
  if (notifTitle.startsWith(_kImportantPrefix)) {
    return notifTitle.substring(_kImportantPrefix.length);
  }
  if (notifTitle.startsWith(_kNewAnnouncementPrefix)) {
    return notifTitle.substring(_kNewAnnouncementPrefix.length);
  }
  if (notifTitle.startsWith(_kAnnouncementPrefix)) {
    return notifTitle.substring(_kAnnouncementPrefix.length);
  }
  return notifTitle;
}

bool _isEmergencyTitle(String title) => title.startsWith(_kImportantPrefix);

// Safety net for a notification resolved as emergency/important whose
// stored title has no "IMPORTANT: " prefix at all (e.g. it was resolved via
// the matched announcement's own is_emergency flag rather than its title) —
// prefixes it for display so the badge and the title agree.
String _displayTitleFor(bool isEmergency, String rawTitle) {
  if (!isEmergency || rawTitle.startsWith(_kImportantPrefix)) return rawTitle;
  return '$_kImportantPrefix$rawTitle';
}

// Calendar-day difference from today (not a 24h-rolling window) — 11:55 PM
// yesterday and 12:05 AM today are 1 day apart by this measure, matching
// what a human means by "yesterday" regardless of time of day.
int _calendarDaysAgo(DateTime d) {
  final now = DateTime.now();
  final date = DateTime(d.year, d.month, d.day);
  final today = DateTime(now.year, now.month, now.day);
  return today.difference(date).inDays;
}

String _dayLabel(DateTime d) {
  final diff = _calendarDaysAgo(d);
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  return '${_kMonthsShort[d.month]} ${d.day}, ${d.year}';
}

String _fmtFullDate(DateTime d) =>
    '${_kMonthsLong[d.month]} ${d.day}, ${d.year}';

class _NotificationEntry {
  final Map<String, dynamic> raw;
  // The announcement this notification was posted for, resolved by title —
  // see _resolveEntries. Null for personal notifications (report status
  // updates) and for announcement-shaped notifications whose source has
  // since been deleted (isOrphanedAnnouncement covers that case).
  final Map<String, dynamic>? announcement;
  final bool isOrphanedAnnouncement;
  final bool isEmergency;
  final DateTime createdAt;

  const _NotificationEntry({
    required this.raw,
    required this.announcement,
    required this.isOrphanedAnnouncement,
    required this.isEmergency,
    required this.createdAt,
  });

  String? get category => announcement?['category'] as String?;

  DateTime? get endDate {
    final raw = announcement?['end_date'] as String?;
    return raw != null ? DateTime.tryParse(raw) : null;
  }

  // The announcement's own date — what it's actually dated/scheduled for,
  // as opposed to createdAt (when this notification happened to be sent,
  // e.g. the moment a backdated draft got published). "Recent" goes by
  // this so an old-dated announcement doesn't count as recent just because
  // it was published today.
  DateTime? get announcementDate {
    final raw = announcement?['start_date'] as String? ??
        announcement?['end_date'] as String?;
    return raw != null ? DateTime.tryParse(raw) : null;
  }

  bool get isExpired {
    final end = endDate;
    if (end == null) return false;
    final today = DateTime.now();
    final endOfDay = DateTime(end.year, end.month, end.day, 23, 59, 59);
    return today.isAfter(endOfDay);
  }

  // Today or yesterday — matches the "Today"/"Yesterday" day-group headers,
  // anchored on the announcement's own date rather than publish time (see
  // announcementDate above).
  bool get isRecent {
    final diff = _calendarDaysAgo(announcementDate ?? createdAt);
    return diff >= 0 && diff <= 1;
  }
  bool get isFinancial => (category ?? '').toLowerCase() == 'financial';
}

// ── Filters ─────────────────────────────────────────

enum _NotifFilter { all, recent, financial, important }

extension on _NotifFilter {
  String get label {
    switch (this) {
      case _NotifFilter.all:
        return 'All';
      case _NotifFilter.recent:
        return 'Recent';
      case _NotifFilter.financial:
        return 'Financial';
      case _NotifFilter.important:
        return 'Important';
    }
  }

  bool matches(_NotificationEntry e) {
    switch (this) {
      case _NotifFilter.all:
        return true;
      case _NotifFilter.recent:
        return e.isRecent;
      case _NotifFilter.financial:
        return e.isFinancial;
      case _NotifFilter.important:
        if (!e.isEmergency) return false;
        if (e.endDate == null &&
            DateTime.now().difference(e.createdAt).inDays > 30) {
          return false;
        }
        return true;
    }
  }
}

class NotificationPage extends StatefulWidget {
  const NotificationPage({super.key});

  @override
  State<NotificationPage> createState() => _NotificationPageState();
}

class _NotificationPageState extends State<NotificationPage> {
  final _supabase = Supabase.instance.client;

  List<Map<String, dynamic>> _notifications = [];
  List<Map<String, dynamic>> _announcements = [];
  bool _loading = true;
  RealtimeChannel? _channel;
  _NotifFilter _filter = _NotifFilter.recent;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
    _subscribeRealtime();
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    super.dispose();
  }

  void _subscribeRealtime() {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;
    _channel = _supabase
        .channel('notifications_page')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'notifications',
          callback: (_) => _loadNotifications(),
        )
        .subscribe();
  }

  Future<void> _loadNotifications() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    try {
      final results = await Future.wait([
        _supabase
            .from('notifications')
            .select()
            .or('user_id.eq.$userId,user_id.is.null')
            .order('created_at', ascending: false),
        _supabase.from('announcements').select(
            'title, content, category, start_date, end_date, is_emergency, created_at, author_name, attachment_url'),
      ]);

      if (mounted) {
        setState(() {
          _notifications = List<Map<String, dynamic>>.from(results[0] as List);
          _announcements = List<Map<String, dynamic>>.from(results[1] as List);
          _entries = _resolveEntries();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── Resolve each notification against the announcement it was posted for ──

  // Resolved once per load (every notification × every announcement), not on
  // each rebuild — filter chips just re-filter this list.
  List<_NotificationEntry> _entries = [];

  List<_NotificationEntry> _resolveEntries() {
    return _notifications.map((n) {
      final title = n['title'] as String? ?? '';
      final isGlobal = n['user_id'] == null;
      final createdAt =
          DateTime.tryParse(n['created_at'] as String? ?? '') ?? DateTime.now();
      final annTitle = _announcementTitleFor(title);
      // Match by title alone — preferring the most recently created
      // announcement when more than one shares that title (an admin
      // reusing a title, or the rare same-minute collision). Earlier this
      // also required the announcement's created_at (a database server
      // timestamp) to be at-or-before the notification's created_at (a
      // browser-clock timestamp) — comparing two different clocks like
      // that is fragile: any drift between them silently fails every
      // match, which is worse than the rare-title-reuse case it guarded
      // against.
      Map<String, dynamic>? match;
      for (final a in _announcements) {
        if (a['title'] != annTitle) continue;
        if (match == null) {
          match = a;
          continue;
        }
        final aCreated = DateTime.tryParse(a['created_at'] as String? ?? '');
        final matchCreated =
            DateTime.tryParse(match['created_at'] as String? ?? '');
        if (aCreated != null &&
            (matchCreated == null || aCreated.isAfter(matchCreated))) {
          match = a;
        }
      }

      return _NotificationEntry(
        raw: n,
        announcement: match,
        // Every broadcast (user_id null) notification in this app comes
        // from publishing/updating an announcement — there is no other
        // source. So a broadcast notification that fails to resolve to a
        // still-existing announcement row is presumed to be one whose
        // source was deleted, regardless of what title format it happened
        // to be published under — robust to future prefix changes, unlike
        // matching a specific prefix list. Personal notifications (report
        // status updates) always carry a user_id, so they're never caught
        // by this and are never hidden.
        isOrphanedAnnouncement: match == null && isGlobal,
        isEmergency: match?['is_emergency'] == true || _isEmergencyTitle(title),
        createdAt: createdAt,
      );
    }).toList();
  }

  List<_NotificationEntry> get _visibleEntries {
    final visible = _entries
        .where((e) => !e.isExpired && !e.isOrphanedAnnouncement)
        .toList();
    return visible.where(_filter.matches).toList();
  }

  void _showAnnouncementDetail(Map<String, dynamic> announcement) {
    final category = announcement['category'] as String?;
    final isEmergency = announcement['is_emergency'] == true;
    final color = announcementCategoryColor(category);
    final title = announcement['title'] as String? ?? 'Announcement';
    final content = announcement['content'] as String? ?? '';
    final author = announcement['author_name'] as String?;
    final startDate =
        DateTime.tryParse(announcement['start_date'] as String? ?? '');
    final attachmentUrl = announcement['attachment_url'] as String?;
    final hasAttachment = attachmentUrl != null &&
        attachmentUrl.isNotEmpty &&
        attachmentUrl != 'EMPTY';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.55,
        minChildSize: 0.3,
        maxChildSize: 0.9,
        expand: false,
        builder: (_, scrollController) => Container(
          decoration: AppDecorations.sheet,
          child: SingleChildScrollView(
            controller: scrollController,
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.xl, AppSpacing.sm, AppSpacing.xl, AppSpacing.xxl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                buildSheetHandle(),
                Row(
                  children: [
                    AppStatusBadge(
                      label: (category ?? 'General').toUpperCase(),
                      color: color,
                    ),
                    if (isEmergency) ...[
                      const SizedBox(width: AppSpacing.sm),
                      AppStatusBadge(label: 'EMERGENCY', color: chateuError),
                    ],
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Text(title, style: AppText.titleLarge),
                if (startDate != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(_fmtFullDate(startDate), style: AppText.caption),
                ],
                const SizedBox(height: AppSpacing.lg),
                Text(
                  content.isNotEmpty ? content : 'No further details.',
                  style: AppText.bodyMedium,
                ),
                if (hasAttachment) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Padding(
                    padding: const EdgeInsets.only(
                        bottom: AppSpacing.xs, left: AppSpacing.xs),
                    child: Row(
                      children: [
                        Icon(Icons.attach_file_rounded,
                            size: 14, color: chateuTextMuted),
                        const SizedBox(width: 4),
                        Text('Attachment', style: AppText.caption),
                      ],
                    ),
                  ),
                  AttachmentPreview(
                    url: attachmentUrl,
                    isImage: isImageAttachment(attachmentUrl),
                    isPdf: isPdfAttachment(attachmentUrl),
                  ),
                ],
                if (author != null && author.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Row(
                    children: [
                      Icon(Icons.person_outline_rounded,
                          size: 14, color: chateuTextMuted),
                      const SizedBox(width: 4),
                      Text(author, style: AppText.caption),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  // Fallback for notifications with no resolved announcement — personal
  // report-status updates, or an announcement-shaped one whose title no
  // longer matches anything (e.g. still using an old title prefix). Same
  // sheet shell as the announcement detail, just built from the
  // notification's own title/message instead.
  void _showNotificationDetail(Map<String, dynamic> raw) {
    final isGlobal = raw['user_id'] == null;
    final title = raw['title'] as String? ?? 'Notification';
    final message = raw['message'] as String? ?? '';
    final createdAt = DateTime.tryParse(raw['created_at'] as String? ?? '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.4,
        minChildSize: 0.25,
        maxChildSize: 0.8,
        expand: false,
        builder: (_, scrollController) => Container(
          decoration: AppDecorations.sheet,
          child: SingleChildScrollView(
            controller: scrollController,
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.xl, AppSpacing.sm, AppSpacing.xl, AppSpacing.xxl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                buildSheetHandle(),
                AppStatusBadge(
                  label: isGlobal ? 'Broadcast' : 'Personal',
                  color: isGlobal ? chateuInfo : chateuPrimary,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(title, style: AppText.titleLarge),
                if (createdAt != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(_fmtFullDate(createdAt), style: AppText.caption),
                ],
                const SizedBox(height: AppSpacing.lg),
                Text(
                  message.isNotEmpty ? message : 'No further details.',
                  style: AppText.bodyMedium,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _buildGroupedList(List<_NotificationEntry> entries) {
    final items = <Widget>[];
    String? lastLabel;
    for (final e in entries) {
      final label = _dayLabel(e.createdAt);
      if (label != lastLabel) {
        if (lastLabel != null) {
          items.add(const SizedBox(height: AppSpacing.lg));
        }
        items.add(Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: AppSectionHeader(title: label),
        ));
        lastLabel = label;
      }
      items.add(Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
        child: _NotificationCard(
          entry: e,
          onTap: () => e.announcement != null
              ? _showAnnouncementDetail(e.announcement!)
              : _showNotificationDetail(e.raw),
        ),
      ));
    }
    return items;
  }

  @override
  Widget build(BuildContext context) {
    final visible = _visibleEntries;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: SizedBox(
            height: 56,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg, vertical: AppSpacing.xs),
              itemCount: _NotifFilter.values.length,
              separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, i) {
                final f = _NotifFilter.values[i];
                return ChoiceChip(
                  label: Text(f.label),
                  selected: f == _filter,
                  onSelected: (_) => setState(() => _filter = f),
                );
              },
            ),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadNotifications,
              child: visible.isEmpty
                  ? LayoutBuilder(
                      builder: (context, c) => SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        child:
                            SizedBox(height: c.maxHeight, child: _buildEmpty()),
                      ),
                    )
                  : ListView(
                      padding: appListPadding(context,
                          top: AppSpacing.lg, bottom: AppSpacing.xxxl),
                      children: _buildGroupedList(visible),
                    ),
            ),
    );
  }

  Widget _buildEmpty() {
    final noneAtAll = _notifications.isEmpty;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.notifications_none_rounded,
              color: chateuTextMuted, size: 48),
          const SizedBox(height: AppSpacing.lg),
          Text(
            noneAtAll ? 'No notifications yet' : 'Nothing here',
            style: AppText.titleMedium,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            noneAtAll
                ? "You're all caught up."
                : 'No ${_filter.label.toLowerCase()} notifications right now.',
            style: AppText.bodyMedium.copyWith(color: chateuTextMuted),
          ),
        ],
      ),
    );
  }
}

// ── Card ────────────────────────────

class _NotificationCard extends StatelessWidget {
  final _NotificationEntry entry;
  final VoidCallback? onTap;

  const _NotificationCard({required this.entry, this.onTap});

  String _timeAgo(String? raw) {
    if (raw == null) return '';
    try {
      final dt = DateTime.parse(raw).toLocal();
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      if (diff.inDays < 7) return '${diff.inDays}d ago';
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = entry.raw;
    final bool isGlobal = data['user_id'] == null;
    final bool isImportant = entry.isEmergency;
    final String message = data['message'] ?? '';
    final String title =
        _displayTitleFor(isImportant, data['title'] ?? 'Notification');
    final String timeAgo = _timeAgo(data['created_at'] as String?);
    final Color accentColor = isGlobal ? chateuInfo : chateuPrimary;

    final card = Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isImportant ? chateuError.withAlpha(16) : chateuSurface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: isImportant ? chateuError.withAlpha(140) : chateuBorder,
          width: isImportant ? 1.5 : 1,
        ),
        boxShadow: AppShadows.card,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(
              isImportant
                  ? Icons.warning_rounded
                  : (isGlobal
                      ? Icons.campaign_rounded
                      : Icons.notifications_rounded),
              color: isImportant ? chateuError : accentColor,
              size: 22,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: AppText.bodyLarge.copyWith(
                          fontWeight: FontWeight.w700,
                          color: isImportant ? chateuError : null,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(timeAgo, style: AppText.caption),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  message,
                  style: AppText.bodyMedium.copyWith(color: chateuTextMuted),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    if (isImportant) ...[
                      AppStatusBadge(label: 'IMPORTANT', color: chateuError),
                      const SizedBox(width: AppSpacing.xs),
                    ],
                    AppStatusBadge(
                      label: isGlobal ? 'Broadcast' : 'Personal',
                      color: accentColor,
                    ),
                    if (onTap != null) ...[
                      const Spacer(),
                      Icon(Icons.chevron_right_rounded,
                          size: 18, color: chateuTextMuted),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );

    if (onTap == null) return card;
    return GestureDetector(onTap: onTap, child: card);
  }
}
