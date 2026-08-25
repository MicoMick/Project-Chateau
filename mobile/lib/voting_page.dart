import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_colors.dart';
import 'app_theme.dart';
import 'app_dialogs.dart';

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
        return const Color(0xFF22C55E);
      case 'closed':
        return const Color(0xFFDC2626);
      default:
        return Colors.grey;
    }
  }

  String _formatDate(String? raw) {
    if (raw == null) return '—';
    try {
      final d = DateTime.parse(raw);
      const months = [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${months[d.month]} ${d.day}, ${d.year}';
    } catch (_) {
      return raw;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: chateuBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: chateuSecondary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          "Voting",
          style: TextStyle(
            color: chateuText,
            fontWeight: FontWeight.w800,
            fontSize: 20,
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: Colors.grey.shade100),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: chateuPrimary))
          : _error != null
              ? _buildError()
              : _elections.isEmpty
                  ? _buildEmpty()
                  : RefreshIndicator(
                      onRefresh: _loadElections,
                      color: chateuPrimary,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
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
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline_rounded,
                size: 52, color: const Color(0xFFDC2626)),
            const SizedBox(height: 16),
            Text(_error!,
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: Colors.grey.shade600, fontSize: 14)),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _loadElections,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text("Retry"),
              style: ElevatedButton.styleFrom(
                backgroundColor: chateuPrimary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
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
          Icon(Icons.how_to_vote_outlined,
              size: 64, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text("No elections available",
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade500)),
          const SizedBox(height: 6),
          Text("Check back later for upcoming elections.",
              style: TextStyle(
                  fontSize: 13, color: Colors.grey.shade400)),
        ],
      ),
    );
  }

  Widget _buildElectionCard(Map<String, dynamic> election) {
    final isActive = _isActive(election);
    final status = election['status'] as String? ?? '';
    final statusColor = _statusColor(status);

    return GestureDetector(
      onTap: () {
        if (!isActive) {
          showAppSnack(context,
            status.toLowerCase() == 'closed'
                ? 'This election has ended.'
                : 'This election is not yet active.',
            type: SnackType.info,
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
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: isActive
              ? Border.all(
                  color: chateuPrimary.withAlpha(80), width: 1.5)
              : null,
          boxShadow: [
            BoxShadow(
              color: isActive
                  ? chateuPrimary.withAlpha(20)
                  : Colors.black.withAlpha(8),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Container(
              padding:
                  const EdgeInsets.fromLTRB(16, 12, 16, 12),
              decoration: BoxDecoration(
                color: isActive
                    ? chateuPrimary.withAlpha(15)
                    : Colors.grey.shade50,
                borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(16)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withAlpha(20),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: statusColor.withAlpha(80)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: statusColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          status.toUpperCase(),
                          style: TextStyle(
                              color: statusColor,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  if (isActive)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: chateuPrimary,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.how_to_vote_rounded,
                              color: Colors.white, size: 12),
                          SizedBox(width: 4),
                          Text("Vote Now",
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                ],
              ),
            ),

            // Body
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    election['title'] as String? ?? "Election",
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: chateuText,
                    ),
                  ),
                  if ((election['description'] as String?)
                          ?.isNotEmpty ==
                      true) ...[
                    const SizedBox(height: 5),
                    Text(
                      election['description'] as String,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade600,
                          height: 1.4),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _dateBadge(
                        icon: Icons.play_circle_outline_rounded,
                        label: "Start",
                        value: _formatDate(
                            election['start_date'] as String?),
                        color: const Color(0xFF22C55E),
                      ),
                      const SizedBox(width: 10),
                      _dateBadge(
                        icon: Icons.stop_circle_outlined,
                        label: "End",
                        value: _formatDate(
                            election['end_date'] as String?),
                        color: const Color(0xFFDC2626),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dateBadge({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Row(
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(
          "$label: ",
          style: TextStyle(
              fontSize: 11,
              color: Colors.grey.shade500,
              fontWeight: FontWeight.w500),
        ),
        Text(
          value,
          style: TextStyle(
              fontSize: 11,
              color: Colors.grey.shade700,
              fontWeight: FontWeight.w600),
        ),
      ],
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
            final aIndex = positionOrder.indexWhere(
                (p) => p.toLowerCase() == a.toLowerCase());
            final bIndex = positionOrder.indexWhere(
                (p) => p.toLowerCase() == b.toLowerCase());
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
    return _candidates
        .where((c) => c['position'] == position)
        .toList();
  }

  bool get _allPositionsSelected {
    if (_positions.isEmpty) return false;
    return _positions.every(
        (pos) => _selectedCandidates[pos] != null);
  }

  Future<void> _submitVote() async {
    if (!_allPositionsSelected) {
      showAppSnack(context, 'Please select a candidate for each position.', type: SnackType.warning);
      return;
    }

    // Confirm dialog
    final selectionSummary = _positions.map((pos) {
      final candidateId = _selectedCandidates[pos];
      final candidate = _candidates.firstWhere(
          (c) => c['id'] == candidateId, orElse: () => {});
      return '$pos: ${candidate['full_name'] as String? ?? '—'}';
    }).join('\n');

    final confirm = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.lg)),
        contentPadding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: chateuPrimary.withAlpha(16), shape: BoxShape.circle),
            child: const Icon(Icons.how_to_vote_rounded, color: chateuPrimary, size: 32),
          ),
          const SizedBox(height: 16),
          Text('Confirm Your Vote', textAlign: TextAlign.center, style: AppText.titleLarge),
          const SizedBox(height: 8),
          Text('This action cannot be undone.',
              textAlign: TextAlign.center,
              style: AppText.bodyMedium.copyWith(color: Colors.grey.shade500)),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: chateuBackground,
              borderRadius: BorderRadius.circular(AppRadius.sm),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Text(selectionSummary,
                style: AppText.bodyMedium.copyWith(height: 1.8)),
          ),
          const SizedBox(height: 20),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.pop(context, false),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: Colors.grey.shade300),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.sm)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                child: Text('Cancel', style: AppText.labelMedium.copyWith(color: Colors.grey.shade700)),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: chateuPrimary, elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.sm)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                child: Text('Submit Vote', style: AppText.labelMedium.copyWith(color: Colors.white)),
              ),
            ),
          ]),
        ]),
      ),
    );

    if (confirm != true) return;

    setState(() => _submitting = true);
    HapticFeedback.mediumImpact();

    try {
      final userId = supabase.auth.currentUser?.id;
      if (userId == null) {
        setState(() => _submitting = false);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Session expired. Please log in again.'),
          backgroundColor: Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ));
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

      if (mounted) {
        setState(() {
          _hasVoted = true;
          _submitting = false;
        });
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.check_circle_rounded,
                    color: Colors.white, size: 18),
                SizedBox(width: 10),
                Text("Your vote has been submitted!"),
              ],
            ),
            backgroundColor: chateuPrimary,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12)),
            margin: const EdgeInsets.all(16),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.error_outline_rounded,
                    color: Colors.white, size: 18),
                SizedBox(width: 10),
                Expanded(
                    child:
                        Text("Failed to submit vote. Please try again.")),
              ],
            ),
            backgroundColor: const Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12)),
            margin: const EdgeInsets.all(16),
          ),
        );
      }
    }
  }

  String _formatDate(String? raw) {
    if (raw == null) return '—';
    try {
      final d = DateTime.parse(raw);
      const months = [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${months[d.month]} ${d.day}, ${d.year}';
    } catch (_) {
      return raw;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: chateuBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: chateuSecondary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          widget.election['title'] as String? ?? "Election",
          style: const TextStyle(
            color: chateuText,
            fontWeight: FontWeight.w800,
            fontSize: 18,
          ),
          overflow: TextOverflow.ellipsis,
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: Colors.grey.shade100),
        ),
      ),
      body: _loading || _checkingVote
          ? const Center(
              child: CircularProgressIndicator(color: chateuPrimary))
          : _error != null
              ? Center(
                  child: Text(_error!,
                      style: TextStyle(color: Colors.grey.shade500)))
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

  Widget _buildVotedState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: chateuPrimary.withAlpha(15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.how_to_vote_rounded,
                  color: chateuPrimary, size: 64),
            ),
            const SizedBox(height: 24),
            const Text(
              "You've Already Voted!",
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: chateuText,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            Text(
              "Your vote for this election has been recorded. Thank you for participating!",
              textAlign: TextAlign.center,
              style:
                  TextStyle(fontSize: 14, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 32),
            // Election period info
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withAlpha(8),
                      blurRadius: 8,
                      offset: const Offset(0, 2)),
                ],
              ),
              child: Column(
                children: [
                  _infoRow(
                    Icons.calendar_today_rounded,
                    "Voting Period",
                    "${_formatDate(widget.election['start_date'] as String?)} – ${_formatDate(widget.election['end_date'] as String?)}",
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVotingForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Election info card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [chateuPrimary, chateuSecondary],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: chateuPrimary.withAlpha(80),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withAlpha(30),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.how_to_vote_rounded,
                          color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        widget.election['title'] as String? ??
                            "Election",
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ],
                ),
                if ((widget.election['description'] as String?)
                        ?.isNotEmpty ==
                    true) ...[
                  const SizedBox(height: 8),
                  Text(
                    widget.election['description'] as String,
                    style: TextStyle(
                        color: Colors.white.withAlpha(200),
                        fontSize: 13),
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(Icons.schedule_rounded,
                        color: Colors.white.withAlpha(180), size: 14),
                    const SizedBox(width: 5),
                    Text(
                      "${_formatDate(widget.election['start_date'] as String?)} – ${_formatDate(widget.election['end_date'] as String?)}",
                      style: TextStyle(
                          color: Colors.white.withAlpha(180),
                          fontSize: 12),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          if (_candidates.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  children: [
                    Icon(Icons.person_search_outlined,
                        size: 48, color: Colors.grey.shade300),
                    const SizedBox(height: 12),
                    Text("No candidates available yet.",
                        style: TextStyle(
                            color: Colors.grey.shade500,
                            fontSize: 14)),
                  ],
                ),
              ),
            )
          else
            ..._positions.map((position) => _buildPositionSection(position)),
        ],
      ),
    );
  }

  Widget _buildPositionSection(String position) {
    final candidates = _candidatesForPosition(position);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              Container(
                width: 4,
                height: 18,
                decoration: BoxDecoration(
                  color: chateuPrimary,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                position,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: chateuText,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                "(Select 1)",
                style: TextStyle(
                    fontSize: 12, color: Colors.grey.shade500),
              ),
            ],
          ),
        ),
        ...candidates.map((c) => _buildCandidateCard(c, position)),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildCandidateCard(
      Map<String, dynamic> candidate, String position) {
    final isSelected =
        _selectedCandidates[position] == candidate['id'];
    final photoUrl = candidate['photo_url'] as String?;

    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() {
          _selectedCandidates[position] =
              isSelected ? null : candidate['id'] as String;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected
              ? chateuPrimary.withAlpha(15)
              : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? chateuPrimary
                : Colors.grey.shade200,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? chateuPrimary.withAlpha(20)
                  : Colors.black.withAlpha(6),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            // Photo
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Container(
                width: 60,
                height: 60,
                color: Colors.grey.shade100,
                child: photoUrl != null && photoUrl.isNotEmpty
                    ? Image.network(
                        photoUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) =>
                            _candidateInitials(
                                candidate['full_name'] as String?),
                      )
                    : _candidateInitials(
                        candidate['full_name'] as String?),
              ),
            ),
            const SizedBox(width: 14),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    candidate['full_name'] as String? ?? "Candidate",
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: isSelected
                          ? chateuPrimary
                          : chateuText,
                    ),
                  ),
                  if ((candidate['manifesto'] as String?)
                          ?.isNotEmpty ==
                      true) ...[
                    const SizedBox(height: 3),
                    Text(
                      candidate['manifesto'] as String,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade500,
                          height: 1.4),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 10),
            // Selector
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: isSelected ? chateuPrimary : Colors.transparent,
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected
                      ? chateuPrimary
                      : Colors.grey.shade300,
                  width: 2,
                ),
              ),
              child: isSelected
                  ? const Icon(Icons.check_rounded,
                      color: Colors.white, size: 14)
                  : null,
            ),
          ],
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
    return Container(
      color: chateuPrimary.withAlpha(30),
      child: Center(
        child: Text(initials,
            style: const TextStyle(
                color: chateuPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 18)),
      ),
    );
  }

  Widget _buildSubmitBar() {
    final selected = _selectedCandidates.values
        .where((v) => v != null)
        .length;
    final total = _positions.length;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
              color: Colors.black.withAlpha(15),
              blurRadius: 16,
              offset: const Offset(0, -4)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Progress
          Row(
            children: [
              Text(
                "$selected / $total positions selected",
                style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                    fontWeight: FontWeight.w500),
              ),
              const Spacer(),
              Text(
                "${((selected / (total == 0 ? 1 : total)) * 100).toInt()}%",
                style: const TextStyle(
                    fontSize: 12,
                    color: chateuPrimary,
                    fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: total == 0 ? 0 : selected / total,
              backgroundColor: Colors.grey.shade200,
              valueColor:
                  const AlwaysStoppedAnimation<Color>(chateuPrimary),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: (_allPositionsSelected && !_submitting)
                  ? _submitVote
                  : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: chateuPrimary,
                disabledBackgroundColor:
                    chateuPrimary.withAlpha(100),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2.5),
                    )
                  : const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.how_to_vote_rounded,
                            color: Colors.white, size: 20),
                        SizedBox(width: 8),
                        Text(
                          "Submit My Vote",
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 16, color: chateuPrimary),
        const SizedBox(width: 8),
        Text("$label: ",
            style: TextStyle(
                color: Colors.grey.shade600,
                fontSize: 13,
                fontWeight: FontWeight.w500)),
        Expanded(
          child: Text(value,
              style: const TextStyle(
                  color: chateuText,
                  fontSize: 13,
                  fontWeight: FontWeight.w600)),
        ),
      ],
    );
  }
}