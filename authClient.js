import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseApp } from './firebase';

export const isFirebaseConfigured = true;
let firebaseAuth = null;
let firestore = null;

try {
  firebaseAuth = initializeAuth(firebaseApp, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  firebaseAuth = getAuth(firebaseApp);
}
firestore = getFirestore(firebaseApp);

export const auth = firebaseAuth;
export const db = firestore;
