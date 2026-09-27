import { GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './authClient';

export const isGoogleSignInConfigured = isFirebaseConfigured;

export async function reauthenticateWithGoogle(user) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await reauthenticateWithPopup(user, provider);
  return true;
}

export async function signInWithGoogle() {
  await signInWithPopup(auth, new GoogleAuthProvider());
  return true;
}
