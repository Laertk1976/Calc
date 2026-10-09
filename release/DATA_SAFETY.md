# Data safety review worksheet

Draft based on local code, 2026-09-27. This is not a completed Play Console declaration. Verify the deployed Firebase configuration and SDK disclosures before submitting.

| Data | Evidence and purpose | Review for Play form |
| --- | --- | --- |
| Email and account ID | Firebase Authentication; identifies and restores the signed-in user's records | Personal info: email address, user IDs; account management and app functionality |
| Google profile information | Native Google Sign-In requests email/profile scopes | Verify name/profile fields received and processed by the SDK and Firebase |
| Debts, invoices, payments and amounts | Stored in Firestore as account-linked calculation records | Financial info: other financial info; assess purchase history based on record use |
| Titles, notes, calculations, comments, history and dates | Entered by users and synced with the record | Other user-generated content; assess names or other personal details entered in records |
| Exported documents | Optional sharing and Drive export | Review files/docs and user-directed transfer exceptions; Drive export needs explicit authorization |
| SDK technical data | Firebase Auth and Google Sign-In dependencies | Check current SDK disclosures and configuration for device identifiers and diagnostics; do not infer 'none' from lack of an analytics screen |
| Pro purchases (when enabled) | Google Play purchase tokens, product/status information, Firebase UID and hashed account binding; server verification and refund notifications | Review purchase history and user identifiers for app functionality, account management and fraud prevention; payment-card details are handled by Google Play |

## Current implementation

- Guest calculations stay in device storage. Signing in uses an account-specific local store and Firestore data.
- Cloud records use the Firebase account ID, not anonymous identifiers.
- Network APIs use HTTPS. Local AsyncStorage is not app-level encrypted storage; do not claim end-to-end encryption.
- Android application backup is currently enabled. Review Android backup behavior and disclosures for local records before launch.
- Optional Google Drive uploads create files in the user's Drive. User-selected sharing sends content to the chosen app/service.
- No advertising SDK, Firebase Analytics initialization or Crashlytics integration was found in the inspected code. This is not a certification of all SDK processing.
- Record deletion is currently recoverable: rows and edit history can remain stored. Do not label that action permanent deletion.
- Account deletion is implemented with fresh authentication, permanent cloud-document removal, local queue clearing and Firebase Authentication deletion. Verify deployment and device acceptance before answering positively. Disclose the indefinitely retained UID/timestamp marker that blocks stale uploads; it contains no record payload or email.

## Questions to resolve

The policy at `https://calc-7271f-account.web.app/privacy` was published October 9, 2026 from `public-account/privacy.html`. Confirmed developer: laertkarap; audience: 13+; support emails: 12 months after resolution, then deletion. Billing records currently have no automatic expiry and their retention is disclosed separately from calculation/account deletion. The billing backend has not yet been deployed.

1. Which optional data categories are collected by the final SDK configuration, including Google profile information and technical identifiers?
2. How will permanent deletion and any retention obligations work, and how long will verified requests take?
3. Which providers qualify as service providers under Google's definitions? A transfer to Firebase still counts as collection; apply sharing exceptions only after checking the policy.
4. Ensure Play Console target-audience selections match the confirmed 13+ audience.
5. Are public Firebase rules restricted to each authenticated owner and validated for writes?

Source: [Google Play Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469).
