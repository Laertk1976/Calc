import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDocsFromServer, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { db } from './authClient';
import { createOfflineCalculationStore, mergeRemoteCalculation } from './offlineCalculationStore';

export const calculationStore = createOfflineCalculationStore({
  storage: AsyncStorage,
  remote: {
    async list(userId) {
      const snapshot = await getDocsFromServer(query(collection(db, 'calculations'), where('userId', '==', userId)));
      return snapshot.docs.filter((item) => item.data().payload).map((item) => {
        const row = item.data().payload;
        return { docId: item.id, row: { ...row, id: row.id || row.createdAt || item.id } };
      });
    },
    async push(userId, operation, existingId) {
      const ref = doc(db, 'calculations', existingId || `local-${encodeURIComponent(userId)}-${encodeURIComponent(operation.rowId)}`);
      return runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (snapshot.exists() && snapshot.data().userId !== userId) throw new Error('This calculation belongs to another account.');
        if (snapshot.exists() && snapshot.data().lastOperation === operation.id) return { docId: ref.id, row: snapshot.data().payload };
        const row = mergeRemoteCalculation(snapshot.exists() ? snapshot.data().payload : null, operation);
        transaction.set(ref, { userId, payload: row, lastOperation: operation.id, updatedAt: serverTimestamp() });
        return { docId: ref.id, row };
      });
    },
  },
});

export const getSavedCalculations = (userId = null) => calculationStore.getRows(userId);
export function syncCalculations(userId) {
  return calculationStore.sync(userId).catch(() => {});
}
export async function updateSavedCalculations(change, userId = null) {
  const rows = await calculationStore.change(change, userId);
  void syncCalculations(userId);
  return rows;
}
export async function saveCalculation(expression, display, type = 'Add', titleOverride = '', userId = null) {
  const title = titleOverride.trim();
  if (!title) return false;
  const savedAt = new Date().toISOString();
  await updateSavedCalculations({ type: 'add', row: {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: savedAt, savedAt, expression: expression || display, title, value: display, type,
  } }, userId);
  return true;
}
