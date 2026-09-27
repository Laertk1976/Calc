import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
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

export default function UtilityButtons({ onSaveType, onList, onButtonPress, onDebts, onInvoices, desktop = false }) {
  const { t, i18n } = useTranslation();
  const styles = useCalculatorStyles();
  const renderButton = (key, grouped = false) => {
    const armenianInvoice = i18n.resolvedLanguage === 'hy' && ['Fact', 'Fcash'].includes(key);
    return (
    <Pressable
      key={key}
      android_disableSound
      onPressIn={onButtonPress}
      onPress={() => key === 'List' ? onList() : onSaveType(key)}
      onLongPress={key === 'Cred' ? onDebts : key === 'Fact' ? onInvoices : undefined}
      delayLongPress={600}
      accessibilityRole="button"
      accessibilityHint={key === 'Cred' ? t('Hold to open debts') : key === 'Fact' ? t('Hold to open invoices') : undefined}
      style={({ pressed }) => [styles.utilityKey, grouped && styles.utilityPrimaryKey, desktop && { height: 50, aspectRatio: undefined, position: 'relative', overflow: 'hidden' }, getUtilityKeyStyle(key), armenianInvoice && { flexShrink: 0, overflow: 'hidden', position: 'relative' }, pressed && styles.pressed]}
    >
      <ButtonLabel
        accessibilityLabel={t(key)}
        naturalWrap={desktop || armenianInvoice}
        style={[
          styles.utilityKeyText,
          armenianInvoice && { fontSize: 18, lineHeight: 23 },
        ]}
      >
        {key === 'Fcash' && i18n.resolvedLanguage === 'ja'
          ? t(key).replace('現金払い', '現金払い\n')
          : t(key)}
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
