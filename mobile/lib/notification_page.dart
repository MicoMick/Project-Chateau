import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_colors.dart';
import 'app_theme.dart';

// ── Announcement resolution ────────────────
const _kEmergencyPrefix = '🚨 EMERGENCY: ';
const _kNewAnnouncementPrefix = 'New Announcement: ';
const _kAnnouncementPrefix = 'Announcement: ';

String _announcementTitleFor(String notifTitle) {
  if (notifTitle.startsWith(_kEmergencyPrefix)) {
    return notifTitle.substring(_kEmergencyPrefix.length);
  }
  if (notifTitle.startsWith(_kNewAnnouncementPrefix)) {
    return notifTitle.substring(_kNewAnnouncementPrefix.length);
  }
  if (notifTitle.startsWith(_kAnnouncementPrefix)) {
    return notifTitle.substring(_kAnnouncementPrefix.length);
  }
  return notifTitle;
}

class _NotificationEntry {
  final Map<String, dynamic> raw;
  final String? category;
  final DateTime? endDate;
  final bool isEmergency;
  final DateTime createdAt;

  const _NotificationEntry({
    required this.raw,
    required this.category,
    required this.endDate,
    required this.isEmergency,
    required this.createdAt,
  });

  bool get isExpired {
    if (endDate == null) return false;
    final today = DateTime.now();
    final endOfDay =
        DateTime(endDate!.year, endDate!.month, endDate!.day, 23, 59, 59);
    return today.isAfter(endOfDay);
  }

  bool get isRecent => DateTime.now().difference(createdAt).inDays < 7;
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
  _NotifFilter _filter = _NotifFilter.all;

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
        _supabase
            .from('announcements')
            .select('title, category, end_date, is_emergency, created_at'),
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
      final createdAt =
          DateTime.tryParse(n['created_at'] as String? ?? '') ?? DateTime.now();
      final annTitle = _announcementTitleFor(title);
      Map<String, dynamic>? match;
      for (final a in _announcements) {
        if (a['title'] != annTitle) continue;
        final aCreated = DateTime.tryParse(a['created_at'] as String? ?? '');
        if (aCreated == null || !aCreated.isAfter(createdAt)) {
          if (match == null) {
            match = a;
          } else {
            final matchCreated =
                DateTime.tryParse(match['created_at'] as String? ?? '');
            if (aCreated != null &&
                (matchCreated == null || aCreated.isAfter(matchCreated))) {
              match = a;
            }
          }
        }
      }

      return _NotificationEntry(
        raw: n,
        category: match?['category'] as String?,
        endDate: match?['end_date'] != null
            ? DateTime.tryParse(match!['end_date'] as String)
            : null,
        isEmergency: match?['is_emergency'] == true ||
            title.startsWith(_kEmergencyPrefix),
        createdAt: createdAt,
      );
    }).toList();
  }

  List<_NotificationEntry> get _visibleEntries {
    final unexpired = _entries.where((e) => !e.isExpired).toList();
    return unexpired.where(_filter.matches).toList();
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
                  : ListView.builder(
                      padding: appListPadding(context,
                          top: AppSpacing.lg, bottom: AppSpacing.xxxl),
                      itemCount: visible.length,
                      itemBuilder: (context, i) =>
                          _NotificationCard(data: visible[i].raw),
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
  final Map<String, dynamic> data;

  const _NotificationCard({required this.data});

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
    final bool isGlobal = data['user_id'] == null;
    final String message = data['message'] ?? '';
    final String title = data['title'] ?? 'Notification';
    final String timeAgo = _timeAgo(data['created_at'] as String?);
    final Color accentColor = isGlobal ? chateuInfo : chateuPrimary;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: AppDecorations.card,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(
              isGlobal ? Icons.campaign_rounded : Icons.notifications_rounded,
              color: accentColor,
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
                        style: AppText.bodyLarge
                            .copyWith(fontWeight: FontWeight.w700),
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
                AppStatusBadge(
                  label: isGlobal ? 'Broadcast' : 'Personal',
                  color: accentColor,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
