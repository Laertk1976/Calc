// Read-only review and local backup; credentials stay inside the Firebase CLI.
const fs = require('node:fs');
const path = require('node:path');
const auth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const rules = require('firebase-tools/lib/gcp/rules');
(async () => {
  const options = { project: 'calc-7271f', nonInteractive: true };
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error('Sign in with Firebase CLI first.');
  auth.setActiveAccount(options, account);
  await requireAuth(options);
  const releases = await rules.listAllReleases(options.project);
  const release = releases.find(item => item.name === `projects/${options.project}/releases/cloud.firestore`);
  if (!release) throw new Error('Default Firestore rules release not found.');
  const files = await rules.getRulesetContent(release.rulesetName);
  if (files.length !== 1) throw new Error('Multiple rule source files require separate review.');
  if (process.argv.includes('--verify')) {
    const expected = fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8');
    if (files[0].content.trim() !== expected.trim()) throw new Error('Live rules do not match the tested local rules.');
    console.log('Verified: live Firestore rules match the tested account-deletion rules.');
    return;
  }
  fs.writeFileSync(path.join(__dirname, '../../release/deployed-firestore-backup.rules'), files[0].content, { encoding: 'utf8', flag: 'wx' });
  console.log(files[0].content);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
