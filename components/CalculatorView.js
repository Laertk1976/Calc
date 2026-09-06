import { StatusBar } from 'expo-status-bar';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { keys, operators } from '../calculatorConstants';
import { styles } from '../calculatorStyles';
import { pretty } from '../calculatorUtils';
import CalculationListModal from './CalculationListModal';
import CalculationTableModal from './CalculationTableModal';
import SaveCalculationModal from './SaveCalculationModal';
import UtilityButtons from './UtilityButtons';

export default function CalculatorView({
  display,
  expression,
  savedCalculations,
  listVisible,
  tableVisible,
  saveDialogVisible,
  saveTitle,
  onKeyPress,
  onSaveType,
  onList,
  onCloseList,
  onCloseTable,
  onCloseSaveDialog,
  onTitleChange,
  onConfirmSave,
  onOpenTable,
  onUpdateCalculations,
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.calculator}>
        <Pressable onPress={onOpenTable} style={styles.titleButton} hitSlop={10}>
          <Text style={styles.title}>CALCULATOR</Text>
        </Pressable>
        <View style={styles.display}>
          {expression ? <Text style={styles.expression}>{expression}</Text> : null}
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.displayText}>{pretty(display)}</Text>
        </View>
        <View style={styles.keypadLayout}>
          <View style={styles.keypad}>
            {keys.map((row) => (
              <View key={row.join('')} style={styles.keyRow}>
                {row.map((key) => {
                  const isOperator = operators.includes(key) || key === '=';
                  const isFunction = ['AC', 'C', '±', '%'].includes(key);
                  return (
                    <Pressable key={key} onPress={() => onKeyPress(key)} style={({ pressed }) => [styles.key, isOperator && styles.operator, isFunction && styles.function, pressed && styles.pressed]}>
                      <Text style={[styles.keyText, isFunction && styles.functionText]}>{key}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <UtilityButtons onSaveType={onSaveType} onList={onList} />
        </View>
        <CalculationListModal visible={listVisible} calculations={savedCalculations} onClose={onCloseList} />
        <CalculationTableModal
          visible={tableVisible}
          calculations={savedCalculations}
          onClose={onCloseTable}
          onUpdateCalculations={onUpdateCalculations}
        />
        <SaveCalculationModal visible={saveDialogVisible} title={saveTitle} onTitleChange={onTitleChange} onConfirm={onConfirmSave} onClose={onCloseSaveDialog} />
      </View>
    </SafeAreaView>
  );
}

