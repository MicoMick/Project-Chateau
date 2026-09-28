import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:chateau_mobile_app/app_config.dart';

void main() {
  test('the version shown in Settings matches pubspec.yaml', () {
    final pubspec = File('pubspec.yaml').readAsStringSync();
    final version =
        RegExp(r'^version:\s*([^+\s]+)', multiLine: true).firstMatch(pubspec)!;

    expect(AppConfig.appVersion, version.group(1),
        reason: 'Bump AppConfig.appVersion when pubspec.yaml changes.');
  });
}
