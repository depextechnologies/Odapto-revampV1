# Odapto Mobile Apps (Android Tablet & iPad)

This guide explains how to build and deploy the Odapto mobile apps using Capacitor.

## Prerequisites

### For Android Development
- Android Studio (latest version)
- Java JDK 17+
- Android SDK (API 33+)

### For iOS Development  
- macOS with Xcode 15+
- CocoaPods (`sudo gem install cocoapods`)
- Apple Developer Account (for App Store submission)

## Project Structure

```
frontend/
├── android/          # Android native project
├── ios/              # iOS native project
├── capacitor.config.json  # Capacitor configuration
└── src/              # React web app source
```

## Build Commands

### Sync Web Assets to Native Projects
```bash
yarn cap:sync
```

### Build for Android
```bash
yarn cap:build:android
yarn cap:open:android  # Opens Android Studio
```

### Build for iOS
```bash
yarn cap:build:ios
yarn cap:open:ios  # Opens Xcode
```

## Building Release APK/AAB (Android)

1. Open Android Studio: `yarn cap:open:android`
2. Go to **Build > Generate Signed Bundle / APK**
3. Create or select a keystore
4. Choose **Android App Bundle (AAB)** for Play Store or **APK** for direct install
5. Select **release** build variant
6. Click **Finish**

The signed APK/AAB will be in:
- `android/app/release/app-release.aab` (for Play Store)
- `android/app/release/app-release.apk` (for direct install)

## Building for iOS (iPad)

1. Open Xcode: `yarn cap:open:ios`
2. Select your development team in **Signing & Capabilities**
3. For TestFlight/App Store:
   - Select **Product > Archive**
   - In Organizer, click **Distribute App**
   - Follow App Store Connect submission flow

## App Configuration

### App ID & Name
- **App ID**: `com.odapto.app`
- **App Name**: Odapto

### Changing App Icons

Place your icons in:
- Android: `android/app/src/main/res/mipmap-*`
- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset`

### Splash Screen
Configure in `capacitor.config.json`:
```json
{
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "backgroundColor": "#E67E4C"
    }
  }
}
```

## Native Plugins Included

- `@capacitor/app` - App lifecycle management
- `@capacitor/splash-screen` - Native splash screen
- `@capacitor/status-bar` - Status bar customization
- `@capacitor/keyboard` - Keyboard handling
- `@capacitor/haptics` - Haptic feedback
- `@capacitor/push-notifications` - Push notifications

## Updating the App

After making changes to the React code:
```bash
yarn build
yarn cap:sync
```

Then rebuild in Android Studio or Xcode.

## Troubleshooting

### Android Build Issues
- Ensure Gradle sync is successful
- Check `android/gradle.properties` for memory settings
- Clean project: **Build > Clean Project**

### iOS Build Issues
- Run `cd ios/App && pod install`
- Check signing certificates in Xcode
- Clean build folder: **Product > Clean Build Folder**

## Play Store / App Store Submission

### Android (Play Store)
1. Create app listing in Google Play Console
2. Upload signed AAB
3. Complete store listing, content rating, pricing
4. Submit for review

### iOS (App Store)
1. Create app in App Store Connect
2. Upload build via Xcode or Transporter
3. Complete app information, screenshots, pricing
4. Submit for review

## Support

For issues, contact the development team or create an issue in the repository.
