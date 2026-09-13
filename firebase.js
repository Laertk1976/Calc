import { getApp, getApps, initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyDkqGtpLve9PMxRIK888Be6IK-AEeU_g00',
  authDomain: 'calc-7271f.firebaseapp.com',
  projectId: 'calc-7271f',
  storageBucket: 'calc-7271f.firebasestorage.app',
  messagingSenderId: '251291907207',
  appId: '1:251291907207:web:526ecc45599af8c1def422',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
