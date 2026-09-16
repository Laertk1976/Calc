import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from './authClient';
import { applyCalculationChange, normalizeCalculation } from './calculationHistory';

const STORAGE_KEY = 'calculatorCalculations';

export async function getSavedCalculations(userId = null) {
  if (userId && db) {
    const calculationsQuery = query(
      collection(db, 'calculations'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(calculationsQuery);
    return snapshot.docs
      .map((item) => item.data().payload ? { ...item.data().payload, id: item.data().payload.id || item.data().payload.createdAt || item.id } : null)
      .filter(Boolean)
      .map(normalizeCalculation)
      .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime());
  }

  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  const calculations = JSON.parse(stored || '[]');
  if (!Array.isArray(calculations)) throw new Error('Saved calculations could not be read.');
  return calculations.map((row, index) => normalizeCalculation({ ...row, id: row.id || row.createdAt || `legacy-${index}` }));
}

export async function saveCalculation(expression, display, type = 'Add', titleOverride = '', userId = null) {
  const title = (titleOverride || '').trim();
  if (!title) return false;

  const savedAt = new Date().toISOString();
  const savedCalculation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: savedAt,
    savedAt,
    expression: expression || display,
    title: title.trim(),
    value: display,
    type,
  };
  if (userId && db) {
    await addDoc(collection(db, 'calculations'), {
      userId,
      payload: savedCalculation,
      createdAt: serverTimestamp(),
    });
    return true;
  }

  const savedCalculations = await getSavedCalculations(userId);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...savedCalculations, savedCalculation]));
  return true;
}

async function writeCalculations(calculations, userId = null) {
  if (userId && db) {
    const snapshot = await getDocs(query(collection(db, 'calculations'), where('userId', '==', userId)));
    const batch = writeBatch(db);
    snapshot.docs.forEach((item) => batch.delete(doc(db, 'calculations', item.id)));
    calculations.forEach((payload) => batch.set(doc(collection(db, 'calculations')), {
      userId,
      payload,
      createdAt: serverTimestamp(),
    }));
    await batch.commit();
    return;
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(calculations));
}

let pendingUpdate = Promise.resolve();
export function updateSavedCalculations(change, userId = null) {
  const update = pendingUpdate.catch(() => {}).then(async () => {
    const previous = await getSavedCalculations(userId);
    const calculations = applyCalculationChange(previous, change);
    await writeCalculations(calculations, userId);
    return calculations;
  });
  pendingUpdate = update;
  return update;
}

