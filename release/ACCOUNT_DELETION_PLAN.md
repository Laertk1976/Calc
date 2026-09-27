# Calc account deletion

Implemented in source. The tested Firestore rules and public page were deployed and verified on 2026-09-27. The current sideload APK does not contain this feature yet; rebuild it for device acceptance.

Public deletion-request URL: **https://calc-7271f-account.web.app/delete-account**. Verified HTTP 200 and the support email link after deployment. Use this URL in Play Console's account-deletion field.

## In the app

Signed-in users open **Account → Delete account**, read the permanent-deletion confirmation and verify their identity with their password or Google. The Account screen also contains Sign out. Google reauthentication does not delete the user's Google account or sign in as a different Firebase account.

The operation persists a local deletion flag, blocks edits and sync, creates `accountDeletions/{uid}`, then permanently deletes all account-owned calculation documents in batches of 400. It includes history and soft-deleted rows. It clears this account's local rows and queue, then deletes the Firebase Authentication identity last. Earlier failures leave the identity available for retry. Stale sync responses cannot restore cleared records.

The cloud marker stores the UID in its path and `requestedAt` only. It is retained indefinitely to stop old sessions from recreating records. Clients cannot update or remove it. This retention is disclosed in the app and page. Guest records, exports, other offline devices and Android backups are outside this operation.

Tests cover cancellation, identity changes, partial failure, batches, restart persistence, late sync responses, account isolation and stale sessions. They use mocks and the Firestore emulator, not production account deletion. Perform final device acceptance with a designated test account.

## On the public website

`public-account/delete-account.html` contains the page **Delete your Calc account**. Its email button drafts a request to laertkarap@gmail.com; it does not send automatically. The intended hosting site is `calc-7271f-account` within Firebase project `calc-7271f`, keeping the support page separate from any main app website.

The page explains ownership verification, the data removed, retained markers and separate copies. Support replies with the expected completion time; no unsupported fixed turnaround has been promised.

## Processing email requests

1. Verify ownership by sending a fresh confirmation to the address registered on the Firebase account and obtaining a response. Do not trust only the incoming sender name or supplied UID. Never ask for passwords, sign-in or recovery codes.
2. Confirm scope and expected completion time with the requester.
3. Locate the verified Authentication user in project `calc-7271f`. Confirm the UID carefully.
4. Create `accountDeletions/{uid}` with a `requestedAt` timestamp, or preserve the existing marker. This must happen before removing documents.
5. Query `calculations` for `userId` equal to that UID. Permanently delete every matching document, including deleted rows, and verify a new query is empty. Never delete the entire collection.
6. Delete that exact Firebase Authentication user. If a step fails, keep the marker and finish the remaining work before reporting completion.
7. Confirm completion and explain removal of offline copies, exports and backups. Support correspondence must be handled according to the operator's disclosed retention practice.

## Deployment and tests

Install the isolated tooling with `npm ci --prefix tools/firebase --ignore-scripts`. With Node and JDK 21 on PATH, run:

```powershell
node tools/firebase/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-calc-deletion --only firestore "node --test tools/firebase/rules.test.mjs"
```

Deployment needs Firebase CLI sign-in. Review and back up existing rules before replacing them; `tools/firebase/read-live-rules.cjs` is read-only and writes a local ignored backup. On 2026-09-27 the deployed rules were the default public test-mode rules expiring 2026-10-13; no collection-specific rules were present.

```powershell
node tools/firebase/node_modules/firebase-tools/lib/bin/firebase.js hosting:sites:create calc-7271f-account --project calc-7271f
node tools/firebase/node_modules/firebase-tools/lib/bin/firebase.js deploy --only firestore:rules,hosting --project calc-7271f
```

Only create the site if it does not already exist. Verify the public URL after deployment. Rules publication changes authorization but does not itself delete records. No production account should be deleted for routine testing.

Source: [Google Play account-deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111).
