// Uses the existing Firebase CLI login; no credentials are printed or saved.
const auth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { findUser, setCustomClaim } = require('firebase-tools/lib/gcp/auth');
(async () => {
  const email = process.argv[2];
  if (!email || !email.includes('@')) throw new Error('Usage: node tools/firebase/grant-owner.cjs EMAIL [--apply]');
  const options = { project: 'calc-7271f', nonInteractive: true };
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error('Sign in with Firebase CLI first.');
  auth.setActiveAccount(options, account);
  await requireAuth(options);
  const user = await findUser(options.project, email);
  if (user.email?.toLowerCase() !== email.toLowerCase() || user.disabled) throw new Error('Active account did not match the requested email.');
  console.log(JSON.stringify({ uid: user.uid, email: user.email, owner: JSON.parse(user.customAttributes || '{}').calcOwner === true }));
  if (process.argv.includes('--apply')) {
    await setCustomClaim(options.project, user.uid, { calcOwner: true }, { merge: true });
    const verified = await findUser(options.project, undefined, undefined, user.uid);
    if (JSON.parse(verified.customAttributes || '{}').calcOwner !== true) throw new Error('Owner grant verification failed.');
    console.log('Verified permanent owner Pro claim. Refresh the app sign-in token to activate.');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
