import Pressable from './SoundPressable';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { customLabelKeys, useCustomLabels } from './CustomLabelsProvider';
import { utilityKeys } from '../calculatorConstants';
import { styles } from '../calculatorStyles';
import useCalculatorStyles from '../useCalculatorStyles';
import ButtonLabel from './ButtonLabel';

function getUtilityKeyStyle(key) {
  if (key === 'Cred') return styles.utilityKeyRed;
  if (key === 'Fact') return styles.utilityKeyPurple;
  if (key === 'Fcash') return styles.utilityKeyBlue;
  return styles.utilityKeyGreen;
}

export default function UtilityButtons({ onSaveType, onList, onButtonPress, onDebts, onInvoices, desktop = false, maxKeypadHeight }) {
  const { t, i18n } = useTranslation();
  const styles = useCalculatorStyles(maxKeypadHeight);
  const custom = useCustomLabels();
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState('');
  useEffect(() => { setEditingKey(null); }, [custom.revision, custom.active]);
  const renderButton = (key, grouped = false) => {
    const customizable = custom.active && customLabelKeys.includes(key);
    const needsLabel = customizable && (custom.editable.includes(key) || !custom.labels[key]);
    const label = customizable ? custom.labels[key] || '' : t(key);
    const armenianInvoice = !customizable && i18n.resolvedLanguage === 'hy' && ['Fact', 'Fcash'].includes(key);
    const buttonStyle = [styles.utilityKey, grouped && styles.utilityPrimaryKey, desktop && { height: 58, aspectRatio: undefined, position: 'relative', overflow: 'hidden' }, getUtilityKeyStyle(key), armenianInvoice && { flexShrink: 0, overflow: 'hidden', position: 'relative' }, customizable && { position: 'relative', overflow: 'hidden' }];
    if (customizable && editingKey === key) {
      return <View key={key} style={buttonStyle}>
        <TextInput autoFocus selectTextOnFocus multiline={false} maxLength={30}
          accessibilityLabel={`Custom label: ${t(key)}`}
          value={draft} onChangeText={setDraft} returnKeyType="done" submitBehavior="submit"
          onSubmitEditing={() => { if (custom.confirmLabel(key, draft)) setEditingKey(null); }}
          style={{ width: '100%', height: '100%', color: '#ffffff', fontSize: 16, textAlign: 'center', paddingHorizontal: 4 }} />
      </View>;
    }
    return (
    <Pressable
      key={key}
      android_disableSound
      onPressIn={onButtonPress}
      onPress={() => {
        if (needsLabel) { setDraft(custom.labels[key] || ''); setEditingKey(key); return; }
        key === 'List' ? onList() : onSaveType(key);
      }}
      onLongPress={needsLabel ? undefined : key === 'Cred' ? onDebts : key === 'Fact' ? onInvoices : undefined}
      delayLongPress={600}
      accessibilityRole="button"
      accessibilityLabel={needsLabel ? `Edit label: ${label || t(key)}` : label}
      accessibilityHint={key === 'Cred' ? t('Hold to open debts') : key === 'Fact' ? t('Hold to open invoices') : undefined}
      style={({ pressed }) => [buttonStyle, pressed && styles.pressed]}
    >
      <ButtonLabel
        accessibilityLabel={label}
        naturalWrap={desktop || armenianInvoice || customizable}
        style={[
          styles.utilityKeyText,
          armenianInvoice && { fontSize: 18, lineHeight: 23 },
        ]}
      >
        {!customizable && key === 'Fcash' && i18n.resolvedLanguage === 'ja'
          ? t(key).replace('現金払い', '現金払い\n')
          : label}
      </ButtonLabel>
    </Pressable>
  );
  };
  return (
    <View style={[styles.utilityColumn, desktop && { width: 82, gap: 8 }]}>
      <View style={[styles.utilityPrimaryGroup, desktop && { gap: 8, padding: 4, borderWidth: 2 }]}>
        {utilityKeys.slice(0, 2).map((key) => renderButton(key, true))}
      </View>
      {renderButton(utilityKeys[2])}
      <View style={[styles.utilityPrimaryGroup, desktop && { gap: 8, padding: 4, borderWidth: 2 }]}>
        {utilityKeys.slice(3, 5).map((key) => renderButton(key, true))}
      </View>
    </View>
  );
}
