import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_colors.dart';
import 'domain/format/format.dart';
import 'app_theme.dart';
import 'app_dialogs.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────────────────────────────────────

class _Tenant {
  final String id, firstName, lastName, middleInitial, email, phone, status;

  const _Tenant({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.middleInitial,
    required this.email,
    required this.phone,
    required this.status,
  });

  String get fullName =>
      '$firstName${middleInitial.isNotEmpty ? ' $middleInitial.' : ''} $lastName'.trim();

  bool get isActive => status == 'active';
  bool get isPending => status == 'pending';

  factory _Tenant.fromMap(Map<String, dynamic> m) => _Tenant(
        id: (m['id'] ?? '').toString(),
        firstName: m['first_name'] ?? '',
        lastName: m['last_name'] ?? '',
        middleInitial: m['middle_initial'] ?? '',
        email: m['email'] ?? '',
        phone: m['phone'] ?? '',
        status: m['account_status'] ?? 'active',
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

class TenantManagementPage extends StatefulWidget {
  const TenantManagementPage({super.key});

  @override
  State<TenantManagementPage> createState() => _TenantManagementPageState();
}

class _TenantManagementPageState extends State<TenantManagementPage> {
  final _supabase = Supabase.instance.client;

  List<_Tenant> _tenants = [];
  bool _isLoading = true;
  String? _address;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final ownerId = _supabase.auth.currentUser?.id;
    if (ownerId == null) {
      setState(() => _isLoading = false);
      return;
    }
    try {
      final profile = await _supabase
          .from('profiles')
          .select('address')
          .eq('id', ownerId)
          .maybeSingle();

      final tenantsRaw = await _supabase
          .from('profiles')
          .select()
          .eq('owner_id', ownerId)
          .order('created_at', ascending: false);

      if (!mounted) return;
      setState(() {
        _address = profile?['address'] as String?;
        _tenants = (tenantsRaw as List)
            .map((t) => _Tenant.fromMap(t as Map<String, dynamic>))
            .toList();
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      showAppSnack(context, 'Failed to load tenants: $e', type: SnackType.error);
    }
  }

  // ── Edge Function call helper ─────────────────────────────────────────────

  // Returns (data: ..., error: null) on success or (data: null, error: ...) on
  // failure. Errors are returned rather than shown here because callers may
  // invoke this while a modal bottom sheet is open — a SnackBar fired from
  // that context renders behind the sheet's overlay and is never seen.
  Future<({Map<String, dynamic>? data, String? error})> _callManageTenant(
      Map<String, dynamic> body) async {
    try {
      final res =
          await _supabase.functions.invoke('manage-tenant', body: body);
      final data = res.data;
      if (data is Map && data['error'] != null) {
        return (data: null, error: data['error'].toString());
      }
      return (data: Map<String, dynamic>.from(data as Map), error: null);
    } catch (e) {
      return (data: null, error: 'Request failed: $e');
    }
  }

  // ── Add / Edit sheet ───────────────────────────────────────────────────────

  void _showAddSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TenantFormSheet(
        onSubmit: (data) async {
          final result = await _callManageTenant({'action': 'create', ...data});
          if (result.data != null && mounted) {
            Navigator.pop(context);
            showAppSnack(context, 'Tenant account created.',
                type: SnackType.success);
            _loadData();
          }
          return result.error;
        },
      ),
    );
  }

  // ── Status toggle / delete ────────────────────────────────────────────────

  // Tenant id currently being (de)activated or removed — drives the disabled/
  // spinner state on that tenant's card so a slow request doesn't look dead.
  String? _busyTenantId;

  Future<void> _toggleStatus(_Tenant tenant) async {
    final activating = !tenant.isActive;
    final confirmed = await showConfirmDialog(
      context,
      title: activating ? 'Reactivate Tenant?' : 'Deactivate Tenant?',
      message: activating
          ? '${tenant.fullName} will regain access to their account.'
          : '${tenant.fullName} will no longer be able to log in.',
      confirmLabel: activating ? 'Reactivate' : 'Deactivate',
      isDanger: !activating,
      icon: activating ? Icons.check_circle_outline_rounded : Icons.block_rounded,
    );
    if (!confirmed) return;

    setState(() => _busyTenantId = tenant.id);
    final result = await _callManageTenant({
      'action': activating ? 'activate' : 'deactivate',
      'tenant_id': tenant.id,
    });
    if (!mounted) return;
    setState(() => _busyTenantId = null);
    if (result.data != null) {
      showAppSnack(
          context,
          activating ? 'Tenant reactivated.' : 'Tenant deactivated.',
          type: SnackType.success);
      _loadData();
    } else {
      showAppSnack(context, result.error ?? 'Request failed.',
          type: SnackType.error);
    }
  }

  Future<void> _removeTenant(_Tenant tenant) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Remove Tenant?',
      message:
          '${tenant.fullName}\'s account will be permanently deleted. This cannot be undone.',
      confirmLabel: 'Remove',
      isDanger: true,
      icon: Icons.delete_outline_rounded,
    );
    if (!confirmed) return;

