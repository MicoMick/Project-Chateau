import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_colors.dart';
import 'app_dialogs.dart';
import 'login_page.dart';

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

  bool _isValidPhone(String phone) {
    final cleaned = phone.replaceAll(RegExp(r'[\s\-\(\)]'), '');
    return RegExp(r'^(09\d{9}|\+639\d{9})$').hasMatch(cleaned);
  }

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
    if (password.length < 8) {
      _showError('Password must be at least 8 characters.'); return false;
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
    if (!_isValidPhone(_phoneCtrl.text.trim())) {
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
        await showDialog(
          context: context,
          builder: (_) => const _InfoDialog(
            icon: Icons.home_rounded,
            iconColor: chateuAccent,
            title: 'Lot Already Has a Homeowner',
            message:
                'This lot already has a registered and active homeowner.\n\n'
                'If you are the homeowner, please contact the HOA admin. '
                'If you are a tenant, ask your homeowner to add you through '
                'the Tenant Management feature in their account.',
          ),
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
          final bytes = await file.readAsBytes();
          final ext   = file.name.contains('.') ? file.name.split('.').last : 'jpg';
          final path  = '$folder/$userId/${DateTime.now().millisecondsSinceEpoch}.$ext';
          await _supabase.storage
              .from('move-in-docs')
              .uploadBinary(path, bytes,
                  fileOptions: const FileOptions(upsert: true));
          return _supabase.storage.from('move-in-docs').getPublicUrl(path);
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

  void _showPendingDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.all(28),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: chateuPrimary.withAlpha(20),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.how_to_reg_rounded,
                  color: chateuPrimary, size: 48),
            ),
            const SizedBox(height: 20),
            const Text(
              'Registration Submitted!',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w800,
                  color: Color(0xFF1A1A1A)),
            ),
            const SizedBox(height: 12),
            const Text(
              'Your account is now pending HOA admin review.\n\n'
              'Please visit the HOA office for your mandatory '
              'orientation with the Treasurer. Your account will '
              'be activated once approved by the admin.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Colors.black54, height: 1.6),
            ),
            const SizedBox(height: 20),
            // Info chip
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: chateuPrimary.withAlpha(15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: chateuPrimary.withAlpha(60)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.info_outline_rounded, color: chateuPrimary, size: 15),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'You will be notified once your account is activated.',
                      style: TextStyle(fontSize: 12, color: chateuPrimary,
                          fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.pushReplacement(context,
                      MaterialPageRoute(builder: (_) => const LoginPage()));
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: chateuPrimary,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  elevation: 0,
                ),
                child: const Text('Back to Login',
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 15)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showLotPicker(List<String> lots) {
    String query = '';
    List<String> filtered = List.from(lots);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(
        builder: (ctx, setModalState) => DraggableScrollableSheet(
          initialChildSize: 0.7,
          maxChildSize: 0.92,
          minChildSize: 0.4,
          expand: false,
          builder: (_, scrollController) => Column(
            children: [
              Container(
                width: 40, height: 4,
                margin: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2)),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Row(children: [
                  const Icon(Icons.home_work_rounded, color: chateuPrimary, size: 20),
                  const SizedBox(width: 8),
                  const Text('Select Block / Lot',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  const Spacer(),
                  Text('${filtered.length} lots',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: TextField(
                  autofocus: false,
                  decoration: InputDecoration(
                    hintText: 'Search e.g. Blk 52 Lot 4',
                    hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                    prefixIcon: const Icon(Icons.search_rounded, color: chateuPrimary, size: 18),
                    filled: true,
                    fillColor: Colors.grey.shade100,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide.none),
                  ),
                  onChanged: (val) {
                    setModalState(() {
                      query = val.toLowerCase();
                      filtered = lots.where((l) => l.toLowerCase().contains(query)).toList();
                    });
                  },
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: filtered.isEmpty
                    ? Center(child: Text('No lots found',
                          style: TextStyle(color: Colors.grey.shade400)))
                    : ListView.builder(
                        controller: scrollController,
                        itemCount: filtered.length,
                        itemBuilder: (_, i) {
                          final lotItem  = filtered[i];
                          final isSelected = _selectedLot == lotItem;
                          return ListTile(
                            dense: true,
                            leading: Container(
                              width: 36, height: 36,
                              decoration: BoxDecoration(
                                color: isSelected ? chateuPrimary : chateuPrimary.withAlpha(18),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Icon(Icons.location_on_rounded,
                                  color: isSelected ? Colors.white : chateuPrimary, size: 18),
                            ),
                            title: Text(lotItem,
                                style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
                                    color: isSelected ? chateuPrimary : const Color(0xFF1A1A1A))),
                            trailing: isSelected
                                ? const Icon(Icons.check_circle_rounded,
                                    color: chateuPrimary, size: 18)
                                : null,
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

  @override
  Widget build(BuildContext context) {
    final mq      = MediaQuery.of(context);
    final screenH = mq.size.height;
    final isSmall = screenH < 700;

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
            errorBuilder: (_, __, ___) => Container(
              key: const ValueKey('signup_bg_fallback'),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF1a1a2e), Color(0xFF16213e)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
          ),
          Container(color: Colors.black.withAlpha(140)),

          SafeArea(
            child: SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              physics: const ClampingScrollPhysics(),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    SizedBox(height: isSmall ? 12 : 20),

                    Image.asset('assets/logo.png',
                        height: isSmall ? 44 : 56,
                        errorBuilder: (_, __, ___) => const Icon(
                            Icons.home_rounded, color: Colors.white, size: 60)),

                    SizedBox(height: isSmall ? 4 : 6),

                    const Text('Create Account',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w700)),

                    SizedBox(height: isSmall ? 10 : 14),

                    _buildStepIndicator(),

                    SizedBox(height: isSmall ? 10 : 14),

                    RepaintBoundary(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                          child: Container(
                            width: double.infinity,
                            padding: EdgeInsets.symmetric(
                                horizontal: isSmall ? 14 : 20,
                                vertical: isSmall ? 14 : 18),
                            decoration: BoxDecoration(
                              color: Colors.white.withAlpha(26),
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(color: Colors.white.withAlpha(51)),
                            ),
                            child: AnimatedSwitcher(
                              duration: const Duration(milliseconds: 250),
                              transitionBuilder: (child, anim) =>
                                  FadeTransition(opacity: anim, child: child),
                              child: _currentStep == 0
                                  ? _buildStep0(screenH)
                                  : _currentStep == 1
                                      ? _buildStep1(screenH)
                                      : _currentStep == 2
                                          ? _buildStep2(screenH)
                                          : _buildStep3(screenH),
                            ),
                          ),
                        ),
                      ),
                    ),

                    SizedBox(height: isSmall ? 14 : 20),

                    if (_currentStep < 3)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text('Already have an account? ',
                              style: TextStyle(color: Colors.white70, fontSize: 13)),
                          GestureDetector(
                            onTap: () => Navigator.pop(context),
                            child: const Text('LOGIN',
                                style: TextStyle(
                                    color: chateuAccent,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13)),
                          ),
                        ],
                      ),

                    SizedBox(height: isSmall ? 16 : 24),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Step indicator ────────────────────────────────────────────────────────

  Widget _buildStepIndicator() {
    const labels = ['Account', 'Personal', 'Address', 'Move-In'];
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(4, (i) {
        final isDone   = i < _currentStep;
        final isActive = i == _currentStep;
        return Row(
          children: [
            Column(
              children: [
                Container(
                  width: 28, height: 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isDone
                        ? chateuPrimary
                        : isActive
                            ? chateuAccent
                            : Colors.white.withAlpha(40),
                    border: isActive
                        ? Border.all(color: chateuAccent, width: 2)
                        : null,
                  ),
                  child: Center(
                    child: isDone
                        ? const Icon(Icons.check_rounded, color: Colors.white, size: 16)
                        : Text('${i + 1}',
                            style: TextStyle(
                                color: isActive ? Colors.black87 : Colors.white70,
                                fontWeight: FontWeight.w700,
                                fontSize: 13)),
                  ),
                ),
                const SizedBox(height: 4),
                Text(labels[i],
                    style: TextStyle(
                        fontSize: 9,
                        color: isActive ? chateuAccent : Colors.white.withAlpha(160),
                        fontWeight: isActive ? FontWeight.w700 : FontWeight.w400)),
              ],
            ),
            if (i < 3)
              Container(
                width: 24, height: 1,
                margin: const EdgeInsets.only(bottom: 18),
                color: i < _currentStep ? chateuPrimary : Colors.white.withAlpha(60),
              ),
          ],
        );
      }),
    );
  }

  // ── Step 0: Account ───────────────────────────────────────────────────────

  Widget _buildStep0(double screenH) {
    final gap    = screenH < 700 ? 10.0 : 14.0;
    final gapBtn = screenH < 700 ? 14.0 : 20.0;
    return Column(
      key: const ValueKey('step0'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label('Email *'),
        _textField(
          controller: _emailCtrl,
          hint: 'Enter your email address',
          keyboardType: TextInputType.emailAddress,
          icon: Icons.email_rounded,
        ),
        SizedBox(height: gap),
        _label('Password *'),
        _passwordField(
          controller: _passwordCtrl,
          hint: 'At least 8 characters',
          isHidden: _isPasswordHidden,
          onToggle: () => setState(() => _isPasswordHidden = !_isPasswordHidden),
        ),
        SizedBox(height: gap),
        _label('Confirm Password *'),
        _passwordField(
          controller: _confirmPasswordCtrl,
          hint: 'Re-enter password',
          isHidden: _isConfirmPasswordHidden,
          onToggle: () => setState(() => _isConfirmPasswordHidden = !_isConfirmPasswordHidden),
        ),
        SizedBox(height: gapBtn),
        _nextButton(
          label: 'Next: Personal Info',
          onTap: () async {
            if (await _validateStep0()) setState(() => _currentStep = 1);
          },
        ),
      ],
    );
  }

  // ── Step 1: Personal info ─────────────────────────────────────────────────

  Widget _buildStep1(double screenH) {
    final gap    = screenH < 700 ? 10.0 : 14.0;
    final gapBtn = screenH < 700 ? 14.0 : 20.0;

    return Column(
      key: const ValueKey('step1'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
                color: chateuPrimary.withAlpha(50),
                borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.person_pin_rounded, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 10),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Personal Information',
                  style: TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
              Text('Tell us about yourself',
                  style: TextStyle(color: Colors.white54, fontSize: 11)),
            ],
          ),
        ]),

        SizedBox(height: gap + 4),

        _label('First Name *'),
        _textField(
          controller: _firstNameCtrl,
          hint: 'Enter your first name',
          icon: Icons.badge_rounded,
          textCapitalization: TextCapitalization.words,
        ),
        SizedBox(height: gap),

        Row(children: [
          Expanded(
            flex: 3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _label('Last Name *'),
                _textField(
                  controller: _lastNameCtrl,
                  hint: 'Last name',
                  icon: Icons.person_rounded,
                  textCapitalization: TextCapitalization.words,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _label('M.I.'),
                _textField(
                  controller: _middleInitialCtrl,
                  hint: 'e.g. A',
                  maxLength: 1,
                  textCapitalization: TextCapitalization.characters,
                ),
              ],
            ),
          ),
        ]),

        SizedBox(height: gap),

        _label('Phone Number *'),
        _textField(
          controller: _phoneCtrl,
          hint: '09123456789 or +639123456789',
          icon: Icons.phone_rounded,
          keyboardType: TextInputType.phone,
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
            final ok = _isValidPhone(phone);
            return Padding(
              padding: const EdgeInsets.only(top: 4, left: 2),
              child: Row(children: [
                Icon(
                  ok ? Icons.check_circle_rounded : Icons.cancel_rounded,
                  size: 13,
                  color: ok ? chateuPrimary : const Color(0xFFDC2626),
                ),
                const SizedBox(width: 4),
                Text(
                  ok ? 'Valid phone number' : 'Use format: 09XXXXXXXXX or +639XXXXXXXXX',
                  style: TextStyle(
                      fontSize: 11,
                      color: ok ? chateuPrimary : const Color(0xFFDC2626)),
                ),
              ]),
            );
          },
        ),

        SizedBox(height: gap),

        _label('Duration of Residency *'),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _durationOfResidency,
              isExpanded: true,
              hint: Row(children: [
                const SizedBox(width: 12),
                Icon(Icons.access_time_rounded, size: 18, color: chateuPrimary),
                const SizedBox(width: 10),
                const Text('How long have you lived here?',
                    style: TextStyle(color: Colors.black38, fontSize: 13)),
              ]),
              icon: const Padding(
                padding: EdgeInsets.only(right: 8),
                child: Icon(Icons.expand_more_rounded, color: chateuPrimary),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              items: _durations.map((d) => DropdownMenuItem(
                value: d,
                child: Text(d, style: const TextStyle(fontSize: 14)),
              )).toList(),
              onChanged: (val) => setState(() => _durationOfResidency = val),
              dropdownColor: Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),

        SizedBox(height: gapBtn),

        Row(children: [
          Expanded(child: _backButton(onTap: () => setState(() => _currentStep = 0))),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: _nextButton(
              label: 'Next: Address',
              onTap: () async {
                if (await _validateStep1()) setState(() => _currentStep = 2);
              },
            ),
          ),
        ]),
      ],
    );
  }

  // ── Step 2: Address & Type ────────────────────────────────────────────────

  Widget _buildStep2(double screenH) {
    final lots   = _selectedStreet?.lots ?? [];
    final gap    = screenH < 700 ? 10.0 : 14.0;
    final gapBtn = screenH < 700 ? 14.0 : 20.0;

    return Column(
      key: const ValueKey('step2'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label('Street *'),
        _dropdownField<_StreetData>(
          value: _selectedStreet,
          hint: 'Select your street',
          icon: Icons.signpost_rounded,
          items: _streets.map((s) => DropdownMenuItem(
                value: s,
                child: Text(s.street, style: const TextStyle(fontSize: 14)),
              )).toList(),
          onChanged: (val) => setState(() {
            _selectedStreet = val;
            _selectedLot    = null;
          }),
        ),

        SizedBox(height: gap),

        _label('Block / Lot *'),
        GestureDetector(
          onTap: _selectedStreet == null ? null : () => _showLotPicker(lots),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
            decoration: BoxDecoration(
              color: _selectedStreet == null ? Colors.white.withAlpha(180) : Colors.white,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(children: [
              Icon(Icons.home_work_rounded,
                  size: 18,
                  color: _selectedStreet == null ? Colors.black26 : chateuPrimary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  _selectedLot ?? (_selectedStreet == null
                      ? 'Select street first'
                      : 'Tap to choose block / lot'),
                  style: TextStyle(
                      fontSize: 13,
                      color: _selectedLot != null ? Colors.black87 : Colors.black38),
                ),
              ),
              Icon(Icons.expand_more_rounded,
                  color: _selectedStreet == null ? Colors.black26 : chateuPrimary),
            ]),
          ),
        ),

        SizedBox(height: gap),

        if (_selectedStreet != null && _selectedLot != null)
          Container(
            padding: const EdgeInsets.all(10),
            margin: EdgeInsets.only(bottom: gap),
            decoration: BoxDecoration(
              color: chateuPrimary.withAlpha(30),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: chateuPrimary.withAlpha(80)),
            ),
            child: Row(children: [
              const Icon(Icons.location_on_rounded, color: chateuAccent, size: 15),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '$_selectedLot, ${_selectedStreet!.street} St., Chateau Real',
                  style: const TextStyle(
                      color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
                ),
              ),
            ]),
          ),

        _infoBox(
          icon: Icons.home_rounded,
          color: chateuAccent,
          text:
              'This account will be registered as the Homeowner for this lot. '
              'Only one homeowner is allowed per lot. Tenants are added later '
              'from your account\'s Tenant Management page.',
        ),

        SizedBox(height: gap),

        _infoBox(
          icon: Icons.pending_actions_rounded,
          color: chateuPrimary,
          text: 'Your account will require admin approval before you can log in.',
        ),

        SizedBox(height: gapBtn),

        Row(children: [
          Expanded(child: _backButton(onTap: () => setState(() => _currentStep = 1))),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: _nextButton(
              label: 'Next: Move-In Docs',
              icon: Icons.upload_file_rounded,
              onTap: () async {
                if (await _validateStep2()) setState(() => _currentStep = 3);
              },
            ),
          ),
        ]),
      ],
    );
  }

  // ── Step 3: Move-In Clearance Form ────────────────────────────────────────

  Widget _buildStep3(double screenH) {
    final gap    = screenH < 700 ? 10.0 : 14.0;
    final gapBtn = screenH < 700 ? 14.0 : 20.0;

    return Column(
      key: const ValueKey('step3'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [

        // ── Header ─────────────────────────────────────────────────────────
        Row(children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: chateuPrimary.withAlpha(50),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.description_rounded, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Move-In Clearance',
                    style: TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
                Text('CREVHAI – Required Documents',
                    style: TextStyle(color: Colors.white54, fontSize: 11)),
              ],
            ),
          ),
        ]),

        SizedBox(height: gap),

        // ── Clearance "header" card (mirrors the form letterhead) ──────────
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white.withAlpha(15),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white.withAlpha(40)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'MOVE IN Clearance',
                style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                    letterSpacing: 0.5),
              ),
              const SizedBox(height: 4),
              Text(
                'Chateau Real Executive Village Homeowners Association Inc. (CREVHAI)',
                style: TextStyle(
                    color: Colors.white.withAlpha(180), fontSize: 10),
              ),
              if (_selectedLot != null && _selectedStreet != null) ...[
                const SizedBox(height: 6),
                Text(
                  '$_selectedLot, ${_selectedStreet!.street} St., Chateau Real, Buenavista III, General Trias, Cavite',
                  style: TextStyle(color: Colors.white.withAlpha(160), fontSize: 10),
                ),
              ],
            ],
          ),
        ),

        SizedBox(height: gap),

        // ── Move-In Date ───────────────────────────────────────────────────
        _mandatoryField('Move-In Date'),
        GestureDetector(
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: DateTime.now(),
              firstDate: DateTime(2000),
              lastDate: DateTime.now().add(const Duration(days: 365)),
              builder: (ctx, child) => Theme(
                data: Theme.of(ctx).copyWith(
                  colorScheme: const ColorScheme.light(
                    primary: chateuPrimary, onPrimary: Colors.white),
                ),
                child: child!,
              ),
            );
            if (picked != null) {
              setState(() {
                _moveInDateCtrl.text =
                    '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
              });
            }
          },
          child: _fieldTile(
            icon: Icons.calendar_today_rounded,
            text: _moveInDateCtrl.text.isEmpty ? 'Select move-in date' : _moveInDateCtrl.text,
            isEmpty: _moveInDateCtrl.text.isEmpty,
          ),
        ),

        SizedBox(height: gap),

        // ── Proof of Ownership ──────────────────────────────────────────────
        _mandatoryField('Proof of Ownership'),
        _docUploadTile(
          hint: 'Deed of Sale / Transfer Certificate of Title',
          file: _proofOfOwnership,
          onTap: () async {
            final f = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
            if (f != null) setState(() => _proofOfOwnership = f);
          },
          onRemove: () => setState(() => _proofOfOwnership = null),
        ),
        SizedBox(height: gap),

        // ── Barangay / HOA Move-Out Clearance ───────────────────────────────
        _mandatoryField('HOA Move-Out Clearance or Barangay Clearance'),
        _docUploadTile(
          hint: 'Upload Barangay Clearance or HOA Move-Out Clearance',
          file: _barangayClearance,
          onTap: () async {
            final f = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
            if (f != null) setState(() => _barangayClearance = f);
          },
          onRemove: () => setState(() => _barangayClearance = null),
        ),
        SizedBox(height: gap),

        // ── Mandatory Treasurer Meeting banner ─────────────────────────────
        _mandatoryMeetingBanner(),

        SizedBox(height: gap),

        // Admin approval notice
        _infoBox(
          icon: Icons.pending_actions_rounded,
          color: chateuPrimary,
          text: 'Your account will be reviewed by the HOA admin before activation.',
        ),

        SizedBox(height: gapBtn),

        Row(children: [
          Expanded(child: _backButton(onTap: () => setState(() => _currentStep = 2))),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: _isLoading
                ? Container(
                    height: 48,
                    decoration: BoxDecoration(
                        color: chateuPrimary,
                        borderRadius: BorderRadius.circular(12)),
                    child: const Center(
                        child: SizedBox(
                            width: 22, height: 22,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2.5))),
                  )
                : _nextButton(
                    label: 'Create Account',
                    icon: Icons.check_circle_rounded,
                    onTap: () {
                      if (_moveInDateCtrl.text.isEmpty) {
                        _showError('Please select your move-in date.'); return;
                      }
                      if (_proofOfOwnership == null) {
                        _showError('Please upload proof of ownership.'); return;
                      }
                      if (_barangayClearance == null) {
                        _showError('Please upload your Barangay/Move-Out Clearance.'); return;
                      }
                      _signUp();
                    },
                  ),
          ),
        ]),
      ],
    );
  }

  // ── Mandatory meeting banner ──────────────────────────────────────────────

  Widget _mandatoryMeetingBanner() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: chateuAccent.withAlpha(25),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: chateuAccent.withAlpha(120)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.warning_amber_rounded, color: chateuAccent, size: 16),
            const SizedBox(width: 8),
            const Text(
              'MANDATORY MEETING REQUIRED',
              style: TextStyle(
                  color: chateuAccent,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.3),
            ),
          ]),
          const SizedBox(height: 6),
          const Text(
            'An orientation/meeting with the HOA Treasurer or HOA President is required upon move-in. '
            'This must be completed before your account can be activated.',
            style: TextStyle(
                color: chateuAccent,
                fontSize: 11,
                height: 1.45),
          ),
        ],
      ),
    );
  }

  // ── Mandatory field label ─────────────────────────────────────────────────

  Widget _mandatoryField(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Row(
        children: [
          Flexible(
            child: Text(text,
                style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.w600),
                overflow: TextOverflow.ellipsis),
          ),
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            decoration: BoxDecoration(
              color: chateuAccent.withAlpha(40),
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: chateuAccent.withAlpha(120)),
            ),
            child: const Text(
              'REQ',
              style: TextStyle(
                  color: chateuAccent,
                  fontSize: 8,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5),
            ),
          ),
        ],
      ),
    );
  }

  // ── Field tile (date picker display) ─────────────────────────────────────

  Widget _fieldTile({
    required IconData icon,
    required String text,
    required bool isEmpty,
  }) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(children: [
          Icon(icon, size: 18, color: chateuPrimary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                  fontSize: 13,
                  color: isEmpty ? Colors.black38 : Colors.black87),
            ),
          ),
          Icon(Icons.expand_more_rounded, color: chateuPrimary),
        ]),
      );

  // ── Doc upload tile ───────────────────────────────────────────────────────

  Widget _docUploadTile({
    required String hint,
    required XFile? file,
    required VoidCallback onTap,
    required VoidCallback onRemove,
  }) {
    final hasFile = file != null;
    return GestureDetector(
      onTap: hasFile ? null : onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: hasFile ? chateuPrimary.withAlpha(20) : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: hasFile ? chateuPrimary.withAlpha(80) : Colors.black12,
            width: hasFile ? 1.5 : 1,
          ),
        ),
        child: Row(children: [
          Icon(
            hasFile ? Icons.check_circle_rounded : Icons.upload_file_rounded,
            size: 20,
            color: hasFile ? chateuPrimary : Colors.black38,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              hasFile ? file.name : hint,
              style: TextStyle(
                fontSize: 12,
                color: hasFile ? chateuPrimary : Colors.black38,
                fontWeight: hasFile ? FontWeight.w600 : FontWeight.w400,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (hasFile)
            GestureDetector(
              onTap: onRemove,
              child: const Icon(Icons.close_rounded, size: 18, color: Colors.red),
            )
          else
            const Icon(Icons.add_photo_alternate_rounded, size: 18, color: chateuPrimary),
        ]),
      ),
    );
  }

  // ── Info box helper ───────────────────────────────────────────────────────

  Widget _infoBox({
    required IconData icon,
    required Color color,
    required String text,
  }) =>
      Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: color.withAlpha(25),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withAlpha(80)),
        ),
        child: Row(children: [
          Icon(icon, color: color, size: 15),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text,
                style: TextStyle(
                    color: color, fontSize: 11, fontWeight: FontWeight.w500)),
          ),
        ]),
      );

  // ── UI helpers ────────────────────────────────────────────────────────────

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 5),
        child: Text(text,
            style: const TextStyle(
                color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
      );

  Widget _textField({
    required TextEditingController controller,
    required String hint,
    IconData? icon,
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.none,
    int? maxLength,
    List<TextInputFormatter>? inputFormatters,
  }) =>
      TextField(
        controller: controller,
        keyboardType: keyboardType,
        textCapitalization: textCapitalization,
        maxLength: maxLength,
        inputFormatters: inputFormatters,
        style: const TextStyle(fontSize: 14, color: Colors.black87),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: Colors.black38, fontSize: 13),
          prefixIcon: icon != null ? Icon(icon, size: 18, color: chateuPrimary) : null,
          filled: true,
          fillColor: Colors.white,
          isDense: true,
          counterText: '',
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: chateuPrimary, width: 1.5)),
        ),
      );

  Widget _passwordField({
    required TextEditingController controller,
    required String hint,
    required bool isHidden,
    required VoidCallback onToggle,
  }) =>
      TextField(
        controller: controller,
        obscureText: isHidden,
        style: const TextStyle(fontSize: 14, color: Colors.black87),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: Colors.black38, fontSize: 13),
          prefixIcon: const Icon(Icons.lock_rounded, size: 18, color: chateuPrimary),
          suffixIcon: IconButton(
            icon: Icon(
                isHidden ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                size: 18,
                color: Colors.black45),
            onPressed: onToggle,
          ),
          filled: true,
          fillColor: Colors.white,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: chateuPrimary, width: 1.5)),
        ),
      );

  Widget _dropdownField<T>({
    required T? value,
    required String hint,
    required IconData icon,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
  }) =>
      Container(
        decoration: BoxDecoration(
            color: Colors.white, borderRadius: BorderRadius.circular(10)),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<T>(
            value: value,
            isExpanded: true,
            hint: Row(children: [
              const SizedBox(width: 12),
              Icon(icon, size: 18, color: chateuPrimary),
              const SizedBox(width: 10),
              Text(hint, style: const TextStyle(color: Colors.black38, fontSize: 13)),
            ]),
            icon: const Padding(
                padding: EdgeInsets.only(right: 8),
                child: Icon(Icons.expand_more_rounded, color: chateuPrimary)),
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            items: items,
            onChanged: onChanged,
            dropdownColor: Colors.white,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );

  Widget _nextButton({
    required String label,
    required VoidCallback onTap,
    IconData icon = Icons.arrow_forward_rounded,
  }) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          height: 48,
          decoration: BoxDecoration(
              color: chateuPrimary, borderRadius: BorderRadius.circular(12)),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(label,
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
              const SizedBox(width: 6),
              Icon(icon, color: Colors.white, size: 16),
            ],
          ),
        ),
      );

  Widget _backButton({required VoidCallback onTap}) => GestureDetector(
        onTap: onTap,
        child: Container(
          height: 48,
          decoration: BoxDecoration(
              color: Colors.white.withAlpha(30),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withAlpha(80))),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.arrow_back_rounded, color: Colors.white70, size: 16),
              SizedBox(width: 6),
              Text('Back',
                  style: TextStyle(
                      color: Colors.white70, fontWeight: FontWeight.w600, fontSize: 14)),
            ],
          ),
        ),
      );
}

// ── Info Dialog ────────────────────────────────────────────────────────────────

class _InfoDialog extends StatelessWidget {
  final IconData icon;
  final Color    iconColor;
  final String   title;
  final String   message;

  const _InfoDialog({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      contentPadding: const EdgeInsets.fromLTRB(22, 24, 22, 18),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: iconColor.withAlpha(20), shape: BoxShape.circle),
          child: Icon(icon, color: iconColor, size: 36),
        ),
        const SizedBox(height: 14),
        Text(title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
        const SizedBox(height: 10),
        Text(message,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: Colors.black54, height: 1.5)),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: chateuPrimary, elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
            child: const Text('Got it',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
          ),
        ),
      ]),
    );
  }
}