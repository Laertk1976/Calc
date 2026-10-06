import { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Pressable from './SoundPressable';
import KeyboardModalFrame from './KeyboardModalFrame';

// Mount a fresh dialog for each name so selections never leak between edits.
export default function RenameNameModal({ name, calculations, onUpdate, onClose, onRenamed }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState([name]);
  const [target, setTarget] = useState(name);
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const active = calculations.filter(row => !row.deletedAt && !row.permanentlyDeletedAt);
  const names = [...new Set(active.map(row => row.title || ''))].sort((a, b) => a.localeCompare(b));
  const title = target.trim();
  const count = active.filter(row => selected.includes(row.title || '')).length;
  const merging = selected.length > 1 || (names.includes(title) && !selected.includes(title));
  const unchanged = selected.length === 1 && selected[0] === title;
  const close = () => { if (!busy.current) onClose(); };
  const save = async () => {
    if (busy.current || !title || !selected.length || unchanged) return;
    if (merging && !confirming) { setConfirming(true); return; }
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      await onUpdate({ type: 'renameName', fromNames: selected, toName: title, mergeConfirmed: confirming });
      onRenamed?.(title, selected);
      onClose();
    } catch {
      setError(t('Rename failed. Your names may have changed. Reopen this dialog and try again.'));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return <Modal transparent visible animationType="fade" onRequestClose={close}>
    <KeyboardModalFrame style={s.backdrop}>
      <View style={s.panel}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={s.heading}>{t('Rename names')}</Text>
          {confirming ? <>
            <Text style={s.text}>{t('Combine all entries under "{{name}}"?', { name: title })}</Text>
            <Text style={s.text}>{selected.map(value => value || t('Untitled')).join(' + ')} → {title}</Text>
          </> : <>
            <Text style={s.text}>{t('Select names for the same person or store. Changes apply across all dates and lists.')}</Text>
            <TextInput accessibilityLabel={t('Search names...')} placeholder={t('Search names...')} placeholderTextColor="#94a3b8" style={s.input} value={search} onChangeText={setSearch} editable={!saving} />
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
              {names.filter(value => value.toLowerCase().includes(search.toLowerCase())).map(value => <Pressable key={value} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(value) }} disabled={saving} onPress={() => setSelected(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])} style={s.name}>
                <Text style={s.text}>{selected.includes(value) ? '☑' : '☐'} {value || t('Untitled')}</Text>
              </Pressable>)}
            </ScrollView>
            <Text style={s.text}>{t('New name')}</Text>
            <TextInput accessibilityLabel={t('New name')} value={target} onChangeText={setTarget} editable={!saving} style={s.input} autoCorrect={false} />
          </>}
          <Text style={s.text}>{t('Selected entries: {{count}}', { count })}</Text>
          <Text style={s.text}>{t('Every saved entry, result, date and payment history is kept. Duplicate entries are not removed.')}</Text>
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <View style={s.actions}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => confirming ? setConfirming(false) : close()} style={s.button}><Text style={s.text}>{t(confirming ? 'Back' : 'Cancel')}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={saving || !title || !selected.length || unchanged} onPress={save} style={[s.button, { backgroundColor: '#1d4ed8', opacity: saving || !title || !selected.length || unchanged ? 0.5 : 1 }]}><Text style={s.text}>{t(saving ? 'Saving...' : confirming ? 'Combine names' : 'Rename')}</Text></Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardModalFrame>
  </Modal>;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0009' },
  panel: { width: '100%', maxWidth: 480, maxHeight: '90%', alignSelf: 'center', padding: 16, borderRadius: 16, backgroundColor: '#1e293b' },
  heading: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 12 },
  text: { color: '#e2e8f0', fontSize: 14, marginVertical: 4, flexShrink: 1 },
  input: { color: '#f8fafc', backgroundColor: '#0f172a', padding: 12, borderRadius: 8, marginVertical: 8, fontSize: 16 },
  name: { paddingVertical: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  button: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 8, backgroundColor: '#334155' },
  error: { color: '#fca5a5', marginTop: 8 },
});
