import { useState } from 'react';
import { Linking, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import Pressable from './SoundPressable';
import { privacyPolicyUrl } from '../privacyPolicy';
import { termsOfUseUrl } from '../termsOfUse';

export default function LegalLinks() {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const privacyUrl = privacyPolicyUrl(i18n.resolvedLanguage);
  const termsUrl = termsOfUseUrl(i18n.resolvedLanguage);
  const [failedUrl, setFailedUrl] = useState('');
  const open = url => async () => {
    setFailedUrl('');
    try { await Linking.openURL(url); }
    catch { setFailedUrl(url); }
  };
  return <View style={{ marginVertical: 8 }}>
    <View style={{ flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'stretch' : 'center', justifyContent: 'center', gap: compact ? 0 : 12 }}>
      <Pressable accessibilityRole="link" onPress={open(privacyUrl)} style={{ minHeight: 44, width: compact ? '100%' : undefined, alignItems: compact ? 'flex-start' : 'center', justifyContent: 'center', padding: 8 }}>
        <Text style={{ color: '#93c5fd', fontSize: 14, textDecorationLine: 'underline' }}>{t('Privacy policy')}</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={open(termsUrl)} style={{ minHeight: 44, width: compact ? '100%' : undefined, alignItems: compact ? 'flex-start' : 'center', justifyContent: 'center', padding: 8 }}>
        <Text style={{ color: '#93c5fd', fontSize: 14, textDecorationLine: 'underline' }}>{t('Terms of use')}</Text>
      </Pressable>
    </View>
    {failedUrl ? <Text selectable accessibilityRole="alert" style={{ color: '#e2e8f0', fontSize: 13 }}>{t('Open this address in your browser:')}{'\n'}{failedUrl}</Text> : null}
  </View>;
}
