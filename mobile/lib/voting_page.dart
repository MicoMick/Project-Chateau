import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_colors.dart';
import 'domain/format/format.dart';
import 'app_dialogs.dart';
import 'app_theme.dart';
import 'audit_logger.dart';

// ── VotingPage ────────────────────────────────────────────────────────────────

class VotingPage extends StatefulWidget {
  const VotingPage({super.key});

  @override
  State<VotingPage> createState() => _VotingPageState();
}

class _VotingPageState extends State<VotingPage> {
  final supabase = Supabase.instance.client;

  List<Map<String, dynamic>> _elections = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadElections();
  }

  Future<void> _loadElections() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await supabase
          .from('elections')
          .select()
          .order('start_date', ascending: false);

      if (mounted) {
        setState(() {
          _elections = List<Map<String, dynamic>>.from(data);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = "Failed to load elections. Please try again.";
          _loading = false;
        });
      }
    }
  }

  bool _isActive(Map<String, dynamic> election) {
    return (election['status'] as String?)?.toLowerCase() == 'active';
  }

  Color _statusColor(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'active':
        return chateuSuccess;
      case 'closed':
        return chateuTextMuted;
      default:
        return chateuInfo;
    }
  }

  String _formatDate(String? raw) => raw == null ? '—' : shortDateFromRaw(raw);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Voting")),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : _elections.isEmpty
                  ? _buildEmpty()
                  : RefreshIndicator(
                      onRefresh: _loadElections,
                      child: ListView.builder(
                        padding: appListPadding(context,
                            top: AppSpacing.lg, bottom: AppSpacing.xxxl),
                        itemCount: _elections.length,
                        itemBuilder: (context, index) =>
                            _buildElectionCard(_elections[index]),
                      ),
                    ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxxl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline_rounded, size: 48, color: chateuError),
            const SizedBox(height: AppSpacing.lg),
            Text(_error!,
                textAlign: TextAlign.center,
                style: AppText.bodyMedium.copyWith(color: chateuTextMuted)),
            const SizedBox(height: AppSpacing.xl),
            FilledButton.icon(
              onPressed: _loadElections,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text("Retry"),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.how_to_vote_outlined, size: 48, color: chateuTextMuted),
          const SizedBox(height: AppSpacing.lg),
          Text("No elections available", style: AppText.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          Text("Check back later for upcoming elections.",
              style: AppText.bodyMedium.copyWith(color: chateuTextMuted)),
        ],
      ),
    );
  }

  Widget _buildElectionCard(Map<String, dynamic> election) {
    final isActive = _isActive(election);
    final status = election['status'] as String? ?? '';
    final statusColor = _statusColor(status);
    final statusLabel = status.isEmpty
        ? 'Upcoming'
        : status[0].toUpperCase() + status.substring(1).toLowerCase();
    final description = election['description'] as String?;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Material(
        color: chateuSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: BorderSide(
              color: isActive ? chateuPrimary.withAlpha(120) : chateuBorder),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () {
            if (!isActive) {
              showAppSnack(
                context,
                status.toLowerCase() == 'closed'
                    ? 'This election has ended.'
                    : 'This election is not yet active.',
                type: status.toLowerCase() == 'closed'
                    ? SnackType.neutral
                    : SnackType.info,
              );
              return;
            }
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ElectionDetailPage(election: election),
              ),
            ).then((_) => _loadElections());
          },
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    AppStatusBadge(label: statusLabel, color: statusColor),
                    const Spacer(),
                    if (isActive)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text("Vote now",
                              style: AppText.labelMedium
                                  .copyWith(color: chateuPrimary)),
                          Icon(Icons.chevron_right_rounded,
                              color: chateuPrimary),
                        ],
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Text(election['title'] as String? ?? "Election",
                    style: AppText.titleMedium),
                if (description?.isNotEmpty == true) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.bodyMedium.copyWith(color: chateuTextMuted),
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Icon(Icons.schedule_rounded,
                        size: 14, color: chateuTextMuted),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        "${_formatDate(election['start_date'] as String?)} – ${_formatDate(election['end_date'] as String?)}",
                        style: AppText.caption,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── ElectionDetailPage ────────────────────────────────────────────────────────

