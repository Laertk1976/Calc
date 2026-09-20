import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import useCalculatorStyles from '../useCalculatorStyles';

function toDate(value) {
  const [day, month, year] = value.split('/').map(Number);
  return value ? new Date(year, month - 1, day) : new Date();
}

function toKey(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export default function DateRangeCalendar({ fromDate, toDate: endDate, onChange }) {
  const { t, i18n } = useTranslation();
  const styles = useCalculatorStyles();
  const [active, setActive] = useState('from');
  const [month, setMonth] = useState(() => toDate(fromDate));
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const choose = (date) => {
    const key = toKey(date);
    if (active === 'from') {
      onChange(key, !endDate || date > toDate(endDate) ? key : endDate);
      setActive('to');
    } else {
      onChange(!fromDate || date < toDate(fromDate) ? key : fromDate, key);
    }
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {[['from', t("From"), fromDate], ['to', t("To"), endDate]].map(([field, label, value]) => (
          <Pressable key={field} accessibilityRole="button" accessibilityLabel={t(field === 'from' ? 'Choose start date' : 'Choose end date')} accessibilityState={{ selected: active === field }} onPress={() => { setActive(field); setMonth(toDate(value)); }} style={[styles.rangePill, { flex: 1 }, active === field && styles.rangePillSelected]}>
            <Text style={styles.rangePillText}>{label}</Text>
            <Text style={styles.quickActionText}>{value || t("Choose date")}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Previous month")} onPress={() => setMonth(new Date(year, monthIndex - 1, 1))} style={{ padding: 12 }}><Text style={styles.quickActionText}>‹</Text></Pressable>
        <Text style={styles.quickActionText}>{month.toLocaleDateString(i18n.resolvedLanguage, { month: 'long', year: 'numeric' })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Next month")} onPress={() => setMonth(new Date(year, monthIndex + 1, 1))} style={{ padding: 12 }}><Text style={styles.quickActionText}>›</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => <Text key={day} style={[styles.quickActionText, { width: '14.285714%', textAlign: 'center', fontSize: 11 }]}>{typeof day === 'string' ? t(day) : day}</Text>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
        {Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
          const day = index - offset + 1;
          const cell = { width: '14.285714%', height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 6 };
          if (day < 1 || day > count) return <View key={index} style={cell} />;
          const date = new Date(year, monthIndex, day);
          const key = toKey(date);
          const endpoint = key === fromDate || key === endDate;
          const inRange = fromDate && endDate && date >= toDate(fromDate) && date <= toDate(endDate);
          return <Pressable key={index} accessibilityRole="button" accessibilityLabel={`${active === 'from' ? t("From") : t("To")} ${key}`} accessibilityState={{ selected: endpoint }} onPress={() => choose(date)} style={[cell, inRange && { backgroundColor: '#1e3a5f' }, endpoint && { backgroundColor: '#2563eb' }]}><Text style={styles.quickActionText}>{typeof day === 'string' ? t(day) : day}</Text></Pressable>;
        })}
      </View>
      <Pressable accessibilityRole="button" onPress={() => { const today = new Date(); const key = toKey(today); onChange(key, key); setMonth(today); setActive('from'); }} style={[styles.quickActionButton, { flex: 0, marginBottom: 12 }]}><Text style={styles.quickActionText}>{t("Today")}</Text></Pressable>
    </View>
  );
}
