import { useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import KeyboardModalFrame from './KeyboardModalFrame';
import SyncStatus from './SyncStatus';
import { debtNames, debtRows, monthDistance } from '../debtList';
import { pretty } from '../calculatorUtils';
import { formatSavedDate } from '../calculatorUtils';
import MonthRangeCalendar from './MonthRangeCalendar';

export default function DebtListModal({ calculations, onClose, onUpdate, syncStatus, onRetrySync }) {
  const { t, i18n } = useTranslation();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [picker, setPicker] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState(null);
  const rows = debtRows(calculations, from, to, selectedName);
  const names = debtNames(calculations, search);
  const chooseName = name => {
    setSelectedName(name); setFrom(''); setTo(''); setPicker(false);
    setSearchVisible(false); setSearch(''); Keyboard.dismiss();
  };
  const total = rows.reduce((sum, row) => sum + (Number(String(row.cred).replace(/,/g, '')) || 0), 0);
  const monthLabel = key => key ? new Date(Number(key.slice(0, 4)), Number(key.slice(5)) - 1, 1).toLocaleDateString(i18n.resolvedLanguage, { month: 'long', year: 'numeric' }) : t('All months');
  const button = (label, action, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={[s.button, disabled && { opacity: 0.5 }]}><Text style={s.text}>{label}</Text></Pressable>;
  const payoffDetails = row => row.paidOffAt ? <Text style={s.paid}>{t('Paid off amount')}: {pretty(String(row.paidOffAmount))}{'\n'}{t('Paid off at')}: {new Date(row.paidOffAt).toLocaleString(i18n.resolvedLanguage)}</Text> : null;
  const deleteDebt = async row => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      await onUpdate({ type: 'delete', id: row.id });
    } catch { setError(t('Save failed')); }
    finally { setSaving(false); }
  };
  const undoPayoff = async row => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      await onUpdate({ type: 'edit', id: row.id, undoPayOff: true, paidOffAt: row.paidOffAt, changes: {} });
    } catch { setError(t('Save failed')); }
    finally { setSaving(false); }
  };
  const save = async (payOff = false) => {
    if (saving) return;
    const amount = String(draft.cred).trim().replace(/,/g, '');
    if (!draft.title.trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(amount) || !Number.isFinite(Number(amount))) {
      setError(t('Enter a name and a valid debt amount.')); return;
    }
    if (payOff && Number(amount) <= 0) {
      setError(t('Enter a positive debt amount to pay off.')); return;
    }
    setSaving(true); setError('');
    try {
      await onUpdate({ type: 'edit', id: draft.id, payOff, changes: { title: draft.title.trim(), cred: String(Number(amount)), comment: draft.comment } });
      setDraft(null);
    } catch { setError(t('Save failed')); }
    finally { setSaving(false); }
  };
  return <Modal transparent animationType="fade" visible onRequestClose={() => { if (!saving) { if (draft) { setDraft(null); setError(''); } else if (searchVisible) setSearchVisible(false); else if (picker) setPicker(false); else onClose(); } }}>
    <KeyboardModalFrame style={s.backdrop}>
      <View style={s.panel}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={s.heading}>{t('Debts')}</Text>
          {!draft && <Pressable accessibilityRole="button" accessibilityLabel={t('Search names...')} accessibilityState={{ expanded: searchVisible }} onPress={() => { setSearchVisible(current => !current); setSearch(''); }} style={[s.button, { width: 44 }]}>
            <View style={{ width: 14, height: 14, borderWidth: 2, borderColor: '#f8fafc', borderRadius: 7 }} />
            <View style={{ position: 'absolute', width: 8, height: 2, backgroundColor: '#f8fafc', transform: [{ rotate: '45deg' }], right: 8, bottom: 10 }} />
          </Pressable>}
        </View>
        <SyncStatus syncStatus={syncStatus} onRetrySync={onRetrySync} />
        {draft ? <ScrollView keyboardShouldPersistTaps="handled">
          {payoffDetails(draft)}
          {['title', 'cred', 'comment'].map(field => <View key={field}>
            <Text style={s.text}>{t({ title: 'Name', cred: 'Debt', comment: 'Comments' }[field])}</Text>
            <TextInput accessibilityLabel={t({ title: 'Name', cred: 'Debt', comment: 'Comments' }[field])} style={s.input} value={String(draft[field] ?? '')} editable={!saving} onChangeText={value => setDraft(current => ({ ...current, [field]: value }))} keyboardType={field === 'cred' ? 'numbers-and-punctuation' : 'default'} />
          </View>)}
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <View style={s.controls}>
            {button(t(saving ? 'Saving...' : 'Save'), () => save(), saving)}
            {button(t('Pay off'), () => save(true), saving || Number(String(draft.cred).replace(/,/g, '')) <= 0)}
            {button(t('Cancel'), () => { setDraft(null); setError(''); }, saving)}
          </View>
        </ScrollView> : <>
          {searchVisible && <View>
            <TextInput autoFocus value={search} onChangeText={setSearch} accessibilityLabel={t('Search names...')} placeholder={t('Search names...')} placeholderTextColor="#94a3b8" style={s.input} autoCorrect={false} />
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: 180 }}>
              {names.map(name => <Pressable key={name} accessibilityRole="button" onPress={() => chooseName(name)} style={s.button}><Text style={s.text}>{name}</Text></Pressable>)}
              {!names.length && <Text style={s.text}>{t('No matching names.')}</Text>}
            </ScrollView>
          </View>}
          {selectedName !== null && <View style={s.controls}>
            <Text style={[s.text, { flexShrink: 1 }]}>{t('Name')}: {selectedName}</Text>
            {button(t('All names'), () => chooseName(null))}
          </View>}
          <View style={s.controls}>
            {button(t('Month calendar'), () => setPicker(current => !current))}
            {button(t('All months'), () => { setFrom(''); setTo(''); setPicker(false); })}
          </View>
          <Text style={s.text} accessibilityLiveRegion="polite">{!from ? t('All months') : from === to ? monthLabel(from) : `${monthLabel(from)} – ${monthLabel(to)}`}</Text>
          <Text style={s.heading}>{t('TOTAL')}: {pretty(String(Number(total.toPrecision(15))))}</Text>
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
            {picker && <MonthRangeCalendar from={from} to={to} onChange={(start, end) => { setFrom(start); setTo(end); }} />}
            {!rows.length && <Text style={s.text}>{t('No debts in these months.')}</Text>}
            {rows.map(row => {
              const distance = monthDistance(row.savedAt || row.createdAt);
              return <View key={row.id} style={s.row}>
                <Text style={s.heading}>{row.title || t('Untitled')}</Text>
                <Text style={[s.amount, row.paidOffAt && { color: '#86efac' }]}>{pretty(String(row.paidOffAt ? row.paidOffAmount : row.cred))}</Text>
                <View style={s.dateBlock}>
                  <Text style={s.text}>{t('Date')}: {t(formatSavedDate(row.savedAt || row.createdAt))}</Text>
                </View>
                {!!row.paidOffAt && <Text style={s.paidBadge}>{t('Paid off')}</Text>}
                {payoffDetails(row)}
                <Text style={s.muted}>{distance === null ? t('No date') : distance < 0 ? t('In {{count}} months', { count: -distance }) : t('{{count}} months ago', { count: distance })}</Text>
                {!!row.comment && <Text style={s.text}>{row.comment}</Text>}
                <View style={s.controls}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                  {button(t('Edit'), () => { setError(''); setDraft({ ...row }); }, saving)}
                  <Pressable accessibilityRole="button" disabled={saving} onPress={() => deleteDebt(row)} style={[s.button, { backgroundColor: '#7f1d1d' }, saving && { opacity: 0.5 }]}>
                    <Text style={s.text}>{t('Delete')}</Text>
                  </Pressable>
                  </View>
                  {!!row.paidOffAt && button(t('Undo payoff'), () => undoPayoff(row), saving)}
                </View>
              </View>;
            })}
          </ScrollView>
          {button(t('Close'), onClose, saving)}
        </>}
      </View>
    </KeyboardModalFrame>
  </Modal>;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 16 },
  panel: { backgroundColor: '#0f172a', borderRadius: 20, padding: 18, maxHeight: '95%', width: '100%', maxWidth: 640, alignSelf: 'center', flexShrink: 1, gap: 12 },
  heading: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  text: { color: '#e2e8f0', fontSize: 16 },
  muted: { color: '#94a3b8', fontSize: 14 },
  amount: { color: '#fca5a5', fontSize: 24, fontWeight: '600' },
  dateBlock: { backgroundColor: '#1e293b', borderRadius: 8, padding: 10, alignSelf: 'stretch' },
  paid: { color: '#86efac', fontSize: 14, marginVertical: 8 },
  paidBadge: { color: '#86efac', backgroundColor: '#14532d', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, fontWeight: '700' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  button: { backgroundColor: '#334155', padding: 12, borderRadius: 10, alignItems: 'center', minHeight: 44 },
  row: { borderBottomWidth: 1, borderColor: '#334155', paddingVertical: 14, gap: 8 },
  input: { color: '#f8fafc', backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginVertical: 10, fontSize: 18 },
  error: { color: '#fca5a5', marginBottom: 10 },
});
