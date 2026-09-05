import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getSavedCalculations, saveCalculation } from './calculationStorage';

const keys = [
  ['AC', 'C', '±', '%'],
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '+'],
  ['1', '2', '3', '−'],
  ['0', '.', '=', '×',],
];

const operators = ['÷', '×', '−', '+'];
const utilityKeys = ['Add', 'List', 'C', 'D', 'E'];

function pretty(value) {
  if (value === 'Error') return value;
  const [whole, decimal] = value.split('.');
  const formatted = Number(whole).toLocaleString('en-US');
  return decimal === undefined ? formatted : `${formatted}.${decimal}`;
}

function evaluateExpression(value) {
  const tokens = value.replace(/,/g, '').match(/-?\d*\.?\d+|[÷×−+]/g) || [];
  if (!tokens.length) return 'Error';

  const values = [Number(tokens[0])];
  const pendingOperators = [];
  for (let index = 1; index < tokens.length; index += 2) {
    const nextOperator = tokens[index];
    const nextValue = Number(tokens[index + 1]);
    if (!Number.isFinite(nextValue)) return 'Error';
    if (nextOperator === '×' || nextOperator === '÷') {
      const previousValue = values.pop();
      const result = nextOperator === '×'
        ? previousValue * nextValue
        : nextValue === 0 ? 'Error' : previousValue / nextValue;
      if (result === 'Error') return result;
      values.push(result);
    } else {
      pendingOperators.push(nextOperator);
      values.push(nextValue);
    }
  }

  return values.slice(1).reduce((result, valueToAdd, index) => (
    pendingOperators[index] === '+' ? result + valueToAdd : result - valueToAdd
  ), values[0]);
}

