import Pressable from './SoundPressable';
import DesktopWorkspace from './DesktopWorkspace';
import { useTranslation } from 'react-i18next';
import SettingsDrawer from './SettingsDrawer';
import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, BackHandler, Dimensions, Easing, NativeModules, Platform, ScrollView, Text, TextInput, Vibration, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getWorkspaceLayout } from '../workspaceLayout';
import SafeAreaView from './CalculatorSafeArea';
import { keys, operators } from '../calculatorConstants';
import useCalculatorStyles from '../useCalculatorStyles';
import { pretty } from '../calculatorUtils';
import CalculationListModal from './CalculationListModal';
import CalculationTableModal from './CalculationTableModal';
import SaveCalculationModal from './SaveCalculationModal';
import UtilityButtons from './UtilityButtons';
import DebtListModal from './DebtListModal';
import LocalCalculationHistory from './LocalCalculationHistory';
import { usePro } from './ProProvider';

const calculationSymbolStyle = { color: '#22c55e' };
const colorCalculationSymbols = value => String(value).split(/([=+\-×÷−*/%])/g).map((part, index) => (
  <Text key={index} style={/^[=+\-×÷−*/%]$/.test(part) ? calculationSymbolStyle : undefined}>{part}</Text>
));

export default function CalculatorView({
  display,
  expression,
  onEditExpression,
  historyEntries,
  onDeleteHistory,
  savedCalculations,
  listVisible,
  tableVisible,
  tableAction,
  onTableActionHandled,
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
  onExportCsv,
  onImportCsv,
  onOpenCalendar,
  onUpdateCalculations,
  onOpenAuth,
  onSignOut,
}) {
  const { t, i18n } = useTranslation();
  const { hasPro, requirePro } = usePro();
  const [editing, setEditing] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const drawerVisible = listVisible || historyVisible;
  const closeDrawer = () => { setHistoryVisible(false); onCloseList(); };
  useEffect(() => { if (listVisible || tableVisible) setHistoryVisible(false); }, [listVisible, tableVisible]);
  const [debtsVisible, setDebtsVisible] = useState(false);
  const [invoicesVisible, setInvoicesVisible] = useState(false);
  const [draft, setDraft] = useState('');
  const expressionInput = useRef(null);
  const expressionScrollRef = useRef(null);
  const scrollExpressionToEnd = () => expressionScrollRef.current?.scrollToEnd({ animated: false });
  const beginEditing = () => {
    setDraft((expression || display).split('=')[0].trim());
    setEditing(true);
  };
  const playKeyFeedback = () => {
    if (Platform.OS === 'android') {
      if (NativeModules.CalcButtonFeedback) NativeModules.CalcButtonFeedback.haptic();
      else Vibration.vibrate(35);
    }
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
  const [sizes, setSizes] = useState({ viewport: 0, header: 0, display: 0 });
  const [workspaceHeight, setWorkspaceHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const screen = Dimensions.get('screen');
  const workspaceLayout = getWorkspaceLayout({ platform: Platform.OS, width, height, screenWidth: screen.width, screenHeight: screen.height, insets, calculatorHeight: workspaceHeight });
  const { desktop, compact } = workspaceLayout;
  const [desktopTab, setDesktopTab] = useState('list');
  useEffect(() => {
    if (!desktop) return;
    if (tableVisible) setDesktopTab('table');
    else if (debtsVisible) setDesktopTab('debts');
    else if (invoicesVisible) setDesktopTab('invoices');
    else if (listVisible) setDesktopTab('list');
    setDebtsVisible(false);
    setInvoicesVisible(false);
    setHistoryVisible(false);
    onCloseList();
    onCloseTable();
  }, [desktop]);
  const [resultWidth, setResultWidth] = useState(0);
  const resultText = display === 'Error' ? t('Error') : pretty(display);
  // Size the formatted text, including separators, before native auto-fitting.
  // This also keeps the web display within its bounds.
  const resultUnits = [...resultText].reduce((total, char) => total + (/[.,\s]/.test(char) ? 0.35 : 0.7), 0);
  const availableResultWidth = resultWidth || Math.min(width, 720) - (width < 600 ? 24 : 40) - 16;
  const resultFontSize = Math.min(compact ? 28 : width < 380 ? 62.4 : 81.6, Math.max(1, (availableResultWidth - 8) / Math.max(1, resultUnits) / Math.max(1, fontScale)));
  const scrollRef = useRef(null);
  const reveal = useRef(new Animated.Value(0)).current;
  const currentReveal = useRef(0);
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
    settle(drawerVisible);
  }, [drawerVisible, panelHeight]);

  useEffect(() => {
    if (!drawerVisible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeDrawer();
      return true;
    });
    return () => subscription.remove();
  }, [drawerVisible, onCloseList]);

  const displayPanel = (<View onLayout={measure('display')} style={[styles.display, { marginTop: desktop ? 0 : drawerVisible ? 0 : 'auto' }, desktop && { minHeight: 160, paddingHorizontal: 0, paddingTop: 16, paddingBottom: 24 }, compact && { minHeight: 48, paddingTop: 0, paddingBottom: 4 }]}>
          <View style={{ width: '100%', minWidth: 0 }} onLayout={({ nativeEvent }) => setResultWidth(nativeEvent.layout.width)}>
            {editing ? (
              <TextInput
                ref={expressionInput}
                accessibilityLabel={t("Edit calculation")}
                style={[styles.expression, { width: '100%', textAlign: 'right', padding: 0, borderWidth: 0, includeFontPadding: false }, compact && { fontSize: 16, marginBottom: 2 }, Platform.OS === 'web' && { outlineStyle: 'none' }]}
                value={draft}
                onChangeText={setDraft}
                onBlur={finishEditing}
                onSubmitEditing={() => expressionInput.current?.blur()}
                autoFocus
                multiline={false}
                cursorColor="#22c55e"
                selectionColor="#22c55e66"
                underlineColorAndroid="transparent"
                autoCorrect={false}
                autoCapitalize="none"
                keyboardType="default"
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
              />
            ) : expression ? (
              <ScrollView
                ref={expressionScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0, flexShrink: 0, width: '100%' }}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
                onContentSizeChange={scrollExpressionToEnd}
                onLayout={scrollExpressionToEnd}
              >
                <Pressable onPress={beginEditing} accessibilityRole="button" accessibilityLabel={t("Edit calculation")}>
                  <Text numberOfLines={1} style={[styles.expression, { textAlign: 'right', flexShrink: 0 }, compact && { fontSize: 16, marginBottom: 2 }]}>
                    {colorCalculationSymbols(expression)}
                  </Text>
                </Pressable>
              </ScrollView>
            ) : compact ? <View accessible={false} style={{ height: 23, marginBottom: 2 }} /> : null}
            <Text
              numberOfLines={1}
              style={[styles.displayText, { width: '100%', textAlign: 'right', fontSize: resultFontSize, padding: 0, color: '#f8fafc', includeFontPadding: false }]}
            >
              {resultText}
            </Text>
          </View>
          {!desktop && <Pressable accessibilityRole="button" accessibilityLabel={drawerVisible ? t("Close calculation history") : t("Open calculation history")} accessibilityState={{ expanded: drawerVisible }} onPress={() => { if (drawerVisible) closeDrawer(); else { finishEditing(); setHistoryVisible(true); } }} hitSlop={8} style={{ alignSelf: 'center', paddingTop: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#64748b' }} />
          </Pressable>}
        </View>);
  const keypadPanel = (<View style={[styles.keypadLayout, desktop && { gap: compact ? 4 : 8 }]}>
          <View style={[styles.keypad, desktop && { gap: compact ? 4 : 8 }]}>
            {keys.map((row) => (
              <View key={row.join('')} style={[styles.keyRow, desktop && { gap: compact ? 4 : 8 }]}>
                {row.map((key) => {
                  const isOperator = operators.includes(key) || key === '=';
                  const isFunction = ['AC', 'C', '±', '%'].includes(key);
                  return (
                    <Pressable key={key} android_disableSound onPressIn={() => compact ? pressKey(key) : playKeyFeedback()} onPress={() => { if (!compact) pressKey(key); }} style={({ pressed }) => [styles.key, desktop && { height: workspaceLayout.keyHeight }, isOperator && styles.operator, isFunction && styles.function, pressed && (compact ? { backgroundColor: '#334155', opacity: 0.9 } : styles.pressed)]}>
                      <Text style={[styles.keyText, compact && { fontSize: 22 }, isFunction && styles.functionText]}>{key}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <UtilityButtons desktop={desktop} compactKeyHeight={compact ? workspaceLayout.keyHeight : undefined} maxKeypadHeight={maxKeypadHeight} onSaveType={onSaveType} onList={desktop ? () => setDesktopTab('list') : onList} onButtonPress={playKeyFeedback} onDebts={() => { if (!requirePro()) return; desktop ? setDesktopTab('debts') : setDebtsVisible(true); }} onInvoices={() => { if (!requirePro()) return; desktop ? setDesktopTab('invoices') : setInvoicesVisible(true); }} />
        </View>);
  if (desktop) return <>
    <StatusBar style="light" hidden={compact && Platform.OS !== 'web'} />
    <DesktopWorkspace layout={workspaceLayout} onCalculatorLayout={({ nativeEvent }) => setWorkspaceHeight(nativeEvent.layout.height)} tab={desktopTab} onTabChange={setDesktopTab} display={displayPanel} keypad={keypadPanel}
      calculations={savedCalculations} onUpdateCalculations={onUpdateCalculations}
      user={user} onOpenAuth={onOpenAuth} onSignOut={onSignOut} onExportCsv={onExportCsv} onImportCsv={onImportCsv} onOpenCalendar={onOpenCalendar} tableAction={tableAction} onTableActionHandled={onTableActionHandled} syncStatus={syncStatus} onRetrySync={onRetrySync} />
    <SaveCalculationModal visible={saveDialogVisible} title={saveTitle} userId={user?.uid} onTitleChange={onTitleChange} onConfirm={onConfirmSave} onClose={onCloseSaveDialog} />
  </>;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" hidden={false} />
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" scrollEnabled={!drawerVisible} onLayout={measure('viewport')} contentContainerStyle={[styles.calculator, { flex: undefined, flexGrow: 1, justifyContent: 'flex-start', paddingBottom: drawerVisible ? 0 : 20 }]}>
        <View onLayout={measure('header')} style={{ paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <SettingsDrawer user={user} onOpenAuth={onOpenAuth} onExportCsv={onExportCsv} onImportCsv={onImportCsv} onOpenCalendar={onOpenCalendar} syncStatus={syncStatus} onRetrySync={onRetrySync} />
          </View>
          <Pressable onPress={onOpenTable} style={({ pressed }) => [styles.titleButton, { alignSelf: 'flex-start', marginTop: 4, marginBottom: 0 }, pressed && styles.pressed]} hitSlop={6} accessibilityRole="button">
            <Text style={styles.title}>CALC</Text>
          </Pressable>
        </View>
        {displayPanel}
        <Animated.View style={{ height: reveal, overflow: 'hidden' }} pointerEvents={drawerVisible ? 'auto' : 'none'} accessibilityElementsHidden={!drawerVisible} importantForAccessibility={drawerVisible ? 'auto' : 'no-hide-descendants'}>
          <View style={{ height: panelHeight }}>
          {historyVisible ? <LocalCalculationHistory entries={historyEntries} onDelete={onDeleteHistory} onRestore={formula => { onEditExpression(formula); closeDrawer(); }} /> : <CalculationListModal inline visible={listVisible} calculations={savedCalculations.filter((item) => !item.deletedAt)} onClose={onCloseList} />}
          </View>
        </Animated.View>
        {!drawerVisible && keypadPanel}
        <CalculationTableModal
          visible={tableVisible}
          calculations={savedCalculations}
          syncStatus={syncStatus}
          onRetrySync={onRetrySync}
          onClose={onCloseTable}
          onUpdateCalculations={onUpdateCalculations}
          requestedAction={tableAction}
          onRequestedActionHandled={onTableActionHandled}
        />
      </ScrollView>
      <SaveCalculationModal visible={saveDialogVisible} title={saveTitle} userId={user?.uid} onTitleChange={onTitleChange} onConfirm={onConfirmSave} onClose={onCloseSaveDialog} />
      {hasPro && invoicesVisible && <DebtListModal amountField="fact" calculations={savedCalculations} onClose={() => setInvoicesVisible(false)} onUpdate={onUpdateCalculations} syncStatus={syncStatus} onRetrySync={onRetrySync} />}
      {hasPro && debtsVisible && <DebtListModal calculations={savedCalculations} onClose={() => setDebtsVisible(false)} onUpdate={onUpdateCalculations} syncStatus={syncStatus} onRetrySync={onRetrySync} />}
    </SafeAreaView>
  );
}
