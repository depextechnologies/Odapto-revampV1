# Odapto Mobile App Build Guide

## Overview
Odapto uses **Capacitor** to wrap the React web application as native Android and iOS apps. The build process creates the React production bundle and syncs it into the native projects.

---

## Prerequisites

### General
- **Node.js** v18+ and **Yarn** v1.22+
- **Git** (to pull the latest code)

### Android
- **Android Studio** (latest stable)
- **Java Development Kit (JDK)** 17+
- **Android SDK** (API Level 34 or latest)
- Set `ANDROID_HOME` environment variable

### iOS
- **macOS** with **Xcode** 15+ installed
- **CocoaPods** (`sudo gem install cocoapods`)
- Apple Developer Account (for device testing and App Store submission)

---

## Quick Start

### 1. Clone and Install Dependencies
```bash
git clone <your-repo-url>
cd frontend
yarn install
```

### 2. Configure Backend URL

**IMPORTANT**: Before building, update the backend URL for your deployment.

Edit `src/config.js` and change the `PRODUCTION_URL`:
```javascript
// For production deployment to odapto.com:
const PRODUCTION_URL = 'https://odapto.com';
```

This URL is used as fallback when `REACT_APP_BACKEND_URL` env var is not available (which is the case in mobile builds).

### 3. Build the Web App
```bash
yarn build
```

### 4. Generate App Icons and Splash Screen

Install the Capacitor assets generator:
```bash
npx @capacitor/assets generate --iconBackgroundColor '#FFFFFF' --splashBackgroundColor '#FFFFFF' --iconBackgroundColorDark '#1A1A1A' --splashBackgroundColorDark '#1A1A1A'
```

This uses the source images in `resources/`:
- `resources/icon.png` - App icon (1024x1024)
- `resources/splash.png` - Splash screen logo (1024x1024)

**Alternatively**, you can manually replace the icons:
- **Android**: Replace icons in `android/app/src/main/res/mipmap-*/ic_launcher.png`
- **iOS**: Replace icons in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

### 5. Sync to Native Projects
```bash
npx cap sync
```

---

## Android Build

### Open in Android Studio
```bash
npx cap open android
```

### Build Debug APK
In Android Studio:
1. Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**
2. The APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

**Or from command line:**
```bash
cd android
./gradlew assembleDebug
```
APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### Build Release APK (for Play Store)

1. **Generate a signing key** (one-time):
```bash
keytool -genkey -v -keystore odapto-release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias odapto-key
```

2. **Configure signing** in `android/app/build.gradle`:
```groovy
android {
    ...
    signingConfigs {
        release {
            storeFile file('odapto-release-key.jks')
            storePassword 'your-store-password'
            keyAlias 'odapto-key'
            keyPassword 'your-key-password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

3. **Build release APK:**
```bash
cd android
./gradlew assembleRelease
```

4. **Build AAB (Android App Bundle)** for Play Store:
```bash
cd android
./gradlew bundleRelease
```
AAB location: `android/app/build/outputs/bundle/release/app-release.aab`

---

## iOS Build

### Open in Xcode
```bash
npx cap open ios
```

### Configure Signing
1. In Xcode, select the **App** target
2. Go to **Signing & Capabilities** tab
3. Select your **Team** (Apple Developer account)
4. Set **Bundle Identifier** to `com.odapto.app`

### Build for Device/TestFlight
1. Select your connected iPad/iPhone or **Any iOS Device** as the build target
2. Go to **Product > Archive**
3. In the Archive Organizer, click **Distribute App**
4. Choose **App Store Connect** for TestFlight/App Store submission
5. Or choose **Ad Hoc** for direct device installation

### Install CocoaPods (if needed)
```bash
cd ios/App
pod install
```

---

## App Configuration Details

### App Metadata
| Property | Value |
|----------|-------|
| App Name | Odapto |
| Package ID | com.odapto.app |
| Version | 1.0.0 |
| Min Android API | 22 (Android 5.1) |
| Min iOS Version | 13.0 |

### Splash Screen Behavior
1. **Native splash screen** shows immediately on app launch (white background with Odapto logo)
2. **Animated splash screen** plays a 7-second branded video animation
3. App transitions to the **Login screen** after the animation completes

### Supported Orientations
- **Phone**: Portrait, Landscape Left, Landscape Right
- **Tablet/iPad**: All orientations including Upside Down

---

## Troubleshooting

### "REACT_APP_BACKEND_URL is undefined"
This is expected in mobile builds. The app uses the `PRODUCTION_URL` fallback in `src/config.js`. Make sure you've updated it before building:
```javascript
const PRODUCTION_URL = 'https://odapto.com'; // Your production URL
```

### CORS Errors
The backend CORS middleware allows all origins (`allow_origins=["*"]`). If you encounter CORS issues:
1. Verify the backend is running and accessible from the device
2. Check that the backend URL is correct in `src/config.js`
3. Test the API directly: `curl -X POST https://odapto.com/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test"}'`

### Android Build Fails
```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npx cap sync android
cd android
./gradlew assembleDebug
```

### iOS Build Fails
```bash
# Clean CocoaPods and rebuild
cd ios/App
pod deintegrate
pod install
cd ../..
npx cap sync ios
```

### White Screen on App Launch
If the app shows a white screen after the splash:
1. Check Chrome DevTools (for Android): `chrome://inspect`
2. Check Safari Web Inspector (for iOS)
3. Verify the `build/` directory was synced: `npx cap sync`

### Hot Reload for Development
```bash
# Terminal 1: Start the React dev server
yarn start

# Terminal 2: Run on Android device
npx cap run android --livereload --external

# Or run on iOS device
npx cap run ios --livereload --external
```

---

## Deploying Backend to odapto.com

When you're ready to deploy to production:

1. Update `frontend/.env.production`:
```
REACT_APP_BACKEND_URL=https://odapto.com
```

2. Update `frontend/src/config.js`:
```javascript
const PRODUCTION_URL = 'https://odapto.com';
```

3. Update `backend/.env` (on your production server):
```
FRONTEND_URL=https://odapto.com
```

4. Rebuild the mobile app:
```bash
yarn build && npx cap sync
```

---

## File Structure

```
frontend/
  capacitor.config.json    # Capacitor configuration
  resources/
    icon.png               # App icon source (1024x1024)
    splash.png             # Splash screen logo source (1024x1024)
  public/
    splash-animation.mp4   # Animated splash screen video
  src/
    config.js              # Backend URL configuration
    components/
      AnimatedSplashScreen.js  # Animated splash screen component
  android/                 # Android native project
  ios/                     # iOS native project
```
