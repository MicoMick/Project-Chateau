import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_colors.dart';
import 'app_theme.dart';
import 'app_dialogs.dart';
import 'login_page.dart';
import 'app_services.dart';
import 'audit_logger.dart';
import 'domain/resident/current_resident.dart';
import 'push_notifications.dart';

class AccountPage extends StatefulWidget {
  const AccountPage({super.key, this.resident});

  /// Defaults to the app's [currentResident]; tests pass their own.
  final CurrentResident? resident;

  @override
  State<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends State<AccountPage> {
  final _supabase = Supabase.instance.client;
  final _picker   = ImagePicker();

  // ── Controllers ───────────────────────────────────────────────────────────
  final _firstNameCtrl     = TextEditingController();
  final _lastNameCtrl      = TextEditingController();
  final _middleInitialCtrl = TextEditingController();
  final _phoneCtrl         = TextEditingController();

  // ── State ─────────────────────────────────────────────────────────────────
  bool _isLoading  = true;
  bool _isSaving   = false;
  bool _isEditMode = false;

  DateTime? _birthDate;
  String?   _avatarUrl;
  String?   _residentType;

  File?      _newAvatarFile;
  Uint8List? _newAvatarBytes;

  bool get _hasNewAvatar => _newAvatarFile != null || _newAvatarBytes != null;

  // ── Family members ────────────────────────────────────────────────────────
  List<Map<String, dynamic>> _familyMembers = [];
  bool _familyLoading = true;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadFamilyMembers();
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _middleInitialCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  Future<void> _loadProfile() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;
    try {
      final data = await _supabase
          .from('profiles')
          .select()
          .eq('id', user.id)
          .single();
      if (!mounted) return;
      setState(() {
        _firstNameCtrl.text     = data['first_name']         ?? '';
        _lastNameCtrl.text      = data['last_name']          ?? '';
        _middleInitialCtrl.text = data['middle_initial']     ?? '';
        _phoneCtrl.text         = data['phone']              ?? '';
        _avatarUrl              = data['avatar_url'];
        _residentType           = data['resident_type'];
        if (data['birth_date'] != null) {
          _birthDate = DateTime.tryParse(data['birth_date']);
        }
        _isLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ── Family members ────────────────────────────────────────────────────────

  Future<void> _loadFamilyMembers() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;
    try {
      final data = await _supabase
          .from('family_members')
          .select()
          .eq('resident_id', user.id)
          .order('created_at');
      if (mounted) {
        setState(() {
          _familyMembers = List<Map<String, dynamic>>.from(data);
          _familyLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _familyLoading = false);
    }
  }

  Future<void> _refreshAll() =>
      Future.wait([_loadProfile(), _loadFamilyMembers()]);

  Future<void> _saveFamilyMember({
    String? id,
    required String fullName,
    required String relationship,
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;
    try {
      final row = {
        'resident_id': user.id,
        'full_name': fullName,
        'relationship': relationship.isNotEmpty ? relationship : null,
        'created_by': user.id,
      };
      if (id != null) {
        await _supabase.from('family_members').update(row).eq('id', id);
        await logAudit('UPDATE_FAMILY_MEMBER', 'Updated family member "$fullName".');
      } else {
        await _supabase.from('family_members').insert(row);
        await logAudit('ADD_FAMILY_MEMBER', 'Added family member "$fullName".');
      }
      await _loadFamilyMembers();
      if (mounted) {
        _showSnack(id != null
            ? 'Family member updated.'
            : 'Family member added.');
      }
    } catch (e) {
      if (mounted) _showSnack('Could not save family member: $e', isError: true);
    }
  }

  Future<void> _deleteFamilyMember(Map<String, dynamic> member) async {
    final confirm = await showConfirmDialog(
      context,
      title: 'Remove Family Member',
      message:
          'Remove "${member['full_name']}" from your household? This cannot be undone.',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      isDanger: true,
      icon: Icons.person_remove_rounded,
    );
    if (!confirm) return;
    try {
      await _supabase.from('family_members').delete().eq('id', member['id']);
      await logAudit('DELETE_FAMILY_MEMBER', 'Removed family member "${member['full_name']}".');
      await _loadFamilyMembers();
      if (mounted) _showSnack('Family member removed.');
    } catch (e) {
      if (mounted) _showSnack('Could not remove family member: $e', isError: true);
    }
  }

  void _showFamilyMemberSheet({Map<String, dynamic>? existing}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FamilyMemberSheet(
        existing: existing,
        onSave: (fullName, relationship) => _saveFamilyMember(
          id: existing?['id'] as String?,
          fullName: fullName,
          relationship: relationship,
        ),
      ),
    );
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  bool _isValidPhone(String phone) {
    final cleaned = phone.replaceAll(RegExp(r'[\s\-\(\)]'), '');
    return RegExp(r'^(09\d{9}|\+639\d{9})$').hasMatch(cleaned);
  }

  bool _validateProfile() {
    final firstName = _firstNameCtrl.text.trim();
    final lastName  = _lastNameCtrl.text.trim();
    final phone     = _phoneCtrl.text.trim();
    if (firstName.isEmpty) {
      _showSnack('First name is required.', isError: true); return false;
    }
    if (lastName.isEmpty) {
      _showSnack('Last name is required.', isError: true); return false;
    }
    if (phone.isNotEmpty && !_isValidPhone(phone)) {
      _showSnack('Enter a valid PH phone number (e.g. 09123456789).', isError: true);
      return false;
    }
    return true;
  }

  Future<void> _saveProfile() async {
    if (!_validateProfile()) return;
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    setState(() => _isSaving = true);
    HapticFeedback.lightImpact();

    try {
      String? newAvatarUrl = _avatarUrl;

      if (_hasNewAvatar) {
        final ext      = kIsWeb ? 'jpg' : _newAvatarFile!.path.split('.').last;
        final fileName =
            '${user.id}/avatar_${DateTime.now().millisecondsSinceEpoch}.$ext';
        if (kIsWeb) {
          await _supabase.storage.from('avatars').uploadBinary(
              fileName, _newAvatarBytes!,
              fileOptions: const FileOptions(upsert: true));
        } else {
          await _supabase.storage.from('avatars').upload(
              fileName, _newAvatarFile!,
              fileOptions: const FileOptions(upsert: true));
        }
        newAvatarUrl =
            _supabase.storage.from('avatars').getPublicUrl(fileName);
      }

      final mi       = _middleInitialCtrl.text.trim().toUpperCase();
      final fullName =
          '${_firstNameCtrl.text.trim()}${mi.isNotEmpty ? ' $mi.' : ''} ${_lastNameCtrl.text.trim()}'
              .trim();

      await _supabase.from('profiles').upsert({
        'id':             user.id,
        'first_name':     _firstNameCtrl.text.trim(),
        'last_name':      _lastNameCtrl.text.trim(),
        'middle_initial': mi,
        'full_name':      fullName,
        'phone':          _phoneCtrl.text.trim(),
        'birth_date':
            _birthDate?.toIso8601String().split('T').first,
        'avatar_url':     newAvatarUrl,
      });

      // The name and avatar shown elsewhere come from the Current Resident.
      await (widget.resident ?? currentResident).refresh();
      await logAudit('UPDATE_PROFILE', 'Updated profile details.');
      if (!mounted) return;

      setState(() {
        _avatarUrl      = newAvatarUrl;
        _newAvatarFile  = null;
        _newAvatarBytes = null;
        _isSaving       = false;
        _isEditMode     = false;
      });
      _showSnack("Profile updated successfully!");
    } on StorageException catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      _showSnack("Avatar upload failed: ${e.message}", isError: true);
    } on PostgrestException catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      _showSnack("Could not save profile: ${e.message}", isError: true);
    } catch (_) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      _showSnack("Something went wrong. Please try again.", isError: true);
    }
  }

  // ── Avatar picker ─────────────────────────────────────────────────────────

  Future<void> _pickAvatar(ImageSource source) async {
    try {
      final xfile = await _picker.pickImage(
          source: source, imageQuality: 85, maxWidth: 600);
      if (xfile != null && mounted) {
        if (kIsWeb) {
          final bytes = await xfile.readAsBytes();
          if (!mounted) return;
          setState(() { _newAvatarBytes = bytes; _newAvatarFile = null; });
        } else {
          setState(() { _newAvatarFile = File(xfile.path); _newAvatarBytes = null; });
        }
      }
    } catch (_) {
      _showSnack("Could not access photo. Check permissions.", isError: true);
    }
  }

  void _showAvatarOptions() {
    showModalBottomSheet(
      context: context,
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, AppSpacing.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              buildSheetHandle(),
              Text("Profile Photo", style: AppText.titleMedium),
              const SizedBox(height: AppSpacing.lg),
              if (!kIsWeb)
                _SheetTile(
                  icon: Icons.camera_alt_rounded,
                  label: "Take a Photo",
                  onTap: () {
                    Navigator.pop(context);
                    _pickAvatar(ImageSource.camera);
                  },
                ),
              _SheetTile(
                icon: Icons.photo_library_rounded,
                label: "Choose from Gallery",
                onTap: () {
                  Navigator.pop(context);
                  _pickAvatar(ImageSource.gallery);
                },
              ),
              if (_hasNewAvatar || _avatarUrl != null)
                _SheetTile(
                  icon: Icons.delete_outline_rounded,
                  label: "Remove Photo",
                  color: chateuError,
                  onTap: () {
                    Navigator.pop(context);
                    setState(() {
                      _newAvatarFile  = null;
                      _newAvatarBytes = null;
                      _avatarUrl      = null;
                    });
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Date picker ───────────────────────────────────────────────────────────

  Future<void> _pickBirthDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? DateTime(1995),
      firstDate: DateTime(1940),
      lastDate: DateTime.now().subtract(const Duration(days: 365 * 10)),
    );
    if (picked != null) setState(() => _birthDate = picked);
  }

  // ── Sign out ──────────────────────────────────────────────────────────────

  Future<void> _signOut() async {
    final confirm = await showConfirmDialog(
      context,
      title:        'Sign Out',
      message:      'Are you sure you want to sign out?',
      confirmLabel: 'Sign Out',
      cancelLabel:  'Cancel',
      isDanger:     true,
      icon:         Icons.logout_rounded,
    );
    if (confirm) {
      await PushNotifications.unregisterToken();
      await _supabase.auth.signOut();
      if (mounted) {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const LoginPage()),
          (_) => false,
        );
      }
    }
  }

  // ── Snack ─────────────────────────────────────────────────────────────────

  void _showSnack(String msg, {bool isError = false}) {
    showAppSnack(context, msg, type: isError ? SnackType.error : SnackType.success);
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final user = _supabase.auth.currentUser;
    final name = (_firstNameCtrl.text.isNotEmpty || _lastNameCtrl.text.isNotEmpty)
        ? '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}'.trim()
        : 'Chateau Resident';

    return Scaffold(
      appBar: AppBar(
        title: const Text("My Account"),
        actions: [
          if (!_isLoading)
            TextButton(
              onPressed: () {
                if (_isEditMode) {
                  setState(() => _isEditMode = false);
                  _loadProfile();
                } else {
                  setState(() => _isEditMode = true);
                }
              },
              child: Text(_isEditMode ? "Cancel" : "Edit"),
            ),
          const SizedBox(width: AppSpacing.xs),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _refreshAll,
              child: SingleChildScrollView(
                padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
                physics: const AlwaysScrollableScrollPhysics(),
                child: AppContentWidth(
                  maxWidth: 640,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.lg,
                        AppSpacing.lg, AppSpacing.lg, AppSpacing.xxxl),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // ── Identity ─────────────────────────────────────
                        Center(
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Container(
                                width: 88,
                                height: 88,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(color: chateuBorder),
                                ),
                                child: ClipOval(child: _buildAvatarImage()),
                              ),
                              if (_isEditMode)
                                Positioned(
                                  right: -12,
                                  bottom: -12,
                                  child: IconButton.filledTonal(
                                    tooltip: 'Change profile photo',
                                    onPressed: _showAvatarOptions,
                                    icon: const Icon(
                                        Icons.camera_alt_rounded,
                                        size: 20),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Text(name,
                            textAlign: TextAlign.center,
                            style: AppText.displayMedium),
                        const SizedBox(height: AppSpacing.xs),
                        Text(user?.email ?? '',
                            textAlign: TextAlign.center,
                            style: AppText.bodyMedium
                                .copyWith(color: chateuTextMuted)),
                        if (_residentType != null) ...[
                          const SizedBox(height: AppSpacing.sm),
                          Center(
                            child: AppStatusBadge(
                              label: _residentType![0].toUpperCase() +
                                  _residentType!.substring(1),
                              color: chateuPrimary,
                            ),
                          ),
                        ],

                        const SizedBox(height: AppSpacing.xxl),

                        // ── Personal Information ─────────────────────────
                        _buildInfoCard(
                          title: "Personal Information",
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  flex: 3,
                                  child: _buildField(
                                    label: "First Name",
                                    controller: _firstNameCtrl,
                                    icon: Icons.badge_rounded,
                                    enabled: _isEditMode,
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.sm),
                                Expanded(
                                  flex: 1,
                                  child: _buildField(
                                    label: "M.I.",
                                    controller: _middleInitialCtrl,
                                    enabled: _isEditMode,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.lg),
                            _buildField(
                              label: "Last Name",
                              controller: _lastNameCtrl,
                              icon: Icons.badge_outlined,
                              enabled: _isEditMode,
                            ),
                            const SizedBox(height: AppSpacing.lg),
                            _buildField(
                              label: "Phone Number",
                              controller: _phoneCtrl,
                              icon: Icons.phone_rounded,
                              enabled: _isEditMode,
                              keyboardType: TextInputType.phone,
                            ),
                            const SizedBox(height: AppSpacing.lg),
                            _buildDateField(),
                          ],
                        ),

                        const SizedBox(height: AppSpacing.lg),
                        _buildFamilyCard(),

                        if (_isEditMode) ...[
                          const SizedBox(height: AppSpacing.xl),
                          AppPrimaryButton(
                            label: "Save Changes",
                            isLoading: _isSaving,
                            onPressed: _saveProfile,
                          ),
                        ],

                        const SizedBox(height: AppSpacing.xxl),
                        OutlinedButton.icon(
                          onPressed: _signOut,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: chateuError,
                            side: BorderSide(color: chateuError),
                            minimumSize: const Size.fromHeight(52),
                          ),
                          icon: const Icon(Icons.logout_rounded, size: 18),
                          label: const Text("Sign Out"),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
    );
  }

  // ── Card wrapper ──────────────────────────────────────────────────────────

  Widget _buildInfoCard({
    required String title,
    Widget? trailing,
    required List<Widget> children,
  }) {
    return Container(
      width: double.infinity,
      decoration: AppDecorations.card,
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Row(
              children: [
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text(title, style: AppText.titleMedium),
                  ),
                ),
                if (trailing != null) trailing,
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          ...children,
        ],
      ),
    );
  }

  // ── Family members card ───────────────────────────────────────────────────

  Widget _buildFamilyCard() {
    return _buildInfoCard(
      title: "Family Members",
      trailing: IconButton.filledTonal(
        tooltip: 'Add family member',
        onPressed: () => _showFamilyMemberSheet(),
        icon: const Icon(Icons.add_rounded),
      ),
      children: [
        if (_familyLoading)
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
              child: CircularProgressIndicator(),
            ),
          )
        else if (_familyMembers.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
            child: Text(
              "No family members added yet.",
              style: AppText.bodyMedium.copyWith(color: chateuTextMuted),
            ),
          )
        else
          for (final m in _familyMembers) _familyMemberTile(m),
      ],
    );
  }

  Widget _familyMemberTile(Map<String, dynamic> member) {
    final name = member['full_name'] as String? ?? '';
    final relationship = member['relationship'] as String?;

    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        radius: 18,
        backgroundColor: chateuSurfaceMuted,
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: AppText.bodyMedium.copyWith(
              color: chateuPrimary, fontWeight: FontWeight.w700),
        ),
      ),
      title: Text(name.isNotEmpty ? name : 'Unnamed',
          style: AppText.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
      subtitle: (relationship != null && relationship.isNotEmpty)
          ? Text(relationship, style: AppText.caption)
          : null,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            tooltip: 'Edit $name',
            onPressed: () => _showFamilyMemberSheet(existing: member),
            icon: Icon(Icons.edit_rounded, size: 20, color: chateuPrimary),
          ),
          IconButton(
            tooltip: 'Remove $name',
            onPressed: () => _deleteFamilyMember(member),
            icon: Icon(Icons.delete_outline_rounded,
                size: 20, color: chateuError),
          ),
        ],
      ),
    );
  }

  // ── Avatar image ──────────────────────────────────────────────────────────

  Widget _buildAvatarImage() {
    if (_hasNewAvatar) {
      return kIsWeb
          ? Image.memory(_newAvatarBytes!, fit: BoxFit.cover, cacheWidth: 264)
          : Image.file(_newAvatarFile!, fit: BoxFit.cover, cacheWidth: 264);
    }
    if (_avatarUrl != null && _avatarUrl!.isNotEmpty) {
      return Image.network(_avatarUrl!,
          fit: BoxFit.cover,
          cacheWidth: 264,
          semanticLabel: 'Profile photo',
          errorBuilder: (_, __, ___) => _avatarPlaceholder());
    }
    return _avatarPlaceholder();
  }

  Widget _avatarPlaceholder() {
    final name =
        '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}'.trim();
    final initials = name.isNotEmpty
        ? name
            .split(' ')
            .where((e) => e.isNotEmpty)
            .map((e) => e[0])
            .take(2)
            .join()
        : '?';
    return Container(
      color: chateuSurfaceMuted,
      child: Center(
        child: Text(
          initials,
          style: AppText.displayLarge.copyWith(color: chateuPrimary),
        ),
      ),
    );
  }

  // ── Field builders ────────────────────────────────────────────────────────

  Widget _buildField({
    required String label,
    required TextEditingController controller,
    IconData? icon,
    required bool enabled,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: controller,
      enabled: enabled,
      keyboardType: keyboardType,
      style: AppText.bodyMedium.copyWith(fontWeight: FontWeight.w500),
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: icon == null ? null : Icon(icon, size: 18),
        fillColor: enabled ? chateuSurface : chateuSurfaceMuted,
      ),
    );
  }

  Widget _buildDateField() {
    final display = _birthDate != null
        ? "${_birthDate!.month.toString().padLeft(2, '0')}/"
            "${_birthDate!.day.toString().padLeft(2, '0')}/"
            "${_birthDate!.year}"
        : "Not set";

    return InkWell(
      onTap: _isEditMode ? _pickBirthDate : null,
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: "Birth Date",
          enabled: _isEditMode,
          prefixIcon: const Icon(Icons.cake_rounded, size: 18),
          suffixIcon: _isEditMode
              ? const Icon(Icons.edit_calendar_rounded, size: 18)
              : null,
          fillColor: _isEditMode ? chateuSurface : chateuSurfaceMuted,
        ),
        child: Text(
          display,
          style: AppText.bodyMedium.copyWith(
            fontWeight: FontWeight.w500,
            color: _birthDate != null ? chateuText : chateuTextMuted,
          ),
        ),
      ),
    );
  }
}

