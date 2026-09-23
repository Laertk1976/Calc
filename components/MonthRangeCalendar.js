import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function MonthRangeCalendar({ from, to, onChange }) {
  const { t, i18n } = useTranslation();
  const [year, setYear] = useState(() => from ? Number(from.slice(0, 4)) : new Date().getFullYear());
  const [anchor, setAnchor] = useState(null);
  const choose = key => {
    if (!anchor) {
      setAnchor(key);
      onChange(key, key);
    } else {
      onChange(key < anchor ? key : anchor, key < anchor ? anchor : key);
      setAnchor(null);
    }
  };
  return <View style={s.calendar}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Previous year')} onPress={() => setYear(value => value - 1)} style={s.arrow}><Text style={s.text}>‹</Text></Pressable>
      <Text style={s.year}>{year}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Next year')} onPress={() => setYear(value => value + 1)} style={s.arrow}><Text style={s.text}>›</Text></Pressable>
    </View>
    <Text style={s.hint}>{t(anchor ? 'Select the last month, or the same month for one month.' : 'Select a month to start a range.')}</Text>
    <View style={s.grid}>
      {Array.from({ length: 12 }, (_, index) => {
        const key = `${year}-${String(index + 1).padStart(2, '0')}`;
        const date = new Date(year, index, 1);
        const selected = !!from && key >= from && key <= to;
        const endpoint = key === from || key === to;
        return <View key={key} style={s.cell}>
          <Pressable accessibilityRole="button" accessibilityLabel={date.toLocaleDateString(i18n.resolvedLanguage, { month: 'long', year: 'numeric' })} accessibilityState={{ selected }} onPress={() => choose(key)} style={[s.month, selected && s.selected, endpoint && s.endpoint]}>
            <Text style={s.text}>{date.toLocaleDateString(i18n.resolvedLanguage, { month: 'short' })}</Text>
          </Pressable>
        </View>;
      })}
    </View>
  </View>;
}

const s = StyleSheet.create({
  calendar: { backgroundColor: '#1e293b', borderRadius: 12, padding: 10, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  arrow: { padding: 12, minWidth: 44, alignItems: 'center' },
  year: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  text: { color: '#f8fafc', fontSize: 16, textAlign: 'center' },
  hint: { color: '#cbd5e1', fontSize: 14, marginVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.333333%', padding: 3 },
  month: { minHeight: 48, justifyContent: 'center', borderRadius: 8, backgroundColor: '#334155', padding: 6 },
  selected: { backgroundColor: '#1e40af' },
  endpoint: { backgroundColor: '#2563eb' },
});
