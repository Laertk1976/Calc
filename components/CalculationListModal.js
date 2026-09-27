import ButtonLabel from './ButtonLabel';
import DateRangeCalendar from './DateRangeCalendar';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { styles } from '../calculatorStyles';
import useCalculatorStyles from '../useCalculatorStyles';
import KeyboardModalFrame from './KeyboardModalFrame';
import { formatSavedDate } from '../calculatorUtils';
import { getCalculationListResults } from '../calculationHistory';

function getSavedItemStyle(type) {
  if (type === 'Cred') return styles.savedItemRed;
  if (type === 'Fact') return styles.savedItemPurple;
  if (type === 'Fcash') return styles.savedItemBlue;
  return styles.savedItemGreen;
}

function dateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateLabel(value) {
  return value.split('-').reverse().join('/');
}

export default function CalculationListModal({ visible, calculations, onClose, inline = false, showClose = true }) {
  const { t } = useTranslation();
  const styles = useCalculatorStyles();
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(() => dateLabel(dateKey(new Date())));
  const [toDate, setToDate] = useState(() => dateLabel(dateKey(new Date())));
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  useEffect(() => {
    setDatePickerVisible(false);
    if (visible) {
      const today = dateLabel(dateKey(new Date()));
      setFromDate(today);
      setToDate(today);
    }
    if (!visible) {
      setSearch('');
      setSearchVisible(false);
    }
  }, [visible]);
  const rangeLabel = fromDate === toDate ? fromDate : `${fromDate} - ${toDate}`;
  const firstDateKey = fromDate.split('/').reverse().join('-');
  const lastDateKey = toDate.split('/').reverse().join('-');
  const rangeCalculations = calculations.filter((item) => {
    const key = dateKey(item.savedAt || item.createdAt);
    return key && key >= firstDateKey && key <= lastDateKey;
  });
  const filteredCalculations = rangeCalculations.filter((item) =>
    [item.title, item.expression, item.info, item.comment].some((value) =>
      String(value || '').toLowerCase().includes(search.trim().toLowerCase())));
  const closeList = () => {
    setSearch('');
    setSearchVisible(false);
    onClose();
  };
  const panel = (
        <View style={[styles.listPanel, inline && { height: '100%', maxHeight: '100%', maxWidth: showClose ? undefined : '100%', flex: 1, padding: 12 }]}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.listTitle, { flex: 1, marginBottom: 0, fontSize: 18 }]}>
                {t('Saved calculations')} · {search.trim() ? `${filteredCalculations.length}/${rangeCalculations.length}` : rangeCalculations.length}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t("Search saved calculations")} accessibilityState={{ expanded: searchVisible }} onPress={() => { setSearchVisible(!searchVisible); setSearch(''); }} style={styles.searchIconButton}>
                <View style={{ width: 14, height: 14, borderWidth: 2, borderColor: '#f8fafc', borderRadius: 7 }} />
                <View style={{ position: 'absolute', width: 7, height: 2, backgroundColor: '#f8fafc', transform: [{ rotate: '45deg' }], right: 6, bottom: 8 }} />
              </Pressable>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('Choose date range')}, ${rangeLabel}`} accessibilityState={{ expanded: datePickerVisible }} onPress={() => setDatePickerVisible(true)} style={[styles.rangePill, { marginBottom: 8 }]}>
            <Text style={styles.rangePillText}>{rangeLabel}</Text>
          </Pressable>
          <Modal transparent animationType="fade" visible={visible && datePickerVisible} onRequestClose={() => setDatePickerVisible(false)}>
            <KeyboardModalFrame style={styles.modalBackdrop}>
              <Pressable accessibilityLabel="Dismiss calendar" accessibilityRole="button" onPress={() => setDatePickerVisible(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
              <View style={[styles.dropdownPanel, { maxHeight: '90%' }]}>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 4 }}>
                  <Text style={styles.dropdownTitle}>{t("Choose date range")}</Text>
                  {datePickerVisible && <DateRangeCalendar fromDate={fromDate} toDate={toDate} onChange={(from, to) => { setFromDate(from); setToDate(to); }} onApply={() => setDatePickerVisible(false)} />}
                  <Text style={styles.listSubtitle}>{rangeLabel}</Text>
                  <Text style={styles.listSubtitle}>{t('Rows in range')}: {filteredCalculations.length}</Text>
                </ScrollView>
              </View>
            </KeyboardModalFrame>
          </Modal>
          {searchVisible && <TextInput autoFocus value={search} onChangeText={setSearch} placeholder={t("Search saved calculations...")} placeholderTextColor="#94a3b8" accessibilityLabel={t("Search saved calculations")} style={[styles.authInput, { paddingVertical: 8, marginBottom: 8 }]} />}
          <ScrollView keyboardShouldPersistTaps="handled" style={[styles.listScroll, inline && { flex: 1 }]} nestedScrollEnabled>
            {filteredCalculations.length ? filteredCalculations.map((calculation, index) => (
              <View key={`${calculation.createdAt}-${index}`} style={[styles.savedItem, getSavedItemStyle(calculation.type)]}>
                <Text style={styles.savedTitle}>{index + 1}. {calculation.title}</Text>
                <Text style={styles.savedExpression}>{calculation.info ?? calculation.expression ?? ''}</Text>
                {calculation.comment ? <Text style={styles.savedComment}>{t('Note')}: {calculation.comment}</Text> : null}
                {getCalculationListResults(calculation).map(({ label, value }) => (
                  <View key={label || 'result'}>
                    <Text style={styles.savedValue}>{label ? `${t(label)}: ` : ''}{value}</Text>
                    {label === 'Cred' && <Text style={{ color: '#f8fafc', fontSize: 16, marginTop: 6, marginBottom: 8 }}>{t('Date')}: {t(formatSavedDate(calculation.savedAt || calculation.createdAt))}</Text>}
                  </View>
                ))}
                <View style={styles.savedMetaRow}>
                  {!getCalculationListResults(calculation).some(result => result.label === 'Cred') && <Text style={styles.savedDate}>{formatSavedDate(calculation.savedAt || calculation.createdAt)}</Text>}
                  <Text style={styles.savedType}>{t(calculation.type || 'Add')}</Text>
                </View>
              </View>
            )) : <Text style={styles.emptyList}>{search.trim() ? t("No matching calculations.") : t("No saved calculations in this date range.")}</Text>}
          </ScrollView>
          {showClose && <Pressable onPress={closeList} hitSlop={{ top: 4, bottom: 4 }} style={({ pressed }) => [styles.closeButton, styles.listCloseButton, { minHeight: 36, paddingVertical: 6 }, pressed && styles.pressed]}>
            <ButtonLabel numberOfLines={1} style={[styles.closeButtonText, { flexShrink: 0 }]}>{t("Close")}</ButtonLabel>
          </Pressable>}
        </View>
  );
  if (inline) return panel;
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardModalFrame style={styles.modalBackdrop}>
        {panel}
      </KeyboardModalFrame>
    </Modal>
  );
}
