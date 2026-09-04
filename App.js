import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

const keys = [
  ['AC', 'C', '±', '%'],
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '+'],
  ['1', '2', '3', '−'],
  ['0', '.', '=', '×'],
];

const operators = ['÷', '×', '−', '+'];

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

  const calculate = (first, op, second) => {
    const a = Number(first);
    const b = Number(second);
    if (op === '+') return a + b;
    if (op === '−') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? 'Error' : a / b;
    return b;
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
        <View style={styles.keypad}>
          {keys.flat().map((key) => {
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111827' },
  calculator: { flex: 1, paddingHorizontal: 20, paddingBottom: 20, justifyContent: 'flex-end' },
  title: { color: '#94a3b8', fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 20 },
  display: { minHeight: 150, justifyContent: 'flex-end', alignItems: 'flex-end', paddingHorizontal: 8, paddingBottom: 24 },
  expression: { color: '#94a3b8', fontSize: 24, marginBottom: 8 },
  displayText: { color: '#f8fafc', fontSize: 68, fontWeight: '300', maxWidth: '100%' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  key: { width: '18%', aspectRatio: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#273449' },
  operator: { backgroundColor: '#f59e0b' },
  function: { backgroundColor: '#cbd5e1' },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] },
  keyText: { color: '#fff', fontSize: 28, fontWeight: '500' },
  functionText: { color: '#172033' },
});
