import Pressable from './SoundPressable';
import ButtonLabel from './ButtonLabel';
import { useTranslation } from 'react-i18next';
import { raisedButton } from '../buttonAppearance';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HISTORY_FIELDS } from '../calculationHistory';
import { formatSavedDate } from '../calculatorUtils';
import KeyboardModalFrame from './KeyboardModalFrame';

const labels = { edit: 'Edited', delete: 'Deleted', restore: 'Restored', undo: 'Undone' };

export default function CalculationHistoryModal({ visible, calculations, saving, onChange, onClose }) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [deletedOnly, setDeletedOnly] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteEvent, setDeleteEvent] = useState(null);
  const events = calculations.flatMap((row) => (row.history || []).map((event) => ({ row, event })))
    .filter(({ row, event }) => event.type !== 'purged' && (!deletedOnly || (row.deletedAt && event.type === 'delete' && row.history.at(-1)?.id === event.id))
      && [row.title, event.before.title, event.after.title].some((title) => String(title || '').toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => b.event.at.localeCompare(a.event.at));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardModalFrame style={s.backdrop}>
        <View style={s.panel}>
          <ScrollView keyboardShouldPersistTaps="handled" style={s.scroll} contentContainerStyle={{ paddingBottom: 12, gap: 12 }}>
          <Text style={s.heading}>{t("Calculation history")}</Text>
          <Text style={s.description}>{t("Deleted rows stay here until restored or permanently deleted.")}</Text>
          <TextInput value={search} onChangeText={setSearch} placeholder={t("Search names...")} placeholderTextColor="#94a3b8" style={s.input} accessibilityLabel={t("Search calculation history")} />
          <View style={s.actions}>
            <Pressable onPress={() => setDeletedOnly(false)} accessibilityRole="button" accessibilityState={{ selected: !deletedOnly }} style={[s.button, !deletedOnly && s.selected]}><ButtonLabel style={s.text}>{t("All changes")}</ButtonLabel></Pressable>
            <Pressable onPress={() => setDeletedOnly(true)} accessibilityRole="button" accessibilityState={{ selected: deletedOnly }} style={[s.button, deletedOnly && s.selected]}><ButtonLabel style={s.text}>{t("Deleted rows")}</ButtonLabel></Pressable>
          </View>
            {events.length ? events.map(({ row, event }) => {
              const latest = row.history.at(-1)?.id === event.id;
              const changes = Object.entries(HISTORY_FIELDS).filter(([field]) => String(event.before[field] ?? '') !== String(event.after[field] ?? ''));
              return (
                <View key={`${row.id}-${event.id}`} style={s.card}>
                  <Text style={s.title}>{event.after.title || event.before.title || t("Untitled calculation")}</Text>
                  <Text style={s.description}>{t(labels[event.type])} · {formatSavedDate(event.at)}</Text>
                  {event.type === 'delete' ? <Text style={s.text}>{event.before.info || event.before.expression || t("Empty calculation")}</Text> : null}
                  {changes.map(([field, label]) => (
                    <View key={field} style={s.change}>
                      <Text style={s.label}>{t(label)}</Text>
                      <Text selectable style={s.old}>{t('Before')}: {String(event.before[field] ?? '') || t("(empty)")}</Text>
                      <Text selectable style={s.text}>{t('After')}: {String(event.after[field] ?? '') || t("(empty)")}</Text>
                    </View>
                  ))}
                  {row.deletedAt && latest ? (
                    <View style={{ gap: 10 }}>
                    <View style={s.actions}>
                    <Pressable disabled={saving} style={[s.button, s.selected, saving && s.disabled]} onPress={() => onChange({ type: 'restore', id: row.id })} accessibilityRole="button"><ButtonLabel style={s.text}>{t("Restore calculation")}</ButtonLabel></Pressable>
                    <Pressable disabled={saving} style={[s.button, s.danger, saving && s.disabled]} onPress={() => setDeleteId(row.id)} accessibilityRole="button"><ButtonLabel style={s.text}>{t('Delete')}</ButtonLabel></Pressable>
                    </View>
                    {deleteId === row.id && <View style={s.confirmation}>
                      <Text accessibilityRole="alert" style={s.text}>{t('Permanently delete "{{name}}" and its history? This cannot be undone or restored.', { name: row.title || t('Untitled calculation') })}</Text>
                      <View style={s.actions}>
                        <Pressable disabled={saving} style={[s.button, s.danger, saving && s.disabled]} onPress={async () => {
                          const saved = await onChange({ type: 'permanentDelete', id: row.id });
                          if (saved !== false) setDeleteId(null);
                        }} accessibilityRole="button"><ButtonLabel style={s.text}>{t('Delete permanently')}</ButtonLabel></Pressable>
                        <Pressable disabled={saving} style={[s.button, saving && s.disabled]} onPress={() => setDeleteId(null)} accessibilityRole="button"><ButtonLabel style={s.text}>{t('Cancel')}</ButtonLabel></Pressable>
                      </View>
                    </View>}
                    </View>
                  ) : <View style={{ gap: 10 }}>
                    <View style={s.actions}>
                    {latest && event.type === 'edit' && !row.deletedAt && (
                    <Pressable disabled={saving} style={[s.button, saving && s.disabled]} onPress={() => onChange({ type: 'undo', id: row.id, eventId: event.id })} accessibilityRole="button"><ButtonLabel style={s.text}>{t("Undo this edit")}</ButtonLabel></Pressable>
                    )}
                    <Pressable disabled={saving} style={[s.button, s.danger, saving && s.disabled]} onPress={() => { setDeleteId(null); setDeleteEvent({ rowId: row.id, eventId: event.id }); }} accessibilityRole="button"><ButtonLabel style={s.text}>{t('Delete')}</ButtonLabel></Pressable>
                    </View>
                    {deleteEvent?.rowId === row.id && deleteEvent?.eventId === event.id && <View style={s.confirmation}>
                      <Text accessibilityRole="alert" style={s.text}>{t('Permanently delete this history entry? The current calculation will stay unchanged. This entry cannot be restored.')}</Text>
                      <View style={s.actions}>
                        <Pressable disabled={saving} style={[s.button, s.danger, saving && s.disabled]} onPress={async () => {
                          const saved = await onChange({ type: 'deleteHistoryEvent', id: row.id, eventId: event.id });
                          if (saved !== false) setDeleteEvent(null);
                        }} accessibilityRole="button"><ButtonLabel style={s.text}>{t('Delete permanently')}</ButtonLabel></Pressable>
                        <Pressable disabled={saving} style={[s.button, saving && s.disabled]} onPress={() => setDeleteEvent(null)} accessibilityRole="button"><ButtonLabel style={s.text}>{t('Cancel')}</ButtonLabel></Pressable>
                      </View>
                    </View>}
                  </View>}
                </View>
              );
            }) : <Text style={s.description}>{deletedOnly ? t("No deleted calculations found.") : t("No changes recorded yet. Saved edits and deletions will appear here.")}</Text>}
          </ScrollView>
          <Pressable style={[s.button, s.selected]} onPress={onClose} accessibilityRole="button"><ButtonLabel style={s.text}>{t("Back to table")}</ButtonLabel></Pressable>
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
  button: { ...raisedButton, minHeight: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: '#334155', padding: 8, borderRadius: 4 },
  selected: { backgroundColor: '#2563eb' },
  danger: { backgroundColor: '#991b1b' },
  confirmation: { gap: 10, padding: 12, borderWidth: 1, borderColor: '#ef4444', borderRadius: 8 },
  disabled: { opacity: 0.5 },
  scroll: { flexShrink: 1 },
  card: { backgroundColor: '#0f172a', padding: 14, borderRadius: 10, marginBottom: 12, gap: 10 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  text: { color: '#f8fafc', fontSize: 15, lineHeight: 22 },
  label: { color: '#93c5fd', fontWeight: '600', fontSize: 14 },
  old: { color: '#cbd5e1', fontSize: 15, lineHeight: 22 },
  change: { gap: 4 },
});
