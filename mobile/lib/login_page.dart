import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_colors.dart';
import 'app_dialogs.dart';
import 'signup_page.dart';
import 'home_page.dart';
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> with SingleTickerProviderStateMixin {
  // Form handling
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _supabase = Supabase.instance.client;

  // State
  bool _isObscured = true;
  bool _isLoading = false;

  // Animations
  late final AnimationController _animController;
  late final Animation<double> _fadeAnim;
  late final Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.12),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  // ── Logic ──────────────────────────────────────────────────────────────────

  Future<void> _handleSignIn() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    HapticFeedback.lightImpact();

    try {
      await _supabase.auth.signInWithPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );

      // Check account status in profiles table. If not active, sign out.
      final profile = await _supabase
          .from('profiles')
          .select('account_status')
          .eq('id', _supabase.auth.currentUser!.id)
          .single();

      if (profile['account_status'] != 'active') {
        await _supabase.auth.signOut();
        _showError("Your account is disabled/pending admin approval.");
        return;
      }

      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const HomePage()),
        );
      }
    } on AuthException catch (e) {
      _showFeedback(e.message, isError: true);
    } catch (e) {
      _showFeedback("Something went wrong. Please try again.", isError: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleForgotPassword() async {
    await showInfoDialog(
      context,
      title: "Forgot Your Password?",
      message:
          "Password resets are handled by your HOA admin for account security. "
          "Please contact your HOA office to have your password reset.",
      icon: Icons.lock_reset_rounded,
    );
  }

  void _showFeedback(String message, {required bool isError}) =>
      showAppSnack(context, message, type: isError ? SnackType.error : SnackType.success);

  void _showError(String msg) =>
      showAppSnack(context, msg, type: SnackType.error);

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final isSmall = mq.size.height < 680;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          // 1. Background Image
          Positioned.fill(
            child: Image.asset(
              'assets/chateau.png',
              fit: BoxFit.cover,
              errorBuilder: (c, e, s) => Container(color: const Color(0xFF1a1a2e)),
            ),
          ),

          // 2. Dark Overlay
          Positioned.fill(
            child: Container(color: Colors.black.withValues(alpha: 0.65)),
          ),

          // 3. Content
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: mq.size.height - mq.padding.vertical),
                child: IntrinsicHeight(
                  child: FadeTransition(
                    opacity: _fadeAnim,
                    child: SlideTransition(
                      position: _slideAnim,
                      child: Form(
                        key: _formKey,
                        child: Column(
                          children: [
                            SizedBox(height: isSmall ? 30 : 50),
                            
                            // Original Logo
                            Image.asset(
                              'assets/logo.png',
                              height: isSmall ? 90 : 120,
                              errorBuilder: (c, e, s) => const Icon(Icons.home_rounded, color: Colors.white, size: 100),
                            ),
                            
                            const SizedBox(height: 12),
                            const Text(
                              'Build a stronger community with us',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.white70, fontSize: 15),
                            ),

                            const Spacer(flex: 1),

                            // Glass Card
                            _buildGlassCard(isSmall),

                            const Spacer(flex: 2),

                            // Footer
                            _buildFooter(),
                            const SizedBox(height: 20),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGlassCard(bool isSmall) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(isSmall ? 20 : 28),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 20, spreadRadius: 5),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildLabel('Email'),
          const SizedBox(height: 8),
          _buildTextField(
            controller: _emailController,
            hint: 'Enter your email',
            keyboardType: TextInputType.emailAddress,
            validator: (v) => v != null && RegExp(r'^[^@]+@[^@]+\.[^@]+$').hasMatch(v.trim())
                ? null
                : 'Enter a valid email address',
          ),
          const SizedBox(height: 20),
          _buildLabel('Password'),
          const SizedBox(height: 8),
          _buildTextField(
            controller: _passwordController,
            hint: 'Enter your password',
            isPassword: true,
            validator: (v) => v != null && v.length >= 8 ? null : 'Password must be at least 8 characters',
          ),
          
          // Forgot Password
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: _isLoading ? null : _handleForgotPassword,
              child: Text('Forgot password?', style: TextStyle(color: chateuAccent, fontSize: 13)),
            ),
          ),

          const SizedBox(height: 16),

          // Sign In Button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _handleSignIn,
              style: ElevatedButton.styleFrom(
                backgroundColor: chateuPrimary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isLoading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Sign in', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(text, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500));
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    bool isPassword = false,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: isPassword ? _isObscured : false,
      keyboardType: keyboardType,
      validator: validator,
      style: const TextStyle(color: Colors.black87, fontSize: 15),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Colors.black38, fontSize: 14),
        fillColor: Colors.white.withValues(alpha: 0.9),
        filled: true,
        suffixIcon: isPassword
            ? IconButton(
                icon: Icon(_isObscured ? Icons.visibility_off : Icons.visibility, color: Colors.grey),
                onPressed: () => setState(() => _isObscured = !_isObscured),
              )
            : null,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        errorStyle: const TextStyle(color: Color(0xFFFCA5A5)),
      ),
    );
  }

  Widget _buildFooter() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Text('New to HOMELINK? ', style: TextStyle(color: Colors.white70, fontSize: 14)),
        GestureDetector(
          onTap: () {
            HapticFeedback.selectionClick();
            Navigator.push(context, MaterialPageRoute(builder: (_) => const SignupPage()));
          },
          child: Text(
            'SIGN UP',
            style: TextStyle(color: chateuAccent, fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
          ),
        ),
      ],
    );
  }
}