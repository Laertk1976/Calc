import SyncStatus from './SyncStatus';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, BackHandler, Easing, PanResponder, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { keys, operators } from '../calculatorConstants';
import useCalculatorStyles from '../useCalculatorStyles';
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
  const styles = useCalculatorStyles();
  const { height } = useWindowDimensions();
  const scrollRef = useRef(null);
  const reveal = useRef(new Animated.Value(0)).current;
  const dragStart = useRef(0);
  const currentReveal = useRef(0);
  const [sizes, setSizes] = useState({ viewport: 0, header: 0, display: 0 });
  const measure = (part) => ({ nativeEvent }) => {
    const measured = nativeEvent.layout.height;
    setSizes((previous) => previous[part] === measured ? previous : { ...previous, [part]: measured });
  };
  const panelHeight = Math.max(0, (sizes.viewport || height) - sizes.header - sizes.display);
  const settle = (open) => Animated.timing(reveal, {
    toValue: open ? panelHeight : 0,
    duration: 450,
    easing: Easing.inOut(Easing.cubic),
    useNativeDriver: false,
  }).start();

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

  const swipe = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 1.5,
    onPanResponderGrant: () => {
      reveal.stopAnimation();
      dragStart.current = currentReveal.current;
    },
    onPanResponderMove: (_, { dy }) => {
      reveal.setValue(Math.max(0, Math.min(panelHeight, dragStart.current + dy)));
    },
    onPanResponderRelease: (_, { dy, vy }) => {
      const open = Math.abs(dy) > 40 ? dy > 0 : Math.abs(vy) > 0.5 ? vy > 0 : listVisible;
      settle(open);
      if (open) onList();
      else onCloseList();
    },
    onPanResponderTerminate: () => settle(listVisible),
  }), [listVisible, panelHeight, onList, onCloseList]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView ref={scrollRef} scrollEnabled={!listVisible} onLayout={measure('viewport')} contentContainerStyle={[styles.calculator, { flex: undefined, flexGrow: 1, justifyContent: 'flex-start', paddingBottom: listVisible ? 0 : 20 }]}>
        <View onLayout={measure('header')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <SyncStatus syncStatus={syncStatus} onRetrySync={onRetrySync} compact />
          </View>
          <Pressable onPress={user ? onSignOut : onOpenAuth} style={[styles.authButton, { marginBottom: 0 }]}>
            <Text style={styles.authButtonText}>{user ? 'Sign out' : 'Sign in'}</Text>
          </Pressable>
        </View>
        <Pressable onPress={onOpenTable} style={[styles.titleButton, { marginBottom: 0, marginTop: 4 }]} hitSlop={6} accessibilityRole="button">
          <Text style={styles.title}>CALCULATOR</Text>
        </Pressable>
        </View>
        <View onLayout={measure('display')} style={[styles.display, { touchAction: 'none', marginTop: listVisible ? 0 : 'auto' }]} {...swipe.panHandlers}>
          {expression ? <Text style={styles.expression}>{expression}</Text> : null}
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.displayText}>{pretty(display)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={listVisible ? 'Close saved calculations' : 'Open saved calculations'} accessibilityState={{ expanded: listVisible }} onPress={listVisible ? onCloseList : onList} hitSlop={8} style={{ alignSelf: 'center', paddingTop: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#64748b' }} />
          </Pressable>
        </View>
        <Animated.View style={{ height: reveal, overflow: 'hidden' }} pointerEvents={listVisible ? 'auto' : 'none'} accessibilityElementsHidden={!listVisible} importantForAccessibility={listVisible ? 'auto' : 'no-hide-descendants'}>
          <CalculationListModal inline visible={listVisible} swipeHandlers={swipe.panHandlers} calculations={savedCalculations.filter((item) => !item.deletedAt)} onClose={onCloseList} />
        </Animated.View>
        {!listVisible && <View style={styles.keypadLayout}>
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
        </View>}
        <CalculationTableModal
          visible={tableVisible}
          calculations={savedCalculations}
          syncStatus={syncStatus}
          onRetrySync={onRetrySync}
          onClose={onCloseTable}
          onUpdateCalculations={onUpdateCalculations}
        />
        <SaveCalculationModal visible={saveDialogVisible} title={saveTitle} userId={user?.uid} onTitleChange={onTitleChange} onConfirm={onConfirmSave} onClose={onCloseSaveDialog} />
      </ScrollView>
    </SafeAreaView>
  );
}

