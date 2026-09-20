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

export default function UtilityButtons({ onSaveType, onList }) {
  const { t, i18n } = useTranslation();
  const styles = useCalculatorStyles();
  return (
    <View style={styles.utilityColumn}>
      {utilityKeys.map((key) => (
        <Pressable
          key={key}
          onPress={() => key === 'List' ? onList() : onSaveType(key)}
          style={({ pressed }) => [styles.utilityKey, getUtilityKeyStyle(key), pressed && styles.pressed]}
        >
          <ButtonLabel
            accessibilityLabel={t(key)}
            style={styles.utilityKeyText}
          >
            {key === 'Fcash' && i18n.resolvedLanguage === 'ja'
              ? t(key).replace('現金払い', '現金払い\n')
              : key === 'Fcash' && i18n.resolvedLanguage === 'hy'
                ? t(key).replace('Կանխիկ ', 'Կանխիկ\n').replace('հաշիվ-', 'հաշիվ-\n')
              : key === 'Fact' && i18n.resolvedLanguage === 'hy'
                ? t(key).replace('Հաշիվ-', 'Հաշիվ-\n')
              : t(key)}
          </ButtonLabel>
        </Pressable>
      ))}
    </View>
  );
}
