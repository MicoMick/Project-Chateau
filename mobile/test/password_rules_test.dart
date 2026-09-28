import 'package:flutter_test/flutter_test.dart';
import 'package:chateau_mobile_app/domain/account/password_rules.dart';

String? problem(String current, String next, String confirm) =>
    passwordChangeProblem(current: current, next: next, confirm: confirm);

void main() {
  test('a valid change has no problem', () {
    expect(problem('oldpass123', 'newpass456', 'newpass456'), isNull);
  });

  test('the current password is required', () {
    expect(problem('', 'newpass456', 'newpass456'),
        'Enter your current password.');
  });

  test('the new password needs at least 8 characters, like signup', () {
    expect(problem('oldpass123', 'short7!', 'short7!'),
        'Password must be at least 8 characters.');
    expect(newPasswordProblem('exactly8'), isNull);
    expect(newPasswordProblem('seven77'), 'Password must be at least 8 characters.');
  });

  test('the confirmation must match', () {
    expect(problem('oldpass123', 'newpass456', 'newpass457'),
        'Passwords do not match.');
  });

  test('the new password must differ from the current one', () {
    expect(problem('samepass123', 'samepass123', 'samepass123'),
        'Choose a password different from your current one.');
  });
}
