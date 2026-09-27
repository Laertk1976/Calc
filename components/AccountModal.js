import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Pressable from './SoundPressable';
import ButtonLabel from './ButtonLabel';
import KeyboardModalFrame from './KeyboardModalFrame';
import useCalculatorStyles from '../useCalculatorStyles';
import { deleteCurrentAccount } from '../accountDeletion';

export default function AccountModal({ visible, user, deletionPending, onClose, onSignOut, onDeleted }) {
  const { t } = useTranslation();
  const styles = useCalculatorStyles();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const supportsPassword = user?.providerData?.some(item => item.providerId === 'password');
  const supportsGoogle = user?.providerData?.some(item => item.providerId === 'google.com');
  useEffect(() => {
    if (visible) { setConfirming(Boolean(deletionPending)); setPassword(''); setError(''); }
  }, [visible]);
  const close = () => { if (!running.current) { setPassword(''); onClose(); } };
  const remove = async provider => {
    if (running.current) return;
    running.current = true;
    setBusy(true); setError('');
    try {
      if (await deleteCurrentAccount(user, password, provider)) onDeleted();
    } catch (failure) {
      const code = String(failure.code || '');
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      setError(t(code === 'auth/user-mismatch' ? 'Use the Google account shown above.'
        : ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(code) ? 'The password is incorrect.'
        : 'Deletion could not finish. Check your connection and try again. If deletion has started, saving and sync stay paused until you finish.'));
    } finally {
      setPassword(''); setBusy(false); running.current = false;
    }
  };
  if (!user) return null;
  return <Modal transparent animationType="fade" visible={visible} onRequestClose={close}>
    <KeyboardModalFrame style={styles.modalBackdrop}>
      <View style={[styles.authPanel, { maxHeight: '95%' }]}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={styles.listTitle}>{t(confirming ? 'Delete your Calc account?' : 'Account')}</Text>
          <Text selectable style={[styles.authHint, { color: '#e2e8f0' }]}>{user.email}</Text>
          {confirming ? <>
            <Text style={[styles.authHint, { color: '#e2e8f0' }]}>{t('This permanently deletes your Calc sign-in account, synced calculations, debts, invoices, payments and edit history, including deleted records. This cannot be undone.')}</Text>
            <Text style={[styles.authHint, { color: '#e2e8f0' }]}>{t('Account records and queued changes on this device are also removed. Guest records, copies on other offline devices, Android backups and exported files are not removed by this action.')}</Text>
            <Text style={[styles.authHint, { color: '#e2e8f0' }]}>{t('A minimal account ID and deletion timestamp are retained to block old devices from uploading deleted records again.')}</Text>
            <Text style={styles.authHint}>{t('Confirm your identity to delete. Your Google account itself will not be deleted.')}</Text>
            {supportsPassword && <TextInput accessibilityLabel={t('Password')} placeholder={t('Password')} placeholderTextColor="#94a3b8" secureTextEntry autoCapitalize="none" autoCorrect={false} value={password} onChangeText={setPassword} editable={!busy} style={styles.authInput} />}
            {error ? <Text accessibilityRole="alert" style={styles.authHint}>{error}</Text> : null}
            {busy ? <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}><ActivityIndicator color="#f8fafc" /><Text style={styles.authButtonText}>{t('Deleting account...')}</Text></View> : null}
            {supportsPassword && <Pressable accessibilityRole="button" disabled={busy || !password} onPress={() => remove('password')} style={[styles.authActionButton, styles.utilityKeyRed, { marginBottom: 10 }, (busy || !password) && styles.disabledButton]}>
              <ButtonLabel style={styles.closeButtonText}>{t('Delete permanently')}</ButtonLabel>
            </Pressable>}
            {supportsGoogle && <Pressable accessibilityRole="button" disabled={busy} onPress={() => remove('google.com')} style={[styles.authActionButton, styles.utilityKeyRed, { marginBottom: 10 }, busy && styles.disabledButton]}>
              <ButtonLabel style={styles.closeButtonText}>{t('Confirm with Google and delete')}</ButtonLabel>
            </Pressable>}
            {!supportsGoogle && !supportsPassword && <Text style={styles.authHint}>{t('For deletion help, email laertkarap@gmail.com. Never send your password.')}</Text>}
          </> : <>
            <Pressable accessibilityRole="button" onPress={() => { close(); onSignOut(); }} style={[styles.authActionButton, styles.authModeButton, { marginBottom: 10 }]}>
              <ButtonLabel style={styles.closeButtonText}>{t('Sign out')}</ButtonLabel>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setConfirming(true)} style={[styles.authActionButton, styles.utilityKeyRed, { marginBottom: 10 }]}>
              <ButtonLabel style={styles.closeButtonText}>{t('Delete account')}</ButtonLabel>
            </Pressable>
          </>}
          {deletionPending && <Text accessibilityRole="alert" style={styles.authHint}>{t('Account deletion is pending. Open Account to finish deletion.')}</Text>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={[styles.authActionButton, styles.cancelButton, busy && styles.disabledButton]}>
            <ButtonLabel style={styles.closeButtonText}>{t('Close')}</ButtonLabel>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardModalFrame>
  </Modal>;
}