// ── Sheet Tile ─────────────────────────────────────────────────────────────────

class _SheetTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  const _SheetTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: color ?? chateuPrimary),
      title: Text(label,
          style: AppText.bodyLarge.copyWith(
            color: color ?? chateuText,
            fontWeight: FontWeight.w500,
          )),
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm)),
      onTap: onTap,
    );
  }
}


// ── Family Member Sheet — add / edit ─────────────────────────────────────────

const List<String> _kRelationshipOptions = [
  'Spouse',
  'Child',
  'Parent',
  'Sibling',
  'Pet',
  'Other',
];

class _FamilyMemberSheet extends StatefulWidget {
  final Map<String, dynamic>? existing;
  final Future<void> Function(String fullName, String relationship) onSave;

  const _FamilyMemberSheet({this.existing, required this.onSave});

  @override
  State<_FamilyMemberSheet> createState() => _FamilyMemberSheetState();
}

class _FamilyMemberSheetState extends State<_FamilyMemberSheet> {
  final _nameCtrl = TextEditingController();
  String _relationship = _kRelationshipOptions.first;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _nameCtrl.text = e['full_name'] as String? ?? '';
      final rel = e['relationship'] as String?;
      if (rel != null && _kRelationshipOptions.contains(rel)) {
        _relationship = rel;
      }
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      showAppSnack(context, 'Full name is required.', type: SnackType.error);
      return;
    }
    setState(() => _isSaving = true);
    await widget.onSave(name, _relationship);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.existing != null;
    return Padding(
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom +
              MediaQuery.paddingOf(context).bottom),
      child: Container(
        decoration: AppDecorations.sheet,
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.xl, AppSpacing.sm, AppSpacing.xl, AppSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            buildSheetHandle(),
            Text(isEdit ? 'Edit Family Member' : 'Add Family Member',
                style: AppText.titleLarge),
            const SizedBox(height: AppSpacing.lg),

            TextField(
              controller: _nameCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Full Name *',
                hintText: 'e.g. Juan Dela Cruz',
                prefixIcon: Icon(Icons.badge_rounded, size: 18),
              ),
            ),

            const SizedBox(height: AppSpacing.lg),
            DropdownButtonFormField<String>(
              initialValue: _relationship,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Relationship'),
              items: _kRelationshipOptions
                  .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                  .toList(),
              onChanged: (v) {
                if (v != null) setState(() => _relationship = v);
              },
            ),

            const SizedBox(height: AppSpacing.xl),
            AppPrimaryButton(
              label: isEdit ? 'Save Changes' : 'Add Family Member',
              isLoading: _isSaving,
              onPressed: _isSaving ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}
