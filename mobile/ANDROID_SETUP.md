# Running Chateau Real on Android (VS Code)

## Prerequisites
1. Install Flutter SDK: https://docs.flutter.dev/get-started/install/windows
2. Install Android Studio (for SDK + emulator): https://developer.android.com/studio
3. Install VS Code Flutter extension

## One-time setup

### 1. Set local.properties (after cloning/unzipping)
Edit `android/local.properties`:
```
sdk.dir=C:\Users\YOUR_NAME\AppData\Local\Android\sdk
flutter.sdk=C:\path\to\flutter
```

### 2. Accept Android licenses
```bash
flutter doctor --android-licenses
```

### 3. Install dependencies
```bash
flutter pub get
```

### 4. Verify setup
```bash
flutter doctor
```
All items should show ✓ (or ✓ with minor warnings).

## Running on a physical Android device

1. Enable **Developer Options** on your phone:
   - Settings → About Phone → tap "Build Number" 7 times

2. Enable **USB Debugging**:
   - Settings → Developer Options → USB Debugging → ON

3. Connect phone via USB, accept the "Allow USB debugging?" prompt

4. In VS Code terminal:
```bash
flutter devices        # verify your device appears
flutter run            # debug mode
flutter run --release  # release mode (faster)
```

Or press **F5** in VS Code with your device selected.

## Running on Android Emulator

1. Open Android Studio → Device Manager → Create Device
2. Choose Pixel 7 → API 34 → Download & Create
3. Start the emulator
4. Run `flutter run` or press F5 in VS Code

## Building APK for sideloading (no Play Store)

```bash
flutter build apk --release
```
APK will be at: `build/app/outputs/flutter-apk/app-release.apk`

Transfer to phone and install (must enable "Install from unknown sources").

## Troubleshooting

**Gradle sync fails:**
```bash
cd android && ./gradlew clean
cd .. && flutter clean && flutter pub get
```

**Mapbox not loading:**
- Verify token in `android/app/src/main/res/values/strings.xml`
- Check internet permission is in AndroidManifest.xml

**Location not working:**
- Accept permission prompt on device
- Emulator: Extended Controls → Location → set coordinates

**Build fails with Kotlin error:**
- Make sure you have Flutter 3.x stable: `flutter upgrade`
