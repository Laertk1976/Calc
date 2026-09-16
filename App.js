import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth } from './authClient';
import { getSavedCalculations, saveCalculation, updateSavedCalculations } from './calculationStorage';
import { operators } from './calculatorConstants';
import { evaluateExpression, pretty } from './calculatorUtils';
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
  const [authVisible, setAuthVisible] = useState(false);

  const expressionTokens = expression.trim() ? expression.trim().split(/\s+/) : [];
  const lastExpressionToken = expressionTokens[expressionTokens.length - 1];
  const canShowLiveResult = !freshInput
    && !expressionTokens.includes('=')
    && !operators.includes(lastExpressionToken)
    && expressionTokens.some((token) => operators.includes(token));
  const calculatedDisplay = canShowLiveResult ? evaluateExpression(expression) : display;
  const visibleDisplay = String(calculatedDisplay);

  useEffect(() => {
    if (!auth) {
      getSavedCalculations().then(setSavedCalculations);
      return undefined;
    }

    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    getSavedCalculations(user?.id).then(setSavedCalculations).catch((error) => {
      console.log('Calculation load error:', error);
      Alert.alert('Sync failed', 'Your calculations could not be loaded from your account.');
    });
  }, [user]);

  const handleUpdateCalculations = async (change) => {
    const calculations = await updateSavedCalculations(change, user?.id);
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
    getSavedCalculations(user?.id).then((calculations) => {
      setSavedCalculations(calculations);
      setListVisible(true);
    });
  };

  const showCalculatorTable = () => {
    getSavedCalculations(user?.id).then((calculations) => {
      setSavedCalculations(calculations);
      setListVisible(false);
      setSaveDialogVisible(false);
      setTableVisible(true);
    });
  };

  const openSaveDialog = (type) => {
    setSaveType(type);
    setSaveTitle('');
    getSavedCalculations(user?.id).then(setSavedCalculations);
    setSaveDialogVisible(true);
  };

  const confirmSave = async (titleOverride = saveTitle) => {
    const trimmedTitle = titleOverride.trim();
    if (!trimmedTitle) {
      Alert.alert('Name required', 'Enter a name before saving.');
      return;
    }

    try {
      const saved = await saveCalculation(expression, visibleDisplay, saveType, trimmedTitle, user?.id);
      if (!saved) return;

      const calculations = await getSavedCalculations(user?.id);
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

  return (
    <SafeAreaProvider>
        <CalculatorView
          display={visibleDisplay}
          expression={expression}
          savedCalculations={savedCalculations}
          listVisible={listVisible}
          tableVisible={tableVisible}
          saveDialogVisible={saveDialogVisible}
          saveTitle={saveTitle}
          user={user}
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
