import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_colors.dart';
import 'app_services.dart';
import 'domain/uploads/uploads.dart';
import 'domain/format/format.dart';
import 'domain/account/password_rules.dart';
import 'app_dialogs.dart';
import 'app_theme.dart';
import 'login_page.dart';
import 'audit_logger.dart';

// ── Address data ───────────────────────────────────────────────────────────────

class _StreetData {
  final String street;
  final List<String> lots;
  const _StreetData(this.street, this.lots);
}

const List<_StreetData> _streets = [
  _StreetData("New York", ["Blk 52 Lot 2","Blk 52 Lot 4","Blk 52 Lot 6","Blk 52 Lot 8","Blk 52 Lot 10","Blk 52 Lot 12","Blk 52 Lot 14","Blk 52 Lot 16","Blk 52 Lot 18","Blk 52 Lot 20","Blk 52 Lot 22","Blk 52 Lot 24","Blk 52 Lot 26","Blk 52 Lot 28","Blk 52 Lot 30","Blk 52 Lot 32","Blk 52 Lot 34","Blk 52 Lot 36","Blk 52 Lot 38","Blk 52 Lot 40","Blk 52 Lot 42","Blk 52 Lot 44","Blk 54 Lot 1","Blk 54 Lot 3","Blk 54 Lot 5","Blk 54 Lot 7","Blk 54 Lot 9","Blk 54 Lot 11","Blk 54 Lot 13","Blk 54 Lot 15","Blk 54 Lot 17","Blk 54 Lot 19","Blk 54 Lot 21","Blk 54 Lot 23","Blk 54 Lot 25","Blk 54 Lot 27","Blk 54 Lot 29","Blk 54 Lot 31","Blk 54 Lot 33","Blk 54 Lot 35","Blk 54 Lot 37","Blk 54 Lot 39","Blk 54 Lot 41"]),
  _StreetData("Springfield", ["Blk 52 Lot 1","Blk 52 Lot 3","Blk 52 Lot 5","Blk 52 Lot 7","Blk 52 Lot 9","Blk 52 Lot 11","Blk 52 Lot 13","Blk 52 Lot 15","Blk 52 Lot 17","Blk 52 Lot 19","Blk 52 Lot 21","Blk 52 Lot 23","Blk 52 Lot 25","Blk 52 Lot 27","Blk 52 Lot 29","Blk 52 Lot 31","Blk 52 Lot 33","Blk 52 Lot 35","Blk 52 Lot 37","Blk 52 Lot 39","Blk 52 Lot 41","Blk 52 Lot 43","Blk 52 Lot 45","Blk 52 Lot 47"]),
  _StreetData("Notre Dame", ["Blk 55 Lot 1","Blk 55 Lot 3","Blk 55 Lot 5","Blk 55 Lot 7","Blk 55 Lot 9","Blk 55 Lot 11","Blk 55 Lot 13","Blk 55 Lot 15","Blk 55 Lot 17","Blk 55 Lot 19","Blk 55 Lot 21","Blk 55 Lot 23","Blk 55 Lot 25","Blk 55 Lot 27","Blk 55 Lot 29","Blk 55 Lot 31","Blk 55 Lot 33","Blk 55 Lot 35","Blk 55 Lot 37","Blk 55 Lot 39","Blk 55 Lot 41","Blk 55 Lot 43","Blk 55 Lot 45","Blk 55 Lot 47","Blk 55 Lot 49","Blk 55 Lot 51","Blk 55 Lot 53","Blk 55 Lot 55","Blk 54 Lot 2","Blk 54 Lot 4","Blk 54 Lot 6","Blk 54 Lot 8","Blk 54 Lot 10","Blk 54 Lot 12","Blk 54 Lot 14","Blk 54 Lot 16","Blk 54 Lot 18","Blk 54 Lot 20","Blk 54 Lot 22","Blk 54 Lot 24","Blk 54 Lot 26","Blk 54 Lot 28","Blk 54 Lot 30","Blk 54 Lot 32","Blk 54 Lot 34","Blk 54 Lot 36","Blk 54 Lot 38","Blk 54 Lot 40","Blk 54 Lot 42"]),
  _StreetData("Stanford", ["Blk 55 Lot 2","Blk 55 Lot 4","Blk 55 Lot 6","Blk 55 Lot 8","Blk 55 Lot 10","Blk 55 Lot 12","Blk 55 Lot 14","Blk 55 Lot 16","Blk 55 Lot 18","Blk 55 Lot 20","Blk 55 Lot 22","Blk 55 Lot 24","Blk 55 Lot 26","Blk 55 Lot 28","Blk 55 Lot 30","Blk 55 Lot 32","Blk 55 Lot 34","Blk 55 Lot 36","Blk 55 Lot 38","Blk 55 Lot 40","Blk 55 Lot 42","Blk 55 Lot 44","Blk 55 Lot 46","Blk 55 Lot 48","Blk 55 Lot 50","Blk 55 Lot 52","Blk 55 Lot 54","Blk 56 Lot 1","Blk 56 Lot 3","Blk 56 Lot 5","Blk 56 Lot 7","Blk 56 Lot 9","Blk 56 Lot 11","Blk 56 Lot 13","Blk 56 Lot 15","Blk 56 Lot 17","Blk 56 Lot 19","Blk 56 Lot 21","Blk 56 Lot 23","Blk 56 Lot 25","Blk 56 Lot 27","Blk 56 Lot 29","Blk 56 Lot 31","Blk 56 Lot 33","Blk 56 Lot 35","Blk 56 Lot 37"]),
  _StreetData("Harvard", ["Blk 56 Lot 2","Blk 56 Lot 4","Blk 56 Lot 6","Blk 56 Lot 8","Blk 56 Lot 10","Blk 56 Lot 12","Blk 56 Lot 14","Blk 56 Lot 16","Blk 56 Lot 18","Blk 56 Lot 20","Blk 56 Lot 22","Blk 56 Lot 24","Blk 56 Lot 26","Blk 56 Lot 28","Blk 56 Lot 30","Blk 56 Lot 32","Blk 56 Lot 34","Blk 56 Lot 36","Blk 56 Lot 38","Blk 56 Lot 40","Blk 57 Lot 1","Blk 57 Lot 3","Blk 57 Lot 5","Blk 57 Lot 7","Blk 57 Lot 9","Blk 57 Lot 11","Blk 57 Lot 13","Blk 57 Lot 15","Blk 57 Lot 17","Blk 57 Lot 19","Blk 57 Lot 21","Blk 57 Lot 23","Blk 57 Lot 25","Blk 57 Lot 27","Blk 57 Lot 29","Blk 57 Lot 31","Blk 57 Lot 33","Blk 57 Lot 35","Blk 57 Lot 37","Blk 57 Lot 38"]),
  _StreetData("West Point", ["Blk 57 Lot 2","Blk 57 Lot 4","Blk 57 Lot 6","Blk 57 Lot 8","Blk 57 Lot 10","Blk 57 Lot 12","Blk 57 Lot 14","Blk 57 Lot 16","Blk 57 Lot 18","Blk 57 Lot 20","Blk 57 Lot 22","Blk 57 Lot 24","Blk 57 Lot 26","Blk 57 Lot 28","Blk 57 Lot 30","Blk 57 Lot 32","Blk 57 Lot 34","Blk 57 Lot 36","Blk 58 Lot 1","Blk 58 Lot 3","Blk 58 Lot 5","Blk 58 Lot 7","Blk 58 Lot 9","Blk 58 Lot 11","Blk 58 Lot 13","Blk 58 Lot 15","Blk 58 Lot 17","Blk 58 Lot 19","Blk 58 Lot 21","Blk 58 Lot 23","Blk 58 Lot 25","Blk 58 Lot 27","Blk 58 Lot 29","Blk 58 Lot 31","Blk 58 Lot 33","Blk 58 Lot 35","Blk 58 Lot 37","Blk 58 Lot 39","Blk 58 Lot 41","Blk 58 Lot 43","Blk 58 Lot 45","Blk 58 Lot 47"]),
  _StreetData("Anapolis", ["Blk 58 Lot 2","Blk 58 Lot 4","Blk 58 Lot 6","Blk 58 Lot 8","Blk 58 Lot 10","Blk 58 Lot 12","Blk 58 Lot 14","Blk 58 Lot 16","Blk 58 Lot 18","Blk 58 Lot 20","Blk 58 Lot 22","Blk 58 Lot 24","Blk 58 Lot 26","Blk 58 Lot 28","Blk 58 Lot 30","Blk 58 Lot 32","Blk 58 Lot 34","Blk 58 Lot 36","Blk 58 Lot 38","Blk 58 Lot 40","Blk 58 Lot 42","Blk 58 Lot 44","Blk 58 Lot 46","Blk 58 Lot 48","Blk 58 Lot 50"]),
];

