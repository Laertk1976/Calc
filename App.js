import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { getSavedCalculations, saveCalculation, updateSavedCalculations } from './calculationStorage';
import { operators } from './calculatorConstants';
import { evaluateExpression, pretty } from './calculatorUtils';
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

  useEffect(() => {
    getSavedCalculations().then(setSavedCalculations);
  }, []);

  const handleUpdateCalculations = (newCalculations) => {
    setSavedCalculations(newCalculations);
    updateSavedCalculations(newCalculations).catch((error) => console.log('Storage update error:', error));
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
    getSavedCalculations().then((calculations) => {
      setSavedCalculations(calculations);
      setListVisible(true);
    });
  };

  const showCalculatorTable = () => {
    getSavedCalculations().then((calculations) => {
      setSavedCalculations(calculations);
      setListVisible(false);
      setSaveDialogVisible(false);
      setTableVisible(true);
    });
  };

  const openSaveDialog = (type) => {
    setSaveType(type);
    setSaveTitle('');
    getSavedCalculations().then(setSavedCalculations);
    setSaveDialogVisible(true);
  };

  const confirmSave = async (titleOverride = saveTitle) => {
    const trimmedTitle = titleOverride.trim();
    if (!trimmedTitle) {
      Alert.alert('Name required', 'Enter a name before saving.');
      return;
    }

    try {
      const saved = await saveCalculation(expression, display, saveType, trimmedTitle);
      if (!saved) return;

      const calculations = await getSavedCalculations();
      setSavedCalculations(calculations);
      setSaveDialogVisible(false);
      setSaveTitle('');
    } catch (error) {
      console.log('Save calculation error:', error);
      Alert.alert('Save failed', 'The calculation could not be saved on this device.');
    }
  };

  const onPress = (key) => {
    if (key === 'AC') {
      setDisplay('0');
      setStoredValue(null);
      setOperator(null);
      setFreshInput(true);
      setExpression('');
      return;
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
    <CalculatorView
      display={display}
      expression={expression}
      savedCalculations={savedCalculations}
      listVisible={listVisible}
      tableVisible={tableVisible}
      saveDialogVisible={saveDialogVisible}
      saveTitle={saveTitle}
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
    />
  );
}
