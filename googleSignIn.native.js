import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './authClient';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export const isGoogleSignInConfigured = Boolean(webClientId);

export async function signInWithGoogle() {
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

  const credential = GoogleAuthProvider.credential(response.data.idToken);
  await signInWithCredential(auth, credential);
  return true;
}
