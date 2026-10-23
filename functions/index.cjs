const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onMessagePublished } = require('firebase-functions/v2/pubsub');
const { GoogleAuth } = require('google-auth-library');
const { PRODUCT_ID, PACKAGE_NAME, hash, accountId, assessPurchase } = require('./purchasePolicy.cjs');
initializeApp();
const db = getFirestore();
const google = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const options = { region: 'us-central1', maxInstances: 5, timeoutSeconds: 60 };
const publisherUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases`;

async function activeUser(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to purchase or restore Pro.');
  if ((await db.doc(`accountDeletions/${request.auth.uid}`).get()).exists) throw new HttpsError('failed-precondition', 'Account deletion is pending.');
  return request.auth.uid;
}

exports.getProBillingAccount = onCall(options, async request => {
  const uid = await activeUser(request);
  const id = accountId(uid);
  await db.doc(`billingAccounts/${id}`).set({ uid });
  return { accountId: id, productId: PRODUCT_ID };
});

async function readPurchase(token) {
  const client = await google.getClient();
  const result = await client.request({ url: `${publisherUrl}/productsv2/tokens/${encodeURIComponent(token)}` });
  return result.data;
}

async function recordPurchase(uid, token, purchase, forceRevoke = false) {
  const status = assessPurchase(purchase, uid);
  if (status === 'wrong-account' || status === 'wrong-product') throw new HttpsError('permission-denied', 'This purchase belongs to a different account or product.');
  if (status === 'pending') return { active: false, pending: true };
  const tokenHash = hash(token);
  const purchaseRef = db.doc(`playPurchases/${tokenHash}`);
  const entitlementRef = uid ? db.doc(`proEntitlements/${uid}`) : null;
  let active = status === 'active' && !forceRevoke;
  await db.runTransaction(async tx => {
    const existing = await tx.get(purchaseRef);
    let entitlement = null;
    if (uid) {
      const [currentEntitlement, deletion] = await Promise.all([
        tx.get(entitlementRef), tx.get(db.doc(`accountDeletions/${uid}`)),
      ]);
      entitlement = currentEntitlement;
      if (deletion.exists) throw new HttpsError('failed-precondition', 'Account deletion is pending.');
      if (existing.exists && existing.data().uid && existing.data().uid !== uid) throw new HttpsError('permission-denied', 'Purchase already linked to another account.');
    }
    const revoked = forceRevoke || existing.data()?.revoked === true;
    if (revoked) active = false;
    tx.set(purchaseRef, { ...(existing.data() || {}), ...(uid ? { uid } : {}), token, active, revoked, productId: PRODUCT_ID, checkedAt: FieldValue.serverTimestamp() });
    // An old refunded token cannot revoke a later valid purchase.
    if (uid && (active || entitlement.data()?.tokenHash === tokenHash)) {
      tx.set(entitlementRef, { active, tokenHash, source: 'google-play', updatedAt: FieldValue.serverTimestamp() });
    }
  });
  if (active && purchase.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
    const client = await google.getClient();
    await client.request({ method: 'POST', url: `${publisherUrl}/products/${PRODUCT_ID}/tokens/${encodeURIComponent(token)}:acknowledge`, data: {} });
  }
  return { active, pending: false };
}

exports.verifyProPurchase = onCall(options, async request => {
  const token = request.data?.purchaseToken;
  if (typeof token !== 'string' || !token || token.length > 4096) throw new HttpsError('invalid-argument', 'A purchase token is required.');
  try {
    // This endpoint is accountless. Google Play's verified purchase token is
    // the ownership proof; Calc/Firebase sign-in is not required.
    return await recordPurchase(null, token, await readPurchase(token));
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    // Do not log Google request objects: they contain purchase tokens.
    throw new HttpsError('unavailable', 'Purchase verification is unavailable. Restore purchases to retry.');
  }
});

exports.playBillingNotification = onMessagePublished({ ...options, topic: 'calc-play-billing', retry: true }, async event => {
  const message = event.data.message.json;
  if (message.packageName !== PACKAGE_NAME || message.testNotification) return;
  const token = message.oneTimeProductNotification?.purchaseToken || message.voidedPurchaseNotification?.purchaseToken;
  if (!token) return;
  const purchase = await readPurchase(token);
  let uid = null;
  if (/^[a-f0-9]{64}$/.test(purchase.obfuscatedExternalAccountId || '')) {
    const binding = await db.doc(`billingAccounts/${purchase.obfuscatedExternalAccountId}`).get();
    uid = binding.data()?.uid || null;
    if (uid && (await db.doc(`accountDeletions/${uid}`).get()).exists) return;
  }
  await recordPurchase(uid, token, purchase, !!message.voidedPurchaseNotification);
});
