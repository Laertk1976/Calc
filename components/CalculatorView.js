import Pressable from './SoundPressable';
import DesktopWorkspace from './DesktopWorkspace';
import ButtonLabel from './ButtonLabel';
import { useTranslation } from 'react-i18next';
import SyncStatus from './SyncStatus';
import LanguageSelector from './LanguageSelector';
import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useTapSound } from './TapSoundProvider';
import { Animated, BackHandler, Easing, Platform, ScrollView, Switch, Text, TextInput, Vibration, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { keys, operators } from '../calculatorConstants';
import useCalculatorStyles from '../useCalculatorStyles';
import { pretty } from '../calculatorUtils';
import CalculationListModal from './CalculationListModal';
import CalculationTableModal from './CalculationTableModal';
import SaveCalculationModal from './SaveCalculationModal';
import UtilityButtons from './UtilityButtons';
import DebtListModal from './DebtListModal';

const calculationSymbolStyle = { color: '#22c55e' };
const colorCalculationSymbols = value => String(value).split(/([=+\-×÷−*/%])/g).map((part, index) => (
  <Text key={index} style={/^[=+\-×÷−*/%]$/.test(part) ? calculationSymbolStyle : undefined}>{part}</Text>
));

export default function CalculatorView({
  display,
  expression,
  onEditExpression,
  savedCalculations,
  listVisible,
  tableVisible,
  saveDialogVisible,
  saveTitle,
  user,
  syncStatus,
  onRetrySync,
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
  onOpenAuth,
  onSignOut,
}) {
  const { t, i18n } = useTranslation();
  const { soundEnabled, toggleSound } = useTapSound();
  const [editing, setEditing] = useState(false);
  const [debtsVisible, setDebtsVisible] = useState(false);
  const [invoicesVisible, setInvoicesVisible] = useState(false);
  const [draft, setDraft] = useState('');
  const expressionInput = useRef(null);
  const beginEditing = () => {
    setDraft((expression || display).split('=')[0].trim());
    setEditing(true);
  };
  const playKeyFeedback = () => {
    if (Platform.OS === 'android') Vibration.vibrate(8);
  };
  const pressKey = (key) => {
    onKeyPress(key);
  };
  const finishEditing = () => {
    if (!editing) return;
    onEditExpression(draft);
    setEditing(false);
  };
  const { width, height, fontScale } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width > 1100;
  const [desktopTab, setDesktopTab] = useState('list');
  const [resultWidth, setResultWidth] = useState(0);
  const resultText = display === 'Error' ? t('Error') : pretty(display);
  // Size the formatted text, including separators, before native auto-fitting.
  // This also keeps the web display within its bounds.
  const resultUnits = [...resultText].reduce((total, char) => total + (/[.,\s]/.test(char) ? 0.35 : 0.7), 0);
  const availableResultWidth = resultWidth || Math.min(width, 720) - (width < 600 ? 24 : 40) - 16;
  const resultFontSize = Math.min(width < 380 ? 62.4 : 81.6, Math.max(1, (availableResultWidth - 8) / Math.max(1, resultUnits) / Math.max(1, fontScale)));
  const scrollRef = useRef(null);
  const reveal = useRef(new Animated.Value(0)).current;
  const currentReveal = useRef(0);
  const [sizes, setSizes] = useState({ viewport: 0, header: 0, display: 0 });
  const measure = (part) => ({ nativeEvent }) => {
    const measured = nativeEvent.layout.height;
    setSizes((previous) => previous[part] === measured ? previous : { ...previous, [part]: measured });
  };
  const panelHeight = Math.max(0, (sizes.viewport || height) - sizes.header - sizes.display);
  const maxKeypadHeight = !desktop && sizes.viewport && sizes.header && sizes.display
    ? Math.max(0, panelHeight - 20) : undefined;
  const styles = useCalculatorStyles(maxKeypadHeight);
  const settle = (open) => {
    const target = open ? panelHeight : 0;
    const remaining = Math.abs(target - currentReveal.current);
    reveal.stopAnimation();
    Animated.timing(reveal, {
      toValue: target,
      duration: Math.max(60, Math.round(220 * Math.min(1, remaining / Math.max(1, panelHeight)))),
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    const listener = reveal.addListener(({ value }) => { currentReveal.current = value; });
    return () => reveal.removeListener(listener);
  }, [reveal]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    settle(listVisible);
  }, [listVisible, panelHeight]);

  useEffect(() => {
    if (!listVisible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseList();
      return true;
    });
    return () => subscription.remove();
  }, [listVisible, onCloseList]);

  const displayPanel = (<View onLayout={measure('display')} style={[styles.display, { marginTop: desktop ? 0 : listVisible ? 0 : 'auto' }, desktop && { minHeight: 160, paddingHorizontal: 0, paddingTop: 16, paddingBottom: 24 }]}>
          <View style={{ width: '100%', minWidth: 0 }} onLayout={({ nativeEvent }) => setResultWidth(nativeEvent.layout.width)}>
            {expression ? <Text style={[styles.expression, { textAlign: 'right' }]}>{colorCalculationSymbols(expression)}</Text> : null}
            <TextInput
              ref={expressionInput}
              accessibilityLabel={t("Edit calculation")}
              style={[styles.displayText, { width: '100%', textAlign: 'right', fontSize: resultFontSize, padding: 0, color: '#f8fafc', includeFontPadding: false }]}
              value={editing ? draft : resultText}
              onFocus={beginEditing}
              onChangeText={setDraft}
              onBlur={finishEditing}
              onSubmitEditing={() => expressionInput.current?.blur()}
              cursorColor="#22c55e"
              selectionColor="#22c55e66"
              underlineColorAndroid="transparent"
              autoCorrect={false}
              autoCapitalize="none"
              keyboardType="default"
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
            />
          </View>
          {!desktop && <Pressable accessibilityRole="button" accessibilityLabel={listVisible ? t("Close saved calculations") : t("Open saved calculations")} accessibilityState={{ expanded: listVisible }} onPress={listVisible ? onCloseList : onList} hitSlop={8} style={{ alignSelf: 'center', paddingTop: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#64748b' }} />
          </Pressable>}
        </View>);
  const keypadPanel = (<View style={[styles.keypadLayout, desktop && { gap: 8 }]}>
          <View style={[styles.keypad, desktop && { gap: 8 }]}>
            {keys.map((row) => (
              <View key={row.join('')} style={[styles.keyRow, desktop && { gap: 8 }]}>
                {row.map((key) => {
                  const isOperator = operators.includes(key) || key === '=';
                  const isFunction = ['AC', 'C', '±', '%'].includes(key);
                  return (
                    <Pressable key={key} android_disableSound onPressIn={playKeyFeedback} onPress={() => pressKey(key)} style={({ pressed }) => [styles.key, desktop && { height: 54 }, isOperator && styles.operator, isFunction && styles.function, pressed && styles.pressed]}>
                      <Text style={[styles.keyText, isFunction && styles.functionText]}>{key}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <UtilityButtons desktop={desktop} maxKeypadHeight={maxKeypadHeight} onSaveType={onSaveType} onList={desktop ? () => setDesktopTab('list') : onList} onButtonPress={playKeyFeedback} onDebts={() => desktop ? setDesktopTab('debts') : setDebtsVisible(true)} onInvoices={() => desktop ? setDesktopTab('invoices') : setInvoicesVisible(true)} />
        </View>);
  if (desktop) return <>
    <DesktopWorkspace tab={desktopTab} onTabChange={setDesktopTab} display={displayPanel} keypad={keypadPanel}
      calculations={savedCalculations} onUpdateCalculations={onUpdateCalculations}
      user={user} onOpenAuth={onOpenAuth} onSignOut={onSignOut} syncStatus={syncStatus} onRetrySync={onRetrySync} />
    <SaveCalculationModal visible={saveDialogVisible} title={saveTitle} userId={user?.uid} onTitleChange={onTitleChange} onConfirm={onConfirmSave} onClose={onCloseSaveDialog} />
  </>;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView ref={scrollRef} scrollEnabled={!listVisible} onLayout={measure('viewport')} contentContainerStyle={[styles.calculator, { flex: undefined, flexGrow: 1, justifyContent: 'flex-start', paddingBottom: listVisible ? 0 : 20 }]}>
        <View onLayout={measure('header')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <SyncStatus syncStatus={syncStatus} onRetrySync={onRetrySync} compact />
          </View>
          <LanguageSelector />
          <Pressable accessibilityRole="button" onPress={onOpenAuth} style={[styles.authButton, styles.headerControl]}>
            <ButtonLabel numberOfLines={1} style={styles.authButtonText}>{user ? t("Account") : t("Sign in")}</ButtonLabel>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
        <Pressable onPress={onOpenTable} style={({ pressed }) => [styles.titleButton, { marginBottom: 0 }, pressed && styles.pressed]} hitSlop={6} accessibilityRole="button">
          <Text style={styles.title}>CALC</Text>
        </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.authButtonText}>{t('Sound')}</Text>
            <Switch accessibilityLabel={t('Sound')} value={soundEnabled} onValueChange={toggleSound} trackColor={{ false: '#475569', true: '#15803d' }} thumbColor={soundEnabled ? '#86efac' : '#cbd5e1'} />
          </View>
        </View>
        </View>
        {displayPanel}
        <Animated.View style={{ height: reveal, overflow: 'hidden' }} pointerEvents={listVisible ? 'auto' : 'none'} accessibilityElementsHidden={!listVisible} importantForAccessibility={listVisible ? 'auto' : 'no-hide-descendants'}>
          <View style={{ height: panelHeight }}>
          <CalculationListModal inline visible={listVisible} calculations={savedCalculations.filter((item) => !item.deletedAt)} onClose={onCloseList} />
          </View>
        </Animated.View>
        {!listVisible && keypadPanel}
        <CalculationTableModal
          visible={tableVisible}
          calculations={savedCalculations}
          syncStatus={syncStatus}
          onRetrySync={onRetrySync}
          onClose={onCloseTable}
          onUpdateCalculations={onUpdateCalculations}
        />
      </ScrollView>
      <SaveCalculationModal visible={saveDialogVisible} title={saveTitle} userId={user?.uid} onTitleChange={onTitleChange} onConfirm={onConfirmSave} onClose={onCloseSaveDialog} />
      {invoicesVisible && <DebtListModal amountField="fact" calculations={savedCalculations} onClose={() => setInvoicesVisible(false)} onUpdate={onUpdateCalculations} syncStatus={syncStatus} onRetrySync={onRetrySync} />}
      {debtsVisible && <DebtListModal calculations={savedCalculations} onClose={() => setDebtsVisible(false)} onUpdate={onUpdateCalculations} syncStatus={syncStatus} onRetrySync={onRetrySync} />}
    </SafeAreaView>
  );
}
