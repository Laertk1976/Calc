import { Pressable, Text, View } from 'react-native';
import { utilityKeys } from '../calculatorConstants';
import { styles } from '../calculatorStyles';

function getUtilityKeyStyle(key) {
  if (key === 'Cred') return styles.utilityKeyRed;
  if (key === 'Fact') return styles.utilityKeyPurple;
  if (key === 'Fcash') return styles.utilityKeyBlue;
  return styles.utilityKeyGreen;
}

export default function UtilityButtons({ onSaveType, onList }) {
  return (
    <View style={styles.utilityColumn}>
      {utilityKeys.map((key) => (
        <Pressable
          key={key}
          onPress={() => key === 'List' ? onList() : onSaveType(key)}
          style={({ pressed }) => [styles.utilityKey, getUtilityKeyStyle(key), pressed && styles.pressed]}
        >
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}
            style={styles.utilityKeyText}
          >
            {key}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
