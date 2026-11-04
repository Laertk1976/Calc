import TapSoundProvider from './components/TapSoundProvider';
import CustomLabelsProvider from './components/CustomLabelsProvider';
import './i18n';
import { useTranslation } from 'react-i18next';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { auth } from './authClient';
import { addSavedCalculations, calculationStore, getSavedCalculations, saveCalculationWithRows, updateSavedCalculations } from './calculationStorage';
// Server synchronization remains available for future reuse:
// import { syncCalculations } from './calculationStorage';
import { operators } from './calculatorConstants';
import { applyPercentage, evaluateExpression, pretty } from './calculatorUtils';
import AuthModal from './components/AuthModal';
import AccountModal from './components/AccountModal';
import CalculatorView from './components/CalculatorView';
import ProProvider, { usePro } from './components/ProProvider';
import ProModal from './components/ProModal';
import { accessibleRecords } from './proAccess';
import { filterCalculationsForDateRange, shareTableCsv } from './tableCsvExport';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { createLocalCalculationHistory, HISTORY_KEY } from './localCalculationHistory';
import { parseTableCsv } from './tableCsvExport';
import { parseDataBackup } from './dataBackup';

const localHistory = createLocalCalculationHistory(AsyncStorage);

export default function App() {
  return <ProProvider><AppContent /></ProProvider>;
}

