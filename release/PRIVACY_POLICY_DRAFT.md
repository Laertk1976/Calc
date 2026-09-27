# Calc privacy policy — draft for review

**Not yet published. Before publishing:** add the public developer identity and effective date, confirm provider disclosures and Android backup behavior, verify account-deletion deployment, and finalize support retention and response times. Bracketed items require completion.

## Who operates Calc

Calc is operated by [PUBLIC DEVELOPER NAME]. Privacy and support contact: laertkarap@gmail.com.

Effective date: [DATE].

## Information used by the app

Calc stores the calculations and records you enter, including titles, notes, debts, invoices, payment details, dates and edit history. These records may contain personal or financial information you choose to enter.

You can save records locally without signing in. When you create an account or sign in, Firebase Authentication processes account information such as your email address and user ID. Google sign-in also uses the profile information needed by Google and Firebase to authenticate you.

## Storage and synchronization

Records are saved in app storage on your device. When you use an account, account-linked records are also synchronized to Google Cloud Firestore. Local saves happen immediately; cloud sync needs an internet connection. Scheduled sync runs when the app is available and the sync interval is due, or when you request manual sync.

Android system backup may also retain app data according to your device and Google backup settings. [VERIFY FINAL BACKUP CONFIGURATION AND DESCRIBE IT ACCURATELY.]

## Providers and exports

Calc uses Google Firebase Authentication and Cloud Firestore to provide account and synchronization features. These services process data to operate and secure the service. See [Firebase privacy information](https://firebase.google.com/support/privacy) and [Google's privacy policy](https://policies.google.com/privacy).

If you authorize a Google Drive export, the selected document is uploaded to your Google Drive. If you choose a sharing action, the selected data is sent to the app or recipient you choose. Copies you export may remain in those destinations independently of Calc.

## Retention and deletion

The app currently retains saved records and edit history. Recoverable deletion of a record keeps information needed to restore it.

In app versions with this feature, open **Account → Delete account** and confirm your identity to permanently remove your Calc authentication account and cloud records, including payments, comments, history and recoverable deleted rows. This also clears that account's records and queued changes on the device performing deletion. Other offline devices, guest records, Android backups and independent exported copies are not remotely erased.

A minimal security marker consisting of the former account ID and deletion timestamp is retained indefinitely to prevent old sessions from uploading deleted data again. It does not contain email addresses or calculation records.

You can also request deletion through [the Calc account-deletion page](https://calc-7271f-account.web.app/delete-account) or contact laertkarap@gmail.com. Ownership is verified before processing requests. [FINALIZE SUPPORT-CORRESPONDENCE RETENTION AND ANY RELEVANT PROVIDER RETENTION BEFORE PUBLICATION.]

## Security

The app uses encrypted network connections to its cloud services. Device records use application storage. These measures do not constitute end-to-end encryption. [VERIFY DEPLOYED DATABASE ACCESS RULES BEFORE PUBLICATION.]

## Audience and changes

[CONFIRM INTENDED AUDIENCE AND ANY CHILDREN'S PRIVACY DISCLOSURE.]

Updates to this policy will be published at [PUBLIC POLICY URL] with a revised effective date. Contact laertkarap@gmail.com with questions.
