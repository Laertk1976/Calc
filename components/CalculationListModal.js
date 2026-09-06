import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { styles } from '../calculatorStyles';
import { formatSavedDate } from '../calculatorUtils';

function getSavedItemStyle(type) {
  if (type === 'Cred') return styles.savedItemRed;
  if (type === 'Fact') return styles.savedItemPurple;
  if (type === 'Fcash') return styles.savedItemBlue;
  return styles.savedItemGreen;
}

export default function CalculationListModal({ visible, calculations, onClose }) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.listPanel}>
          <Text style={styles.listTitle}>Saved calculations</Text>
          <ScrollView style={styles.listScroll}>
            {calculations.length ? calculations.map((calculation, index) => (
              <View key={`${calculation.createdAt}-${index}`} style={[styles.savedItem, getSavedItemStyle(calculation.type)]}>
                <Text style={styles.savedTitle}>{calculation.title}</Text>
                <Text style={styles.savedExpression}>{calculation.expression}</Text>
                <Text style={styles.savedValue}>{calculation.value}</Text>
                <View style={styles.savedMetaRow}>
                  <Text style={styles.savedDate}>{formatSavedDate(calculation.savedAt || calculation.createdAt)}</Text>
                  <Text style={styles.savedType}>{calculation.type || 'Add'}</Text>
                </View>
              </View>
            )) : <Text style={styles.emptyList}>No saved calculations yet.</Text>}
          </ScrollView>
          <Pressable onPress={onClose} style={[styles.closeButton, styles.listCloseButton]}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
