import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import KeyboardModalFrame from './KeyboardModalFrame';
import { auth, isFirebaseConfigured } from '../authClient';
import useCalculatorStyles from '../useCalculatorStyles';
import { isGoogleSignInConfigured, signInWithGoogle } from '../googleSignIn';

export default function AuthModal({ visible, user, onClose }) {
  const styles = useCalculatorStyles();
  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const googleAuthReady = isFirebaseConfigured && isGoogleSignInConfigured;

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
      const signedIn = await signInWithGoogle();
      if (!signedIn) return;
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
      <KeyboardModalFrame style={styles.modalBackdrop}>
          <View style={[styles.authPanel, { maxHeight: '100%', flexShrink: 1 }]}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
            <Text style={styles.listTitle}>Sign in</Text>
            {!isFirebaseConfigured ? (
              <Text style={styles.authHint}>Add the Firebase configuration values to your .env file to enable account sign-in.</Text>
            ) : null}
            <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#94a3b8" autoCapitalize="none" keyboardType="email-address" style={styles.authInput} />
            <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#94a3b8" secureTextEntry style={styles.authInput} />
            </ScrollView>
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
            <Pressable onPress={onClose} style={[styles.authActionButton, styles.cancelButton, { flexShrink: 0 }]}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </Pressable>
          </View>
      </KeyboardModalFrame>
    </Modal>
  );
}
