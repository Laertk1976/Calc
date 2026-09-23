import ButtonLabel from './ButtonLabel';
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

export default function CalculationListModal({ visible, calculations, onClose, inline = false, swipeHandlers }) {
  const { t, i18n } = useTranslation();
  const styles = useCalculatorStyles();
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  useEffect(() => {
    setDatePickerVisible(false);
    if (visible) setSelectedDate(dateKey(new Date()));
    if (!visible) {
      setSearch('');
      setSearchVisible(false);
    }
  }, [visible]);
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const dayCalculations = calculations.filter((item) => dateKey(item.savedAt || item.createdAt) === selectedDate);
  const filteredCalculations = dayCalculations.filter((item) =>
    [item.title, item.expression, item.info, item.comment].some((value) =>
      String(value || '').toLowerCase().includes(search.trim().toLowerCase())));
  const closeList = () => {
    setSearch('');
    setSearchVisible(false);
    onClose();
  };
  const panel = (
        <View style={[styles.listPanel, inline && { height: '100%', maxHeight: '100%', maxWidth: undefined, flex: 1, padding: 12 }]}>
          <View {...swipeHandlers} style={inline && { touchAction: 'none' }}>
            {inline && <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#64748b', marginBottom: 12 }} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.listTitle, { flex: 1, marginBottom: 0, fontSize: 18 }]}>
                {t('Saved calculations')} · {search.trim() ? `${filteredCalculations.length}/${dayCalculations.length}` : dayCalculations.length}
              </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('Choose date')}, ${dateLabel(selectedDate)}`} accessibilityState={{ expanded: datePickerVisible }} onPress={() => {
            const [selectedYear, selectedMonth] = selectedDate.split('-').map(Number);
            setCalendarMonth(new Date(selectedYear, selectedMonth - 1, 1));
            setDatePickerVisible(true);
          }} hitSlop={4} style={styles.searchIconButton}>
            <Text numberOfLines={1} style={[styles.quickActionText, { fontSize: 14, lineHeight: 18, includeFontPadding: false }]}>{Number(selectedDate.slice(-2))}</Text>
          </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t("Search saved calculations")} accessibilityState={{ expanded: searchVisible }} onPress={() => { setSearchVisible(!searchVisible); setSearch(''); }} style={styles.searchIconButton}>
                <View style={{ width: 14, height: 14, borderWidth: 2, borderColor: '#f8fafc', borderRadius: 7 }} />
                <View style={{ position: 'absolute', width: 7, height: 2, backgroundColor: '#f8fafc', transform: [{ rotate: '45deg' }], right: 6, bottom: 8 }} />
              </Pressable>
            </View>
          </View>
          <Modal transparent animationType="fade" visible={visible && datePickerVisible} onRequestClose={() => setDatePickerVisible(false)}>
            <KeyboardModalFrame style={styles.modalBackdrop}>
              <Pressable accessibilityLabel="Dismiss calendar" accessibilityRole="button" onPress={() => setDatePickerVisible(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
              <View style={[styles.dropdownPanel, { width: '100%', maxWidth: 320 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("Previous month")} onPress={() => setCalendarMonth(new Date(year, month - 1, 1))} style={{ padding: 12 }}><Text style={styles.quickActionText}>‹</Text></Pressable>
                  <Text style={styles.quickActionText}>{calendarMonth.toLocaleDateString(i18n.resolvedLanguage, { month: 'long', year: 'numeric' })}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("Next month")} onPress={() => setCalendarMonth(new Date(year, month + 1, 1))} style={{ padding: 12 }}><Text style={styles.quickActionText}>›</Text></Pressable>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => <Text key={day} style={[styles.quickActionText, { width: '14.285714%', textAlign: 'center', fontSize: 11, marginBottom: 8 }]}>{typeof day === 'string' ? t(day) : day}</Text>)}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {calendarDays.map((day, index) => {
                    const date = day ? dateKey(new Date(year, month, day)) : '';
                    return day ? (
                      <Pressable key={index} accessibilityRole="button" accessibilityLabel={`${t('Date')}: ${dateLabel(date)}`} accessibilityState={{ selected: selectedDate === date }} onPress={() => { setSelectedDate(date); setDatePickerVisible(false); }} style={[{ width: '14.285714%', height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }, selectedDate === date && { backgroundColor: '#2563eb' }]}>
                        <Text style={styles.quickActionText}>{typeof day === 'string' ? t(day) : day}</Text>
                      </Pressable>
                    ) : <View key={index} style={{ width: '14.285714%', height: 40 }} />;
                  })}
                </View>
                <Pressable accessibilityRole="button" onPress={() => { setSelectedDate(dateKey(new Date())); setDatePickerVisible(false); }} style={[styles.quickActionButton, { marginTop: 12 }]}><Text style={styles.quickActionText}>{t("Today")}</Text></Pressable>
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
            )) : <Text style={styles.emptyList}>{search.trim() ? t("No matching calculations for this date.") : t("No saved calculations for this date.")}</Text>}
          </ScrollView>
          <Pressable onPress={closeList} hitSlop={{ top: 4, bottom: 4 }} style={({ pressed }) => [styles.closeButton, styles.listCloseButton, { minHeight: 36, paddingVertical: 6 }, pressed && styles.pressed]}>
            <ButtonLabel numberOfLines={1} style={[styles.closeButtonText, { flexShrink: 0 }]}>{t("Close")}</ButtonLabel>
          </Pressable>
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
