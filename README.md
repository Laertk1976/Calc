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

In Firebase Authentication, enable Email/Password and Google providers. Add an Android app with package name `com.example.calc` in the Firebase project. For Google sign-in, use the existing Google OAuth client IDs and add the app's SHA-1 certificate in Firebase. The Android redirect URI is `com.googleusercontent.apps.186668101668-d2preo1to754tg8edidaod4v1lfp8gvu:/oauthredirect`.

Web Google sign-in uses Firebase `signInWithPopup`, so `http://localhost:8081` is not an OAuth redirect URI for this app. In Firebase Authentication, ensure `localhost` is listed under Authorized domains. Native Android sign-in continues to use the Android client ID and native callback above.

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

1. In Google Cloud Console, enable the Google Drive API. Create an **Android** OAuth client with package name `com.example.calc` and the SHA-1 certificate fingerprint of the APK being tested. Create separate web and iOS OAuth clients when those platforms are used.
2. Copy `.env.example` to `.env` and replace the three placeholder client IDs.
3. For web CSV upload, add the exact browser URL as an authorized redirect URI (for example, `http://localhost:8081`). Do not add a trailing slash unless it is present in the address bar. Android does not use this web redirect URI.
4. Restart Expo after changing `.env`. After this change, rebuild and reinstall Android so it registers `com.example.calc:/oauthredirect` as its sign-in return URL.

The table supports saving CSV locally, uploading CSV to Google Drive, and uploading PDF to Google Drive from Android or iOS. Web PDF export opens the clean table in the browser print dialog.
