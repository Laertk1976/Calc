import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from './authClient';

const STORAGE_KEY = 'calculatorCalculations';

export async function getSavedCalculations(userId = null) {
  if (userId && db) {
    const calculationsQuery = query(
      collection(db, 'calculations'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(calculationsQuery);
    return snapshot.docs
      .map((item) => item.data().payload)
      .filter(Boolean)
      .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime());
  }

  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const calculations = JSON.parse(stored || '[]');
    return Array.isArray(calculations) ? calculations : [];
  } catch {
    return [];
  }
}

export async function saveCalculation(expression, display, type = 'Add', titleOverride = '', userId = null) {
  const title = (titleOverride || '').trim();
  if (!title) return false;

  const savedAt = new Date().toISOString();
  const savedCalculation = {
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

export async function updateSavedCalculations(calculations, userId = null) {
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

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(calculations));
  } catch (error) {
    console.log('Storage update error:', error);
  }
}

