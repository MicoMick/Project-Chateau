import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_colors.dart';
import 'app_config.dart';
import 'app_dialogs.dart';
import 'app_theme.dart';
import 'audit_logger.dart';
import 'domain/account/password_rules.dart';
import 'push_notifications.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SingleChildScrollView(
        padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
        child: AppContentWidth(
          maxWidth: 640,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const AppSectionHeader(title: 'Appearance'),
                const SizedBox(height: AppSpacing.xs),
                Text('System follows your phone’s dark mode setting.',
                    style: AppText.bodyMedium.copyWith(color: chateuTextMuted)),
                const SizedBox(height: AppSpacing.md),
                ValueListenableBuilder<ThemeMode>(
                  valueListenable: appThemeMode,
                  builder: (context, mode, _) => SegmentedButton<ThemeMode>(
                    segments: const [
                      ButtonSegment(
                        value: ThemeMode.light,
                        icon: Icon(Icons.light_mode_outlined),
                        label: Text('Light'),
                      ),
                      ButtonSegment(
                        value: ThemeMode.dark,
                        icon: Icon(Icons.dark_mode_outlined),
                        label: Text('Dark'),
                      ),
                      ButtonSegment(
                        value: ThemeMode.system,
                        icon: Icon(Icons.brightness_auto_outlined),
                        label: Text('System'),
                      ),
                    ],
                    selected: {mode},
                    showSelectedIcon: false,
                    onSelectionChanged: (s) => setThemeMode(s.first),
                  ),
                ),

                // Push notifications are Android-only (no web Firebase config).
                if (!kIsWeb) ...[
                  const SizedBox(height: AppSpacing.xxl),
                  const AppSectionHeader(title: 'Notifications'),
                  ValueListenableBuilder<bool>(
                    valueListenable: PushNotifications.enabled,
                    builder: (context, on, _) => SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Push notifications'),
                      subtitle: const Text(
                          'New announcements and important HOA updates on this phone.'),
                      value: on,
                      onChanged: PushNotifications.setEnabled,
                    ),
                  ),
                ],

                const SizedBox(height: AppSpacing.xxl),
                const AppSectionHeader(title: 'Account'),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.lock_outline_rounded),
                  title: const Text('Change password'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => const _ChangePasswordSheet(),
                  ),
                ),

                const SizedBox(height: AppSpacing.xxl),
                Text('Chateau Real · Version ${AppConfig.appVersion}',
                    textAlign: TextAlign.center,
                    style: AppText.caption.copyWith(color: chateuTextMuted)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ChangePasswordSheet extends StatefulWidget {
  const _ChangePasswordSheet();

  @override
  State<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<_ChangePasswordSheet> {
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _obscured = true;
  bool _isSaving = false;
  String? _error;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final problem = passwordChangeProblem(
      current: _currentCtrl.text,
      next: _newCtrl.text,
      confirm: _confirmCtrl.text,
    );
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }

    setState(() {
      _isSaving = true;
      _error = null;
    });
    final auth = Supabase.instance.client.auth;
    try {
      // Re-check the current password so an unlocked phone left lying
      // around can't be used to take over the account.
      try {
        await auth.signInWithPassword(
            email: auth.currentUser!.email!, password: _currentCtrl.text);
      } on AuthException {
        setState(() => _error = 'Current password is incorrect.');
        return;
      }
      await auth.updateUser(UserAttributes(password: _newCtrl.text));
      await logAudit('CHANGE_PASSWORD', 'Changed account password.');
      if (!mounted) return;
      Navigator.of(context).pop();
      showAppSnack(context, 'Password changed.', type: SnackType.success);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not change password: $e');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Widget _field(TextEditingController ctrl, String label,
          {TextInputAction action = TextInputAction.next}) =>
      TextField(
        controller: ctrl,
        obscureText: _obscured,
        textInputAction: action,
        onSubmitted: action == TextInputAction.done ? (_) => _save() : null,
        decoration: InputDecoration(labelText: label),
      );

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: AppDecorations.sheet,
      padding: EdgeInsets.only(
          left: AppSpacing.xl,
          right: AppSpacing.xl,
          top: AppSpacing.sm,
          bottom: MediaQuery.of(context).viewInsets.bottom +
              MediaQuery.paddingOf(context).bottom +
              AppSpacing.xxl),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            buildSheetHandle(),
            Text('Change password', style: AppText.titleLarge),
            const SizedBox(height: AppSpacing.lg),
            _field(_currentCtrl, 'Current password'),
            const SizedBox(height: AppSpacing.md),
            _field(_newCtrl, 'New password (at least 8 characters)'),
            const SizedBox(height: AppSpacing.md),
            _field(_confirmCtrl, 'Confirm new password',
                action: TextInputAction.done),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => setState(() => _obscured = !_obscured),
                icon: Icon(_obscured ? Icons.visibility : Icons.visibility_off),
                label: Text(_obscured ? 'Show passwords' : 'Hide passwords'),
              ),
            ),
            if (_error != null) ...[
              AppNoticeBanner(
                  icon: Icons.error_outline_rounded,
                  text: _error!,
                  color: chateuError),
              const SizedBox(height: AppSpacing.md),
            ],
            FilledButton(
              onPressed: _isSaving ? null : _save,
              child: _isSaving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Save password'),
            ),
          ],
        ),
      ),
    );
  }
}
