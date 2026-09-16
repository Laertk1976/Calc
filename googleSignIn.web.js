import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './authClient';

export const isGoogleSignInConfigured = isFirebaseConfigured;

export async function signInWithGoogle() {
  await signInWithPopup(auth, new GoogleAuthProvider());
  return true;
}
