import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { styles } from '../calculatorStyles';

function getSavedItemStyle(type) {
  if (type === 'Cred') return styles.savedItemRed;
  if (type === 'Fact') return styles.savedItemPurple;
  if (type === 'Fcash') return styles.savedItemBlue;
  return styles.savedItemGreen;
}

function escapeHtml(value) {
  return String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildTableHtml(calculations) {
  const rows = calculations.map((calculation) => {
    const type = calculation.type || 'Add';
    const value = calculation.value || '';
    const info = `${calculation.expression || value} = ${value}`;
    return `<tr><td>${escapeHtml(calculation.title || '')}</td><td>${escapeHtml(info)}</td><td>${type === 'Add' ? value : ''}</td><td>${type === 'Cred' ? value : ''}</td><td>${type === 'Fact' ? value : ''}</td><td>${type === 'Fcash' ? value : ''}</td></tr>`;
  }).join('');

  return `<html><head><style>@page { size: A4 landscape; margin: 12mm; } body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #111827; background: #fff; } table { border-collapse: collapse; width: 1800px; min-width: 100%; table-layout: auto; } th, td { border: 1px solid #475569; padding: 10px 12px; text-align: left; font-size: 12px; vertical-align: top; white-space: normal; word-break: break-word; } th { background: #e2e8f0; font-weight: 700; } h2 { margin: 0 0 12px 0; font-size: 24px; }</style></head><body><h2>Calculator table</h2><table><thead><tr><th style="width: 180px;">Name</th><th style="width: 420px;">Info</th><th style="width: 150px;">Add</th><th style="width: 150px;">Cred</th><th style="width: 150px;">Fact</th><th style="width: 150px;">Fcash</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No data</td></tr>'}</tbody></table></body></html>`;
}

async function shareAsPdf(calculations, options) {
  const { uri } = await Print.printToFileAsync({ html: buildTableHtml(calculations), base64: false, width: 1400, height: 1000, orientation: 'landscape' });
  await Sharing.shareAsync(uri, options);
}

export default function CalculationTableModal({ visible, calculations, onClose }) {
  const saveTableAsPdf = () => shareAsPdf(calculations, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' }).catch((error) => console.log('PDF save error:', error));
  const shareTable = () => shareAsPdf(calculations, { mimeType: 'application/pdf' }).catch((error) => console.log('Share error:', error));

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, styles.tableModalBackdrop]}>
        <View style={styles.tablePanel}>
          <Text style={styles.listTitle}>Calculator table</Text>
          <ScrollView style={styles.tableVerticalScroll} showsVerticalScrollIndicator>
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
              <View>
                <View style={styles.tableHeaderRow}>
                  {['Name', 'Info', 'Add', 'Cred', 'Fact', 'Fcash'].map((heading, index) => (
                    <View key={heading} style={[styles.tableHeaderCell, index === 0 ? styles.nameColumn : index === 1 ? styles.infoColumn : styles.typeColumn]}><Text style={styles.tableHeaderText}>{heading}</Text></View>
                  ))}
                </View>
                {calculations.length ? calculations.map((calculation, index) => {
                  const cellStyle = getSavedItemStyle(calculation.type);
                  const typeIndex = { Add: 2, Cred: 3, Fact: 4, Fcash: 5 }[calculation.type];
                  const cells = [calculation.title, `${calculation.expression || calculation.value} = ${calculation.value}`, 'Add', 'Cred', 'Fact', 'Fcash'];
                  return (
                    <View key={`${calculation.createdAt}-${index}`} style={styles.tableBodyRow}>
                      {cells.map((cell, cellIndex) => (
                        <View key={`${cellIndex}-${cell}`} style={[styles.tableCell, cellIndex === 0 ? styles.nameColumn : cellIndex === 1 ? styles.infoColumn : styles.typeColumn, cellIndex === typeIndex && cellStyle]}>
                          <Text style={styles.tableCellText}>{cellIndex < 2 || cellIndex === typeIndex ? cellIndex < 2 ? cell : calculation.value : ''}</Text>
                        </View>
                      ))}
                    </View>
                  );
                }) : <Text style={styles.emptyList}>No saved calculations yet.</Text>}
              </View>
            </ScrollView>
          </ScrollView>
          <View style={styles.tableActions}>
            <Pressable onPress={saveTableAsPdf} style={[styles.closeButton, styles.tableActionButton]}><Text style={styles.closeButtonText}>Save PDF</Text></Pressable>
            <Pressable onPress={shareTable} style={[styles.closeButton, styles.tableActionButton]}><Text style={styles.closeButtonText}>Share</Text></Pressable>
          </View>
          <Pressable onPress={onClose} style={[styles.closeButton, styles.listCloseButton]}><Text style={styles.closeButtonText}>Close</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}