class ElectionDetailPage extends StatefulWidget {
  final Map<String, dynamic> election;
  const ElectionDetailPage({super.key, required this.election});

  @override
  State<ElectionDetailPage> createState() => _ElectionDetailPageState();
}

class _ElectionDetailPageState extends State<ElectionDetailPage> {
  final supabase = Supabase.instance.client;

  List<Map<String, dynamic>> _candidates = [];
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  // Map of position -> selected candidate id
  final Map<String, String?> _selectedCandidates = {};
  // Track positions
  List<String> _positions = [];

  // Track if user has already voted
  bool _hasVoted = false;
  bool _checkingVote = true;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    await _checkIfVoted();
    await _loadCandidates();
  }

  Future<void> _checkIfVoted() async {
    final userId = supabase.auth.currentUser?.id;
    if (userId == null) {
      setState(() => _checkingVote = false);
      return;
    }
    try {
      final electionId = widget.election['id'] as String;
      final data = await supabase
          .from('votes')
          .select('id')
          .eq('election_id', electionId)
          .eq('voter_id', userId)
          .limit(1);
      if (mounted) {
        setState(() {
          _hasVoted = (data as List).isNotEmpty;
          _checkingVote = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _checkingVote = false);
    }
  }

  Future<void> _loadCandidates() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final electionId = widget.election['id'] as String;
      final data = await supabase
          .from('candidates')
          .select()
          .eq('election_id', electionId)
          .order('position', ascending: true);

      if (mounted) {
        final candidates = List<Map<String, dynamic>>.from(data);

        // Define the canonical position order
        const positionOrder = [
          'President',
          'Vice President',
          'Secretary',
          'Treasurer',
          'Auditor',
          'P.R.O.',
          'Public Relations Officer',
          'Business Manager',
          'Senator',
          'Representative',
        ];

        // Extract unique positions
        final positionSet = <String>{};
        for (final c in candidates) {
          final pos = c['position'] as String? ?? '';
          if (pos.isNotEmpty) positionSet.add(pos);
        }

        // Sort: known positions first (by their index), then unknowns alphabetically
        final sortedPositions = positionSet.toList()
          ..sort((a, b) {
            final aIndex = positionOrder
                .indexWhere((p) => p.toLowerCase() == a.toLowerCase());
            final bIndex = positionOrder
                .indexWhere((p) => p.toLowerCase() == b.toLowerCase());
            if (aIndex != -1 && bIndex != -1) return aIndex.compareTo(bIndex);
            if (aIndex != -1) return -1;
            if (bIndex != -1) return 1;
            return a.compareTo(b);
          });

        setState(() {
          _candidates = candidates;
          _positions = sortedPositions;
          // Initialize selection map
          for (final pos in _positions) {
            _selectedCandidates.putIfAbsent(pos, () => null);
          }
          _loading = false;
        });
      }
    } catch (e) {
      debugPrint('Candidates load error: $e');
      if (mounted) {
        setState(() {
          _error = 'Failed to load candidates: $e';
          _loading = false;
        });
      }
    }
  }

  List<Map<String, dynamic>> _candidatesForPosition(String position) {
    return _candidates.where((c) => c['position'] == position).toList();
  }

  bool get _allPositionsSelected {
    if (_positions.isEmpty) return false;
    return _positions.every((pos) => _selectedCandidates[pos] != null);
  }

  Future<void> _submitVote() async {
    if (!_allPositionsSelected) {
      showAppSnack(context, 'Please select a candidate for each position.',
          type: SnackType.warning);
      return;
    }

    // Confirm dialog
    final selectionSummary = _positions.map((pos) {
      final candidateId = _selectedCandidates[pos];
      final candidate = _candidates.firstWhere((c) => c['id'] == candidateId,
          orElse: () => {});
      return '$pos: ${candidate['full_name'] as String? ?? '—'}';
    }).join('\n');

    final confirm = await showConfirmDialog(
      context,
      title: 'Confirm Your Vote',
      message: 'This action cannot be undone.\n\n$selectionSummary',
      confirmLabel: 'Submit Vote',
      icon: Icons.how_to_vote_rounded,
    );

    if (confirm != true) return;

    setState(() => _submitting = true);
    HapticFeedback.mediumImpact();

    try {
      final userId = supabase.auth.currentUser?.id;
      if (userId == null) {
        setState(() => _submitting = false);
        if (!mounted) return;
        showAppSnack(context, 'Session expired. Please log in again.',
            type: SnackType.error);
        return;
      }
      final electionId = widget.election['id'] as String;

      // Insert one vote row per position/candidate
      final votes = _positions.map((pos) {
        return {
          'election_id': electionId,
          'candidate_id': _selectedCandidates[pos],
          'voter_id': userId,
        };
      }).toList();

      await supabase.from('votes').insert(votes);

      // Logs that a vote was cast, not who for — ballots stay secret.
      await logAudit(
        'CAST_VOTE',
        'Cast a vote in "${widget.election['title'] as String? ?? 'Election'}".',
      );

      if (mounted) {
        setState(() {
          _hasVoted = true;
          _submitting = false;
        });
        HapticFeedback.heavyImpact();
        showAppSnack(context, 'Your vote has been submitted!',
            type: SnackType.success);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        showAppSnack(context, 'Failed to submit vote. Please try again.',
            type: SnackType.error);
      }
    }
  }

  String _formatDate(String? raw) => raw == null ? '—' : shortDateFromRaw(raw);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.election['title'] as String? ?? "Election",
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: _loading || _checkingVote
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.xxl),
                    child: Text(_error!,
                        textAlign: TextAlign.center,
                        style: AppText.bodyMedium
                            .copyWith(color: chateuTextMuted)),
                  ),
                )
              : _hasVoted
                  ? _buildVotedState()
                  : _buildVotingForm(),
      bottomNavigationBar: (!_loading &&
              !_checkingVote &&
              _error == null &&
              !_hasVoted &&
              _candidates.isNotEmpty)
          ? _buildSubmitBar()
          : null,
    );
  }

  String get _period =>
      "${_formatDate(widget.election['start_date'] as String?)} – ${_formatDate(widget.election['end_date'] as String?)}";

  Widget _buildVotedState() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xxxl),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.how_to_vote_rounded, color: chateuPrimary, size: 56),
              const SizedBox(height: AppSpacing.xl),
              Text("You've already voted",
                  style: AppText.displayMedium, textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.sm),
              Text(
                "Your vote for this election has been recorded. Thank you for participating.",
                textAlign: TextAlign.center,
                style: AppText.bodyMedium.copyWith(color: chateuTextMuted),
              ),
              const SizedBox(height: AppSpacing.xxl),
              Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: AppDecorations.card,
                child: _infoRow(
                    Icons.calendar_today_rounded, "Voting Period", _period),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVotingForm() {
    final description = widget.election['description'] as String?;
    return SingleChildScrollView(
      padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
      child: AppContentWidth(
        maxWidth: 640,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.xxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (description?.isNotEmpty == true) ...[
                Text(description!,
                    style: AppText.bodyLarge.copyWith(color: chateuTextMuted)),
                const SizedBox(height: AppSpacing.sm),
              ],
              Row(
                children: [
                  Icon(Icons.schedule_rounded,
                      color: chateuTextMuted, size: 16),
                  const SizedBox(width: 6),
                  Flexible(child: Text(_period, style: AppText.caption)),
                ],
              ),
              const SizedBox(height: AppSpacing.xl),
              if (_candidates.isEmpty)
                Center(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.xxxl),
                    child: Column(
                      children: [
                        Icon(Icons.person_search_outlined,
                            size: 48, color: chateuTextMuted),
                        const SizedBox(height: AppSpacing.md),
                        Text("No candidates available yet.",
                            style: AppText.bodyMedium
                                .copyWith(color: chateuTextMuted)),
                      ],
                    ),
                  ),
                )
              else
                for (final position in _positions)
                  _buildPositionSection(position),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPositionSection(String position) {
    final candidates = _candidatesForPosition(position);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.md),
          child: AppSectionHeader(
            title: position,
            trailing: Text("Select 1", style: AppText.caption),
          ),
        ),
        for (final c in candidates) _buildCandidateCard(c, position),
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }

  Widget _buildCandidateCard(Map<String, dynamic> candidate, String position) {
    final isSelected = _selectedCandidates[position] == candidate['id'];
    final photoUrl = candidate['photo_url'] as String?;
    final name = candidate['full_name'] as String? ?? "Candidate";
    final manifesto = candidate['manifesto'] as String?;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Semantics(
        inMutuallyExclusiveGroup: true,
        checked: isSelected,
        label: '$name, $position',
        child: Material(
          color: isSelected ? chateuPrimary.withAlpha(18) : chateuSurface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
            side: BorderSide(
              color: isSelected ? chateuPrimary : chateuBorder,
              width: isSelected ? 2 : 1,
            ),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() {
                _selectedCandidates[position] =
                    isSelected ? null : candidate['id'] as String;
              });
            },
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    child: Container(
                      width: 56,
                      height: 56,
                      color: chateuSurfaceMuted,
                      child: photoUrl != null && photoUrl.isNotEmpty
                          ? Image.network(
                              photoUrl,
                              fit: BoxFit.cover,
                              cacheWidth: 168,
                              excludeFromSemantics: true,
                              errorBuilder: (_, __, ___) =>
                                  _candidateInitials(name),
                            )
                          : _candidateInitials(name),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name,
                            style: AppText.titleMedium.copyWith(
                                color:
                                    isSelected ? chateuPrimary : chateuText)),
                        if (manifesto?.isNotEmpty == true) ...[
                          const SizedBox(height: 2),
                          Text(
                            manifesto!,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.caption,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Icon(
                    isSelected
                        ? Icons.radio_button_checked_rounded
                        : Icons.radio_button_unchecked_rounded,
                    color: isSelected ? chateuPrimary : chateuTextMuted,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _candidateInitials(String? name) {
    final initials = (name ?? '?')
        .trim()
        .split(' ')
        .where((e) => e.isNotEmpty)
        .map((e) => e[0])
        .take(2)
        .join()
        .toUpperCase();
    return Center(
      child: Text(initials,
          style: AppText.titleMedium.copyWith(color: chateuPrimary)),
    );
  }

  Widget _buildSubmitBar() {
    final selected = _selectedCandidates.values.where((v) => v != null).length;
    final total = _positions.length;

    return Container(
      decoration: BoxDecoration(
        color: chateuSurface,
        border: Border(top: BorderSide(color: chateuBorder)),
      ),
      child: SafeArea(
        top: false,
        child: AppContentWidth(
          maxWidth: 640,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.md),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Text("$selected of $total positions selected",
                        style: AppText.caption),
                    const Spacer(),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: total == 0 ? 0 : selected / total,
                    backgroundColor: chateuSurfaceMuted,
                    minHeight: 6,
                    semanticsLabel: 'Ballot progress',
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                AppPrimaryButton(
                  label: "Submit My Vote",
                  isLoading: _submitting,
                  onPressed: _allPositionsSelected ? _submitVote : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 16, color: chateuPrimary),
        const SizedBox(width: AppSpacing.sm),
        Text("$label: ",
            style: AppText.bodyMedium.copyWith(color: chateuTextMuted)),
        Expanded(
          child: Text(value,
              style: AppText.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
        ),
      ],
    );
  }
}
