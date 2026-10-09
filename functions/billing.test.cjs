const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { accountId, hash, PRODUCT_ID } = require('./purchasePolicy.cjs');

function harness() {
  const records = new Map();
  const purchases = new Map();
  const acknowledgements = [];
  const snapshot = path => ({ exists: records.has(path), data: () => records.get(path) });
  const db = {
    doc(path) { return { path, get: async () => snapshot(path), set: async data => records.set(path, data) }; },
    async runTransaction(fn) {
      const writes = [];
      await fn({ get: async ref => snapshot(ref.path), set: (ref, data) => writes.push([ref.path, data]) });
      for (const [path, data] of writes) records.set(path, data);
    },
  };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  class GoogleAuth {
    async getClient() { return { request: async ({ method, url }) => {
      const token = decodeURIComponent(url.split('/tokens/')[1].replace(/:acknowledge$/, ''));
      if (method === 'POST') {
        acknowledgements.push(token);
        purchases.get(token).acknowledgementState = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
        return { data: {} };
      }
      if (!purchases.has(token)) throw new Error('Google rejected token');
      return { data: structuredClone(purchases.get(token)) };
    } }; }
  }
  const exports = {};
  vm.runInNewContext(fs.readFileSync(`${__dirname}/index.cjs`, 'utf8'), { exports, require(name) {
    if (name === 'firebase-admin/app') return { initializeApp() {} };
    if (name === 'firebase-admin/firestore') return { getFirestore: () => db, FieldValue: { serverTimestamp: () => 'server-time' } };
    if (name === 'firebase-functions/v2/https') return { HttpsError, onCall: (_, fn) => fn };
    if (name === 'firebase-functions/v2/pubsub') return { onMessagePublished: (_, fn) => fn };
    if (name === 'google-auth-library') return { GoogleAuth };
    return require(name);
  } });
  const addPurchase = (token, state = 'PURCHASED', uid = 'alice') => purchases.set(token, {
    obfuscatedExternalAccountId: accountId(uid), productLineItem: [{ productId: PRODUCT_ID }],
    purchaseStateContext: { purchaseState: state }, acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
  });
  const verify = (token, uid = 'alice') => exports.verifyProPurchase({ auth: uid ? { uid } : null, data: { purchaseToken: token } });
  return { ...exports, records, purchases, acknowledgements, addPurchase, verify };
}

test('verified purchase is granted once, acknowledged, and restored to the same account', async () => {
  const h = harness(); h.addPurchase('token');
  assert.equal((await h.verify('token')).active, true);
  assert.equal((await h.verify('token')).active, true);
  assert.equal(h.records.get('proEntitlements/alice').active, true);
  assert.equal(h.records.size, 2);
  assert.deepEqual(h.acknowledgements, ['token']);
  await assert.rejects(h.verify('token', 'bob'), { code: 'permission-denied' });
});

test('invalid, pending, unauthenticated and deleted-account purchases cannot grant access', async () => {
  const h = harness(); h.addPurchase('pending', 'PENDING');
  assert.equal((await h.verify('pending')).pending, true);
  await assert.rejects(h.verify('invalid'), { code: 'unavailable' });
  await assert.rejects(h.verify('pending', null), { code: 'unauthenticated' });
  h.addPurchase('valid'); h.records.set('accountDeletions/alice', {});
  await assert.rejects(h.verify('valid'), { code: 'failed-precondition' });
  assert.equal(h.records.has('proEntitlements/alice'), false);
  assert.deepEqual(h.acknowledgements, []);
});

test('refund revokes matching access but an older refunded purchase cannot revoke a replacement', async () => {
  const h = harness(); h.addPurchase('old'); h.addPurchase('new');
  await h.getProBillingAccount({ auth: { uid: 'alice' } });
  await h.verify('old'); await h.verify('new');
  const notification = token => ({ data: { message: { json: { packageName: 'com.example.calc', voidedPurchaseNotification: { purchaseToken: token } } } } });
  await h.playBillingNotification(notification('old'));
  assert.equal(h.records.get('proEntitlements/alice').active, true);
  await h.playBillingNotification(notification('new'));
  assert.equal(h.records.get('proEntitlements/alice').active, false);
  assert.equal(h.records.get(`playPurchases/${hash('new')}`).active, false);
  // A lagging Play API response cannot regrant a token explicitly voided by Google.
  assert.equal((await h.verify('new')).active, false);
});

test('a completed pending purchase is granted by the server notification after the app closes', async () => {
  const h = harness();
  await h.getProBillingAccount({ auth: { uid: 'alice' } });
  h.addPurchase('later');
  await h.playBillingNotification({ data: { message: { json: { packageName: 'com.example.calc', oneTimeProductNotification: { purchaseToken: 'later' } } } } });
  assert.equal(h.records.get('proEntitlements/alice').active, true);
  assert.deepEqual(h.acknowledgements, ['later']);
});
