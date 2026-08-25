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
class AccountPage extends StatefulWidget {
  const AccountPage({super.key});

  @override
  State<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends State<AccountPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
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

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
    _loadProfile();
  }

  @override
  void dispose() {
    _animController.dispose();
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
      setState(() => _isLoading = false);
    }
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

      setState(() {
        _avatarUrl      = newAvatarUrl;
        _newAvatarFile  = null;
        _newAvatarBytes = null;
        _isSaving       = false;
        _isEditMode     = false;
      });
      _showSnack("Profile updated successfully!");
    } on StorageException catch (e) {
      setState(() => _isSaving = false);
      _showSnack("Avatar upload failed: ${e.message}", isError: true);
    } on PostgrestException catch (e) {
      setState(() => _isSaving = false);
      _showSnack("Could not save profile: ${e.message}", isError: true);
    } catch (_) {
      setState(() => _isSaving = false);
      _showSnack("Something went wrong. Please try again.", isError: true);
    }
  }

  // ── Avatar picker ─────────────────────────────────────────────────────────

  Future<void> _pickAvatar(ImageSource source) async {
    try {
      final xfile = await _picker.pickImage(
          source: source, imageQuality: 85, maxWidth: 600);
      if (xfile != null) {
        if (kIsWeb) {
          final bytes = await xfile.readAsBytes();
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
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, AppSpacing.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40, height: 4,
                margin: const EdgeInsets.only(bottom: AppSpacing.lg),
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
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
                  color: const Color(0xFFDC2626),
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
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.light(
            primary: chateuPrimary,
            onPrimary: Colors.white,
            surface: Colors.white,
          ),
        ),
        child: child!,
      ),
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
    final mq      = MediaQuery.of(context);
    final screenW = mq.size.width;
    final isWide  = screenW > 600;
    final hPad    = isWide ? screenW * 0.08 : AppSpacing.lg;
    final user    = _supabase.auth.currentUser;

    return Scaffold(
      backgroundColor: chateuBackground,
      appBar: AppBar(
        backgroundColor: chateuBackground,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: chateuPrimary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text("My Account", style: AppText.titleLarge),
        centerTitle: true,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: AppSpacing.md),
            child: GestureDetector(
              onTap: () {
                if (_isEditMode) {
                  setState(() => _isEditMode = false);
                  _loadProfile();
                } else {
                  setState(() => _isEditMode = true);
                }
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md, vertical: 7),
                decoration: BoxDecoration(
                  color: _isEditMode
                      ? Colors.grey.shade200
                      : chateuPrimary,
                  borderRadius: BorderRadius.circular(AppRadius.xxl),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _isEditMode ? Icons.close_rounded : Icons.edit_rounded,
                      size: 14,
                      color: _isEditMode
                          ? Colors.grey.shade700
                          : Colors.white,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      _isEditMode ? "Cancel" : "Edit",
                      style: AppText.caption.copyWith(
                        fontWeight: FontWeight.w700,
                        color: _isEditMode
                            ? Colors.grey.shade700
                            : Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: chateuPrimary))
          : SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: EdgeInsets.symmetric(horizontal: hPad)
                  .copyWith(bottom: AppSpacing.xxxl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: AppSpacing.lg),

                  // ── Avatar hero card ────────────────────────────────
                  _FadeSlide(
                    controller: _animController,
                    delay: 0.0,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                          vertical: AppSpacing.xxl,
                          horizontal: AppSpacing.xl),
                      decoration: AppDecorations.primaryGradient(
                          radius: AppRadius.lg),
                      child: Column(
                        children: [
                          // Avatar
                          Stack(
                            children: [
                              Container(
                                width: 88,
                                height: 88,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                      color: Colors.white.withAlpha(80),
                                      width: 3),
                                ),
                                child: ClipOval(child: _buildAvatarImage()),
                              ),
                              if (_isEditMode)
                                Positioned(
                                  right: 0, bottom: 0,
                                  child: GestureDetector(
                                    onTap: _showAvatarOptions,
                                    child: Container(
                                      padding: const EdgeInsets.all(6),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        shape: BoxShape.circle,
                                        boxShadow: AppShadows.card,
                                      ),
                                      child: const Icon(
                                        Icons.camera_alt_rounded,
                                        size: 16,
                                        color: chateuPrimary,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.md),

                          // Name
                          Text(
                            (_firstNameCtrl.text.isNotEmpty ||
                                    _lastNameCtrl.text.isNotEmpty)
                                ? '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}'
                                    .trim()
                                : 'Chateau Resident',
                            style: AppText.displayMedium.copyWith(
                              color: Colors.white,
                              fontSize: 20,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            user?.email ?? '',
                            style: AppText.caption.copyWith(
                              color: Colors.white.withAlpha(180),
                            ),
                          ),
                          if (_residentType != null) ...[
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
                                _residentType!.toUpperCase(),
                                style: AppText.caption.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.5,
                                  fontSize: 10,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: AppSpacing.lg),

                  // ── Personal Information ────────────────────────────
                  _FadeSlide(
                    controller: _animController,
                    delay: 0.1,
                    child: _buildInfoCard(
                      icon: Icons.person_rounded,
                      title: "Personal Information",
                      children: [
                        Row(
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
                                icon: Icons.short_text_rounded,
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
                  ),

                  // ── Save Button ─────────────────────────────────────
                  if (_isEditMode) ...[
                    const SizedBox(height: AppSpacing.xl),
                    AppPrimaryButton(
                      label: "Save Changes",
                      icon: Icons.save_rounded,
                      isLoading: _isSaving,
                      onPressed: _saveProfile,
                    ),
                  ],

                  const SizedBox(height: AppSpacing.xl),

                  // ── Sign Out ────────────────────────────────────────
                  _FadeSlide(
                    controller: _animController,
                    delay: 0.3,
                    child: SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: OutlinedButton(
                        onPressed: _signOut,
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(
                              color: Color(0xFFDC2626), width: 1.5),
                          shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(AppRadius.md)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.logout_rounded,
                                color: Color(0xFFDC2626), size: 18),
                            const SizedBox(width: AppSpacing.sm),
                            Text(
                              "Sign Out",
                              style: AppText.labelLarge.copyWith(
                                  color: const Color(0xFFDC2626)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: AppSpacing.lg),
                ],
              ),
            ),
    );
  }

  // ── Card wrapper ──────────────────────────────────────────────────────────

  Widget _buildInfoCard({
    required IconData icon,
    required String title,
    required List<Widget> children,
  }) {
    return Container(
      width: double.infinity,
      decoration: AppDecorations.card,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.md),
            decoration: BoxDecoration(
              color: chateuPrimary.withAlpha(15),
              borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(AppRadius.md)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: chateuPrimary.withAlpha(30),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: chateuPrimary, size: 18),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(title, style: AppText.titleMedium),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }

  // ── Avatar image ──────────────────────────────────────────────────────────

  Widget _buildAvatarImage() {
    if (_hasNewAvatar) {
      return kIsWeb
          ? Image.memory(_newAvatarBytes!, fit: BoxFit.cover)
          : Image.file(_newAvatarFile!, fit: BoxFit.cover);
    }
    if (_avatarUrl != null && _avatarUrl!.isNotEmpty) {
      return Image.network(_avatarUrl!, fit: BoxFit.cover,
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
      color: Colors.white.withAlpha(40),
      child: Center(
        child: Text(
          initials,
          style: AppText.displayLarge.copyWith(
            fontSize: 32,
            color: Colors.white,
          ),
        ),
      ),
    );
  }

  // ── Field builders ────────────────────────────────────────────────────────

  Widget _buildField({
    required String label,
    required TextEditingController controller,
    required IconData icon,
    required bool enabled,
    TextInputType? keyboardType,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: AppText.caption.copyWith(
              color: Colors.grey.shade500,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.3,
            )),
        const SizedBox(height: AppSpacing.xs),
        TextField(
          controller: controller,
          enabled: enabled,
          keyboardType: keyboardType,
          maxLines: maxLines,
          style: AppText.bodyMedium.copyWith(fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, size: 18,
                color: chateuPrimary.withAlpha(180)),
            fillColor: enabled ? chateuBackground : Colors.grey.shade50,
            filled: true,
            contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md, vertical: AppSpacing.md),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.sm),
                borderSide: BorderSide.none),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.sm),
                borderSide:
                    BorderSide(color: chateuPrimary.withAlpha(60), width: 1)),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.sm),
                borderSide:
                    const BorderSide(color: chateuPrimary, width: 1.5)),
            disabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.sm),
                borderSide: BorderSide.none),
          ),
        ),
      ],
    );
  }

  Widget _buildDateField() {
    final display = _birthDate != null
        ? "${_birthDate!.month.toString().padLeft(2, '0')}/"
            "${_birthDate!.day.toString().padLeft(2, '0')}/"
            "${_birthDate!.year}"
        : "Not set";

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("Birth Date",
            style: AppText.caption.copyWith(
              color: Colors.grey.shade500,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.3,
            )),
        const SizedBox(height: AppSpacing.xs),
        GestureDetector(
          onTap: _isEditMode ? _pickBirthDate : null,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md, vertical: 13),
            decoration: BoxDecoration(
              color: _isEditMode ? chateuBackground : Colors.grey.shade50,
              borderRadius: BorderRadius.circular(AppRadius.sm),
              border: Border.all(
                color: _isEditMode
                    ? chateuPrimary.withAlpha(60)
                    : Colors.transparent,
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.cake_rounded,
                    size: 18, color: chateuPrimary.withAlpha(180)),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  display,
                  style: AppText.bodyMedium.copyWith(
                    fontWeight: FontWeight.w500,
                    color: _birthDate != null
                        ? chateuText
                        : Colors.grey.shade400,
                  ),
                ),
                const Spacer(),
                if (_isEditMode)
                  Icon(Icons.edit_calendar_rounded,
                      size: 16, color: chateuPrimary.withAlpha(140)),
              ],
            ),
          ),
        ),
      ],
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
    final c = color ?? chateuPrimary;
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: c.withAlpha(18),
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        child: Icon(icon, color: c, size: 20),
      ),
      title: Text(label,
          style: AppText.bodyLarge.copyWith(
            color: c,
            fontWeight: FontWeight.w500,
          )),
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm)),
      onTap: onTap,
    );
  }
}

// ── Animation helper ───────────────────────────────────────────────────────────

class _FadeSlide extends StatelessWidget {
  final AnimationController controller;
  final double delay;
  final Widget child;

  const _FadeSlide({
    required this.controller,
    required this.delay,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final fade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: controller,
        curve: Interval(delay, (delay + 0.4).clamp(0.0, 1.0),
            curve: Curves.easeOut),
      ),
    );
    final slide =
        Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
            .animate(
      CurvedAnimation(
        parent: controller,
        curve: Interval(delay, (delay + 0.4).clamp(0.0, 1.0),
            curve: Curves.easeOut),
      ),
    );
    return FadeTransition(
        opacity: fade,
        child: SlideTransition(position: slide, child: child));
  }
}