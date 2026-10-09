import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from './firebase';
import { auth } from './authClient';
import { PRO_PRODUCT_ID } from './proAccess';

const functions = getFunctions(firebaseApp, 'us-central1');
const verify = httpsCallable(functions, 'verifyProPurchase');
const billingAccount = httpsCallable(functions, 'getProBillingAccount');

export default function useProBilling(user, visible) {
  const [product, setProduct] = useState(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sdk = useRef(null);
  const mounted = useRef(true);
  const processing = useRef(new Map());
  const operation = useRef(false);
  const currentUid = useRef(user?.uid);
  currentUid.current = user?.uid;
  const update = (setter, value) => { if (mounted.current) setter(value); };
  const fail = error => {
    const code = String(error?.code || '');
    if (/cancel/i.test(code)) update(setMessage, '');
    else if (/pending|deferred/i.test(code)) update(setMessage, 'Payment is pending. Pro unlocks after Google Play confirms it.');
    else if (/permission-denied/i.test(code)) update(setMessage, 'Use the Calc account that originally bought Pro.');
    else update(setMessage, 'Purchases are unavailable. Please try again from the Google Play version.');
  };
  const processPurchase = async purchase => {
    const uid = currentUid.current;
    if (!uid || uid !== auth.currentUser?.uid || purchase.productId !== PRO_PRODUCT_ID) return false;
    if (purchase.purchaseState === 'pending') {
      update(setMessage, 'Payment is pending. Pro unlocks after Google Play confirms it.');
      return false;
    }
    if (!purchase.purchaseToken) return false;
    const key = `${uid}:${purchase.purchaseToken}`;
    if (processing.current.has(key)) return processing.current.get(key);
    const task = (async () => {
      const result = await verify({ purchaseToken: purchase.purchaseToken });
      if (currentUid.current !== uid) return false;
      // The backend acknowledges this non-consumable purchase. Never consume it.
      update(setMessage, result.data.active ? 'Pro is unlocked. Thank you!' : result.data.pending
        ? 'Payment is pending. Pro unlocks after Google Play confirms it.' : 'No active Pro purchase was found.');
      return result.data.active;
    })();
    processing.current.set(key, task);
    try { return await task; } finally { processing.current.delete(key); }
  };
  const restore = async (silent = false) => {
    if (!sdk.current || !currentUid.current || operation.current) return;
    const uid = currentUid.current;
    operation.current = true;
    if (!silent) { update(setBusy, true); update(setMessage, ''); }
    try {
      const purchases = (await sdk.current.getAvailablePurchases()).filter(p => p.productId === PRO_PRODUCT_ID);
      if (currentUid.current !== uid) return;
      for (const purchase of purchases) await processPurchase(purchase);
      if (!purchases.length && !silent) update(setMessage, 'No active Pro purchase was found.');
    } catch (error) { if (!silent) fail(error); }
    finally { operation.current = false; update(setBusy, false); }
  };
  const retry = async () => {
    if (!sdk.current) { update(setMessage, 'Purchases are unavailable. Please try again from the Google Play version.'); return; }
    try {
      await sdk.current.initConnection();
      update(setReady, true);
      const products = await sdk.current.fetchProducts({ skus: [PRO_PRODUCT_ID], type: 'in-app' });
      update(setProduct, products.find(p => p.id === PRO_PRODUCT_ID) || null);
      update(setMessage, products.length ? '' : 'Purchases are unavailable. Please try again from the Google Play version.');
    } catch (error) { fail(error); }
  };
  useEffect(() => {
    mounted.current = true;
    let success, failure;
    try {
      sdk.current = require('expo-iap');
      success = sdk.current.purchaseUpdatedListener(purchase => {
        void processPurchase(purchase).catch(fail).finally(() => { operation.current = false; update(setBusy, false); });
      });
      failure = sdk.current.purchaseErrorListener(error => { operation.current = false; update(setBusy, false); fail(error); });
      void retry();
    } catch (error) { fail(error); }
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void restore(true); });
    return () => {
      mounted.current = false;
      success?.remove(); failure?.remove(); foreground.remove();
      void sdk.current?.endConnection().catch(() => {});
    };
  }, []);
  useEffect(() => { setMessage(''); if (ready && user) void restore(true); }, [ready, user?.uid]);
  useEffect(() => { if (visible) void retry(); }, [visible]);
  const buy = async () => {
    if (!product || !ready || !user || operation.current) return;
    const uid = user.uid;
    operation.current = true;
    setBusy(true); setMessage('');
    try {
      const { data } = await billingAccount();
      if (currentUid.current !== uid || auth.currentUser?.uid !== uid) return;
      if (data.productId !== PRO_PRODUCT_ID) throw new Error('Product mismatch');
      await sdk.current.requestPurchase({ type: 'in-app', request: { google: { skus: [PRO_PRODUCT_ID], obfuscatedAccountId: data.accountId } } });
    } catch (error) { fail(error); }
    finally { operation.current = false; update(setBusy, false); }
  };
  return { price: product?.displayPrice, busy, message, buy, restore: () => restore(false), retry, available: ready && !!product };
}
