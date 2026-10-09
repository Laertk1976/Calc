import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onIdTokenChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../authClient';
import { cachedProAccess, localDay } from '../proAccess';

const ProContext = createContext(null);
export const usePro = () => useContext(ProContext);

export default function ProProvider({ children }) {
  const [access, setAccess] = useState({ uid: null, active: false, loading: true });
  const [today, setToday] = useState(() => localDay(new Date()));
  const [paywall, setPaywall] = useState(false);
  const generation = useRef(0);
  const uid = auth?.currentUser?.uid || null;
  const hasPro = !!uid && access.uid === uid && access.active;
  useEffect(() => {
    const tick = () => {
      setToday(localDay(new Date()));
      setAccess(current => current.active && current.expiresAt <= Date.now() ? { ...current, active: false } : current);
    };
    const timer = setInterval(tick, 1000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') tick(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  useEffect(() => {
    if (!auth) { setAccess({ uid: null, active: false, loading: false }); return; }
    let stop = () => {};
    const unsubscribe = onIdTokenChanged(auth, async user => {
      const run = ++generation.current;
      stop(); stop = () => {};
      const account = user?.uid || null;
      setAccess({ uid: account, active: false, loading: !!account });
      if (!account) return;
      const key = `calc.pro.v1.${account}`;
      let authoritative = false;
      const publish = (active, persist = false, checkedAt = Date.now()) => {
        if (generation.current !== run) return;
        setAccess({ uid: account, active, loading: false, expiresAt: checkedAt + 7 * 24 * 60 * 60 * 1000 });
        if (persist) void AsyncStorage.setItem(key, JSON.stringify({ uid: account, active, checkedAt: Date.now() })).catch(() => {});
      };
      try {
        const cached = JSON.parse(await AsyncStorage.getItem(key));
        if (!authoritative) publish(cachedProAccess(cached, account), false, cached?.checkedAt || 0);
      } catch { publish(false); }
      if (generation.current !== run) return;
      try {
        const result = await user.getIdTokenResult();
        if (generation.current !== run) return;
        if (result.claims.calcOwner === true) { authoritative = true; publish(true, true); return; }
      } catch { /* Retain recently verified access while offline. */ }
      if (generation.current !== run) return;
      stop = onSnapshot(doc(db, 'proEntitlements', account), snapshot => {
        if (snapshot.metadata.fromCache) return;
        authoritative = true;
        publish(snapshot.data()?.active === true, true);
      }, () => { /* Cached access expires on the next refresh. */ });
    });
    const refresh = AppState.addEventListener('change', state => {
      if (state === 'active') void auth.currentUser?.getIdToken(true).catch(() => {});
    });
    void auth.currentUser?.getIdToken(true).catch(() => {});
    return () => { generation.current++; unsubscribe(); stop(); refresh.remove(); };
  }, []);
  const requirePro = () => {
    if (hasPro) return true;
    setPaywall(true);
    return false;
  };
  return <ProContext.Provider value={{ hasPro, loading: access.loading, today, paywall, setPaywall, requirePro }}>{children}</ProContext.Provider>;
}
