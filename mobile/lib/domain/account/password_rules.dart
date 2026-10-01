/// The one password rule, shared by signup and Settings.
String? newPasswordProblem(String password) => password.length < 8
    ? 'Password must be at least 8 characters.'
    : null;

/// What's wrong with a password change, or null if it can go ahead.
String? passwordChangeProblem({
  required String current,
  required String next,
  required String confirm,
}) {
  if (current.isEmpty) return 'Enter your current password.';
  final weak = newPasswordProblem(next);
  if (weak != null) return weak;
  if (next != confirm) return 'Passwords do not match.';
  if (next == current) {
    return 'Choose a password different from your current one.';
  }
  return null;
}
