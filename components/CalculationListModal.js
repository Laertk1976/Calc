import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { styles } from '../calculatorStyles';
import useCalculatorStyles from '../useCalculatorStyles';
import KeyboardModalFrame from './KeyboardModalFrame';
import { formatSavedDate } from '../calculatorUtils';

function getSavedItemStyle(type) {
  if (type === 'Cred') return styles.savedItemRed;
  if (type === 'Fact') return styles.savedItemPurple;
  if (type === 'Fcash') return styles.savedItemBlue;
  return styles.savedItemGreen;
}

export default function CalculationListModal({ visible, calculations, onClose, inline = false, swipeHandlers }) {
  const styles = useCalculatorStyles();
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (!visible) {
      setSearch('');
      setSearchVisible(false);
    }
  }, [visible]);
  const filteredCalculations = calculations.filter((item) =>
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
                Saved calculations · {search.trim() ? `${filteredCalculations.length}/${calculations.length}` : calculations.length}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Search saved calculations" accessibilityState={{ expanded: searchVisible }} onPress={() => { setSearchVisible(!searchVisible); setSearch(''); }} style={styles.searchIconButton}>
                <View style={{ width: 14, height: 14, borderWidth: 2, borderColor: '#f8fafc', borderRadius: 7 }} />
                <View style={{ position: 'absolute', width: 7, height: 2, backgroundColor: '#f8fafc', transform: [{ rotate: '45deg' }], right: 6, bottom: 8 }} />
              </Pressable>
            </View>
          </View>
          {searchVisible && <TextInput autoFocus value={search} onChangeText={setSearch} placeholder="Search saved calculations..." placeholderTextColor="#94a3b8" accessibilityLabel="Search saved calculations" style={[styles.authInput, { paddingVertical: 8, marginBottom: 8 }]} />}
          <ScrollView keyboardShouldPersistTaps="handled" style={[styles.listScroll, inline && { flex: 1 }]} nestedScrollEnabled>
            {filteredCalculations.length ? filteredCalculations.map((calculation, index) => (
              <View key={`${calculation.createdAt}-${index}`} style={[styles.savedItem, getSavedItemStyle(calculation.type)]}>
                <Text style={styles.savedTitle}>{index + 1}. {calculation.title}</Text>
                <Text style={styles.savedExpression}>{calculation.expression || calculation.info || ''}</Text>
                {calculation.comment ? <Text style={styles.savedComment}>Note: {calculation.comment}</Text> : null}
                <Text style={styles.savedValue}>{calculation.value || calculation.cred || calculation.fact || calculation.fcash || ''}</Text>
                <View style={styles.savedMetaRow}>
                  <Text style={styles.savedDate}>{formatSavedDate(calculation.savedAt || calculation.createdAt)}</Text>
                  <Text style={styles.savedType}>{calculation.type || 'Add'}</Text>
                </View>
              </View>
            )) : <Text style={styles.emptyList}>{search.trim() ? 'No matching calculations.' : 'No saved calculations yet.'}</Text>}
          </ScrollView>
          <Pressable onPress={closeList} hitSlop={{ top: 4, bottom: 4 }} style={({ pressed }) => [styles.closeButton, styles.listCloseButton, { minHeight: 36, paddingVertical: 6 }, pressed && styles.pressed]}>
            <Text numberOfLines={1} style={[styles.closeButtonText, { flexShrink: 0 }]}>Close</Text>
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
