import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth } from './authClient';
import { calculationStore, syncCalculations, getSavedCalculations, saveCalculation, updateSavedCalculations } from './calculationStorage';
import { operators } from './calculatorConstants';
import { applyPercentage, evaluateExpression, pretty } from './calculatorUtils';
import AuthModal from './components/AuthModal';
import CalculatorView from './components/CalculatorView';

export default function App() {
  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [freshInput, setFreshInput] = useState(true);
  const [expression, setExpression] = useState('');
  const [savedCalculations, setSavedCalculations] = useState([]);
  const [listVisible, setListVisible] = useState(false);
  const [tableVisible, setTableVisible] = useState(false);
  const [saveDialogVisible, setSaveDialogVisible] = useState(false);
  const [saveType, setSaveType] = useState('Add');
  const [saveTitle, setSaveTitle] = useState('');
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ phase: 'local', pending: 0 });
  const [authVisible, setAuthVisible] = useState(false);

  const expressionTokens = expression.trim() ? expression.trim().split(/\s+/) : [];
  const lastExpressionToken = expressionTokens[expressionTokens.length - 1];
  const canShowLiveResult = !freshInput
    && !expressionTokens.includes('=')
    && !operators.includes(lastExpressionToken)
    && expressionTokens.some((token) => operators.includes(token));
  const calculatedDisplay = canShowLiveResult ? evaluateExpression(expression) : display;
  const visibleDisplay = String(calculatedDisplay);

  useEffect(() => auth ? onAuthStateChanged(auth, setUser) : undefined, []);
  useEffect(() => {
    const userId = user?.uid || null;
    let active = true;
    setSavedCalculations([]);
    setSyncStatus({ phase: userId ? 'checking' : 'local', pending: 0 });
    const unsubscribe = calculationStore.subscribe(userId, ({ rows, status }) => {
      if (active) { setSavedCalculations(rows); setSyncStatus(status); }
    });
    const retry = () => { void syncCalculations(userId); };
    calculationStore.getSnapshot(userId).then(() => { if (active) retry(); }).catch(() => {
      if (active) setSyncStatus({ phase: 'error', error: 'Saved device data could not be read.', pending: 0 });
    });
    const timer = userId ? setInterval(retry, 30000) : null;
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') retry(); });
    globalThis.addEventListener?.('online', retry);
    return () => {
      active = false;
      unsubscribe();
      clearInterval(timer);
      subscription.remove();
      globalThis.removeEventListener?.('online', retry);
    };
  }, [user?.uid]);

  const handleUpdateCalculations = async (change) => {
    const calculations = await updateSavedCalculations(change, user?.uid);
    setSavedCalculations(calculations);
    return calculations;
  };

  const calculate = (first, currentOperator, second) => {
    const firstNumber = Number(first);
    const secondNumber = Number(second);
    if (currentOperator === '+') return firstNumber + secondNumber;
    if (currentOperator === '−') return firstNumber - secondNumber;
    if (currentOperator === '×') return firstNumber * secondNumber;
    if (currentOperator === '÷') return secondNumber === 0 ? 'Error' : firstNumber / secondNumber;
    return secondNumber;
  };

  const showSavedCalculations = () => {
    setListVisible(true);
    getSavedCalculations(user?.uid).then((calculations) => {
      setSavedCalculations(calculations);
    }).catch(() => {});
  };

  const showCalculatorTable = () => {
    getSavedCalculations(user?.uid).then((calculations) => {
      setSavedCalculations(calculations);
      setListVisible(false);
      setSaveDialogVisible(false);
      setTableVisible(true);
    });
  };

  const openSaveDialog = (type) => {
    setSaveType(type);
    setSaveTitle('');
    getSavedCalculations(user?.uid).then(setSavedCalculations);
    setSaveDialogVisible(true);
  };

  const confirmSave = async (titleOverride = saveTitle) => {
    const trimmedTitle = titleOverride.trim();
    if (!trimmedTitle) {
      Alert.alert('Name required', 'Enter a name before saving.');
      return;
    }

    try {
      const saved = await saveCalculation(expression, visibleDisplay, saveType, trimmedTitle, user?.uid);
      if (!saved) return;

      const calculations = await getSavedCalculations(user?.uid);
      setSavedCalculations(calculations);
      setSaveDialogVisible(false);
      setSaveTitle('');
    } catch (error) {
      console.log('Save calculation error:', error);
      Alert.alert('Save failed', 'The calculation could not be saved on this device.');
    }
  };

  const onPress = (key) => {
    const resetCalculatorState = () => {
      setDisplay('0');
      setStoredValue(null);
      setOperator(null);
      setFreshInput(true);
      setExpression('');
    };

    if (key === 'AC') {
      resetCalculatorState();
      return;
    }

    if (key === 'C') {
      if (display === 'Error') {
        resetCalculatorState();
        return;
      }

      const currentExpression = expression.trimEnd();
      if (!currentExpression) {
        resetCalculatorState();
        return;
      }

      const nextExpression = currentExpression.slice(0, -1).trimEnd();
      if (!nextExpression) {
        resetCalculatorState();
        return;
      }

      const tokens = nextExpression.split(/\s+/);
      const lastToken = tokens[tokens.length - 1];
      const equalsIndex = tokens.lastIndexOf('=');
      const normalizeNumber = (value) => value.replace(/,/g, '');

      setExpression(nextExpression);

      if (equalsIndex >= 0) {
        const resultToken = tokens[equalsIndex + 1];
        const fallbackToken = tokens[equalsIndex - 1];
        setDisplay(normalizeNumber(resultToken || fallbackToken || '0'));
        setStoredValue(null);
        setOperator(null);
        setFreshInput(!resultToken);
        return;
      }

      if (operators.includes(lastToken)) {
        const precedingExpression = tokens.slice(0, -1).join(' ');
        const precedingToken = tokens[tokens.length - 2] || '0';
        const precedingValue = evaluateExpression(precedingExpression);
        setDisplay(normalizeNumber(precedingToken));
        setStoredValue(precedingValue === 'Error' ? null : precedingValue);
        setOperator(lastToken);
        setFreshInput(true);
        return;
      }

      const lastOperatorIndex = tokens.findLastIndex((token) => operators.includes(token));
      setDisplay(normalizeNumber(lastToken));
      if (lastOperatorIndex > 0) {
        const precedingValue = evaluateExpression(tokens.slice(0, lastOperatorIndex).join(' '));
        setStoredValue(precedingValue === 'Error' ? null : precedingValue);
        setOperator(tokens[lastOperatorIndex]);
      } else {
        setStoredValue(null);
        setOperator(null);
      }
      setFreshInput(false);
      return;
    }

    if (key === '±') {
      if (display !== '0' && display !== 'Error') setDisplay(String(Number(display) * -1));
      return;
    }

    if (key === '%') {
      const percentage = applyPercentage(expression, display);
      if (percentage) {
        setDisplay(percentage.display);
        setExpression(percentage.expression);
        setFreshInput(false);
      }
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
        setStoredValue(null);
        setOperator(null);
        setFreshInput(true);
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

  const editExpression = (value) => {
    const formula = value.split('=')[0].replace(/,/g, '').trim();
    if (formula && evaluateExpression(formula) === 'Error') {
      Alert.alert('Invalid calculation', 'Enter a complete calculation using numbers and +, -, × or ÷.');
      return;
    }
    const tokens = formula.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[+\-−×÷*/]/gi) || [];
    for (let index = 0; index < tokens.length - 1; index += 1) {
      if (/^[+\-−]$/.test(tokens[index]) && (index === 0 || /^[+\-−×÷*/]$/.test(tokens[index - 1]))) {
        tokens.splice(index, 2, `${tokens[index] === '−' ? '-' : tokens[index]}${tokens[index + 1]}`);
      }
    }
    const normalized = tokens.map((token) => ({ '-': '−', '*': '×', '/': '÷' }[token] || token)).join(' ');
    const last = tokens.at(-1);
    const pending = last && /^[+\-−×÷*/]$/.test(last);
    const result = evaluateExpression(normalized);
    setExpression(normalized);
    setDisplay(String(!formula ? '0' : pending ? evaluateExpression(tokens.slice(0, -1).join(' ')) : result));
    setStoredValue(null);
    setOperator(null);
    setFreshInput(false);
    const normalizedTokens = normalized.split(' ');
    const lastOperatorIndex = normalizedTokens.findLastIndex((token) => operators.includes(token));
    if (lastOperatorIndex > 0) {
      const preceding = evaluateExpression(normalizedTokens.slice(0, lastOperatorIndex).join(' '));
      setStoredValue(preceding === 'Error' ? null : preceding);
      setOperator(normalizedTokens[lastOperatorIndex]);
      setDisplay(pending ? String(preceding) : normalizedTokens.at(-1));
      setFreshInput(Boolean(pending));
    }
  };

  return (
    <SafeAreaProvider>
        <CalculatorView
          display={visibleDisplay}
          expression={expression}
          onEditExpression={editExpression}
          savedCalculations={savedCalculations}
          listVisible={listVisible}
          tableVisible={tableVisible}
          saveDialogVisible={saveDialogVisible}
          saveTitle={saveTitle}
          user={user}
          syncStatus={syncStatus}
          onRetrySync={() => syncCalculations(user?.uid)}
          onKeyPress={onPress}
          onSaveType={openSaveDialog}
          onList={showSavedCalculations}
          onCloseList={() => setListVisible(false)}
          onCloseTable={() => setTableVisible(false)}
          onCloseSaveDialog={() => setSaveDialogVisible(false)}
          onTitleChange={setSaveTitle}
          onConfirmSave={confirmSave}
          onOpenTable={showCalculatorTable}
          onUpdateCalculations={handleUpdateCalculations}
          onOpenAuth={() => setAuthVisible(true)}
          onSignOut={() => auth && signOut(auth)}
        />
        <AuthModal visible={authVisible} user={user} onClose={() => setAuthVisible(false)} />
    </SafeAreaProvider>
  );
}
