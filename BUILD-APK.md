# Build FlowLedger APK

The project is already wired for Capacitor Android packaging.

## One-time setup

1. Install Android Studio.
2. Open Android Studio once and install:
   - Android SDK
   - Android SDK Platform
   - Android SDK Build-Tools
3. Make sure `sdkmanager`/SDK paths are configured by Android Studio.

## Build commands

From the project root:

```bash
npm install
npm run android:build
```

## Output APK

After a successful build, the debug APK should be at:

```bash
android/app/build/outputs/apk/debug/app-debug.apk
```

## Helpful commands

```bash
npm run android:open
npm run cap:sync
```

`android:open` opens the Android project in Android Studio, which is the easiest place to make a release build later.
