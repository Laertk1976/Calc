import { useRef, useState } from 'react';
import { Animated, Easing, Modal, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Pressable from './SoundPressable';
import { useTapSound } from './TapSoundProvider';
import { usePro } from './ProProvider';
import { useCustomLabels } from './CustomLabelsProvider';
import { languages, selectLanguage } from '../i18n';
import SyncStatus from './SyncStatus';
import PrivacyPolicyLink from './PrivacyPolicyLink';

export default function SettingsDrawer({ user, onOpenAuth, syncStatus, onRetrySync }) {
  const { t, i18n } = useTranslation();
  const { soundEnabled, toggleSound } = useTapSound();
  const { hasPro, setPaywall } = usePro();
  const custom = useCustomLabels();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(360, width - 24);
  const [open, setOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const selected = languages.find(item => item.code === i18n.resolvedLanguage) || languages[1];
  const animate = (value, done) => Animated.timing(progress, {
    toValue: value, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
  }).start(done);
  const close = action => {
    if (closing.current) return;
    closing.current = true;
    animate(0, () => { setOpen(false); setLanguageOpen(false); closing.current = false; action?.(); });
  };
  const row = (icon, label, action, detail) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={s.row}>
    <Ionicons name={icon} size={22} color="#a8caff" />
    <View style={s.label}><Text style={s.text}>{label}</Text>{!!detail && <Text numberOfLines={2} style={s.detail}>{detail}</Text>}</View>
    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
  </Pressable>;
  return <>
    <Pressable testID="open-settings" accessibilityRole="button" accessibilityLabel={t('Open menu')} accessibilityState={{ expanded: open }} onPress={() => { progress.setValue(0); setOpen(true); }} style={s.trigger}>
      <Ionicons name="menu" size={28} color="#f8fafc" />
    </Pressable>
    <Modal transparent visible={open} animationType="none" onShow={() => animate(1)} onRequestClose={() => close()}>
      <View style={s.overlay}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) }]} />
        <Pressable silent accessibilityRole="button" accessibilityLabel={t('Close menu')} onPress={() => close()} style={StyleSheet.absoluteFillObject} />
        <Animated.View testID="settings-drawer" accessibilityViewIsModal style={[s.drawer, { width: drawerWidth, paddingTop: Math.max(16, insets.top), paddingBottom: Math.max(16, insets.bottom), transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [drawerWidth, 0] }) }] }]}>
          <View style={s.header}>
            <Text accessibilityRole="header" style={s.title}>{t('Menu')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Close menu')} onPress={() => close()} style={s.trigger}><Ionicons name="close" size={26} color="#f8fafc" /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
            {row('person-circle-outline', t(user ? 'Account' : 'Sign in'), () => close(onOpenAuth), user?.email)}
            {row('sparkles-outline', t(hasPro ? 'Pro is active' : 'Unlock Pro'), () => close(() => setPaywall(true)))}
            <View style={s.row}>
              <Ionicons name="volume-medium-outline" size={22} color="#a8caff" />
              <Text style={[s.text, s.label]}>{t('Sound')}</Text>
              <Switch accessibilityLabel={t('Sound')} value={soundEnabled} onValueChange={toggleSound} trackColor={{ false: '#475569', true: '#15803d' }} thumbColor={soundEnabled ? '#86efac' : '#cbd5e1'} />
            </View>
            <View style={s.section}>
              <Text style={s.text}>{t('Synchronization')}</Text>
              <SyncStatus syncStatus={syncStatus} onRetrySync={onRetrySync} showStatus />
            </View>
            <Pressable testID="language-menu" accessibilityRole="button" accessibilityLabel={t('Language')} accessibilityState={{ expanded: languageOpen }} onPress={() => setLanguageOpen(value => !value)} style={s.row}>
              <Ionicons name="language-outline" size={22} color="#a8caff" />
              <View style={s.label}><Text style={s.text}>{t('Language')}</Text><Text style={s.detail}>{custom.active ? 'Custom' : selected.name}</Text></View>
              <Ionicons name={languageOpen ? 'close' : 'menu'} size={24} color="#e2e8f0" />
            </Pressable>
            {languageOpen && <View testID="drawer-languages" style={s.languages}>
              {languages.map(language => <Pressable key={language.code} accessibilityRole="radio" accessibilityState={{ checked: !custom.active && selected.code === language.code }} onPress={() => { custom.chooseStandard(); selectLanguage(language.code); setLanguageOpen(false); }} style={s.language}>
                <Text style={[s.text, s.label]}>{language.name}</Text>
                {!custom.active && selected.code === language.code && <Ionicons name="checkmark" size={20} color="#86efac" />}
              </Pressable>)}
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: custom.active }} onPress={() => { custom.chooseCustom(); setLanguageOpen(false); }} style={s.language}><Text style={[s.text, s.label]}>Custom</Text>{custom.active && <Ionicons name="checkmark" size={20} color="#86efac" />}</Pressable>
            </View>}
            <PrivacyPolicyLink />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  trigger: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  overlay: { flex: 1 },
  drawer: { position: 'absolute', right: 0, top: 0, bottom: 0, backgroundColor: '#111827', borderLeftWidth: 1, borderColor: '#334155', paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, minHeight: 62, borderBottomWidth: 1, borderColor: '#263449' },
  label: { flex: 1, minWidth: 0 },
  text: { color: '#f8fafc', fontSize: 16 },
  detail: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  section: { paddingTop: 20, paddingBottom: 8, borderBottomWidth: 1, borderColor: '#263449', gap: 8 },
  languages: { paddingHorizontal: 12, backgroundColor: '#1e293b', borderRadius: 12 },
  language: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, minHeight: 48, gap: 8 },
});