// ── Page ───────────────────────────────────────────────────────────────────────

class SignupPage extends StatefulWidget {
  const SignupPage({super.key});

  @override
  State<SignupPage> createState() => _SignupPageState();
}

class _SignupPageState extends State<SignupPage> {
  bool _isPasswordHidden        = true;
  bool _isConfirmPasswordHidden = true;
  bool _isLoading               = false;
  int  _currentStep             = 0;

  // Controllers
  final _emailCtrl             = TextEditingController();
  final _passwordCtrl          = TextEditingController();
  final _confirmPasswordCtrl   = TextEditingController();
  final _firstNameCtrl         = TextEditingController();
  final _lastNameCtrl          = TextEditingController();
  final _middleInitialCtrl     = TextEditingController();
  final _phoneCtrl             = TextEditingController();

  // Address
  _StreetData? _selectedStreet;
  String?      _selectedLot;

  // Resident type — self-registration is homeowners only; tenants are added
  // by their homeowner via the Tenant Management module.
  static const String _residentType = 'owner';
  String? _durationOfResidency;

  // Move-in documents (Step 3)
  final _moveInDateCtrl = TextEditingController();

  // Owner documents
  XFile? _proofOfOwnership;   // deed of sale / title
  XFile? _barangayClearance;  // HOA move-out clearance or Barangay Clearance

