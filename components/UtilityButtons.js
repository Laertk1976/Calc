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

export default function UtilityButtons({ onSaveType, onList, onButtonPress }) {
  const { t, i18n } = useTranslation();
  const styles = useCalculatorStyles();
  const renderButton = (key, grouped = false) => (
    <Pressable
      key={key}
      onPressIn={onButtonPress}
      onPress={() => key === 'List' ? onList() : onSaveType(key)}
      style={({ pressed }) => [styles.utilityKey, grouped && styles.utilityPrimaryKey, getUtilityKeyStyle(key), pressed && styles.pressed]}
    >
      <ButtonLabel
        accessibilityLabel={t(key)}
        style={[
          styles.utilityKeyText,
          i18n.resolvedLanguage === 'hy' && ['Fact', 'Fcash'].includes(key) && styles.utilityThreeLineText,
          i18n.resolvedLanguage === 'hy' && key === 'Fcash' && styles.utilityFourLineText,
        ]}
      >
        {key === 'Fcash' && i18n.resolvedLanguage === 'ja'
          ? t(key).replace('現金払い', '現金払い\n')
          : key === 'Fcash' && i18n.resolvedLanguage === 'hy'
            ? t(key).replace('Կանխիկ ', 'Կանխիկ\n').replace('հաշիվ-', 'հաշիվ-\n').replace('ապրանքա ', 'ապրանքա\n')
          : key === 'Fact' && i18n.resolvedLanguage === 'hy'
            ? t(key).replace('Հաշիվ-', 'Հաշիվ-\n').replace('ապրանքա-', 'ապրանքա-\n')
          : t(key)}
      </ButtonLabel>
    </Pressable>
  );
  return (
    <View style={styles.utilityColumn}>
      <View style={styles.utilityPrimaryGroup}>
        {utilityKeys.slice(0, 2).map((key) => renderButton(key, true))}
      </View>
      {renderButton(utilityKeys[2])}
      <View style={styles.utilityPrimaryGroup}>
        {utilityKeys.slice(3, 5).map((key) => renderButton(key, true))}
      </View>
    </View>
  );
}
