# Privacy policy publication

Published October 9, 2026. Developer display name confirmed by the owner: **laertkarap**. Audience: **13+**. Support correspondence: **12 months after resolution**, then manual deletion by the developer.

- Published HTML source: `public-account/privacy.html`.
- Public URL: `https://calc-7271f-account.web.app/privacy`.
- Existing account deletion URL: `https://calc-7271f-account.web.app/delete-account`.
- Hosting configuration already supports the `/privacy` URL through `cleanUrls`.
- Both privacy and account-deletion pages were deployed successfully to the existing Firebase Hosting site. The policy has no draft placeholders.
- The account-deletion page includes matching purchase and support-email retention disclosures.
- Privacy and Terms links are implemented in the Sign in, Account, Pro and Settings screens in all six UI languages. Both documents open in the app's selected language. These app changes require a new app build; already-installed APKs are not updated by Hosting deployment.
- Enter the public privacy URL in Play Console. Target-audience selections there still need to match the owner's 13+ choice.
- Recheck the Data safety declaration against the actual released build and enabled backend services. The policy conditionally describes Pro processing because the purchase backend is not live yet.

Deploy only Hosting when the text is finalized; this does not deploy the pending billing functions or Firestore rules:

```powershell
node tools/firebase/node_modules/firebase-tools/lib/bin/firebase.js deploy --only hosting --project calc-7271f
```

For later updates, verify both public URLs without signing in and check all policy/deletion links. Support-email deletion is a manual operating commitment, not an automated mailbox cleanup feature.

Reference: [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311).

## Localized policy pages (October 14, 2026)

- Deployed to Firebase Hosting on October 14, 2026. All six policy URLs and the account-deletion URL returned HTTP 200 and matched the local HTML. Seven privacy/language tests passed.
- English remains at `/privacy`. Armenian, Russian, Japanese, Hindi and Korean use `/privacy/hy`, `/privacy/ru`, `/privacy/ja`, `/privacy/hi` and `/privacy/ko`.
- The app opens each legal page matching its selected language. The manual browser fallback displays the same localized URL. Unknown locales fall back to English.
- The Terms text and language selector are localized in all six app languages.
- Every page includes links to all six languages and works without JavaScript, under the existing Hosting content security policy.
- Privacy translation sources are in `release/privacy-translations/*.json`; the English source remains `public-account/privacy.html`. All 46 policy headings/paragraphs are preserved. The effective date remains October 9, 2026 because this update translates the existing policy.
- The Terms source is `public-account/terms.html`; translations are in `release/terms-translations/*.json`, with generated pages under `public-account/terms/`. Run `node scripts/build-terms-pages.cjs` after editing and `node scripts/build-terms-pages.cjs --check` to verify them.
- After editing policy text, update corresponding translations and run `node scripts/build-privacy-pages.cjs`. Run `node --test privacyPolicy.test.cjs translations.test.cjs` before deploying Hosting.
- Hosting deployment publishes the translated pages; a new app build is needed for automatic language selection in installed APKs.
