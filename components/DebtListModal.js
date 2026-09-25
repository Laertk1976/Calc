import { useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import KeyboardModalFrame from './KeyboardModalFrame';
import SyncStatus from './SyncStatus';
import { debtNames, debtRows, monthDistance } from '../debtList';
import { pretty } from '../calculatorUtils';
import { formatSavedDate } from '../calculatorUtils';
import MonthRangeCalendar from './MonthRangeCalendar';

export default function DebtListModal({ calculations, onClose, onUpdate, syncStatus, onRetrySync, amountField = 'cred' }) {
  const { t, i18n } = useTranslation();
  const invoice = amountField === 'fact';
  const paidAt = invoice ? 'invoicePaidOffAt' : 'paidOffAt';
  const paidAmount = invoice ? 'invoicePaidOffAmount' : 'paidOffAmount';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [picker, setPicker] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState(null);
  const rows = debtRows(calculations, from, to, selectedName, amountField);
  const names = debtNames(calculations, search, amountField);
  const chooseName = name => {
    setSelectedName(name); setFrom(''); setTo(''); setPicker(false);
    setSearchVisible(false); setSearch(''); Keyboard.dismiss();
  };
  const total = rows.reduce((sum, row) => sum + (Number(String(row[amountField]).replace(/,/g, '')) || 0), 0);
  const monthLabel = key => key ? new Date(Number(key.slice(0, 4)), Number(key.slice(5)) - 1, 1).toLocaleDateString(i18n.resolvedLanguage, { month: 'long', year: 'numeric' }) : t('All months');
  const button = (label, action, disabled = false, inRow = false) => <Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={[s.button, inRow && s.rowButton, disabled && { opacity: 0.5 }]}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={s.buttonText}>{label}</Text></Pressable>;
  const payoffDetails = row => row[paidAt] ? <Text style={s.paid}>{t('Paid off amount')}: {pretty(String(row[paidAmount]))}{'\n'}{t('Paid off at')}: {new Date(row[paidAt]).toLocaleString(i18n.resolvedLanguage)}</Text> : null;
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
      await onUpdate({ type: 'edit', id: row.id, undoPayOff: true, amountField, paidOffAt: row[paidAt], changes: {} });
    } catch { setError(t('Save failed')); }
    finally { setSaving(false); }
  };
  const save = async (payOff = false) => {
    if (saving) return;
    const amount = String(draft[amountField]).trim().replace(/,/g, '');
    if (!draft.title.trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(amount) || !Number.isFinite(Number(amount))) {
      setError(t(invoice ? 'Enter a name and a valid invoice amount.' : 'Enter a name and a valid debt amount.')); return;
    }
    if (payOff && Number(amount) <= 0) {
      setError(t(invoice ? 'Enter a positive invoice amount to pay off.' : 'Enter a positive debt amount to pay off.')); return;
    }
    setSaving(true); setError('');
    try {
      await onUpdate({ type: 'edit', id: draft.id, payOff, amountField, changes: { title: draft.title.trim(), [amountField]: String(Number(amount)), comment: draft.comment } });
      setDraft(null);
    } catch { setError(t('Save failed')); }
    finally { setSaving(false); }
  };
  return <Modal transparent animationType="fade" visible onRequestClose={() => { if (!saving) { if (draft) { setDraft(null); setError(''); } else if (searchVisible) setSearchVisible(false); else if (picker) setPicker(false); else onClose(); } }}>
    <KeyboardModalFrame style={s.backdrop}>
      <View style={s.panel}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={s.heading}>{t(invoice ? 'Invoices' : 'Debts')}</Text>
          {!draft && <Pressable accessibilityRole="button" accessibilityLabel={t('Search names...')} accessibilityState={{ expanded: searchVisible }} onPress={() => { setSearchVisible(current => !current); setSearch(''); }} style={[s.button, { width: 44 }]}>
            <View style={{ width: 14, height: 14, borderWidth: 2, borderColor: '#f8fafc', borderRadius: 7 }} />
            <View style={{ position: 'absolute', width: 8, height: 2, backgroundColor: '#f8fafc', transform: [{ rotate: '45deg' }], right: 8, bottom: 10 }} />
          </Pressable>}
        </View>
        <SyncStatus syncStatus={syncStatus} onRetrySync={onRetrySync} />
        {draft ? <ScrollView keyboardShouldPersistTaps="handled">
          {payoffDetails(draft)}
          {['title', amountField, 'comment'].map(field => <View key={field}>
            <Text style={s.text}>{t({ title: 'Name', cred: 'Debt', fact: 'Invoice', comment: 'Comments' }[field])}</Text>
            <TextInput accessibilityLabel={t({ title: 'Name', cred: 'Debt', fact: 'Invoice', comment: 'Comments' }[field])} style={s.input} value={String(draft[field] ?? '')} editable={!saving} onChangeText={value => setDraft(current => ({ ...current, [field]: value }))} keyboardType={field === amountField ? 'numbers-and-punctuation' : 'default'} />
          </View>)}
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <View style={s.controls}>
            {button(t(saving ? 'Saving...' : 'Save'), () => save(), saving, true)}
            {button(t('Pay off'), () => save(true), saving || Number(String(draft[amountField]).replace(/,/g, '')) <= 0, true)}
            {button(t('Cancel'), () => { setDraft(null); setError(''); }, saving, true)}
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
            <Text style={[s.text, s.summaryText, { flexShrink: 1 }]}>{t('Name')}: {selectedName}</Text>
            {button(t('All names'), () => chooseName(null), false, true)}
          </View>}
          <View style={s.controls}>
            {button(t('Month calendar'), () => setPicker(current => !current), false, true)}
            {button(t('All months'), () => { setFrom(''); setTo(''); setPicker(false); }, false, true)}
          </View>
          <Text style={[s.text, s.summaryText]} accessibilityLiveRegion="polite">{!from ? t('All months') : from === to ? monthLabel(from) : `${monthLabel(from)} – ${monthLabel(to)}`}</Text>
          <Text style={[s.heading, s.detailHeading]}>{t('TOTAL')}: {pretty(String(Number(total.toPrecision(15))))}</Text>
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
            {picker && <MonthRangeCalendar from={from} to={to} onChange={(start, end) => { setFrom(start); setTo(end); }} />}
            {!rows.length && <Text style={s.text}>{t(invoice ? 'No invoices in these months.' : 'No debts in these months.')}</Text>}
            {rows.map(row => {
              const distance = monthDistance(row.savedAt || row.createdAt);
              return <View key={row.id} style={s.row}>
                <Text style={[s.heading, s.detailHeading]}>{row.title || t('Untitled')}</Text>
                <Text style={[s.amount, row[paidAt] && { color: '#86efac' }]}>{pretty(String(row[paidAt] ? row[paidAmount] : row[amountField]))}</Text>
                <View style={s.dateBlock}>
                  <Text style={s.text}>{t('Date')}: {t(formatSavedDate(row.savedAt || row.createdAt))}</Text>
                </View>
                {!!row[paidAt] && <Text style={s.paidBadge}>{t('Paid off')}</Text>}
                {payoffDetails(row)}
                <Text style={s.muted}>{distance === null ? t('No date') : distance < 0 ? t('In {{count}} months', { count: -distance }) : t('{{count}} months ago', { count: distance })}</Text>
                {!!row.comment && <Text style={s.text}>{row.comment}</Text>}
                <View style={s.controls}>
                  {button(t('Edit'), () => { setError(''); setDraft({ ...row }); }, saving, true)}
                  <Pressable accessibilityRole="button" disabled={saving} onPress={() => deleteDebt(row)} style={[s.button, s.rowButton, { backgroundColor: '#7f1d1d' }, saving && { opacity: 0.5 }]}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={s.buttonText}>{t('Delete')}</Text>
                  </Pressable>
                  {!!row[paidAt] && button(t('Undo payoff'), () => undoPayoff(row), saving, true)}
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
  panel: { backgroundColor: '#0f172a', borderRadius: 20, padding: 18, maxHeight: '95%', width: '100%', maxWidth: 640, alignSelf: 'center', flexShrink: 1, gap: 8 },
  heading: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  text: { color: '#e2e8f0', fontSize: 16 },
  muted: { color: '#94a3b8', fontSize: 14 },
  amount: { color: '#fca5a5', fontSize: 16.8, fontWeight: '600' },
  dateBlock: { backgroundColor: '#1e293b', borderRadius: 8, padding: 10, alignSelf: 'stretch' },
  paid: { color: '#86efac', fontSize: 14, marginVertical: 8 },
  paidBadge: { color: '#86efac', backgroundColor: '#14532d', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, fontWeight: '700' },
  controls: { flexDirection: 'row', flexWrap: 'nowrap', gap: 6, alignItems: 'center' },
  button: { backgroundColor: '#334155', paddingHorizontal: 8, paddingVertical: 8.4, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 30.8 },
  rowButton: { flex: 1, minWidth: 0 },
  buttonText: { color: '#e2e8f0', fontSize: 11.2, textAlign: 'center' },
  summaryText: { fontSize: 11.2 },
  detailHeading: { fontSize: 14 },
  row: { borderBottomWidth: 1, borderColor: '#334155', paddingVertical: 10, gap: 6 },
  input: { color: '#f8fafc', backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginVertical: 10, fontSize: 18 },
  error: { color: '#fca5a5', marginBottom: 10 },
});
