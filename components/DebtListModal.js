import Pressable from './SoundPressable';
import PanelModal from './PanelModal';
import ListExportActions from './ListExportActions';
import { useEffect, useState } from 'react';
import { usePro } from './ProProvider';
import { Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import KeyboardModalFrame from './KeyboardModalFrame';
import SyncStatus from './SyncStatus';
import { debtNames, debtRows, groupDebtRows, monthDistance } from '../debtList';
import { latestUndoableChange, normalizeCalculation } from '../calculationHistory';
import { pretty } from '../calculatorUtils';
import { formatSavedDate } from '../calculatorUtils';
import DateRangeCalendar from './DateRangeCalendar';
import useCalculatorStyles from '../useCalculatorStyles';

export default function DebtListModal({ calculations, onClose, onUpdate, syncStatus, onRetrySync, amountField = 'cred', inline = false }) {
  const { hasPro, requirePro, today: todayKey } = usePro();
  const { t, i18n } = useTranslation();
  const styles = useCalculatorStyles();
  const invoice = amountField === 'fact';
  const paidAt = invoice ? 'invoicePaidOffAt' : 'paidOffAt';
  const paidAmount = invoice ? 'invoicePaidOffAmount' : 'paidOffAmount';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [picker, setPicker] = useState(false);
  const [draft, setDraft] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState(null);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  useEffect(() => {
    if (!hasPro) {
      setFrom(todayKey.split('-').reverse().join('/')); setTo(todayKey.split('-').reverse().join('/'));
      setPicker(false); setSearchVisible(false); setSearch(''); setSelectedName(null); setDraft(null); setSelectedId(null);
    }
  }, [hasPro, todayKey]);
  const filterUnpaid = !invoice && unpaidOnly;
  const undoable = latestUndoableChange(calculations.map(normalizeCalculation).filter(row =>
    selectedId?.includes(row.id) &&
    [row, row.history.at(-1)?.before].some(value => value?.[amountField] !== undefined && value[amountField] !== null && value[amountField] !== '')
  ));
  const undoLatest = async () => {
    if (!requirePro()) return;
    if (saving || !undoable) return;
    setSaving(true); setError('');
    try {
      await onUpdate({ type: 'undo', id: undoable.row.id, eventId: undoable.event.id });
    } catch { setError(t('Save failed')); }
    finally { setSaving(false); }
  };
  const rows = debtRows(calculations, from.split('/').reverse().join('-'), to.split('/').reverse().join('-'), selectedName, amountField, filterUnpaid);
  const selectedRows = selectedId === null ? [] : debtRows(calculations, '', '', null, amountField).filter(row => selectedId.includes(row.id));
  const selectedRow = selectedRows[0];
  const groups = groupDebtRows(rows, amountField);
  const visibleRows = selectedRow ? selectedRows : groups.map(group => group.rows[0]);
  const openRows = entries => { setSelectedId(entries.map(row => row.id)); setError(''); Keyboard.dismiss(); };
  const names = debtNames(calculations, search, amountField);
  const chooseName = name => {
    setSelectedName(name); setFrom(''); setTo(''); setPicker(false);
    setSearchVisible(false); setSearch(''); Keyboard.dismiss();
  };
  const total = rows.reduce((sum, row) => sum + (Number(String(row[amountField]).replace(/,/g, '')) || 0), 0);
  const rangeLabel = !from && !to ? t('All dates') : from === to ? from : `${from} - ${to}`;
  const today = new Date();
  const calendarLabel = !from && !to
    ? `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
    : rangeLabel;
  const button = (label, action, disabled = false, inRow = false) => <Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={[s.button, inRow && s.rowButton, disabled && { opacity: 0.5 }]}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={s.buttonText}>{label}</Text></Pressable>;
  const payoffDetails = row => row[paidAt] ? <Text style={s.paid}>{t('Paid off amount')}: {pretty(String(row[paidAmount]))}{'\n'}{t('Paid off at')}: {new Date(row[paidAt]).toLocaleString(i18n.resolvedLanguage)}</Text> : null;
  const deleteDebt = async row => {
    if (!requirePro()) return;
    if (saving) return;
    setSaving(true); setError('');
    try {
      await onUpdate({ type: 'delete', id: row.id });
      if (selectedId?.length === 1 && selectedId[0] === row.id) setSelectedId(null);
    } catch { setError(t('Save failed')); }
    finally { setSaving(false); }
  };
  const undoPayoff = async row => {
    if (!requirePro()) return;
    if (saving) return;
    setSaving(true); setError('');
    try {
      await onUpdate({ type: 'edit', id: row.id, undoPayOff: true, amountField, paidOffAt: row[paidAt], changes: {} });
    } catch { setError(t('Save failed')); }
    finally { setSaving(false); }
  };
  const save = async (payOff = false) => {
    if (!requirePro()) return;
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
      await onUpdate({ type: 'edit', id: draft.id, payOff, amountField, changes: { [amountField]: String(Number(amount)), comment: draft.comment } });
      setDraft(null);
    } catch { setError(t('Save failed')); }
    finally { setSaving(false); }
  };
  return <PanelModal inline={inline} transparent animationType="fade" visible onRequestClose={() => { if (!saving) { if (draft) { setDraft(null); setError(''); } else if (selectedRow) { setSelectedId(null); setError(''); } else if (searchVisible) setSearchVisible(false); else if (picker) setPicker(false); else onClose?.(); } }}>
    <KeyboardModalFrame style={[s.backdrop, inline && { padding: 0, backgroundColor: 'transparent' }]}>
      <View style={[s.panel, selectedRow && { height: '95%' }, inline && { flex: 1, minHeight: 0, maxHeight: '100%', maxWidth: '100%', borderRadius: 0, backgroundColor: '#1e293b' }]}>
        <View style={s.header}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[s.heading, s.headerTitle]}>{t(invoice ? 'Invoices' : 'Debts')}</Text>
          {!draft && !selectedRow && <View style={[s.controls, s.headerControls]}>
            {!invoice && <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Unpaid only')}
              accessibilityState={{ selected: unpaidOnly }}
              onPress={() => setUnpaidOnly(current => !current)}
              style={[s.button, s.unpaidButton, unpaidOnly && s.unpaidButtonActive]}
            >
              <Ionicons name={unpaidOnly ? 'filter' : 'filter-outline'} size={14.4} color="#e2e8f0" />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[s.buttonText, s.unpaidButtonText]}>{t('Unpaid only')}</Text>
              {unpaidOnly && <Ionicons name="checkmark" size={14.4} color="#e2e8f0" />}
            </Pressable>}
          {!draft && <Pressable accessibilityRole="button" accessibilityLabel={t('Search names...')} accessibilityState={{ expanded: searchVisible }} onPress={() => { if (!requirePro()) return; setSearchVisible(current => !current); setSearch(''); }} style={[s.button, s.searchButton]}>
            <View style={{ width: 14, height: 14, borderWidth: 2, borderColor: '#f8fafc', borderRadius: 7 }} />
            <View style={{ position: 'absolute', width: 8, height: 2, backgroundColor: '#f8fafc', transform: [{ rotate: '45deg' }], right: 8, bottom: 10 }} />
          </Pressable>}
          </View>}
        </View>
        {!draft && !selectedRow && <View style={[s.controls, { justifyContent: 'space-between' }]}>
          <SyncStatus compact syncStatus={syncStatus} onRetrySync={onRetrySync} />
        </View>}
        {!draft && !!selectedRow && <View style={[s.controls, { justifyContent: 'flex-end' }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(undoable?.event.type === 'delete' ? 'Undo delete' : 'Undo edit')}
            disabled={saving || !undoable}
            onPress={undoLatest}
            style={[s.button, s.undoButton, (saving || !undoable) && { opacity: 0.5 }]}
          >
            <Ionicons name="arrow-undo" size={22} color="#e2e8f0" />
          </Pressable>
        </View>}
        {draft ? <ScrollView keyboardShouldPersistTaps="handled">
          {payoffDetails(draft)}
          <Text style={s.heading}>{draft.title || t('Untitled')}</Text>
          {[amountField, 'comment'].map(field => <View key={field}>
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
          {!selectedRow && <>
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
            <Pressable accessibilityRole="button" accessibilityLabel={t('Choose date range')} accessibilityState={{ expanded: picker }} onPress={() => { if (requirePro()) setPicker(true); }} style={({ pressed }) => [styles.dateDropdownButton, { flex: 1, minWidth: 0, paddingHorizontal: 6, gap: 4 }, pressed && styles.pressed]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[styles.dateDropdownButtonText, { flexShrink: 1, fontSize: 15 }]}>📅 {calendarLabel}</Text>
              <Text style={styles.dateDropdownArrow}>▼</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { if (!requirePro()) return; setFrom(''); setTo(''); setPicker(false); }} style={({ pressed }) => [styles.dateDropdownButton, { flexShrink: 0 }, pressed && styles.pressed]}>
              <Text numberOfLines={1} style={styles.dateDropdownButtonText}>{t('All dates')}</Text>
            </Pressable>
          </View>
          <Text style={[s.text, s.summaryText]} accessibilityLiveRegion="polite">{rangeLabel}</Text>
          <Text style={[s.heading, s.detailHeading]}>{t('TOTAL')}: {pretty(String(Number(total.toPrecision(15))))}</Text>
          </>}
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          {selectedRows.length > 1 && <Text style={s.heading}>{selectedRow.title || t('Untitled')} · {t('TOTAL')}: {pretty(String(Number(selectedRows.reduce((sum, row) => sum + (Number(String(row[amountField]).replace(/,/g, '')) || 0), 0).toPrecision(15))))}</Text>}
          <ScrollView key={selectedRow ? selectedRow.id : 'list'} keyboardShouldPersistTaps="handled" style={selectedRow ? { flex: 1 } : { flexShrink: 1 }} contentContainerStyle={selectedRow && { flexGrow: 1 }}>
            {!visibleRows.length && <Text style={s.text}>{t(invoice ? 'No invoices in this date range.' : filterUnpaid ? 'No unpaid debts match these filters.' : 'No debts in this date range.')}</Text>}
            {visibleRows.map((row, index) => {
              const group = !selectedRow ? groups[index] : null;
              if (group?.rows.length > 1) return <Pressable key={group.key} accessibilityRole="button" accessibilityLabel={group.title || t('Untitled')} disabled={saving} onPress={() => openRows(group.rows)} style={s.row}>
                <Text style={[s.heading, s.detailHeading]}>{group.title || t('Untitled')}</Text>
                <Text style={s.amount}>{pretty(String(group.total))}</Text>
              </Pressable>;
              const distance = monthDistance(row.savedAt || row.createdAt);
              return <View key={row.id} style={[s.row, selectedRows.length === 1 && { flex: 1, borderBottomWidth: 0 }]}>
                <Pressable accessibilityRole="button" accessibilityLabel={row.title || t('Untitled')} disabled={saving || !!selectedRow} onPress={() => openRows([row])} style={[{ gap: 6 }, selectedRows.length === 1 && { flex: 1 }]}>
                <Text style={[s.heading, s.detailHeading]}>{row.title || t('Untitled')}</Text>
                <Text style={[s.amount, row[paidAt] && { color: '#86efac' }]}>{pretty(String(row[paidAt] ? row[paidAmount] : row[amountField]))}</Text>
                <View style={s.dateBlock}>
                  <Text style={s.text}>{t('Date')}: {t(formatSavedDate(row.savedAt || row.createdAt))}</Text>
                </View>
                {!!row[paidAt] && <Text style={s.paidBadge}>{t('Paid off')}</Text>}
                {payoffDetails(row)}
                <Text style={s.muted}>{distance === null ? t('No date') : distance < 0 ? t('In {{count}} months', { count: -distance }) : t('{{count}} months ago', { count: distance })}</Text>
                {!!row.comment && <Text style={s.text}>{row.comment}</Text>}
                </Pressable>
                <View style={s.controls}>
                  {button(t('Edit'), () => { if (!requirePro()) return; setError(''); setDraft({ ...row }); }, saving, true)}
                  {!row[paidAt] && button(t('Pay off'), () => { if (!requirePro()) return; setError(''); setDraft({ ...row }); }, saving, true)}
                  <Pressable accessibilityRole="button" disabled={saving} onPress={() => deleteDebt(row)} style={[s.button, s.rowButton, { backgroundColor: '#7f1d1d' }, saving && { opacity: 0.5 }]}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={s.buttonText}>{t('Delete')}</Text>
                  </Pressable>
                  {!!row[paidAt] && button(t('Undo payoff'), () => undoPayoff(row), saving, true)}
                </View>
              </View>;
            })}
          </ScrollView>
          {selectedRow && <ListExportActions rows={selectedRows} amountField={amountField} summary={selectedRow.title || t('Untitled')} accessibilityLabel={`${t('Share')}: ${selectedRow.title || t('Untitled')}`} />}
          {!selectedRow && <ListExportActions rows={rows} amountField={amountField} summary={[rangeLabel, selectedName !== null ? `${t('Name')}: ${selectedName}` : '', filterUnpaid ? t('Unpaid only') : ''].filter(Boolean).join(' | ')} />}
          {selectedRow ? button(t('Back'), () => { setSelectedId(null); setError(''); }, saving) : !inline && button(t('Close'), onClose, saving)}
        </>}
      </View>
    </KeyboardModalFrame>
    <Modal transparent animationType="fade" visible={picker} onRequestClose={() => setPicker(false)}>
      <KeyboardModalFrame style={styles.modalBackdrop}>
        <Pressable silent accessibilityRole="button" accessibilityLabel={t('Close')} onPress={() => setPicker(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
        <View style={[styles.dropdownPanel, { maxHeight: '90%' }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.dropdownTitle}>{t('Choose date range')}</Text>
            {picker && <DateRangeCalendar fromDate={from} toDate={to} onChange={(start, end) => { setFrom(start); setTo(end); }} onApply={() => setPicker(false)} />}
          </ScrollView>
        </View>
      </KeyboardModalFrame>
    </Modal>
  </PanelModal>;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 16 },
  panel: { backgroundColor: '#0f172a', borderRadius: 20, padding: 18, maxHeight: '95%', width: '100%', maxWidth: 640, alignSelf: 'center', flexShrink: 1, gap: 8 },
  heading: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  headerTitle: { flex: 1, minWidth: 0, fontSize: 16 },
  headerControls: { flexShrink: 1, minWidth: 0, maxWidth: '70%' },
  searchButton: { width: 44, flexShrink: 0 },
  text: { color: '#e2e8f0', fontSize: 16 },
  muted: { color: '#94a3b8', fontSize: 14 },
  amount: { color: '#fca5a5', fontSize: 16.8, fontWeight: '600' },
  dateBlock: { backgroundColor: '#1e293b', borderRadius: 8, padding: 10, alignSelf: 'stretch' },
  paid: { color: '#86efac', fontSize: 14, marginVertical: 8 },
  paidBadge: { color: '#86efac', backgroundColor: '#14532d', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, fontWeight: '700' },
  controls: { flexDirection: 'row', flexWrap: 'nowrap', gap: 6, alignItems: 'center' },
  button: { backgroundColor: '#334155', paddingHorizontal: 8, paddingVertical: 8.4, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 30.8 },
  rowButton: { flex: 1, minWidth: 0 },
  undoButton: { width: 44, minHeight: 44 },
  unpaidButton: { flexDirection: 'row', flexShrink: 1, minWidth: 0, gap: 4, minHeight: 32, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 8 },
  unpaidButtonText: { fontSize: 8.96, flexShrink: 1, minWidth: 0 },
  unpaidButtonActive: { backgroundColor: '#1d4ed8' },
  buttonText: { color: '#e2e8f0', fontSize: 11.2, textAlign: 'center' },
  summaryText: { fontSize: 11.2 },
  detailHeading: { fontSize: 14 },
  row: { borderBottomWidth: 1, borderColor: '#334155', paddingVertical: 10, gap: 6 },
  input: { color: '#f8fafc', backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginVertical: 10, fontSize: 18 },
  error: { color: '#fca5a5', marginBottom: 10 },
});