    setState(() => _busyTenantId = tenant.id);
    final result =
        await _callManageTenant({'action': 'delete', 'tenant_id': tenant.id});
    if (!mounted) return;
    setState(() => _busyTenantId = null);
    if (result.data != null) {
      showAppSnack(context, 'Tenant removed.', type: SnackType.success);
      _loadData();
    } else {
      showAppSnack(context, result.error ?? 'Request failed.',
          type: SnackType.error);
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final hasAddress = _address != null && _address!.isNotEmpty;
    // Optional address banner, section header, then tenants (or empty state).
    final lead = <Widget>[
      if (hasAddress) ...[
        AppNoticeBanner(
          icon: Icons.home_rounded,
          text: 'Tenants added here are linked to: $_address',
        ),
        const SizedBox(height: AppSpacing.xl),
      ],
      AppSectionHeader(title: 'Your Tenants (${_tenants.length})'),
      const SizedBox(height: AppSpacing.md),
    ];

    return Scaffold(
      appBar: buildStandardAppBar(context: context, title: 'Tenant Management'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddSheet,
        icon: const Icon(Icons.person_add_alt_1_rounded),
        label: const Text('Add Tenant'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: appListPadding(context,
                    top: AppSpacing.xl, bottom: AppSpacing.xxxl + 72),
                itemCount: lead.length + (_tenants.isEmpty ? 1 : _tenants.length),
                itemBuilder: (context, i) {
                  if (i < lead.length) return lead[i];
                  if (_tenants.isEmpty) {
                    return Padding(
                      padding: const EdgeInsets.all(AppSpacing.xxl),
                      child: Column(
                        children: [
                          Icon(Icons.people_outline_rounded,
                              size: 48, color: chateuTextMuted),
                          const SizedBox(height: AppSpacing.md),
                          Text('No tenants added yet.',
                              style: AppText.bodyMedium
                                  .copyWith(color: chateuTextMuted)),
                        ],
                      ),
                    );
                  }
                  final t = _tenants[i - lead.length];
                  return _TenantCard(
                    tenant: t,
                    isBusy: _busyTenantId == t.id,
                    onToggleStatus: () => _toggleStatus(t),
                    onRemove: () => _removeTenant(t),
                  );
                },
              ),
            ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant card
// ─────────────────────────────────────────────────────────────────────────────

class _TenantCard extends StatelessWidget {
  final _Tenant tenant;
  final bool isBusy;
  final VoidCallback onToggleStatus, onRemove;

  const _TenantCard({
    required this.tenant,
    required this.isBusy,
    required this.onToggleStatus,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final color = tenant.isPending
        ? chateuWarning
        : (tenant.isActive ? chateuPrimary : chateuTextMuted);
    Widget spinner(Color c) => SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(strokeWidth: 2, color: c),
        );
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.xs),
      decoration: AppDecorations.card,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tenant.fullName,
                        style: AppText.titleMedium,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(tenant.email,
                        style: AppText.caption,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              AppStatusBadge(
                  label: tenant.isPending
                      ? 'Pending Approval'
                      : (tenant.isActive ? 'Active' : 'Inactive'),
                  color: color),
            ],
          ),
          if (tenant.phone.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(children: [
              Icon(Icons.phone_rounded, size: 14, color: chateuTextMuted),
              const SizedBox(width: 6),
              Text(tenant.phone, style: AppText.caption),
            ]),
          ],
          if (tenant.isPending) ...[
            const SizedBox(height: AppSpacing.sm),
            AppNoticeBanner(
              icon: Icons.pending_actions_rounded,
              color: chateuWarning,
              text: 'Awaiting HOA admin approval of the move-in clearance.',
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              // The owner can't activate a pending tenant themselves — that
              // only happens once the admin approves the move-in clearance.
              if (!tenant.isPending)
                TextButton.icon(
                  style: TextButton.styleFrom(foregroundColor: chateuWarning),
                  onPressed: isBusy ? null : onToggleStatus,
                  icon: isBusy
                      ? spinner(chateuWarning)
                      : Icon(
                          tenant.isActive
                              ? Icons.block_rounded
                              : Icons.check_circle_outline_rounded,
                          size: 18),
                  label: Text(tenant.isActive ? 'Deactivate' : 'Reactivate'),
                ),
              TextButton.icon(
                style: TextButton.styleFrom(foregroundColor: chateuError),
                onPressed: isBusy ? null : onRemove,
                icon: isBusy
                    ? spinner(chateuError)
                    : const Icon(Icons.delete_outline_rounded, size: 18),
                label: const Text('Remove'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Add tenant form sheet
// ─────────────────────────────────────────────────────────────────────────────

class _TenantFormSheet extends StatefulWidget {
  // Returns an error message to display inline, or null on success.
  final Future<String?> Function(Map<String, dynamic> data) onSubmit;

  const _TenantFormSheet({required this.onSubmit});

  @override
  State<_TenantFormSheet> createState() => _TenantFormSheetState();
}

class _TenantFormSheetState extends State<_TenantFormSheet> {
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _middleInitialCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _moveInDateCtrl = TextEditingController();
  final _picker = ImagePicker();
  bool _isSubmitting = false;
  bool _isPasswordHidden = true;
  String? _errorText;

  // Move-in clearance docs — same requirement as a self-registering
  // homeowner, minus proof of ownership (a tenant has a contract instead).
  XFile? _contractCopy;
  XFile? _barangayClearance;

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _middleInitialCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _moveInDateCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickMoveInDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null && mounted) {
      setState(() {
        _moveInDateCtrl.text =
            dateKey(picked);
      });
    }
  }

  Future<void> _pickContractCopy() async {
    final f = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (f != null && mounted) setState(() => _contractCopy = f);
  }

  Future<void> _pickBarangayClearance() async {
    final f = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (f != null && mounted) setState(() => _barangayClearance = f);
  }

  // Uploads on behalf of the tenant using the OWNER's own session (the
  // tenant has no session yet at this point), so the path's uid segment
  // must be the owner's id to satisfy the move-in-docs storage RLS policy.
  Future<String?> _uploadDoc(XFile? file, String folder, String ownerId) async {
    if (file == null) return null;
    try {
      final bytes = await file.readAsBytes();
      final ext = file.name.contains('.') ? file.name.split('.').last : 'jpg';
      final path = '$folder/$ownerId/${DateTime.now().millisecondsSinceEpoch}.$ext';
      await Supabase.instance.client.storage
          .from('move-in-docs')
          .uploadBinary(path, bytes, fileOptions: const FileOptions(upsert: true));
      return Supabase.instance.client.storage.from('move-in-docs').getPublicUrl(path);
    } catch (_) {
      return null;
    }
  }

  Future<void> _submit() async {
    setState(() => _errorText = null);

    final first = _firstNameCtrl.text.trim();
    final last = _lastNameCtrl.text.trim();
    if (first.isEmpty || last.isEmpty) {
      setState(() => _errorText = 'First and last name are required.');
      return;
    }
    if (!isValidPhPhone(_phoneCtrl.text.trim())) {
      setState(() => _errorText =
          'Enter a valid PH phone number (e.g. 09123456789).');
      return;
    }

    final data = <String, dynamic>{
      'first_name': first,
      'last_name': last,
      'middle_initial': _middleInitialCtrl.text.trim(),
      'phone': _phoneCtrl.text.trim(),
    };

    final email = _emailCtrl.text.trim();
    final password = _passwordCtrl.text;
    if (email.isEmpty || !RegExp(r'^[^@]+@[^@]+\.[^@]+$').hasMatch(email)) {
      setState(() => _errorText = 'Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setState(() => _errorText = 'Password must be at least 8 characters.');
      return;
    }
    data['email'] = email;
    data['password'] = password;

    if (_moveInDateCtrl.text.isEmpty) {
      setState(() => _errorText = 'Please select the move-in date.');
      return;
    }
    if (_contractCopy == null) {
      setState(() => _errorText = 'Please upload a copy of the lease/contract.');
      return;
    }
    if (_barangayClearance == null) {
      setState(() =>
          _errorText = 'Please upload the Barangay/HOA Move-Out Clearance.');
      return;
    }

    final ownerId = Supabase.instance.client.auth.currentUser?.id;
    if (ownerId == null) {
      setState(() => _errorText = 'Not authenticated.');
      return;
    }

    setState(() => _isSubmitting = true);
    HapticFeedback.lightImpact();

    final contractUrl = await _uploadDoc(_contractCopy, 'contract-copy', ownerId);
    final clearanceUrl =
        await _uploadDoc(_barangayClearance, 'barangay-clearance', ownerId);
    if (contractUrl == null || clearanceUrl == null) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorText = 'Failed to upload move-in documents. Please try again.';
        });
      }
      return;
    }

    data['move_in_date'] = _moveInDateCtrl.text;
    data['contract_copy_url'] = contractUrl;
    data['barangay_clearance_url'] = clearanceUrl;

    final error = await widget.onSubmit(data);
    if (mounted) {
      setState(() {
        _isSubmitting = false;
        _errorText = error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
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
              bottom: MediaQuery.of(context).viewInsets.bottom +
                  MediaQuery.paddingOf(context).bottom +
                  AppSpacing.xxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              buildSheetHandle(),
              Text('Add Tenant', style: AppText.titleLarge),
              const SizedBox(height: AppSpacing.xs),
              Text('Create a login account for your tenant.',
                  style: AppText.bodyMedium.copyWith(color: chateuTextMuted)),
              if (_errorText != null) ...[
                const SizedBox(height: AppSpacing.md),
                AppNoticeBanner(
                  icon: Icons.error_rounded,
                  color: chateuError,
                  text: _errorText!,
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              Row(children: [
                Expanded(
                    flex: 3,
                    child: _field(
                        label: 'First Name *',
                        controller: _firstNameCtrl,
                        icon: Icons.badge_rounded)),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                    flex: 3,
                    child: _field(
                        label: 'Last Name *',
                        controller: _lastNameCtrl,
                        icon: Icons.person_rounded)),
              ]),
              const SizedBox(height: AppSpacing.md),
              Row(children: [
                Expanded(
                    flex: 1,
                    child: _field(
                        label: 'M.I.',
                        controller: _middleInitialCtrl,
                        maxLength: 1)),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                    flex: 3,
                    child: _field(
                        label: 'Phone',
                        controller: _phoneCtrl,
                        icon: Icons.phone_rounded,
                        keyboardType: TextInputType.phone)),
              ]),
              const SizedBox(height: AppSpacing.md),
              _field(
                label: 'Email *',
                controller: _emailCtrl,
                icon: Icons.email_rounded,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: AppSpacing.md),
              _field(
                label: 'Temporary Password *',
                controller: _passwordCtrl,
                icon: Icons.lock_rounded,
                obscureText: _isPasswordHidden,
                suffixIcon: IconButton(
                  tooltip: _isPasswordHidden ? 'Show password' : 'Hide password',
                  icon: Icon(
                      _isPasswordHidden
                          ? Icons.visibility_off_rounded
                          : Icons.visibility_rounded,
                      size: 18),
                  onPressed: () =>
                      setState(() => _isPasswordHidden = !_isPasswordHidden),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              AppNoticeBanner(
                icon: Icons.info_outline_rounded,
                text:
                    'Share this email and temporary password with your tenant so they can log in. They can change their password later from their account.',
              ),

              const SizedBox(height: AppSpacing.xl),
              Text('Move-In Clearance', style: AppText.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              Text(
                  'Same requirements as a homeowner move-in — the HOA admin must '
                  'approve this before your tenant can log in.',
                  style: AppText.bodyMedium.copyWith(color: chateuTextMuted)),
              const SizedBox(height: AppSpacing.md),

              InkWell(
                onTap: _pickMoveInDate,
                borderRadius: BorderRadius.circular(AppRadius.sm),
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Move-In Date *',
                    prefixIcon: Icon(Icons.calendar_today_rounded, size: 18),
                    suffixIcon: Icon(Icons.expand_more_rounded),
                  ),
                  child: Text(
                    _moveInDateCtrl.text.isEmpty
                        ? 'Select move-in date'
                        : _moveInDateCtrl.text,
                    style: AppText.bodyMedium.copyWith(
                        color: _moveInDateCtrl.text.isEmpty
                            ? chateuTextMuted
                            : chateuText),
                  ),
                ),
              ),

              const SizedBox(height: AppSpacing.md),
              Text('Contract Copy *',
                  style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
              const SizedBox(height: AppSpacing.sm),
              _docUploadTile(
                hint: 'Lease agreement / contract of tenancy',
                file: _contractCopy,
                onTap: _pickContractCopy,
                onRemove: () => setState(() => _contractCopy = null),
              ),

              const SizedBox(height: AppSpacing.md),
              Text('Barangay / HOA Move-Out Clearance *',
                  style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
              const SizedBox(height: AppSpacing.sm),
              _docUploadTile(
                hint: 'Upload Barangay Clearance or HOA Move-Out Clearance',
                file: _barangayClearance,
                onTap: _pickBarangayClearance,
                onRemove: () => setState(() => _barangayClearance = null),
              ),

              const SizedBox(height: AppSpacing.xl),
              AppPrimaryButton(
                label: 'Create Tenant Account',
                isLoading: _isSubmitting,
                onPressed: _isSubmitting ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _docUploadTile({
    required String hint,
    required XFile? file,
    required VoidCallback onTap,
    required VoidCallback onRemove,
  }) {
    return AppUploadTile(
      hasFile: file != null,
      label: file?.name ?? hint,
      onTap: file != null ? null : onTap,
      onRemove: onRemove,
    );
  }

  Widget _field({
    required String label,
    required TextEditingController controller,
    IconData? icon,
    TextInputType? keyboardType,
    int? maxLength,
    bool obscureText = false,
    Widget? suffixIcon,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      maxLength: maxLength,
      obscureText: obscureText,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: icon != null ? Icon(icon, size: 18) : null,
        suffixIcon: suffixIcon,
        counterText: '',
      ),
    );
  }
}
