import { makeRedirectUri } from 'expo-auth-session';
import { useIdTokenAuthRequest } from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithCredential, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { auth, isFirebaseConfigured } from '../authClient';
import { styles } from '../calculatorStyles';

const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const nativeGoogleRedirectUri = androidClientId
  ? `com.googleusercontent.apps.${androidClientId.replace(/\.apps\.googleusercontent\.com$/, '')}:/oauthredirect`
  : undefined;
const redirectUri = Platform.OS === 'android'
  ? nativeGoogleRedirectUri
  : makeRedirectUri({ scheme: 'com.example.calc' });

export default function AuthModal({ visible, user, onClose }) {
  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleRequest, , promptGoogleLogin] = useIdTokenAuthRequest({
    androidClientId,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    redirectUri,
    scopes: ['profile', 'email'],
  });
  const googleAuthReady = Platform.OS === 'web' ? isFirebaseConfigured : Boolean(googleRequest);

  useEffect(() => {
    if (visible) {
      setEmail('');
      setPassword('');
      setMode('signIn');
    }
  }, [visible]);

  const handleEmailAuth = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert('Check your details', 'Enter an email and a password with at least 6 characters.');
      return;
    }

    setBusy(true);
    const result = mode === 'signIn'
      ? await signInWithEmailAndPassword(auth, email.trim(), password)
      : await createUserWithEmailAndPassword(auth, email.trim(), password);
    setBusy(false);

    if (!result?.user) {
      Alert.alert('Sign-in failed', 'Firebase did not return an account.');
      return;
    }
    onClose();
  };

  const handleGoogleAuth = async () => {
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } else {
        const result = await promptGoogleLogin();
        if (result?.type !== 'success' || !result.authentication?.idToken) {
          if (result?.type !== 'cancel' && result?.type !== 'dismiss') Alert.alert('Google sign-in failed', 'Google did not return an ID token.');
          return;
        }
        const credential = GoogleAuthProvider.credential(result.authentication.idToken, result.authentication.accessToken);
        await signInWithCredential(auth, credential);
      }
      onClose();
    } catch (error) {
      Alert.alert('Google sign-in failed', error.message || 'Google sign-in could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  if (user) return null;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalBackdrop}>
          <View style={styles.authPanel}>
            <Text style={styles.listTitle}>Sign in</Text>
            {!isFirebaseConfigured ? (
              <Text style={styles.authHint}>Add the Firebase configuration values to your .env file to enable account sign-in.</Text>
            ) : null}
            <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#94a3b8" autoCapitalize="none" keyboardType="email-address" style={styles.authInput} />
            <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#94a3b8" secureTextEntry style={styles.authInput} />
            <View style={styles.authActions}>
              <Pressable disabled={busy || !isFirebaseConfigured} onPress={handleEmailAuth} style={({ pressed }) => [styles.authActionButton, styles.authEmailButton, (busy || !isFirebaseConfigured) && styles.disabledButton, pressed && styles.pressed]}>
                <Text style={styles.closeButtonText}>{mode === 'signIn' ? 'Sign in' : 'Create account'}</Text>
              </Pressable>
              <Pressable disabled={busy || !isFirebaseConfigured || !googleAuthReady} onPress={handleGoogleAuth} style={({ pressed }) => [styles.authActionButton, styles.googleButton, (busy || !isFirebaseConfigured || !googleAuthReady) && styles.disabledButton, pressed && styles.pressed]}>
                <Text style={styles.closeButtonText}>Continue with Google</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setMode((current) => current === 'signIn' ? 'signUp' : 'signIn')} style={styles.authModeButton}>
              <Text style={styles.authModeText}>{mode === 'signIn' ? 'Create a new account' : 'Already have an account? Sign in'}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={[styles.authActionButton, styles.cancelButton]}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
