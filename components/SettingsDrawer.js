import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Modal, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Pressable from './SoundPressable';
import { useTapSound } from './TapSoundProvider';
import { usePro } from './ProProvider';
import { useCustomLabels } from './CustomLabelsProvider';
import { languages, selectLanguage } from '../i18n';
import PrivacyPolicyLink from './PrivacyPolicyLink';
import DateRangeCalendar from './DateRangeCalendar';
import { raisedButton, pressedButton } from '../buttonAppearance';

function todayKey() {
  const today = new Date();
  return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
}

export default function SettingsDrawer({ user, onOpenAuth, onExportCsv, onImportCsv, onOpenCalendar, syncStatus, onRetrySync, compact = false }) {
  const { t, i18n } = useTranslation();
  const { soundEnabled, toggleSound } = useTapSound();
  const { hasPro, inTrial, trialDaysLeft, setPaywall, requirePro } = usePro();
  const custom = useCustomLabels();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(360, width - 24);
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [fromDate, setFromDate] = useState(todayKey);
  const [toDate, setToDate] = useState(todayKey);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [languageHeight, setLanguageHeight] = useState(0);
  const menuScroll = useRef(null);
  const menuViewportHeight = useRef(0);
  const menuScrollOffset = useRef(0);
  const languageRow = useRef({ y: 0, height: 0 });
  const revealLanguages = () => {
    if (!menuViewportHeight.current || !languageHeight) return;
    const { y, height } = languageRow.current;
    // Show the last option with breathing room, keeping the Language heading
    // visible too. On very small screens, start at the heading and allow scrolling.
    const offset = Math.min(y, Math.max(menuScrollOffset.current,
      y + height + languageHeight + 12 - menuViewportHeight.current));
    menuScroll.current?.scrollTo({ y: Math.max(0, offset), animated: true });
  };
  const languageProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(languageProgress, {
      toValue: languageOpen ? 1 : 0, duration: 200,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [languageOpen, languageProgress]);
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
  const exportCsv = async () => {
    if (!onExportCsv || exporting) return;
    setExporting(true);
    try { await onExportCsv({ fromDate, toDate }); }
    catch (error) { Alert.alert(t('CSV export failed'), error?.message || t('Please try again.')); }
    finally { setExporting(false); }
  };
  const importCsv = async () => {
    if (!onImportCsv || importing) return;
    setImporting(true);
    try { await onImportCsv(); }
    finally { setImporting(false); }
  };
  const row = (icon, label, action, detail) => <Pressable accessibilityRole="button" onPress={action} style={s.row}>
    <Ionicons name={icon} size={22} color="#a8caff" />
    <View style={s.label}><Text style={s.text}>{label}</Text>{detail ? <Text style={s.detail}>{detail}</Text> : null}</View>
    <Ionicons name="chevron-forward" size={20} color="#64748b" />
  </Pressable>;
  const menuButton = (icon, label, action, expanded, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={expanded === undefined ? undefined : { expanded }} disabled={disabled} onPress={action} style={({ pressed }) => [s.menuButton, pressed && s.menuButtonPressed, disabled && { opacity: 0.5 }]}>
    <View style={s.menuButtonContent}>
      <Ionicons name={icon} size={20} color="#bfdbfe" />
      <Text numberOfLines={1} style={s.menuButtonText}>{label}</Text>
    </View>
  </Pressable>;
  return <>
    <Pressable testID="open-settings" accessibilityRole="button" accessibilityLabel={t('Open menu')} accessibilityState={{ expanded: open }} onPress={() => { progress.setValue(0); setOpen(true); }} style={[s.trigger, compact && { width: 24, height: 24, borderRadius: 6 }]}>
      <Ionicons name="menu" size={compact ? 20 : 28} color="#f8fafc" />
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
          <ScrollView ref={menuScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}
            onLayout={({ nativeEvent }) => { menuViewportHeight.current = nativeEvent.layout.height; }}
            onScroll={({ nativeEvent }) => { menuScrollOffset.current = nativeEvent.contentOffset.y; }} scrollEventThrottle={16}>
            {/* Account access is kept for payment verification and future reuse. */}
            {/* {row('person-circle-outline', t(user ? 'Account' : 'Sign in'), () => close(onOpenAuth), user?.email)} */}
            <View style={s.menuButtonRow}>
              <View style={s.exportCalendarGroup}>
                {menuButton('calendar-outline', t('Calendar'), () => { if (requirePro()) setCalendarOpen(value => !value); }, calendarOpen)}
                {menuButton('download-outline', t(exporting ? 'Please wait...' : 'Export CSV'), exportCsv, undefined, exporting)}
              </View>
              <View style={s.importButtonSlot}>
                {menuButton('folder-open-outline', t(importing ? 'Please wait...' : 'Import CSV'), importCsv, undefined, importing)}
              </View>
            </View>
            {calendarOpen && <View style={s.calendarPanel}><DateRangeCalendar fromDate={fromDate} toDate={toDate} onChange={(from, to) => { setFromDate(from); setToDate(to); }} onApply={() => setCalendarOpen(false)} /></View>}
            {row('sparkles-outline', t(hasPro ? 'Pro is active' : 'Unlock Pro'), () => close(() => setPaywall(true)), inTrial ? t('Trial active: {{days}} days remaining.', { days: trialDaysLeft }) : undefined)}
            <View style={s.row}>
              <Ionicons name="volume-medium-outline" size={22} color="#a8caff" />
              <Text style={[s.text, s.label]}>{t('Sound')}</Text>
              <Switch accessibilityLabel={t('Sound')} value={soundEnabled} onValueChange={toggleSound} trackColor={{ false: '#475569', true: '#15803d' }} thumbColor={soundEnabled ? '#86efac' : '#cbd5e1'} />
            </View>
            {/* Server synchronization controls are retained for future reuse. */}
            {/* <View style={s.section}>
              <Text style={s.text}>{t('Synchronization')}</Text>
              <SyncStatus syncStatus={syncStatus} onRetrySync={onRetrySync} showStatus />
            </View> */}
            <Pressable testID="language-menu" accessibilityRole="button" accessibilityLabel={t('Language')} accessibilityState={{ expanded: languageOpen }} onPress={() => setLanguageOpen(value => !value)}
              onLayout={({ nativeEvent }) => { languageRow.current = nativeEvent.layout; }} style={s.row}>
              <Ionicons name="language-outline" size={22} color="#a8caff" />
              <View style={s.label}><Text style={s.text}>{t('Language')}</Text><Text style={s.detail}>{custom.active ? 'Custom' : selected.name}</Text></View>
              <Ionicons name={languageOpen ? 'chevron-up' : 'menu'} size={24} color="#e2e8f0" />
            </Pressable>
            <Animated.View testID="drawer-languages" pointerEvents={languageOpen ? 'auto' : 'none'}
              onLayout={({ nativeEvent }) => {
                if (languageOpen && nativeEvent.layout.height >= languageHeight - 1) revealLanguages();
              }}
              accessibilityElementsHidden={!languageOpen} importantForAccessibility={languageOpen ? 'auto' : 'no-hide-descendants'}
              style={{ height: Animated.multiply(languageProgress, languageHeight), overflow: 'hidden' }}>
            <View onLayout={({ nativeEvent }) => setLanguageHeight(nativeEvent.layout.height)} style={s.languages}>
              {languages.map(language => <Pressable key={language.code} accessibilityRole="radio" accessibilityState={{ checked: !custom.active && selected.code === language.code }} onPress={() => { custom.chooseStandard(); selectLanguage(language.code); setLanguageOpen(false); }} style={s.language}>
                <Text style={[s.text, s.label]}>{language.name}</Text>
                {!custom.active && selected.code === language.code && <Ionicons name="checkmark" size={20} color="#86efac" />}
              </Pressable>)}
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: custom.active }} onPress={() => { custom.chooseCustom(); setLanguageOpen(false); }} style={s.language}><Text style={[s.text, s.label]}>Custom</Text>{custom.active && <Ionicons name="checkmark" size={20} color="#86efac" />}</Pressable>
            </View>
            </Animated.View>
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
  menuButtonRow: { flexDirection: 'row', gap: 8, paddingVertical: 12 },
  exportCalendarGroup: { flex: 2, minWidth: 0, flexDirection: 'row', gap: 4, padding: 6, borderWidth: 1, borderColor: '#fff', borderRadius: 13 },
  importButtonSlot: { flex: 1, minWidth: 0, paddingVertical: 7, paddingHorizontal: 4.5 },
  menuButton: { ...raisedButton, flex: 1, minWidth: 0, minHeight: 58, alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 12, backgroundColor: '#1e3a5f' },
  menuButtonContent: { flex: 1, width: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 10, backgroundColor: '#1e3a5f', padding: 7 },
  menuButtonPressed: pressedButton,
  menuButtonText: { color: '#f8fafc', fontSize: 12, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, minHeight: 62, borderBottomWidth: 1, borderColor: '#263449' },
  label: { flex: 1, minWidth: 0 },
  text: { color: '#f8fafc', fontSize: 16 },
  detail: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  section: { paddingTop: 20, paddingBottom: 8, borderBottomWidth: 1, borderColor: '#263449', gap: 8 },
  calendarPanel: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 8 },
  languages: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, backgroundColor: '#1e293b', borderRadius: 12 },
  language: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, minHeight: 48, gap: 8 },
});
