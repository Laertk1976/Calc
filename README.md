# Calc

## Account sign-in and synced calculations

The main screen supports email/password and Google sign-in through Firebase Authentication. Calculations are stored in Cloud Firestore under the signed-in user. Drive authorization is separate and is only requested when a Drive action is pressed.

Add these values to `.env`:

```text
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id
```

In Firebase Authentication, enable Email/Password and Google providers. Add an Android app with package name `com.example.calc` in the Firebase project. Register the SHA-1 certificate of the installed APK in that Android app's settings. Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env` to a **Web application** OAuth client ID from the same Google Cloud/Firebase project.

Web Google sign-in uses Firebase `signInWithPopup`, so `http://localhost:8081` is not an OAuth redirect URI for this app. In Firebase Authentication, ensure `localhost` is listed under Authorized domains. Android uses the native Google Sign-In SDK and exchanges its ID token for a Firebase credential; account sign-in does not use the Drive OAuth redirect.

### Android development app

Google account sign-in requires our own development APK; Expo Go does not include the native Google Sign-In module. `expo-dev-client` is already installed.

Build and install locally with an Android phone connected over USB:

```sh
npx expo run:android --device
```

For an already installed development APK, start Metro and open **Calculator** on the phone:

```sh
npx expo start --dev-client
```

The local debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Its current signing certificate SHA-1 is:

```text
5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

Register this fingerprint for `com.example.calc` in Firebase project `calc-7271f`. A `DEVELOPER_ERROR` / code 10 means the native app and Google OAuth configuration do not match. Verify the package, actual APK certificate, and Web OAuth client ID together.

For a cloud build, log in to EAS, link/configure the project, and run `eas build --profile development --platform android`; `eas.json` includes that profile. Configure the required `EXPO_PUBLIC_*` variables for the build environment. Verify the resulting APK's certificate because EAS signing can differ from local signing.

Create a Firestore database and add these security rules:

```text
rules_version = '2';
service cloud.firestore {
	match /databases/{database}/documents {
		match /calculations/{calculationId} {
			allow read, write: if request.auth != null
				&& request.auth.uid == resource.data.userId;
			allow create: if request.auth != null
				&& request.auth.uid == request.resource.data.userId;
		}
	}
}
```

## Google Drive setup

1. Enable the Google Drive API in the same Google Cloud project used by Firebase (`calc-7271f`). Configure the OAuth consent screen and add your Google account as a test user if the app is in testing.
2. Mobile Drive uploads use the native Google Sign-In SDK with `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and the registered Android package/SHA-1. Drive access (`drive.file`) is requested only when an upload is pressed. The old Android browser OAuth client and redirect are no longer used for Drive.
3. Web CSV upload retains browser authorization. Add the exact browser URL as an authorized redirect URI on the Web OAuth client (for example, `http://localhost:8081`). Do not add a trailing slash unless it is present in the address bar.
4. Restart Expo after changing `.env`. The Drive authorization change uses the native module already included in the development APK, so it does not itself require a native rebuild.

The table supports saving CSV locally, uploading CSV to Google Drive, and uploading PDF to Google Drive from Android or iOS. Web PDF export opens the clean table in the browser print dialog.