  final _picker   = ImagePicker();
  final _supabase = Supabase.instance.client;

  static const List<String> _durations = [
    'Less than 1 year',
    '1 – 3 years',
    '4 – 5 years',
    '6 – 10 years',
    'More than 10 years',
  ];

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmPasswordCtrl.dispose();
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _middleInitialCtrl.dispose();
    _phoneCtrl.dispose();
    _moveInDateCtrl.dispose();
    super.dispose();
  }

  // ── Phone validation ──────────────────────────────────────────────────────

  // ── Step validators ───────────────────────────────────────────────────────

  Future<bool> _validateStep0() async {
    final email    = _emailCtrl.text.trim();
    final password = _passwordCtrl.text;
    final confirm  = _confirmPasswordCtrl.text;

    if (email.isEmpty || password.isEmpty || confirm.isEmpty) {
      _showError('Please fill in all fields.'); return false;
    }
    if (!RegExp(r'^[^@]+@[^@]+\.[^@]+$').hasMatch(email)) {
      _showError('Please enter a valid email address.'); return false;
    }
    final weak = newPasswordProblem(password);
    if (weak != null) {
      _showError(weak); return false;
    }
    if (password != confirm) {
      _showError('Passwords do not match.'); return false;
    }
    final emailInUse = await _checkEmailInUse(email);
    if (emailInUse == null) {
      _showError('Could not verify email availability. Please try again.');
      return false;
    }
    if (emailInUse) {
      _showError('An account with this email already exists.'); return false;
    }
    return true;
  }

  Future<bool> _validateStep1() async {
    if (_firstNameCtrl.text.trim().isEmpty || _lastNameCtrl.text.trim().isEmpty) {
      _showError('First and last name are required.'); return false;
    }
    if (_phoneCtrl.text.trim().isEmpty) {
      _showError('Phone number is required.'); return false;
    }
    if (!isValidPhPhone(_phoneCtrl.text.trim())) {
      _showError('Enter a valid PH phone number (e.g. 09123456789).'); return false;
    }
    final phoneInUse = await _checkPhoneInUse(_phoneCtrl.text.trim());
    if (phoneInUse == null) {
      _showError('Could not verify phone availability. Please try again.');
      return false;
    }
    if (phoneInUse) {
      _showError('This phone number is already registered.'); return false;
    }
    if (_durationOfResidency == null) {
      _showError('Please select your duration of residency.'); return false;
    }
    return true;
  }

  ({String block, String lot})? _parseLot(String raw) {
    final match = RegExp(r'(Blk \d+)\s+(Lot \d+)').firstMatch(raw);
    if (match == null) return null;
    return (block: match.group(1)!, lot: match.group(2)!);
  }

  Future<bool> _validateStep2() async {
    if (_selectedStreet == null || _selectedLot == null) {
      _showError('Please select your street and lot.'); return false;
    }
    final parsed = _parseLot(_selectedLot!);
    if (parsed == null) {
      _showError('Invalid lot format. Please re-select your lot.'); return false;
    }

    // Only one owner per lot.
    // Uses the `is_lot_available` RPC (security definer) instead of a direct
    // `profiles` select — the caller is still anonymous at this point in the
    // form, and RLS on `profiles` blocks anon reads of other people's rows,
    // so a direct select fails and must not be treated as "lot available."
    try {
      final available = await _supabase.rpc('is_lot_available', params: {
        'p_block':  parsed.block,
        'p_lot':    parsed.lot,
        'p_street': _selectedStreet!.street,
      }) as bool;
      if (!available) {
        if (!mounted) return false;
        await showInfoDialog(
          context,
          icon: Icons.home_rounded,
          iconColor: chateuWarning,
          title: 'Lot Already Has a Homeowner',
          message:
              'This lot already has a registered and active homeowner.\n\n'
              'If you are the homeowner, please contact the HOA admin. '
              'If you are a tenant, ask your homeowner to add you through '
              'the Tenant Management feature in their account.',
        );
        return false;
      }
    } catch (_) {
      if (!mounted) return false;
      _showError('Could not verify lot availability. Please try again.');
      return false;
    }

    return true;
  }

  // Returns null (rather than swallowing the error) when the availability
  // check itself fails, so callers don't mistake "couldn't check" for
  // "available."
  Future<bool?> _checkEmailInUse(String email) async {
    try {
      final available =
          await _supabase.rpc('is_email_available', params: {'p_email': email}) as bool;
      return !available;
    } catch (_) {
      return null;
    }
  }

  Future<bool?> _checkPhoneInUse(String phone) async {
    try {
      final available =
          await _supabase.rpc('is_phone_available', params: {'p_phone': phone}) as bool;
      return !available;
    } catch (_) {
      return null;
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  Future<void> _signUp() async {
    setState(() => _isLoading = true);
    HapticFeedback.lightImpact();

    final parsed = _parseLot(_selectedLot!);
    if (parsed == null) {
      setState(() => _isLoading = false);
      _showError('Invalid lot format. Please go back and re-select your lot.');
      return;
    }
    final block    = parsed.block;
    final lot      = parsed.lot;
    final mi       = _middleInitialCtrl.text.trim().toUpperCase();
    final fullName =
        '${_firstNameCtrl.text.trim()}${mi.isNotEmpty ? ' $mi.' : ''} ${_lastNameCtrl.text.trim()}'.trim();
    final address  = '$_selectedLot, ${_selectedStreet!.street} St., Chateau Real';

    try {
      // ── Auth sign-up (email confirmation is disabled in Supabase dashboard)
      // signUp() returns a live session immediately — no email sent.
      final response = await _supabase.auth.signUp(
        email:    _emailCtrl.text.trim(),
        password: _passwordCtrl.text,
        data: {
          'full_name':             fullName,
          'first_name':            _firstNameCtrl.text.trim(),
          'last_name':             _lastNameCtrl.text.trim(),
          'middle_initial':        mi,
          'phone':                 _phoneCtrl.text.trim(),
          'block':                 block,
          'lot':                   lot,
          'street':                _selectedStreet!.street,
          'address':               address,
          'resident_type':         _residentType,
          'duration_of_residency': _durationOfResidency,
          'account_status':        'pending',
        },
      );

      if (!mounted) return;

      final userId = response.user?.id;
      if (userId == null) {
        setState(() => _isLoading = false);
        _showError('Registration failed. Please try again.');
        return;
      }

      Future<String?> uploadDoc(XFile? file, String folder) async {
        if (file == null) return null;
        try {
          return await uploads.store(Evidence.moveInDocument(folder), file);
        } catch (_) { return null; }
      }

      final proofUrl     = await uploadDoc(_proofOfOwnership,  'proof-of-ownership');
      final clearanceUrl = await uploadDoc(_barangayClearance, 'barangay-clearance');

      await _supabase.from('profiles').upsert({
        'id':                    userId,
        'email':                 _emailCtrl.text.trim(),
        'full_name':             fullName,
        'first_name':            _firstNameCtrl.text.trim(),
        'last_name':             _lastNameCtrl.text.trim(),
        'middle_initial':        mi,
        'phone':                 _phoneCtrl.text.trim(),
        'block':                 block,
        'lot':                   lot,
        'street':                _selectedStreet!.street,
        'address':               address,
        'resident_type':         _residentType,
        'account_status':        'pending',
        'duration_of_residency': _durationOfResidency,
      }, onConflict: 'id');

      await _supabase.from('move_in_clearances').insert({
        'user_id':                userId,
        'move_in_date':           _moveInDateCtrl.text,
        'resident_type':          _residentType,
        'proof_of_ownership_url': proofUrl,
        'barangay_clearance_url': clearanceUrl,
        'status':                 'pending',
      });

      // Log before signing out — logAudit needs the still-active session to
      // attribute this to the new account, and to look up resident_type.
      await logAudit(
        'SIGNUP',
        'Registered as $_residentType at $address. Awaiting admin approval.',
      );

      await _supabase.auth.signOut();

      if (mounted) {
        setState(() => _isLoading = false);
        _showPendingDialog();
      }
    } on AuthException catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      if (e.message.toLowerCase().contains('already registered') ||
          e.message.toLowerCase().contains('already exists')) {
        _showError('An account with this email already exists.');
      } else {
        _showError(e.message);
      }
    } on PostgrestException catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showError('Database error: ${e.message}');
    } on StorageException catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showError('File upload error: ${e.message}');
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showError('Something went wrong. Please try again.');
    }
  }

  // ── Dialogs & snacks ──────────────────────────────────────────────────────

  Future<void> _showPendingDialog() async {
    await showInfoDialog(
      context,
      icon: Icons.how_to_reg_rounded,
      title: 'Registration Submitted!',
      message: 'Your account is now pending HOA admin review.\n\n'
          'Please visit the HOA office for your mandatory orientation with '
          'the Treasurer. You will be notified once your account is activated.',
      buttonLabel: 'Back to Login',
    );
    if (!mounted) return;
    Navigator.pushReplacement(
        context, MaterialPageRoute(builder: (_) => const LoginPage()));
  }

  void _showLotPicker(List<String> lots) {
    List<String> filtered = List.from(lots);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setModalState) => DraggableScrollableSheet(
          initialChildSize: 0.7,
          maxChildSize: 0.92,
          minChildSize: 0.4,
          expand: false,
          builder: (_, scrollController) => Column(
            children: [
              const SizedBox(height: AppSpacing.md),
              buildSheetHandle(),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.sm),
                child: Row(children: [
                  Text('Select Block / Lot', style: AppText.titleMedium),
                  const Spacer(),
                  Text('${filtered.length} lots', style: AppText.caption),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.sm),
                child: TextField(
                  decoration: const InputDecoration(
                    hintText: 'Search e.g. Blk 52 Lot 4',
                    prefixIcon: Icon(Icons.search_rounded, size: 18),
                    isDense: true,
                  ),
                  onChanged: (val) {
                    final q = val.toLowerCase();
                    setModalState(() {
                      filtered =
                          lots.where((l) => l.toLowerCase().contains(q)).toList();
                    });
                  },
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Text('No lots found',
                            style: AppText.bodyMedium
                                .copyWith(color: chateuTextMuted)))
                    : ListView.builder(
                        controller: scrollController,
                        itemCount: filtered.length,
                        itemBuilder: (_, i) {
                          final lotItem = filtered[i];
                          final isSelected = _selectedLot == lotItem;
                          return ListTile(
                            leading: Icon(Icons.location_on_outlined,
                                color: isSelected
                                    ? chateuPrimary
                                    : chateuTextMuted),
                            title: Text(lotItem,
                                style: AppText.bodyMedium.copyWith(
                                    fontWeight: isSelected
                                        ? FontWeight.w700
                                        : FontWeight.w400,
                                    color: isSelected
                                        ? chateuPrimary
                                        : chateuText)),
                            trailing: isSelected
                                ? Icon(Icons.check_rounded,
                                    color: chateuPrimary)
                                : null,
                            selected: isSelected,
                            onTap: () {
                              setState(() => _selectedLot = lotItem);
                              Navigator.pop(ctx);
                            },
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

  void _showError(String msg) =>
      showAppSnack(context, msg, type: SnackType.error);

  // ── Build ─────────────────────────────────────────────────────────────────

  static const _stepLabels = ['Account', 'Personal', 'Address', 'Move-In'];

  @override
  Widget build(BuildContext context) {
    final isSmall = MediaQuery.sizeOf(context).height < 700;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            'assets/chateau.png',
            key: const ValueKey('signup_bg'),
            fit: BoxFit.cover,
            gaplessPlayback: true,
            excludeFromSemantics: true,
            errorBuilder: (_, __, ___) => const SizedBox.shrink(),
          ),
          ColoredBox(color: Colors.black.withAlpha(150)),
          SafeArea(
            child: SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              child: AppContentWidth(
                maxWidth: 520,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                  child: Column(
                    children: [
                      Row(children: [
                        BackButton(
                          color: Colors.white,
                          onPressed: _currentStep > 0
                              ? () => setState(() => _currentStep--)
                              : null,
                        ),
                        const Spacer(),
                      ]),
                      Image.asset('assets/logo.png',
                          height: isSmall ? 44 : 56,
                          semanticLabel: 'Chateau Real',
                          errorBuilder: (_, __, ___) => const Icon(
                              Icons.home_rounded,
                              color: Colors.white,
                              size: 56)),
                      const SizedBox(height: AppSpacing.sm),
                      Semantics(
                        header: true,
                        child: Text('Create Account',
                            style: AppText.titleLarge
                                .copyWith(color: Colors.white)),
                      ),
                      SizedBox(height: isSmall ? AppSpacing.md : AppSpacing.lg),
                      _buildStepIndicator(),
                      SizedBox(height: isSmall ? AppSpacing.md : AppSpacing.lg),
                      Container(
                        width: double.infinity,
                        padding: EdgeInsets.all(
                            isSmall ? AppSpacing.lg : AppSpacing.xl),
                        decoration: BoxDecoration(
                          color: chateuSurface,
                          borderRadius: BorderRadius.circular(AppRadius.lg),
                        ),
                        child: AnimatedSwitcher(
                          duration: MediaQuery.disableAnimationsOf(context)
                              ? Duration.zero
                              : const Duration(milliseconds: 200),
                          child: switch (_currentStep) {
                            0 => _buildStep0(),
                            1 => _buildStep1(),
                            2 => _buildStep2(),
                            _ => _buildStep3(),
                          },
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      if (_currentStep < 3)
                        Wrap(
                          alignment: WrapAlignment.center,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text('Already have an account?',
                                style: AppText.bodyMedium
                                    .copyWith(color: Colors.white70)),
                            TextButton(
                              style: TextButton.styleFrom(
                                  foregroundColor: chateuAccent),
                              onPressed: () => Navigator.pop(context),
                              child: const Text('Log in'),
                            ),
                          ],
                        ),
                      const SizedBox(height: AppSpacing.xl),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Step indicator (on the photo, so fixed light-on-dark colors) ──────────

  Widget _buildStepIndicator() {
    return Semantics(
      label: 'Step ${_currentStep + 1} of 4: ${_stepLabels[_currentStep]}',
      child: ExcludeSemantics(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(4, (i) {
            final isDone = i < _currentStep;
            final isActive = i == _currentStep;
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isDone
                            ? const Color(0xFF006837)
                            : isActive
                                ? chateuAccent
                                : Colors.white.withAlpha(40),
                      ),
                      child: Center(
                        child: isDone
                            ? const Icon(Icons.check_rounded,
                                color: Colors.white, size: 16)
                            : Text('${i + 1}',
                                style: TextStyle(
                                    color: isActive
                                        ? const Color(0xFF1A1A1A)
                                        : Colors.white70,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14)),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(_stepLabels[i],
                        style: TextStyle(
                            fontSize: 12,
                            color: isActive ? chateuAccent : Colors.white70,
                            fontWeight:
                                isActive ? FontWeight.w700 : FontWeight.w400)),
                  ],
                ),
                if (i < 3)
                  Container(
                    width: 20,
                    height: 1,
                    margin: const EdgeInsets.fromLTRB(4, 14, 4, 0),
                    color: Colors.white.withAlpha(i < _currentStep ? 160 : 60),
                  ),
              ],
            );
          }),
        ),
      ),
    );
  }

  Widget _stepHeader(String title, String subtitle) => Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: AppText.titleMedium),
            const SizedBox(height: 2),
            Text(subtitle, style: AppText.caption),
          ],
        ),
      );

  // ── Step 0: Account ───────────────────────────────────────────────────────

  Widget _buildStep0() {
    return Column(
      key: const ValueKey('step0'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _stepHeader('Account', 'You will sign in with these'),
        _textField(
          controller: _emailCtrl,
          label: 'Email *',
          hint: 'you@email.com',
          keyboardType: TextInputType.emailAddress,
          autofill: AutofillHints.email,
          icon: Icons.email_rounded,
        ),
        const SizedBox(height: AppSpacing.lg),
        _passwordField(
          controller: _passwordCtrl,
          label: 'Password *',
          hint: 'At least 8 characters',
          isHidden: _isPasswordHidden,
          onToggle: () => setState(() => _isPasswordHidden = !_isPasswordHidden),
        ),
        const SizedBox(height: AppSpacing.lg),
        _passwordField(
          controller: _confirmPasswordCtrl,
          label: 'Confirm Password *',
          hint: 'Re-enter password',
          isHidden: _isConfirmPasswordHidden,
          onToggle: () => setState(
              () => _isConfirmPasswordHidden = !_isConfirmPasswordHidden),
        ),
        const SizedBox(height: AppSpacing.xl),
        _nextButton(
          label: 'Next: Personal Info',
          onTap: () async {
            if (await _validateStep0() && mounted) {
              setState(() => _currentStep = 1);
            }
          },
        ),
      ],
    );
  }

  // ── Step 1: Personal info ─────────────────────────────────────────────────

  Widget _buildStep1() {
    return Column(
      key: const ValueKey('step1'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _stepHeader('Personal Information', 'Tell us about yourself'),
        _textField(
          controller: _firstNameCtrl,
          label: 'First Name *',
          icon: Icons.badge_rounded,
          textCapitalization: TextCapitalization.words,
          autofill: AutofillHints.givenName,
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            flex: 3,
            child: _textField(
              controller: _lastNameCtrl,
              label: 'Last Name *',
              textCapitalization: TextCapitalization.words,
              autofill: AutofillHints.familyName,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            flex: 2,
            child: _textField(
              controller: _middleInitialCtrl,
              label: 'M.I.',
              hint: 'e.g. A',
              maxLength: 1,
              textCapitalization: TextCapitalization.characters,
            ),
          ),
        ]),
        const SizedBox(height: AppSpacing.lg),
        _textField(
          controller: _phoneCtrl,
          label: 'Phone Number *',
          hint: '09123456789 or +639123456789',
          icon: Icons.phone_rounded,
          keyboardType: TextInputType.phone,
          autofill: AutofillHints.telephoneNumber,
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[\d\+]')),
            LengthLimitingTextInputFormatter(13),
          ],
        ),
        ValueListenableBuilder<TextEditingValue>(
          valueListenable: _phoneCtrl,
          builder: (_, val, __) {
            final phone = val.text.trim();
            if (phone.isEmpty) return const SizedBox.shrink();
            final ok = isValidPhPhone(phone);
            final c = ok ? chateuPrimary : chateuError;
            return Padding(
              padding: const EdgeInsets.only(top: 6, left: 2),
              child: Row(children: [
                Icon(ok ? Icons.check_circle_rounded : Icons.cancel_rounded,
                    size: 14, color: c),
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    ok
                        ? 'Valid phone number'
                        : 'Use format: 09XXXXXXXXX or +639XXXXXXXXX',
                    style: AppText.caption.copyWith(color: c),
                  ),
                ),
              ]),
            );
          },
        ),
        const SizedBox(height: AppSpacing.lg),
        DropdownButtonFormField<String>(
          initialValue: _durationOfResidency,
          isExpanded: true,
          decoration: const InputDecoration(
            labelText: 'Duration of Residency *',
            prefixIcon: Icon(Icons.access_time_rounded, size: 18),
          ),
          hint: const Text('How long have you lived here?'),
          items: _durations
              .map((d) => DropdownMenuItem(value: d, child: Text(d)))
              .toList(),
          onChanged: (val) => setState(() => _durationOfResidency = val),
        ),
        const SizedBox(height: AppSpacing.xl),
        Row(children: [
          Expanded(
              child: _backButton(onTap: () => setState(() => _currentStep = 0))),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            flex: 2,
            child: _nextButton(
              label: 'Next: Address',
              onTap: () async {
                if (await _validateStep1() && mounted) {
                  setState(() => _currentStep = 2);
                }
              },
            ),
          ),
        ]),
      ],
    );
  }

  // ── Step 2: Address & Type ────────────────────────────────────────────────

  Widget _buildStep2() {
    final lots = _selectedStreet?.lots ?? [];
    final hasStreet = _selectedStreet != null;

    return Column(
      key: const ValueKey('step2'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _stepHeader('Address', 'Your lot in Chateau Real'),
        DropdownButtonFormField<_StreetData>(
          initialValue: _selectedStreet,
          isExpanded: true,
          decoration: const InputDecoration(
            labelText: 'Street *',
            prefixIcon: Icon(Icons.signpost_rounded, size: 18),
          ),
          hint: const Text('Select your street'),
          items: _streets
              .map((s) => DropdownMenuItem(value: s, child: Text(s.street)))
              .toList(),
          onChanged: (val) => setState(() {
            _selectedStreet = val;
            _selectedLot = null;
          }),
        ),
        const SizedBox(height: AppSpacing.lg),
        InkWell(
          onTap: hasStreet ? () => _showLotPicker(lots) : null,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          child: InputDecorator(
            decoration: InputDecoration(
              labelText: 'Block / Lot *',
              enabled: hasStreet,
              prefixIcon: const Icon(Icons.home_work_rounded, size: 18),
              suffixIcon: const Icon(Icons.expand_more_rounded),
            ),
            child: Text(
              _selectedLot ??
                  (hasStreet ? 'Tap to choose block / lot' : 'Select street first'),
              style: AppText.bodyMedium.copyWith(
                  color: _selectedLot != null ? chateuText : chateuTextMuted),
            ),
          ),
        ),
        if (hasStreet && _selectedLot != null) ...[
          const SizedBox(height: AppSpacing.md),
          Row(children: [
            Icon(Icons.location_on_rounded, color: chateuPrimary, size: 16),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                '$_selectedLot, ${_selectedStreet!.street} St., Chateau Real',
                style: AppText.bodyMedium.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
          ]),
        ],
        const SizedBox(height: AppSpacing.lg),
        const AppNoticeBanner(
          icon: Icons.home_rounded,
          text: 'This account will be registered as the Homeowner for this lot. '
              'Only one homeowner is allowed per lot. Tenants are added later '
              'from your account\'s Tenant Management page.',
        ),
        const SizedBox(height: AppSpacing.sm),
        const AppNoticeBanner(
          icon: Icons.pending_actions_rounded,
          text: 'Your account will require admin approval before you can log in.',
        ),
        const SizedBox(height: AppSpacing.xl),
        Row(children: [
          Expanded(
              child: _backButton(onTap: () => setState(() => _currentStep = 1))),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            flex: 2,
            child: _nextButton(
              label: 'Next: Move-In Docs',
              onTap: () async {
                if (await _validateStep2() && mounted) {
                  setState(() => _currentStep = 3);
                }
              },
            ),
          ),
        ]),
      ],
    );
  }

  // ── Step 3: Move-In Clearance Form ────────────────────────────────────────

  Future<void> _pickDoc(void Function(XFile) assign) async {
    final f = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (f != null && mounted) setState(() => assign(f));
  }

  Widget _buildStep3() {
    return Column(
      key: const ValueKey('step3'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _stepHeader('Move-In Clearance', 'CREVHAI – Required Documents'),
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: AppDecorations.muted,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Move-In Clearance',
                  style: AppText.labelMedium.copyWith(color: chateuText)),
              const SizedBox(height: 4),
              Text(
                'Chateau Real Executive Village Homeowners Association Inc. (CREVHAI)',
                style: AppText.caption,
              ),
              if (_selectedLot != null && _selectedStreet != null) ...[
                const SizedBox(height: 6),
                Text(
                  '$_selectedLot, ${_selectedStreet!.street} St., Chateau Real, Buenavista III, General Trias, Cavite',
                  style: AppText.caption,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        InkWell(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          onTap: () async {
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
          },
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
        const SizedBox(height: AppSpacing.lg),
        _fieldLabel('Proof of Ownership *'),
        AppUploadTile(
          hasFile: _proofOfOwnership != null,
          label: _proofOfOwnership?.name ??
              'Deed of Sale / Transfer Certificate of Title',
          onTap: _proofOfOwnership != null
              ? null
              : () => _pickDoc((f) => _proofOfOwnership = f),
          onRemove: () => setState(() => _proofOfOwnership = null),
        ),
        const SizedBox(height: AppSpacing.lg),
        _fieldLabel('HOA Move-Out Clearance or Barangay Clearance *'),
        AppUploadTile(
          hasFile: _barangayClearance != null,
          label: _barangayClearance?.name ??
              'Upload Barangay Clearance or HOA Move-Out Clearance',
          onTap: _barangayClearance != null
              ? null
              : () => _pickDoc((f) => _barangayClearance = f),
          onRemove: () => setState(() => _barangayClearance = null),
        ),
        const SizedBox(height: AppSpacing.lg),
        AppNoticeBanner(
          icon: Icons.warning_amber_rounded,
          color: chateuWarning,
          text: 'Mandatory meeting required: an orientation with the HOA '
              'Treasurer or HOA President is required upon move-in. This must '
              'be completed before your account can be activated.',
        ),
        const SizedBox(height: AppSpacing.sm),
        const AppNoticeBanner(
          icon: Icons.pending_actions_rounded,
          text: 'Your account will be reviewed by the HOA admin before activation.',
        ),
        const SizedBox(height: AppSpacing.xl),
        Row(children: [
          Expanded(
              child: _backButton(onTap: () => setState(() => _currentStep = 2))),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            flex: 2,
            child: AppPrimaryButton(
              label: 'Create Account',
              isLoading: _isLoading,
              onPressed: () {
                if (_moveInDateCtrl.text.isEmpty) {
                  _showError('Please select your move-in date.');
                  return;
                }
                if (_proofOfOwnership == null) {
                  _showError('Please upload proof of ownership.');
                  return;
                }
                if (_barangayClearance == null) {
                  _showError('Please upload your Barangay/Move-Out Clearance.');
                  return;
                }
                _signUp();
              },
            ),
          ),
        ]),
      ],
    );
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  Widget _fieldLabel(String text) => Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
        child: Text(text,
            style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
      );

  Widget _textField({
    required TextEditingController controller,
    required String label,
    String? hint,
    IconData? icon,
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.none,
    int? maxLength,
    String? autofill,
    List<TextInputFormatter>? inputFormatters,
  }) =>
      TextField(
        controller: controller,
        keyboardType: keyboardType,
        textCapitalization: textCapitalization,
        maxLength: maxLength,
        inputFormatters: inputFormatters,
        autofillHints: autofill == null ? null : [autofill],
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          prefixIcon: icon != null ? Icon(icon, size: 18) : null,
          counterText: '',
        ),
      );

  Widget _passwordField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required bool isHidden,
    required VoidCallback onToggle,
  }) =>
      TextField(
        controller: controller,
        obscureText: isHidden,
        autofillHints: const [AutofillHints.newPassword],
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          prefixIcon: const Icon(Icons.lock_rounded, size: 18),
          suffixIcon: IconButton(
            tooltip: isHidden ? 'Show password' : 'Hide password',
            icon: Icon(
                isHidden ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                size: 18),
            onPressed: onToggle,
          ),
        ),
      );

  Widget _nextButton({required String label, required VoidCallback onTap}) =>
      FilledButton(
        onPressed: onTap,
        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
        child: Text(label, overflow: TextOverflow.ellipsis),
      );

  Widget _backButton({required VoidCallback onTap}) => OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52)),
        child: const Text('Back'),
      );
}
