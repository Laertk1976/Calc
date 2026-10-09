import Pressable from './SoundPressable';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import SettingsDrawer from './SettingsDrawer';
import CalculationListModal from './CalculationListModal';
import CalculationTableModal from './CalculationTableModal';
import DebtListModal from './DebtListModal';
import { usePro } from './ProProvider';

const tabs = [['list', 'List'], ['table', 'Table'], ['debts', 'Debts'], ['invoices', 'Invoices']];

export default function DesktopWorkspace({ tab, onTabChange, display, keypad, calculations, onUpdateCalculations, user, onOpenAuth, onSignOut, syncStatus, onRetrySync }) {
  const { hasPro, requirePro } = usePro();
  useEffect(() => { if (!hasPro && tab === 'table') onTabChange('list'); }, [hasPro, tab]);
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [visited, setVisited] = useState({ list: true });
  useEffect(() => { setVisited(current => current[tab] ? current : { ...current, [tab]: true }); }, [tab]);
  const selectTab = next => {
    if (next === 'table' && !requirePro()) return;
    setVisited(current => ({ ...current, [next]: true }));
    onTabChange(next);
  };
  const fullWidth = expanded && tab === 'table';
  return <View testID="desktop-workspace" style={s.screen}>
    <View style={s.toolbar}>
      <Text style={s.brand}>CALC</Text>
      <View style={s.toolbarSpacer} />
      <SettingsDrawer user={user} onOpenAuth={onOpenAuth} syncStatus={syncStatus} onRetrySync={onRetrySync} />
    </View>
    <View style={s.workspace}>
      <View testID="desktop-records" style={s.records}>
        <View style={s.navigation}>
          <View accessibilityRole="tablist" style={s.tabs}>
            {tabs.map(([id, label]) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => selectTab(id)} style={({ pressed }) => [s.tab, tab === id && s.activeTab, pressed && { opacity: 0.8 }]}>
              <Text style={[s.tabText, tab === id && s.activeTabText]}>{t(label)}</Text>
            </Pressable>)}
          </View>
          {tab === 'table' && <Pressable accessibilityRole="button" accessibilityLabel={t(fullWidth ? 'Restore split view' : 'Expand table')} onPress={() => setExpanded(value => !value)} style={s.expand}>
            <Text style={s.toolbarText}>{t(fullWidth ? 'Restore split view' : 'Expand table')}</Text>
          </Pressable>}
        </View>
        {tabs.filter(([id]) => visited[id] || id === tab).map(([id]) => <View key={id} testID={'desktop-panel-' + id} style={[s.panel, tab !== id && { display: 'none' }]}>
          {id === 'list' && <CalculationListModal desktop inline showClose={false} visible calculations={calculations.filter(row => !row.deletedAt)} />}
          {id === 'table' && hasPro && <CalculationTableModal inline visible calculations={calculations} onUpdateCalculations={onUpdateCalculations} onClose={() => selectTab('list')} />}
          {id === 'debts' && <DebtListModal inline calculations={calculations} onUpdate={onUpdateCalculations} syncStatus={syncStatus} onRetrySync={onRetrySync} />}
          {id === 'invoices' && <DebtListModal inline amountField="fact" calculations={calculations} onUpdate={onUpdateCalculations} syncStatus={syncStatus} onRetrySync={onRetrySync} />}
        </View>)}
      </View>
      <View testID="desktop-calculator" style={[s.calculator, fullWidth && { display: 'none' }]}>
        <ScrollView style={s.calculatorDisplay} contentContainerStyle={s.calculatorContent} keyboardShouldPersistTaps="handled">
          <Text style={s.sectionLabel}>{t('Calculator')}</Text>
          {display}
        </ScrollView>
        <View style={s.calculatorKeypad}>{keypad}</View>
      </View>
    </View>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#0b1220' },
  toolbar: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, gap: 20, borderBottomWidth: 1, borderColor: '#263449', backgroundColor: '#111827' },
  brand: { color: '#f8fafc', fontSize: 20, fontWeight: '800', letterSpacing: 4 },
  toolbarSpacer: { flex: 1 },
  toolbarText: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  sound: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  account: { width: 108, minHeight: 44, borderRadius: 6, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  workspace: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 20, padding: 24 },
  calculator: { width: 380, minHeight: 0, backgroundColor: '#111827', borderWidth: 1, borderColor: '#263449', borderRadius: 14, overflow: 'hidden' },
  calculatorDisplay: { flex: 1, minHeight: 0 },
  calculatorContent: { flexGrow: 1, justifyContent: 'flex-end', padding: 20, paddingBottom: 0 },
  calculatorKeypad: { flexShrink: 0, padding: 20, paddingTop: 0 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  records: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 14, overflow: 'hidden' },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: 12, borderBottomWidth: 1, borderColor: '#334155' },
  tabs: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  tab: { minHeight: 40, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#2563eb' },
  tabText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  activeTabText: { color: '#ffffff' },
  expand: { minHeight: 36, paddingHorizontal: 10, justifyContent: 'center', borderWidth: 1, borderColor: '#475569', borderRadius: 6 },
  panel: { flex: 1, minWidth: 0, minHeight: 0 },
});
