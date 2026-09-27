import { GoogleAuthProvider, reauthenticateWithCredential, signInWithCredential } from 'firebase/auth';
import { auth } from './authClient';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export const isGoogleSignInConfigured = Boolean(webClientId);

async function getGoogleCredential() {
  if (!webClientId) {
    throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not configured.');
  }

  let googleSignIn;
  try {
    googleSignIn = await import('@react-native-google-signin/google-signin');
  } catch {
    throw new Error('Google sign-in requires a rebuilt development app and is not available in Expo Go.');
  }

  const { GoogleSignin, isSuccessResponse } = googleSignIn;
  GoogleSignin.configure({ webClientId, scopes: ['email', 'profile'] });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') return false;
  if (!isSuccessResponse(response) || !response.data.idToken) {
    throw new Error('Google did not return an ID token.');
  }

  return GoogleAuthProvider.credential(response.data.idToken);
}

export async function signInWithGoogle() {
  const credential = await getGoogleCredential();
  if (!credential) return false;
  await signInWithCredential(auth, credential);
  return true;
}

export async function reauthenticateWithGoogle(user) {
  const credential = await getGoogleCredential();
  if (!credential) return false;
  await reauthenticateWithCredential(user, credential);
  return true;
}
