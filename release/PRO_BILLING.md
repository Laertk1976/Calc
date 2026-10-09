# Calc Pro implementation and activation

Prepared 2026-10-08. The client and backend source are implemented and locally tested. Billing functions and new Firestore rules have **not** been deployed. There is no Play Console developer account/product yet, so real purchases are not active.

## Product behavior

- Free: calculations, adding records (including Debt, Invoice, Cash Invoice), and records saved on the current local day. The debt/invoice lists and name suggestions are also limited to today.
- Pro: Table, search, calendar/date navigation, all past records, record editing, payoff, undo and deletion. Editing is gated to prevent changing the debt amount to zero as a payoff bypass.
- Locked actions open one payment screen. Hiding an older record never removes it from storage or sync. Account deletion stays available without Pro.
- Product ID: `calc_pro_lifetime`, one-time **non-consumable**, intended US price **$4.99**. Do not configure a subscription, rental, or consumable.
- The price on the purchase button comes from Google Play, including local currency; an unavailable product cannot be purchased. Web supports existing entitlements but directs purchases to the Android app.
- Sign-in is required before purchase/restore. Each receipt is linked to the purchasing Firebase UID. Restore requires that same Calc account and the Google Play account that purchased it. Do not silently transfer receipts between Calc accounts.
- Pending payments do not unlock Pro. The server verifies the product, account binding and purchase state, grants the entitlement, then acknowledges the purchase. It never consumes the product.
- Confirmed Pro is cached per account for up to seven days offline. Online entitlement updates override that cache; signing out removes access immediately. Reconnect periodically to verify access.
- These are app feature gates, not encryption of the user's own records. Local caches and JavaScript can be modified on a compromised device. Firebase prevents clients from minting entitlements/owner claims or reading private purchase tokens; existing owner-only record sync remains unchanged.

## Owner access — already activated

The Firebase account `laertkarap@gmail.com`, UID `JhM46835nzbj4qgbJkQdSH3emz23`, has the administrator-issued custom claim `calcOwner: true`. It was granted and read back successfully on 2026-10-08. The client does not contain an email-based bypass. Sign in with this account in the updated app; restart or sign in again if the token predates the grant.

The administrative helper preserves other claims:

```powershell
node tools/firebase/grant-owner.cjs laertkarap@gmail.com
# Explicitly grant, only from a trusted administrative environment:
node tools/firebase/grant-owner.cjs laertkarap@gmail.com --apply
```

## Activate billing after Play Console registration

1. Create the [Google Play developer account](https://support.google.com/googleplay/android-developer/answer/6112435) and complete the account/payment profile requirements. Add Calc as a free app with in-app purchases. The Google registration fee is separate from Pro.
2. Finalize the Android application ID before the first upload. It is currently `com.example.calc` in Android, Expo, Firebase, and `functions/purchasePolicy.cjs`; all must agree if it changes. Prepare a properly upload-signed AAB as described in `PLAY_STORE.md`. The locally tested release APK uses the existing development key and is not a Play upload artifact.
3. Create `calc_pro_lifetime` as a one-time product with a permanent buy option, priced at USD 4.99 with appropriate regional prices. Configure only that buy option initially; no rentals or discount offers. Keep real sale activation until backend and license testing are ready.
4. Firebase Functions deployment requires the [Blaze plan](https://firebase.google.com/docs/functions/get-started). Enable billing deliberately, with budget alerts. No billing plan was changed by this implementation.
5. Enable the Google Play Android Developer API in the cloud project. Give the **deployed functions' runtime service account** the Play Console permissions needed to view purchases and manage orders/acknowledgements for Calc. Use Application Default Credentials; do not put service-account keys in the app or repository. Confirm the actual runtime service account in Cloud Run/Functions instead of assuming its name.
6. Install locked server dependencies with `npm ci --prefix functions`. Run the tests below. Review/deploy the updated Firestore rules and billing code:

   ```powershell
   node tools/firebase/node_modules/firebase-tools/lib/bin/firebase.js deploy --only firestore:rules,functions:billing --project calc-7271f
   ```

   Functions use region `us-central1`: `getProBillingAccount`, `verifyProPurchase`, `playBillingNotification`.
7. Configure [real-time developer notifications](https://developer.android.com/google/play/billing/rtdn-reference) for one-time products and voided purchases. Topic: `projects/calc-7271f/topics/calc-play-billing`. Grant the Google Play notifications service identity permission to publish to the topic. Send a test notification and check delivery. This is required for pending purchases completed while the app is closed and prompt refund revocation.
8. Add license testers and upload the AAB to internal testing. Use a **separate non-owner Calc account** to exercise the paywall; owner access intentionally bypasses payment. Follow [Google's billing test guide](https://developer.android.com/google/play/billing/test).
9. Verify successful purchase, cancellation, decline, pending approval after restart, restore/reinstall, wrong Calc account, sign-out, offline grace, and refund/revoke. Verify old records remain intact. Do not mark live billing complete until these Play-backed tests pass.

## Server data and deletion

- `proEntitlements/{uid}`: the account can read its own status; only the backend writes it.
- `playPurchases/{sha256(token)}`: private purchase token, Firebase UID, product, active/revoked state, verification timestamp. Clients cannot read or write these records.
- `billingAccounts/{sha256('calc-pro:' + uid)}`: private UID binding used to associate Google notifications with accounts.
- Refunds revoke the matching receipt only; an old refund cannot revoke a replacement purchase. A voided receipt stays revoked even if a later verification response is stale.
- Account-deletion markers prevent billing callbacks from reactivating deleted accounts. Minimal purchase/binding records are retained to handle refunds and prevent receipt reuse. Document this retention in the published privacy/deletion policy before release. Restoring into a newly created Calc account after deleting the original account is not automatically supported.

## Local validation

```powershell
node --test *.test.mjs *.test.cjs functions/*.test.cjs
node tools/firebase/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only firestore --project demo-calc-deletion "node --test tools/firebase/rules.test.mjs"
node node_modules/expo/bin/cli export --platform web --output-dir .pro-web-check
node pro.ui-check.cjs
# JDK 21/Android SDK/Node on PATH, from android/:
.\gradlew.bat app:assembleRelease --console=plain --no-daemon
```

The browser check uses an isolated, hidden Edge profile and test-only local records. It checks desktop/mobile free access and locked actions without modifying real account data. Tests of Google responses use fixtures; they are not evidence of a live Play purchase.
