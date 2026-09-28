import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_colors.dart';
import 'app_dialogs.dart';
import 'app_theme.dart';
import 'signup_page.dart';
import 'home_page.dart';
import 'app_services.dart';
import 'audit_logger.dart';
import 'domain/resident/current_resident.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, this.resident});

  /// Defaults to the app's [currentResident]; tests pass their own.
  final CurrentResident? resident;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  CurrentResident get _resident => widget.resident ?? currentResident;

  // Form handling
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _supabase = Supabase.instance.client;

  // State
  bool _isObscured = true;
  bool _isLoading = false;

  @override
  void dispose() {
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

      // Only active (approved, not disabled) Residents may use the app.
      final resident = await _resident.refresh();

      if (!(resident?.isActive ?? false)) {
        await _supabase.auth.signOut();
        if (!mounted) return;
        _showError("Your account is disabled/pending admin approval.");
        return;
      }

      await logAudit('LOGIN', 'Signed in to the mobile app.');

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
    final emailController = TextEditingController(text: _emailController.text.trim());
    bool isSubmitting = false;

    final submitted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Forgot Your Password?'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                "Enter your account email. Your HOA admin will be notified and will reset your password for you.",
              ),
              const SizedBox(height: AppSpacing.lg),
              TextField(
                controller: emailController,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                autofocus: true,
                enabled: !isSubmitting,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  hintText: 'you@email.com',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: isSubmitting ? null : () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: isSubmitting
                  ? null
                  : () async {
                      final email = emailController.text.trim();
                      if (email.isEmpty || !email.contains('@')) {
                        showAppSnack(context, 'Enter a valid email address.', type: SnackType.error);
                        return;
                      }
                      setDialogState(() => isSubmitting = true);
                      try {
                        await _supabase.functions.invoke(
                          'request-password-reset',
                          body: {'email': email},
                        );
                        if (dialogContext.mounted) Navigator.pop(dialogContext, true);
                      } catch (_) {
                        setDialogState(() => isSubmitting = false);
                        if (context.mounted) {
                          showAppSnack(context, 'Something went wrong. Please try again.', type: SnackType.error);
                        }
                      }
                    },
              child: isSubmitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Send Request'),
            ),
          ],
        ),
      ),
    );

    emailController.dispose();

    if (submitted == true && mounted) {
      await showInfoDialog(
        context,
        title: "Request Sent",
        message:
            "If that email matches an account, your HOA admin has been notified "
            "and will reset your password soon.",
        icon: Icons.mark_email_read_rounded,
      );
    }
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
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          Positioned.fill(
            child: Image.asset(
              'assets/chateau.png',
              fit: BoxFit.cover,
              excludeFromSemantics: true,
              errorBuilder: (c, e, s) => const SizedBox.shrink(),
            ),
          ),
          Positioned.fill(
            child: ColoredBox(color: Colors.black.withValues(alpha: 0.65)),
          ),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xxl),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: mq.size.height - mq.padding.vertical),
                child: IntrinsicHeight(
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 440),
                      child: Form(
                        key: _formKey,
                        child: AutofillGroup(
                          child: Column(
                            children: [
                              if (Navigator.canPop(context))
                                const Align(
                                  alignment: Alignment.centerLeft,
                                  child: BackButton(color: Colors.white),
                                ),
                              SizedBox(height: isSmall ? 8 : 24),
                              Image.asset(
                                'assets/logo.png',
                                height: isSmall ? 90 : 120,
                                semanticLabel: 'Chateau Real',
                                errorBuilder: (c, e, s) => const Icon(Icons.home_rounded, color: Colors.white, size: 100),
                              ),
                              const SizedBox(height: AppSpacing.md),
                              Text(
                                'Build a stronger community with us',
                                textAlign: TextAlign.center,
                                style: AppText.bodyLarge.copyWith(color: Colors.white70),
                              ),
                              const Spacer(flex: 1),
                              const SizedBox(height: AppSpacing.xl),
                              _buildFormCard(isSmall),
                              const Spacer(flex: 2),
                              const SizedBox(height: AppSpacing.xl),
                              _buildFooter(),
                              const SizedBox(height: AppSpacing.lg),
                            ],
                          ),
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

  Widget _buildFormCard(bool isSmall) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(isSmall ? AppSpacing.xl : AppSpacing.xxl),
      decoration: BoxDecoration(
        color: chateuSurface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'Email',
              hintText: 'you@email.com',
            ),
            validator: (v) => v != null && RegExp(r'^[^@]+@[^@]+\.[^@]+$').hasMatch(v.trim())
                ? null
                : 'Enter a valid email address',
          ),
          const SizedBox(height: AppSpacing.lg),
          TextFormField(
            controller: _passwordController,
            obscureText: _isObscured,
            autofillHints: const [AutofillHints.password],
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _isLoading ? null : _handleSignIn(),
            decoration: InputDecoration(
              labelText: 'Password',
              suffixIcon: IconButton(
                tooltip: _isObscured ? 'Show password' : 'Hide password',
                icon: Icon(_isObscured ? Icons.visibility_off : Icons.visibility),
                onPressed: () => setState(() => _isObscured = !_isObscured),
              ),
            ),
            validator: (v) => v != null && v.length >= 8 ? null : 'Password must be at least 8 characters',
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: _isLoading ? null : _handleForgotPassword,
              child: const Text('Forgot password?'),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppPrimaryButton(
            label: 'Sign in',
            isLoading: _isLoading,
            onPressed: _handleSignIn,
          ),
        ],
      ),
    );
  }

  Widget _buildFooter() {
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text('New to Chateau?', style: AppText.bodyMedium.copyWith(color: Colors.white70)),
        TextButton(
          style: TextButton.styleFrom(foregroundColor: chateuAccent),
          onPressed: () {
            HapticFeedback.selectionClick();
            Navigator.push(context, MaterialPageRoute(builder: (_) => const SignupPage()));
          },
          child: const Text('Sign up'),
        ),
      ],
    );
  }
}
