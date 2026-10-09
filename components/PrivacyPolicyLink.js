import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Pressable from './SoundPressable';

export const PRIVACY_POLICY_URL = 'https://calc-7271f-account.web.app/privacy';

export default function PrivacyPolicyLink() {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const open = async () => {
    setFailed(false);
    try { await Linking.openURL(PRIVACY_POLICY_URL); }
    catch { setFailed(true); }
  };
  return <View style={{ marginVertical: 8 }}>
    <Pressable accessibilityRole="link" onPress={open} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      <Text style={{ color: '#93c5fd', fontSize: 14, textDecorationLine: 'underline' }}>{t('Privacy policy')}</Text>
    </Pressable>
    {failed && <Text selectable accessibilityRole="alert" style={{ color: '#e2e8f0', fontSize: 13 }}>{t('Open this address in your browser:')}{'\n'}{PRIVACY_POLICY_URL}</Text>}
  </View>;
}
