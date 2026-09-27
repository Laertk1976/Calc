# Calc: Google Play preparation

Prepared 2026-09-27. This is a preparation pack, not approval to publish.

## Confirmed details

- App name: **Calc**
- Support email: **laertkarap@gmail.com**
- Developer account: not created yet
- Current code version: 1.0.13 (16)
- Current Android application ID: `com.example.calc`
- Android target: API 36; minimum: API 24

## Before the first upload

1. Create a [Google Play Console account](https://play.google.com/console/signup). Google currently charges a [one-time US$25 registration fee](https://support.google.com/googleplay/android-developer/answer/6112435). Complete identity and device verification when requested. Choose the account type that reflects your real status.
2. Choose the public developer name, target countries, audience and free/paid distribution. These are still undecided.
3. Confirm the permanent application ID. `com.example.calc` is a development-style identifier; a unique identifier associated with your developer identity is preferable before the first upload. Changing it requires matching native code/configuration and Firebase/OAuth registration. Existing locally saved records will not automatically move into an app with a different ID.
4. Create and securely back up a private upload keystore. Do not use `android/app/debug.keystore` for Play. Enable Play App Signing. Keep the upload key, its passwords and backup outside source control.
5. Verify the deployed rules and public deletion-request page, then test **Account → Delete account** using a designated test account. The flow is implemented; production acceptance is separate. See `ACCOUNT_DELETION_PLAN.md`. Recoverable row deletion remains separate from account deletion. [Google's account-deletion requirement](https://support.google.com/googleplay/android-developer/answer/13327111).
6. Finalize and host the privacy policy at a public URL, then link it inside the app and in Play Console. The separate deletion-request page is live at https://calc-7271f-account.web.app/delete-account; the privacy policy remains a draft.
7. Verify deployed Firestore security rules with two accounts. The local repository does not establish which rules are live. Reads, updates and deletes must check ownership; updates must not change `userId` to another account.
8. Review `DATA_SAFETY.md`, including Firebase and Google Sign-In SDK behavior. Complete the Data safety, ads, app access, content rating, target audience and financial-features forms from the final app's actual behavior.
9. Add the Play **app signing certificate** SHA-1/SHA-256 to the correct Firebase Android application. The upload certificate alone does not configure Google sign-in for Play-installed builds. Verify package, OAuth web client and Firebase project together.
10. Supply store images and test the Play-distributed build. See `STORE_LISTING.md`.

## Release signing and build

The existing sideload APKs use the development key. Gradle now accepts upload credentials through environment variables. A Play release bundle fails early when those credentials are absent; ordinary sideload APK builds still work.

Configure these in a trusted local shell or secret manager; do not paste passwords into chat or commit them:

- `CALC_UPLOAD_STORE_FILE`: absolute path to the private upload keystore
- `CALC_UPLOAD_STORE_PASSWORD`
- `CALC_UPLOAD_KEY_ALIAS`
- `CALC_UPLOAD_KEY_PASSWORD`

With Node and JDK 21 available on PATH and JAVA_HOME set, run from the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-play-bundle.ps1
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`.

The execution-policy option applies only to that PowerShell process; it does not change the machine's policy.

Before uploading, inspect the bundle's signing certificate with JDK `keytool -printcert -jarfile <bundle-path>` and confirm it is your upload certificate, not Android Debug. Increment `versionCode` for each later uploaded version. New Play apps use an [Android App Bundle](https://support.google.com/googleplay/android-developer/answer/9859152), rather than the sideload APK.

The new Play signing identity may not update an existing development-signed installation. Sync or export records before any uninstall; verify account restoration on a separate device first.

## Permissions prepared

- Removed broad external-storage read/write access. App exports use app-owned files, share sheets and explicit Google Drive authorization.
- Removed overlay permission from the release manifest while leaving development configuration available.
- Explicitly blocked microphone recording and disabled Expo Audio background recording/playback configuration. Tap sounds still use normal foreground playback.
- Internet, vibration and dependency-provided audio/network permissions remain. Inspect the final merged release manifest after any prebuild or SDK change.

## Verification before rollout

- [ ] Sign in/up with email and Google; check cancellation, wrong passwords and connection errors. Email auth currently needs error handling so a rejection cannot leave its busy state stuck.
- [ ] Test local saves after force-close, restart and device reboot.
- [ ] Test first sign-in restoration, account isolation, manual sync, delayed sync and errors. Automatic sync is due every eight hours while running or on next reopen; it is not guaranteed background backup.
- [ ] Complete device acceptance of the implemented account-deletion flow with a designated test account. Local retry, queue protection and rules tests are available.
- [ ] Test PDF, CSV, Android sharing and Drive exports on the installed release. The current native CSV share uses a data URI; verify that it works with the native sharing API before claiming export readiness.
- [ ] Check small screens, large fonts, keyboard, long translations, accessibility and offline behavior.
- [ ] Verify 16 KB native-library compatibility and test on a 16 KB device/emulator. APK ZIP alignment alone does not establish ELF compatibility. [Android guidance](https://developer.android.com/guide/practices/page-sizes).
- [ ] Run the Play pre-launch report and resolve crashes or account-access issues.
- [ ] Provide a dedicated reviewer account and instructions if requested; never use personal financial records in reviewer accounts or screenshots.

API 36 meets the [current target API requirement](https://support.google.com/googleplay/android-developer/answer/11926878). Recheck before the actual upload.

For a new personal account, Google currently requires at least **12 opted-in testers for 14 continuous days** before applying for production access. Completing that period does not guarantee approval. [Testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465).

## Still needed from the owner

- Public developer name and final application ID decision
- Developer account registration and verification
- Hosting/domain for policy and deletion pages (a custom domain is optional)
- Audience, countries and pricing decisions
- Private upload signing setup and backup

No Play developer account has been created, upload keystore generated or app submitted. Account-deletion Firestore rules and the public deletion-request page were deployed on 2026-09-27 after Firebase sign-in. No production account was deleted during testing.
