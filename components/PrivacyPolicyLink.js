import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Pressable from './SoundPressable';
import { privacyPolicyUrl } from '../privacyPolicy';

export { PRIVACY_POLICY_URL } from '../privacyPolicy';

export default function PrivacyPolicyLink() {
  const { t, i18n } = useTranslation();
  const url = privacyPolicyUrl(i18n.resolvedLanguage);
  const [failed, setFailed] = useState(false);
  const open = async () => {
    setFailed(false);
    try { await Linking.openURL(url); }
    catch { setFailed(true); }
  };
  return <View style={{ marginVertical: 8 }}>
    <Pressable accessibilityRole="link" onPress={open} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      <Text style={{ color: '#93c5fd', fontSize: 14, textDecorationLine: 'underline' }}>{t('Privacy policy')}</Text>
    </Pressable>
    {failed && <Text selectable accessibilityRole="alert" style={{ color: '#e2e8f0', fontSize: 13 }}>{t('Open this address in your browser:')}{'\n'}{url}</Text>}
  </View>;
}
