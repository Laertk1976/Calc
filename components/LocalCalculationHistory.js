import { useRef } from 'react';
import { Animated, PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Pressable from './SoundPressable';
import { pretty } from '../calculatorUtils';

function HistoryRow({ entry, onRestore, onDelete }) {
  const { t } = useTranslation();
  const offset = useRef(new Animated.Value(0)).current;
  const swiping = useRef(false);
  const responder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5,
    onPanResponderGrant: () => { swiping.current = true; },
    onPanResponderMove: (_, { dx }) => offset.setValue(dx),
    onPanResponderRelease: (_, { dx }) => {
      if (Math.abs(dx) >= 72) onDelete(entry.id);
      Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start(),
  });
  return <View style={styles.rowBackground}>
    <Animated.View {...responder.panHandlers} style={{ transform: [{ translateX: offset }] }}>
      <Pressable onPressIn={() => { swiping.current = false; }} onPress={() => { if (!swiping.current) onRestore(entry.expression); }}
        accessibilityRole="button" accessibilityHint={t('Tap to reuse. Swipe left or right to delete.')}
        accessibilityActions={[{ name: 'activate' }, { name: 'delete', label: t('Delete') }]}
        onAccessibilityAction={({ nativeEvent }) => nativeEvent.actionName === 'delete' ? onDelete(entry.id) : onRestore(entry.expression)}
        style={styles.row}>
        <Text style={styles.formula}>{entry.expression} <Text style={styles.result}>= {pretty(entry.result)}</Text></Text>
      </Pressable>
    </Animated.View>
  </View>;
}

export default function LocalCalculationHistory({ entries, onRestore, onDelete }) {
  const { t } = useTranslation();
  return <View style={styles.panel}>
    <Text style={styles.title}>{t('Calculation history')}</Text>
    <Text style={styles.hint}>{t('Tap to reuse. Swipe left or right to delete.')}</Text>
    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
      {entries.map(entry => <HistoryRow key={entry.id} entry={entry} onRestore={onRestore} onDelete={onDelete} />)}
      {!entries.length && <Text style={styles.hint}>{t('No calculations yet.')}</Text>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: 12, minHeight: 0 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  hint: { color: '#94a3b8', fontSize: 13, marginBottom: 14 },
  rowBackground: { backgroundColor: '#7f1d1d', borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  row: { backgroundColor: '#1e293b', padding: 16, minHeight: 56, justifyContent: 'center' },
  formula: { color: '#f8fafc', fontSize: 17 },
  result: { color: '#22c55e', fontWeight: '600' },
});
