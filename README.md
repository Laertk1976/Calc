# Calc

## Google Drive setup

1. In Google Cloud Console, enable the Google Drive API and create OAuth client IDs for web, Android, and iOS.
2. Copy `.env.example` to `.env` and replace the three placeholder client IDs.
3. Add `http://localhost:8081` and the Expo web redirect URI to the web OAuth client.
4. Restart Expo after changing `.env`.

The table supports saving CSV locally, uploading CSV to Google Drive, and uploading PDF to Google Drive from Android or iOS. Web PDF export opens the clean table in the browser print dialog.
