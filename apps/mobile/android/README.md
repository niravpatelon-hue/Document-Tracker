# Android host project

The React Native Android host project (Gradle wrapper, `settings.gradle`,
`app/build.gradle`, `MainApplication`, `MainActivity`, manifest) is generated
with the React Native CLI rather than committed by hand, so it always matches the
pinned RN version:

```bash
cd apps/mobile
npx @react-native-community/cli init DocumentTracker \
  --version 0.76.5 --skip-install --directory .
# then merge the generated android/ over this directory
npm install
```

The capture-layer native modules under
`android/app/src/main/java/com/documenttracker/scanner/` are the hand-written
part and drop into that generated project. Two wiring steps are required:

## 1. Register the package

In `MainApplication.kt`, add `CapturePackage` to the package list:

```kotlin
import com.documenttracker.scanner.CapturePackage
// ...
override fun getPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
        add(CapturePackage())
    }
```

## 2. Add the ML Kit dependencies

In `android/app/build.gradle`:

```gradle
dependencies {
    // ML Kit Document Scanner (edge detection, perspective correction, multi-page)
    implementation 'com.google.android.gms:play-services-mlkit-document-scanner:16.0.0-beta1'
    // ML Kit on-device Latin text recognition (free OCR tier)
    implementation 'com.google.mlkit:text-recognition:16.0.0'
}
```

`minSdkVersion` must be 21+ (ML Kit Document Scanner requirement) and the device
must have Google Play Services. Devices without Play Services fall back to the
alternative capture path noted in `docs/ARCHITECTURE.md` §14.

> This project targets **Android only** — there is no `ios/` directory by design.
