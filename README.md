# Calc

## Google Drive setup

1. In Google Cloud Console, enable the Google Drive API. Create an **Android** OAuth client with package name `com.example.calc` and the SHA-1 certificate fingerprint of the APK being tested. Create separate web and iOS OAuth clients when those platforms are used.
2. Copy `.env.example` to `.env` and replace the three placeholder client IDs.
3. For web CSV upload, add the exact browser URL as an authorized redirect URI (for example, `http://localhost:8081`). Do not add a trailing slash unless it is present in the address bar. Android does not use this web redirect URI.
4. Restart Expo after changing `.env`. After this change, rebuild and reinstall Android so it registers `com.example.calc:/oauthredirect` as its sign-in return URL.

The table supports saving CSV locally, uploading CSV to Google Drive, and uploading PDF to Google Drive from Android or iOS. Web PDF export opens the clean table in the browser print dialog.