export default function App() {
  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [freshInput, setFreshInput] = useState(true);
  const [expression, setExpression] = useState('');
  const [savedCalculations, setSavedCalculations] = useState([]);
  const [listVisible, setListVisible] = useState(false);

  const calculate = (first, op, second) => {
    const a = Number(first);
    const b = Number(second);
    if (op === '+') return a + b;
    if (op === '−') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? 'Error' : a / b;
    return b;
  };

  const showSavedCalculations = () => {
    setSavedCalculations(getSavedCalculations());
    setListVisible(true);
  };

  const onPress = (key) => {
    if (key === 'AC') {
      setDisplay('0'); setStoredValue(null); setOperator(null); setFreshInput(true); setExpression(''); return;
    }
    if (key === 'C') {
      if (display === 'Error') return;
      const nextDisplay = display.length > 1 ? display.slice(0, -1) : '0';
      setDisplay(nextDisplay);
      setExpression((current) => display.length > 1 ? current.slice(0, -1) : current.replace(/\s?\d+$/, ''));
      setFreshInput(display.length <= 1);
      return;
    }
    if (key === '±') {
      if (display !== '0' && display !== 'Error') setDisplay(String(Number(display) * -1));
      return;
    }
    if (key === '%') {
      if (display !== 'Error') setDisplay(String(Number(display) / 100));
      return;
    }
    if (operators.includes(key)) {
      if (display === 'Error') return;
      const nextStored = storedValue !== null && operator && !freshInput
        ? calculate(storedValue, operator, display)
        : Number(display);
      setExpression((current) => {
        if (storedValue !== null && operator && freshInput) return current.replace(/\s[÷×−+]$/, ` ${key}`);
        if (storedValue !== null && operator && !freshInput) return `${current} ${key}`;
        return `${pretty(display)} ${key}`;
      });
      setStoredValue(nextStored);
      setOperator(key);
      setFreshInput(true);
      if (nextStored === 'Error') setDisplay('Error');
      return;
    }
    if (key === '=') {
      if (storedValue !== null && operator && display !== 'Error') {
        const formula = `${expression}${freshInput ? ` ${pretty(display)}` : ''}`;
        const result = evaluateExpression(formula);
        setExpression(`${formula} = ${pretty(String(result))}`);
        setDisplay(String(result));
        setStoredValue(null); setOperator(null); setFreshInput(true);
      }
      return;
    }
    if (key === '.' && display.includes('.') && !freshInput) return;
    const next = freshInput ? (key === '.' ? '0.' : key) : `${display}${key}`;
    setDisplay(next.length > 12 ? display : next);
    setExpression((current) => {
      if (!current || !freshInput) {
        if (!current) return next;
        return `${current}${key}`;
      }
      return `${current.trimEnd()} ${next}`;
    });
    setFreshInput(false);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.calculator}>
        <Text style={styles.title}>CALCULATOR</Text>
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
                    <Pressable
                      key={key}
                      onPress={() => onPress(key)}
                      style={({ pressed }) => [styles.key, isOperator && styles.operator, isFunction && styles.function, pressed && styles.pressed]}
                    >
                      <Text style={[styles.keyText, isFunction && styles.functionText]}>{key}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.utilityColumn}>
            {utilityKeys.map((key) => (
              <Pressable
                key={key}
                onPress={() => {
                  if (key === 'Add') saveCalculation(expression, display);
                  if (key === 'List') showSavedCalculations();
                }}
                style={({ pressed }) => [styles.utilityKey, pressed && styles.pressed]}
              >
                <Text style={styles.keyText}>{key}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Modal animationType="fade" transparent visible={listVisible} onRequestClose={() => setListVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.listPanel}>
              <Text style={styles.listTitle}>Saved calculations</Text>
              <ScrollView style={styles.listScroll}>
                {savedCalculations.length ? savedCalculations.map((calculation, index) => (
                  <View key={`${calculation.createdAt}-${index}`} style={styles.savedItem}>
                    <Text style={styles.savedTitle}>{calculation.title}</Text>
                    <Text style={styles.savedExpression}>{calculation.expression}</Text>
                    <Text style={styles.savedValue}>{calculation.value}</Text>
                  </View>
                )) : <Text style={styles.emptyList}>No saved calculations yet.</Text>}
              </ScrollView>
              <Pressable onPress={() => setListVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111827' },
  calculator: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 20, justifyContent: 'flex-end' },
  title: { color: '#94a3b8', fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 20 },
  display: { minHeight: 150, justifyContent: 'flex-end', alignItems: 'flex-end', paddingHorizontal: 8, paddingBottom: 24 },
  expression: { color: '#94a3b8', fontSize: 24, marginBottom: 8 },
  displayText: { color: '#f8fafc', fontSize: 68, fontWeight: '300', maxWidth: '100%' },
  keypadLayout: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  keypad: { flex: 1, gap: 12 },
  keyRow: { flexDirection: 'row', gap: 12 },
  key: { flex: 1, aspectRatio: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#273449' },
  operator: { backgroundColor: '#f59e0b' },
  function: { backgroundColor: '#cbd5e1' },
  utilityColumn: { width: '19%', flexShrink: 0, gap: 12 },
  utilityKey: { width: '100%', aspectRatio: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#22c55e' },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] },
  keyText: { color: '#fff', fontSize: 28, fontWeight: '500' },
  functionText: { color: '#172033' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.72)', justifyContent: 'center', padding: 20 },
  listPanel: { width: '100%', maxWidth: 520, maxHeight: '80%', alignSelf: 'center', backgroundColor: '#1e293b', borderRadius: 8, padding: 20 },
  listTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  listScroll: { marginBottom: 16 },
  savedItem: { borderBottomColor: '#475569', borderBottomWidth: 1, paddingVertical: 12 },
  savedTitle: { color: '#86efac', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  savedExpression: { color: '#cbd5e1', fontSize: 15, marginBottom: 4 },
  savedValue: { color: '#f8fafc', fontSize: 20 },
  emptyList: { color: '#94a3b8', fontSize: 16, paddingVertical: 20 },
  closeButton: { alignItems: 'center', backgroundColor: '#22c55e', borderRadius: 5, paddingVertical: 12 },
  closeButtonText: { color: '#052e16', fontSize: 16, fontWeight: '700' },
});
