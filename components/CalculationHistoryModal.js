import { raisedButton } from '../buttonAppearance';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HISTORY_FIELDS } from '../calculationHistory';
import { formatSavedDate } from '../calculatorUtils';
import KeyboardModalFrame from './KeyboardModalFrame';

const labels = { edit: 'Edited', delete: 'Deleted', restore: 'Restored', undo: 'Undone' };

export default function CalculationHistoryModal({ visible, calculations, saving, onChange, onClose }) {
  const [search, setSearch] = useState('');
  const [deletedOnly, setDeletedOnly] = useState(false);
  const events = calculations.flatMap((row) => (row.history || []).map((event) => ({ row, event })))
    .filter(({ row, event }) => (!deletedOnly || (row.deletedAt && event.type === 'delete' && row.history.at(-1)?.id === event.id))
      && [row.title, event.before.title, event.after.title].some((title) => String(title || '').toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => b.event.at.localeCompare(a.event.at));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardModalFrame style={s.backdrop}>
        <View style={s.panel}>
          <ScrollView keyboardShouldPersistTaps="handled" style={s.scroll} contentContainerStyle={{ paddingBottom: 12, gap: 12 }}>
          <Text style={s.heading}>Calculation history</Text>
          <Text style={s.description}>Changes are recorded from now on. Deleted rows stay here until restored.</Text>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search names..." placeholderTextColor="#94a3b8" style={s.input} accessibilityLabel="Search calculation history" />
          <View style={s.actions}>
            <Pressable onPress={() => setDeletedOnly(false)} accessibilityRole="button" accessibilityState={{ selected: !deletedOnly }} style={[s.button, !deletedOnly && s.selected]}><Text style={s.text}>All changes</Text></Pressable>
            <Pressable onPress={() => setDeletedOnly(true)} accessibilityRole="button" accessibilityState={{ selected: deletedOnly }} style={[s.button, deletedOnly && s.selected]}><Text style={s.text}>Deleted rows</Text></Pressable>
          </View>
            {events.length ? events.map(({ row, event }) => {
              const latest = row.history.at(-1)?.id === event.id;
              const changes = Object.entries(HISTORY_FIELDS).filter(([field]) => String(event.before[field] ?? '') !== String(event.after[field] ?? ''));
              return (
                <View key={`${row.id}-${event.id}`} style={s.card}>
                  <Text style={s.title}>{event.after.title || event.before.title || 'Untitled calculation'}</Text>
                  <Text style={s.description}>{labels[event.type]} · {formatSavedDate(event.at)}</Text>
                  {event.type === 'delete' ? <Text style={s.text}>{event.before.info || event.before.expression || 'Empty calculation'}</Text> : null}
                  {changes.map(([field, label]) => (
                    <View key={field} style={s.change}>
                      <Text style={s.label}>{label}</Text>
                      <Text selectable style={s.old}>Before: {String(event.before[field] ?? '') || '(empty)'}</Text>
                      <Text selectable style={s.text}>After: {String(event.after[field] ?? '') || '(empty)'}</Text>
                    </View>
                  ))}
                  {row.deletedAt && latest ? (
                    <Pressable disabled={saving} style={[s.button, s.selected, saving && s.disabled]} onPress={() => onChange({ type: 'restore', id: row.id })} accessibilityRole="button"><Text style={s.text}>Restore calculation</Text></Pressable>
                  ) : latest && event.type === 'edit' && !row.deletedAt ? (
                    <Pressable disabled={saving} style={[s.button, saving && s.disabled]} onPress={() => onChange({ type: 'undo', id: row.id, eventId: event.id })} accessibilityRole="button"><Text style={s.text}>Undo this edit</Text></Pressable>
                  ) : null}
                </View>
              );
            }) : <Text style={s.description}>{deletedOnly ? 'No deleted calculations found.' : 'No changes recorded yet. Saved edits and deletions will appear here.'}</Text>}
          </ScrollView>
          <Pressable style={[s.button, s.selected]} onPress={onClose} accessibilityRole="button"><Text style={s.text}>Back to table</Text></Pressable>
        </View>
      </KeyboardModalFrame>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)', padding: 18 },
  panel: { width: '100%', maxWidth: 620, maxHeight: '90%', alignSelf: 'center', backgroundColor: '#1e293b', borderRadius: 16, padding: 18, gap: 12 },
  heading: { color: '#f8fafc', fontSize: 23, fontWeight: '700' },
  description: { color: '#cbd5e1', fontSize: 14, lineHeight: 21 },
  input: { color: '#f8fafc', backgroundColor: '#0f172a', padding: 12, borderRadius: 8 },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  button: { ...raisedButton, minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#334155', padding: 12, borderRadius: 8 },
  selected: { backgroundColor: '#2563eb' },
  disabled: { opacity: 0.5 },
  scroll: { flexShrink: 1 },
  card: { backgroundColor: '#0f172a', padding: 14, borderRadius: 10, marginBottom: 12, gap: 10 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  text: { color: '#f8fafc', fontSize: 15, lineHeight: 22 },
  label: { color: '#93c5fd', fontWeight: '600', fontSize: 14 },
  old: { color: '#cbd5e1', fontSize: 15, lineHeight: 22 },
  change: { gap: 4 },
});
