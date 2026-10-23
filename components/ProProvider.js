import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
/* Old signed-in entitlement sync retained for future use:
import { onIdTokenChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../authClient';
*/
import { isTrialActive, localDay, trialDaysRemaining } from '../proAccess';

const ProContext = createContext(null);
export const usePro = () => useContext(ProContext);

export default function ProProvider({ children }) {
  const [paidAccess, setPaidAccess] = useState({ active: false, checkedAt: 0, expiresAt: 0 });
  const [today, setToday] = useState(() => localDay(new Date()));
  const [trialStartedAt, setTrialStartedAt] = useState(null);
  const [trialReady, setTrialReady] = useState(false);
  const [trialNow, setTrialNow] = useState(() => Date.now());
  const [paywall, setPaywall] = useState(false);
  const inTrial = trialReady && isTrialActive(trialStartedAt, trialNow);
  const hasPro = inTrial || (paidAccess.active && paidAccess.expiresAt > trialNow);
  const setPurchasedPro = useCallback(async (active, verified = false) => {
    if (!verified) return;
    const checkedAt = Date.now();
    const next = { active: !!active, checkedAt, expiresAt: checkedAt + 7 * 24 * 60 * 60 * 1000 };
    setPaidAccess(next);
    try { await AsyncStorage.setItem('calc.pro.purchase.v1', JSON.stringify(next)); } catch { /* Keep the in-memory verification for this session. */ }
  }, []);
  useEffect(() => {
    let active = true;
    const key = 'calc.pro.trial.start.v1';
    void AsyncStorage.getItem(key).then(async value => {
      let startedAt = Number(value);
      if (!Number.isFinite(startedAt) || startedAt <= 0) {
        startedAt = Date.now();
        await AsyncStorage.setItem(key, String(startedAt));
      }
      if (active) { setTrialStartedAt(startedAt); setTrialReady(true); }
    }).catch(() => { if (active) setTrialReady(true); });
    void AsyncStorage.getItem('calc.pro.purchase.v1').then(value => {
      const cached = JSON.parse(value || 'null');
      if (active && cached?.active === true && Number.isFinite(cached.checkedAt) && cached.checkedAt > 0 && cached.checkedAt <= Date.now()) {
        setPaidAccess({ active: true, checkedAt: cached.checkedAt, expiresAt: cached.checkedAt + 7 * 24 * 60 * 60 * 1000 });
      }
    }).catch(() => {});
    const tick = () => {
      setToday(localDay(new Date()));
      setTrialNow(Date.now());
      setPaidAccess(current => current.active && current.expiresAt <= Date.now() ? { ...current, active: false } : current);
    };
    const timer = setInterval(tick, 60000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') tick(); });
    return () => { active = false; clearInterval(timer); listener.remove(); };
  }, []);
  /* Old account-bound purchase entitlement listener retained for future use:
  useEffect(() => {
    if (!auth) { setAccess({ uid: null, active: false, loading: false }); return; }
    let stop = () => {};
    const unsubscribe = onIdTokenChanged(auth, async user => {
      const run = ++generation.current;
      stop(); stop = () => {};
      const account = user?.uid || null;
      // Token refreshes on resume must not unmount the open Pro screen.
      // Keep this account's unexpired access until fresh evidence replaces it.
      const retainAccess = current => !!account && current.uid === account
        && current.active && current.expiresAt > Date.now();
      setAccess(current => retainAccess(current)
        ? current : { uid: account, active: false, loading: !!account });
      if (!account) return;
      const key = `calc.pro.v1.${account}`;
      let authoritative = false;
      const publish = (active, persist = false, checkedAt = Date.now(), fallback = false) => {
        if (generation.current !== run) return;
        setAccess(current => fallback && retainAccess(current) ? current
          : { uid: account, active, loading: false, expiresAt: checkedAt + 7 * 24 * 60 * 60 * 1000 });
        if (persist) void AsyncStorage.setItem(key, JSON.stringify({ uid: account, active, checkedAt: Date.now() })).catch(() => {});
      };
      try {
        const cached = JSON.parse(await AsyncStorage.getItem(key));
        if (!authoritative) publish(cachedProAccess(cached, account), false, cached?.checkedAt || 0, true);
      } catch { publish(false, false, 0, true); }
      if (generation.current !== run) return;
      try {
        const result = await user.getIdTokenResult();
        if (generation.current !== run) return;
        if (result.claims.calcOwner === true) { authoritative = true; publish(true, true); return; }
      } catch { // Retain recently verified access while offline.
      }
      if (generation.current !== run) return;
      stop = onSnapshot(doc(db, 'proEntitlements', account), snapshot => {
        if (snapshot.metadata.fromCache) return;
        authoritative = true;
        publish(snapshot.data()?.active === true, true);
      }, () => { // Cached access expires on the next refresh.
      });
    });
    const refresh = AppState.addEventListener('change', state => {
      if (state === 'active') void auth.currentUser?.getIdToken(true).catch(() => {});
    });
    void auth.currentUser?.getIdToken(true).catch(() => {});
    return () => { generation.current++; unsubscribe(); stop(); refresh.remove(); };
  }, []);
  */
  const requirePro = () => {
    if (!trialReady || hasPro) return true;
    setPaywall(true);
    return false;
  };
  return <ProContext.Provider value={{ hasPro, inTrial, trialDaysLeft: trialDaysRemaining(trialStartedAt, trialNow), loading: !trialReady, today, paywall, setPaywall, setPurchasedPro, requirePro }}>{children}</ProContext.Provider>;
}
