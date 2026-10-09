import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Pressable from './SoundPressable';
import PrivacyPolicyLink from './PrivacyPolicyLink';
import KeyboardModalFrame from './KeyboardModalFrame';
import { usePro } from './ProProvider';
import useProBilling from '../useProBilling';

export default function ProModal({ user, onSignIn }) {
  const { t } = useTranslation();
  const { hasPro, paywall, setPaywall } = usePro();
  const billing = useProBilling(user, paywall);
  const button = (label, action, disabled = false, primary = false) => <Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={[s.button, primary && s.primary, disabled && { opacity: 0.5 }]}><Text style={s.buttonText}>{label}</Text></Pressable>;
  return <Modal transparent animationType="fade" visible={paywall} onRequestClose={() => setPaywall(false)}>
    <KeyboardModalFrame style={s.backdrop}>
      <View style={s.panel}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={s.title}>{t(hasPro ? 'Pro is active' : 'Unlock Calc Pro')}</Text>
          <Text style={s.subtitle}>{t('One-time purchase. No subscription.')}</Text>
          <Text style={s.text}>{t('Table, search and calendar')}{'\n'}{t('Access records from every date')}{'\n'}{t('Edit, pay off and delete records')}</Text>
          <Text style={s.note}>{t('Free access includes calculations, adding records and today’s List. Older records stay saved.')}</Text>
          {!!user && <Text style={s.note}>{user.email}</Text>}
          {!hasPro && <>
            {billing.price && <Text style={s.price}>{billing.price}</Text>}
            {!user ? button(t('Sign in to buy or restore Pro'), onSignIn, billing.busy, true)
              : <>
                {button(billing.busy ? t('Please wait...') : billing.price ? t('Buy Pro — {{price}}', { price: billing.price }) : t('Buy Pro'), billing.buy, billing.busy || !billing.available, true)}
                {button(t('Restore purchases'), billing.restore, billing.busy)}
                {!billing.available && button(t('Try again'), billing.retry, billing.busy)}
              </>}
          </>}
          {!!billing.message && !hasPro && <Text accessibilityRole="alert" style={s.note}>{t(billing.message)}</Text>}
          <PrivacyPolicyLink />
          {button(t('Close'), () => setPaywall(false))}
        </ScrollView>
      </View>
    </KeyboardModalFrame>
  </Modal>;
}
const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0009' },
  panel: { width: '100%', maxWidth: 440, maxHeight: '90%', alignSelf: 'center', backgroundColor: '#0f172a', padding: 24, borderRadius: 20 },
  title: { color: '#f8fafc', fontSize: 26, fontWeight: '700', marginBottom: 10 },
  subtitle: { color: '#86efac', fontSize: 16, marginBottom: 24 },
  text: { color: '#f8fafc', fontSize: 17, lineHeight: 30, marginBottom: 16 },
  note: { color: '#cbd5e1', fontSize: 14, lineHeight: 21, marginBottom: 16 },
  price: { color: '#f8fafc', fontSize: 30, fontWeight: '700', marginBottom: 16 },
  button: { backgroundColor: '#334155', borderRadius: 10, padding: 14, marginBottom: 10, minHeight: 48, justifyContent: 'center' },
  primary: { backgroundColor: '#166534' },
  buttonText: { color: '#f8fafc', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
