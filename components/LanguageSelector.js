import ButtonLabel from './ButtonLabel';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { languages, selectLanguage } from '../i18n';
import useCalculatorStyles from '../useCalculatorStyles';

export default function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const styles = useCalculatorStyles();
  const button = useRef(null);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 60, right: 12 });
  const selected = languages.find(({ code }) => code === i18n.resolvedLanguage) || languages[1];
  return (
    <>
      <Pressable ref={button} accessibilityRole="button" accessibilityLabel={`${t('Language')}: ${selected.name}`} accessibilityState={{ expanded: open }}
        onPress={() => {
          button.current?.measureInWindow((x, y, width, height) => setAnchor({ top: Math.min(y + height + 4, Math.max(8, viewportHeight - 290)), left: Math.max(8, Math.min(x + width - 180, viewportWidth - 188)) }));
          setOpen(true);
        }} style={[styles.authButton, styles.headerControl]}>
        <ButtonLabel numberOfLines={1} adjustsFontSizeToFit style={styles.authButtonText}>{selected.name} ▾</ButtonLabel>
      </Pressable>
      <Modal transparent statusBarTranslucent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Close')} onPress={() => setOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.25)' }} />
          <View accessibilityViewIsModal style={{ position: 'absolute', ...anchor, width: 180, maxHeight: '75%', backgroundColor: '#1e293b', borderColor: '#64748b', borderWidth: 1, borderRadius: 8, padding: 6 }}>
            <ScrollView>
              {languages.map(language => (
                <Pressable key={language.code} accessibilityRole="radio" accessibilityState={{ checked: selected.code === language.code }}
                  onPress={() => { selectLanguage(language.code); setOpen(false); }}
                  style={{ padding: 12, minHeight: 44, borderRadius: 4, backgroundColor: selected.code === language.code ? '#2563eb' : 'transparent' }}>
                  <Text style={{ color: '#ffffff', fontSize: 16 }}>{language.name}{selected.code === language.code ? ' ✓' : ''}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