function AppContent() {
  const { hasPro, today, requirePro, setPaywall } = usePro();
  const { t, i18n } = useTranslation();
  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [freshInput, setFreshInput] = useState(true);
  const [expression, setExpression] = useState('');
  const [savedCalculations, setSavedCalculations] = useState([]);
  const [listVisible, setListVisible] = useState(false);
  const [tableVisible, setTableVisible] = useState(false);
  const [tableAction, setTableAction] = useState(null);
  const [saveDialogVisible, setSaveDialogVisible] = useState(false);
  const [saveType, setSaveType] = useState('Add');
  const [saveTitle, setSaveTitle] = useState('');
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ phase: 'local', pending: 0 });
  const [authVisible, setAuthVisible] = useState(false);
  const [accountVisible, setAccountVisible] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const historyError = () => Alert.alert(t('Error'), t('Calculation history could not be saved on this device.'));
  useEffect(() => {
    const unsubscribe = localHistory.subscribe(setHistoryEntries);
    void localHistory.load().catch(historyError);
    return unsubscribe;
  }, []);

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
    let active = true;
    const userId = user?.uid || null;
    setSavedCalculations([]);
    setSyncStatus({ phase: 'local', pending: 0 });
    // Cloud transfer is disabled; retain each existing local storage namespace.
    const unsubscribe = calculationStore.subscribe(userId, ({ rows }) => {
      if (active) { setSavedCalculations(rows); setSyncStatus({ phase: 'local', pending: 0 }); }
    });
    calculationStore.getSnapshot(userId).catch(() => {
      if (active) setSyncStatus({ phase: 'error', error: 'Saved device data could not be read.', pending: 0 });
    });
    return () => { active = false; unsubscribe(); };
    /* Server sync loop retained for future reuse:
    const userId = user?.uid || null;
    const retry = () => { if (active) void syncCalculations(userId, { automatic: true }); };
    const timer = userId ? setInterval(retry, 60000) : null;
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') retry(); });
    globalThis.addEventListener?.('online', retry);
    return () => { clearInterval(timer); subscription.remove(); globalThis.removeEventListener?.('online', retry); };
    */
  }, [user?.uid]);

  const handleUpdateCalculations = async (change) => {
    if (!requirePro()) return savedCalculations;
    if (syncStatus.deletionPending) { setAccountVisible(true); throw new Error(t('Account deletion is pending. Open Account to finish deletion.')); }
    const calculations = await updateSavedCalculations(change, user?.uid);
    setSavedCalculations(calculations);
    return calculations;
  };

  const requestClearAllLocalData = async () => {
    try {
      const [calculations, recentResults] = await Promise.all([
        getSavedCalculations(user?.uid),
        localHistory.load(),
      ]);
      setSavedCalculations(calculations);
      setHistoryEntries(recentResults);
      if (!calculations.length && !recentResults.length) {
        Alert.alert(t('Nothing to clear'), t('There are no saved calculations or recent results on this phone.'));
        return;
      }
      Alert.alert(
        t('Clear all calculations?'),
        t('This permanently deletes {{calculations}} saved calculations and {{results}} recent results from this phone. This cannot be undone.', {
          calculations: calculations.length,
          results: recentResults.length,
        }),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Delete all'),
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await calculationStore.clearAllLocal(user?.uid || null);
                  await localHistory.clear();
                  setSavedCalculations([]);
                  setHistoryEntries([]);
                  setListVisible(false);
                  setTableVisible(false);
                  setDisplay('0');
                  setStoredValue(null);
                  setOperator(null);
                  setFreshInput(true);
                  setExpression('');
                  Alert.alert(t('Calculations cleared'), t('All saved calculations and recent results were deleted from this phone.'));
                } catch (error) {
                  Alert.alert(t('Error'), error?.message || t('Could not clear local data.'));
                }
              })();
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert(t('Error'), error?.message || t('Could not clear local data.'));
    }
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
    if (!requirePro()) return;
    getSavedCalculations(user?.uid).then((calculations) => {
      setSavedCalculations(calculations);
      setListVisible(false);
      setSaveDialogVisible(false);
      setTableVisible(true);
    });
  };

  const openTableAction = (action) => {
    if (!requirePro()) return;
    setListVisible(false);
    setTableAction(action);
    setTableVisible(true);
  };

  const exportCsvForRange = async ({ fromDate, toDate }) => {
    if (!requirePro()) return;
    const rows = filterCalculationsForDateRange(savedCalculations, fromDate, toDate);
    await shareTableCsv(rows, fromDate, toDate, t);
  };

  const exportDataBackup = async () => {
    const backup = await calculationStore.createBackup(HISTORY_KEY);
    const fileName = `calc-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const content = JSON.stringify(backup, null, 2);
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    const uri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, content);
    await Sharing.shareAsync(uri, { mimeType: 'application/json', UTI: 'public.json' });
  };

  const confirmBackupRestore = async ({ records, results }) => {
    const message = t('Backup restore confirmation', { records, results });
    if (Platform.OS === 'web') return window.confirm(message);
    return new Promise(resolve => Alert.alert(t('Restore backup?'), message, [
      { text: t('Cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: t('Restore'), onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }));
  };

  const importCsvFile = async () => {
    let importingBackup = false;
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', 'application/json', 'public.json'], copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.[0]?.uri) return;
      const asset = picked.assets[0];
      const content = asset.file?.text ? await asset.file.text() : await FileSystem.readAsStringAsync(asset.uri);
      if (/\.json$/i.test(asset.name || '') || content.trimStart().startsWith('{')) {
        importingBackup = true;
        const backup = parseDataBackup(content);
        const records = backup.calculationStores.reduce((count, store) => count + (Array.isArray(store.value) ? store.value : store.value.rows).length, 0);
        if (!await confirmBackupRestore({ records, results: backup.localHistory.length })) return;
        const previousRecentResults = await localHistory.load();
        const restored = await calculationStore.restoreBackup(backup);
        const recentResults = await localHistory.merge(restored.localHistory);
        const previousIds = new Set(previousRecentResults.map(entry => entry.id));
        const recentHistoryAdded = recentResults.filter(entry => !previousIds.has(entry.id)).length;
        setHistoryEntries(recentResults);
        setSavedCalculations(await getSavedCalculations(user?.uid));
        Alert.alert(t('Backup restored'), t('Backup merge summary', {
          added: restored.added,
          conflicts: restored.conflicts,
          history: restored.historyAdded + recentHistoryAdded,
        }));
        return;
      }
      if (!requirePro()) return;
      const imported = parseTableCsv(content, t, i18n);
      if (syncStatus.deletionPending) throw new Error(t('Account deletion is pending. Open Account to finish deletion.'));
      const { rows, added } = await addSavedCalculations(imported, user?.uid);
      setSavedCalculations(rows);
      Alert.alert(t('CSV import complete'), t('Imported {{count}} calculations.', { count: added }));
    } catch (error) {
      Alert.alert(t(importingBackup ? 'Import failed' : 'CSV import failed'), error?.message || t('Please try again.'));
    }
  };

  const openSaveDialog = (type) => {
    if (!requirePro()) return;
    setSaveType(type);
    setSaveTitle('');
    getSavedCalculations(user?.uid).then(setSavedCalculations);
    setSaveDialogVisible(true);
  };

  const confirmSave = async (titleOverride = saveTitle) => {
    if (!requirePro()) return;
    if (syncStatus.deletionPending) { setSaveDialogVisible(false); setAccountVisible(true); return; }
    const trimmedTitle = titleOverride.trim();
    if (!trimmedTitle) {
      Alert.alert(t("Name required"), t("Enter a name before saving."));
      return;
    }

    try {
      const calculations = await saveCalculationWithRows(expression, visibleDisplay, saveType, trimmedTitle, user?.uid);
      if (!calculations) return;
      setSavedCalculations(calculations);
      setSaveDialogVisible(false);
      setSaveTitle('');
    } catch (error) {
      console.log('Save calculation error:', error);
      Alert.alert(t("Save failed"), t("The calculation could not be saved on this device."));
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
        ? evaluateExpression(expression)
        : Number(display);
      setExpression((current) => {
        if (storedValue !== null && operator && freshInput) return `${pretty(String(storedValue))} ${key}`;
        if (storedValue !== null && operator && !freshInput) return `${current} ${key}`;
        return `${pretty(display)} ${key}`;
      });
      setStoredValue(nextStored);
      setOperator(key);
      setFreshInput(true);
      setDisplay(String(nextStored));
      return;
    }

    if (key === '=') {
      if (storedValue !== null && operator && display !== 'Error') {
        const expressionTokens = expression.trim().split(/\s+/).filter(Boolean);
        const hasPendingOperator = freshInput && operators.includes(expressionTokens.at(-1));
        const formula = hasPendingOperator
          ? expressionTokens.slice(0, -1).join(' ')
          : expression;
        const result = evaluateExpression(formula);
        if (result !== 'Error') void localHistory.add(formula, result).catch(historyError);
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
    setDisplay(next);
    setExpression((current) => {
      if (freshInput && current.includes('=')) return next;
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
      Alert.alert(t("Invalid calculation"), t("Enter a complete calculation using numbers and +, -, × or ÷."));
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
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <TapSoundProvider>
      <CustomLabelsProvider>
        <CalculatorView
          key={`${user?.uid || 'guest'}:${hasPro}:${today}`}
          display={visibleDisplay}
          expression={expression}
          onEditExpression={editExpression}
          historyEntries={historyEntries}
          onDeleteHistory={id => { void localHistory.remove(id).catch(historyError); }}
          savedCalculations={accessibleRecords(savedCalculations, hasPro, today)}
          listVisible={listVisible}
          tableVisible={tableVisible && hasPro}
          tableAction={tableAction}
          onTableActionHandled={() => setTableAction(null)}
          saveDialogVisible={saveDialogVisible}
          saveTitle={saveTitle}
          user={user}
          syncStatus={syncStatus}
          onRetrySync={undefined}
          onKeyPress={onPress}
          onSaveType={openSaveDialog}
          onList={showSavedCalculations}
          onCloseList={() => setListVisible(false)}
          onCloseTable={() => setTableVisible(false)}
          onCloseSaveDialog={() => setSaveDialogVisible(false)}
          onTitleChange={setSaveTitle}
          onConfirmSave={confirmSave}
          onOpenTable={showCalculatorTable}
          onExportCsv={exportCsvForRange}
          onBackupData={exportDataBackup}
          onImportCsv={importCsvFile}
          onClearAll={requestClearAllLocalData}
          onOpenCalendar={undefined}
          onUpdateCalculations={handleUpdateCalculations}
          onOpenAuth={() => user ? setAccountVisible(true) : setAuthVisible(true)}
          onSignOut={() => auth && signOut(auth)}
        />
        <AuthModal visible={authVisible} user={user} onClose={() => setAuthVisible(false)} />
        <AccountModal visible={accountVisible} user={user} deletionPending={syncStatus.deletionPending}
          onClose={() => setAccountVisible(false)} onSignOut={() => auth && signOut(auth)}
          onDeleted={() => { setAccountVisible(false); setAuthVisible(false); setSavedCalculations([]); setTableVisible(false); setListVisible(false); setSaveDialogVisible(false); setExpression(''); setDisplay('0'); setStoredValue(null); setOperator(null); setFreshInput(false); }} />
        <ProModal user={user} onSignIn={() => { setPaywall(false); setAuthVisible(true); }} />
      </CustomLabelsProvider>
      </TapSoundProvider>
    </SafeAreaProvider>
  );
}
