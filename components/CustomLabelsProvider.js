import { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CustomLabelsContext = createContext(null);
const storageKey = 'calculator.customLabels';
export const customLabelKeys = ['Cred', 'Fact', 'Fcash'];

export default function CustomLabelsProvider({ children }) {
  const [settings, setSettings] = useState({ active: false, labels: {} });
  const [editable, setEditable] = useState([]);
  const [revision, setRevision] = useState(0);
  const changed = useRef(false);
  const pendingSave = useRef(Promise.resolve());
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey).then(value => {
      if (!mounted || changed.current || !value) return;
      const saved = JSON.parse(value);
      const labels = Object.fromEntries(customLabelKeys.map(key => [key,
        typeof saved.labels?.[key] === 'string' ? saved.labels[key].trim().slice(0, 30) : '',
      ]));
      setSettings({ active: saved.active === true, labels });
    }).catch(() => {}).finally(() => { if (mounted) setLoaded(true); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    pendingSave.current = pendingSave.current.catch(() => {}).then(() => AsyncStorage.setItem(storageKey, JSON.stringify(settings)));
    pendingSave.current.catch(() => {});
  }, [loaded, settings]);
  const chooseCustom = () => {
    changed.current = true;
    setSettings(current => ({ ...current, active: true }));
    setEditable(customLabelKeys);
    setRevision(value => value + 1);
  };
  const chooseStandard = () => {
    changed.current = true;
    setSettings(current => ({ ...current, active: false }));
    setEditable([]);
    setRevision(value => value + 1);
  };
  const confirmLabel = (key, value) => {
    const label = value.trim().slice(0, 30);
    if (!customLabelKeys.includes(key) || !label) return false;
    changed.current = true;
    setSettings(current => ({ ...current, labels: { ...current.labels, [key]: label } }));
    setEditable(current => current.filter(item => item !== key));
    return true;
  };
  return <CustomLabelsContext.Provider value={{ ...settings, editable, revision, chooseCustom, chooseStandard, confirmLabel }}>
    {children}
  </CustomLabelsContext.Provider>;
}

export const useCustomLabels = () => useContext(CustomLabelsContext);
