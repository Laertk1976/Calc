import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from './firebase';
import { PRO_PRODUCT_ID } from './proAccess';

const functions = getFunctions(firebaseApp, 'us-central1');
const verify = httpsCallable(functions, 'verifyProPurchase');
// The account-based billing endpoint remains available in the backend for the
// old signed-in build, but this local edition verifies purchases by Play token.
// const billingAccount = httpsCallable(functions, 'getProBillingAccount');

export default function useProBilling(visible, onEntitlementChange) {
  const [product, setProduct] = useState(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sdk = useRef(null);
  const mounted = useRef(true);
  const processing = useRef(new Map());
  const operation = useRef(false);
  const update = (setter, value) => { if (mounted.current) setter(value); };
  const fail = error => {
    const code = String(error?.code || '');
    if (/cancel/i.test(code)) update(setMessage, '');
    else if (/pending|deferred/i.test(code)) update(setMessage, 'Payment is pending. Pro unlocks after Google Play confirms it.');
    else if (/permission-denied/i.test(code)) update(setMessage, 'Google Play could not verify this purchase. Restore it and try again.');
    else update(setMessage, 'Purchases are unavailable. Please try again from the Google Play version.');
  };
  const processPurchase = async purchase => {
    if (purchase.productId !== PRO_PRODUCT_ID) return false;
    if (purchase.purchaseState === 'pending') {
      update(setMessage, 'Payment is pending. Pro unlocks after Google Play confirms it.');
      return false;
    }
    if (!purchase.purchaseToken) return false;
    const key = purchase.purchaseToken;
    if (processing.current.has(key)) return processing.current.get(key);
    const task = (async () => {
      const result = await verify({ purchaseToken: purchase.purchaseToken });
      // The backend acknowledges this non-consumable purchase. Never consume it.
      update(setMessage, result.data.active ? 'Pro is unlocked. Thank you!' : result.data.pending
        ? 'Payment is pending. Pro unlocks after Google Play confirms it.' : 'No active Pro purchase was found.');
      onEntitlementChange?.(result.data.active, true);
      return result.data.active;
    })();
    processing.current.set(key, task);
    try { return await task; } finally { processing.current.delete(key); }
  };
  const restore = async (silent = false) => {
    if (!sdk.current || operation.current) return;
    operation.current = true;
    if (!silent) { update(setBusy, true); update(setMessage, ''); }
    try {
      const purchases = (await sdk.current.getAvailablePurchases()).filter(p => p.productId === PRO_PRODUCT_ID);
      for (const purchase of purchases) await processPurchase(purchase);
      if (!purchases.length) onEntitlementChange?.(false, true);
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
  useEffect(() => { setMessage(''); if (ready) void restore(true); }, [ready]);
  useEffect(() => { if (visible) void retry(); }, [visible]);
  const buy = async () => {
    if (!product || !ready || operation.current) return;
    operation.current = true;
    setBusy(true); setMessage('');
    try {
      await sdk.current.requestPurchase({ type: 'in-app', request: { google: { skus: [PRO_PRODUCT_ID] } } });
    } catch (error) { fail(error); }
    finally { operation.current = false; update(setBusy, false); }
  };
  return { price: product?.displayPrice, busy, message, buy, restore: () => restore(false), retry, available: ready && !!product };
}
