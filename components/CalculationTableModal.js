import { ResponseType, makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { styles } from '../calculatorStyles';
import { formatSavedDate, pretty } from '../calculatorUtils';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const googleClientIds = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
};

function getDateKey(value) {
  if (!value) return 'No Date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No Date';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

function parseDateKeyToTime(dateKey) {
  if (!dateKey || dateKey === 'No Date') return 0;
  const parts = dateKey.split('/').map(Number);
  if (parts.length !== 3) return 0;
  const [day, month, year] = parts;
  return new Date(year, month - 1, day).getTime();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCalculationInfo(calculation) {
  const value = pretty(calculation.value || '');
  const expr = calculation.expression;
  if (!expr || expr === calculation.value) return value;
  if (expr.includes('=')) return expr;
  return `${expr} = ${value}`;
}

function normalizeCalculation(calc) {
  const type = calc.type || 'Add';
  const rawVal = calc.value || '';
  return {
    ...calc,
    id: calc.id || calc.createdAt || `${Date.now()}-${Math.random()}`,
    createdAt: calc.createdAt || new Date().toISOString(),
    savedAt: calc.savedAt || calc.createdAt || new Date().toISOString(),
    title: calc.title || '',
    info: calc.info !== undefined ? calc.info : getCalculationInfo(calc),
    expression: calc.expression || calc.info || rawVal,
    comment: calc.comment !== undefined ? calc.comment : (type === 'Add' ? rawVal : ''),
    cred: calc.cred !== undefined ? calc.cred : (type === 'Cred' ? rawVal : ''),
    fact: calc.fact !== undefined ? calc.fact : (type === 'Fact' ? rawVal : ''),
    fcash: calc.fcash !== undefined ? calc.fcash : (type === 'Fcash' ? rawVal : ''),
  };
}

function formatNumberDisplay(val) {
  if (!val && val !== 0) return '';
  const num = Number(String(val).replace(/,/g, ''));
  return Number.isNaN(num) ? String(val) : pretty(String(val));
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildTableCsv(calculations) {
  const header = ['Name', 'Date', 'Info', 'Comments', 'Cred', 'Fact', 'Fcash'];
  const rows = calculations.map((calculation) => {
    const norm = normalizeCalculation(calculation);
    return [
      norm.title || 'Untitled',
      formatSavedDate(norm.savedAt || norm.createdAt),
      norm.info || norm.expression || '',
      norm.comment || '',
      formatNumberDisplay(norm.cred),
      formatNumberDisplay(norm.fact),
      formatNumberDisplay(norm.fcash),
    ];
  });

  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
}

function downloadCsv(csv, fileName) {
  if (Platform.OS !== 'web') return false;
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

function buildTableHtml(calculations, filterSummary = '') {
  const totals = { Cred: 0, Fact: 0, Fcash: 0 };
  let hasTotals = false;

  const rows = calculations.map((calculation) => {
    const norm = normalizeCalculation(calculation);
    const title = escapeHtml(norm.title || 'Untitled');
    const dateStr = formatSavedDate(norm.savedAt || norm.createdAt);
    const info = escapeHtml(norm.info || norm.expression || '');
    const comment = escapeHtml(norm.comment || '');

    const credNum = Number(String(norm.cred || '').replace(/,/g, ''));
    if (!Number.isNaN(credNum) && credNum !== 0) {
      totals.Cred += credNum;
      hasTotals = true;
    }

    const factNum = Number(String(norm.fact || '').replace(/,/g, ''));
    if (!Number.isNaN(factNum) && factNum !== 0) {
      totals.Fact += factNum;
      hasTotals = true;
    }

    const fcashNum = Number(String(norm.fcash || '').replace(/,/g, ''));
    if (!Number.isNaN(fcashNum) && fcashNum !== 0) {
      totals.Fcash += fcashNum;
      hasTotals = true;
    }

    const credVal = norm.cred ? escapeHtml(formatNumberDisplay(norm.cred)) : '';
    const factVal = norm.fact ? escapeHtml(formatNumberDisplay(norm.fact)) : '';
    const fcashVal = norm.fcash ? escapeHtml(formatNumberDisplay(norm.fcash)) : '';

    return `
      <tr>
        <td class="cell-name">
          <div class="title-text">${title}</div>
          ${dateStr !== 'No date' ? `<div class="date-text">${escapeHtml(dateStr)}</div>` : ''}
        </td>
        <td class="cell-info">${info}</td>
        <td class="cell-comment">${comment}</td>
        <td class="cell-num ${credVal ? 'cell-cred' : ''}">${credVal}</td>
        <td class="cell-num ${factVal ? 'cell-fact' : ''}">${factVal}</td>
        <td class="cell-num ${fcashVal ? 'cell-fcash' : ''}">${fcashVal}</td>
      </tr>
    `;
  }).join('');

  const formatTotal = (num) => (num ? pretty(String(Math.round(num * 10000) / 10000)) : '-');

  const footerRow = hasTotals && calculations.length > 0 ? `
    <tfoot>
      <tr class="total-row">
        <td colspan="3" class="total-label">TOTAL</td>
        <td class="cell-num total-cell">${formatTotal(totals.Cred)}</td>
        <td class="cell-num total-cell">${formatTotal(totals.Fact)}</td>
        <td class="cell-num total-cell">${formatTotal(totals.Fcash)}</td>
      </tr>
    </tfoot>
  ` : '';

  const exportDate = new Date();
  const exportDateStr = formatSavedDate(exportDate.toISOString());

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #ffffff;
      width: 100%;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 2px solid #0f172a;
    }
    .header-bar h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #0f172a;
    }
    .header-bar .meta {
      font-size: 8px;
      color: #64748b;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 4px 6px;
      vertical-align: middle;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    th {
      background-color: #0f172a;
      color: #f8fafc;
      font-weight: 700;
      font-size: 9px;
      text-align: center;
      padding: 6px 4px;
    }
    th.col-name     { width: 18%; text-align: left; padding-left: 8px; }
    th.col-info     { width: 28%; text-align: left; padding-left: 8px; }
    th.col-comments { width: 24%; text-align: left; padding-left: 8px; background-color: #334155; }
    th.col-cred     { width: 10%; background-color: #dc2626; }
    th.col-fact     { width: 10%; background-color: #9333ea; }
    th.col-fcash    { width: 10%; background-color: #2563eb; }

    td.cell-name {
      text-align: left;
    }
    .title-text {
      font-size: 8.5px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.2;
    }
    .date-text {
      font-size: 7px;
      color: #64748b;
      margin-top: 1px;
    }
    td.cell-info {
      font-size: 8px;
      font-family: Consolas, Monaco, "Courier New", monospace;
      color: #334155;
      text-align: left;
      line-height: 1.25;
    }
    td.cell-comment {
      font-size: 8px;
      color: #334155;
      text-align: left;
      line-height: 1.25;
    }
    td.cell-num {
      font-size: 8.5px;
      font-weight: 600;
      text-align: right;
      font-variant-numeric: tabular-nums;
      padding-right: 6px;
    }
    td.cell-cred {
      background-color: rgba(239, 68, 68, 0.18) !important;
      color: #7f1d1d;
    }
    td.cell-fact {
      background-color: rgba(168, 85, 247, 0.18) !important;
      color: #581c87;
    }
    td.cell-fcash {
      background-color: rgba(59, 130, 246, 0.18) !important;
      color: #1e3a8a;
    }
    tr:nth-child(even) td:not(.cell-cred):not(.cell-fact):not(.cell-fcash) {
      background-color: #f8fafc;
    }
    .total-row {
      background-color: #f1f5f9;
      border-top: 2px solid #0f172a;
    }
    .total-label {
      text-align: right;
      font-weight: 700;
      font-size: 8.5px;
      letter-spacing: 0.5px;
      padding-right: 8px;
      color: #0f172a;
    }
    .total-cell {
      font-size: 8.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .empty-row td {
      text-align: center;
      padding: 18px;
      font-size: 10px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <h2>CALCULATOR TABLE</h2>
    <div class="meta">${escapeHtml(filterSummary ? `${filterSummary} • ` : '')}${escapeHtml(exportDateStr)} &bull; ${calculations.length} ${calculations.length === 1 ? 'record' : 'records'}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="col-name">Name</th>
        <th class="col-info">Info</th>
        <th class="col-comments">Comments</th>
        <th class="col-cred">Cred</th>
        <th class="col-fact">Fact</th>
        <th class="col-fcash">Fcash</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr class="empty-row"><td colspan="6">No saved calculations yet.</td></tr>'}
    </tbody>
    ${footerRow}
  </table>
</body>
</html>`;
}

async function shareAsPdf(calculations, options, filterSummary) {
  if (Platform.OS === 'web') {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('The browser blocked the print window. Allow pop-ups and try again.');
    }

    printWindow.document.write(buildTableHtml(calculations, filterSummary));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
    return;
  }

  const { uri } = await Print.printToFileAsync({
    html: buildTableHtml(calculations, filterSummary),
    base64: false,
    width: 1190,
    height: 842,
    orientation: 'landscape',
  });
  await Sharing.shareAsync(uri, options);
}

async function createPdfUri(calculations, filterSummary) {
  const result = await Print.printToFileAsync({
    html: buildTableHtml(calculations, filterSummary),
    base64: false,
    width: 1190,
    height: 842,
    orientation: 'landscape',
  });
  return result.uri;
}

export default function CalculationTableModal({
  visible,
  calculations,
  onClose,
  onUpdateCalculations,
}) {
  const [rows, setRows] = useState(() => (calculations || []).map(normalizeCalculation));
  const [driveAccessToken, setDriveAccessToken] = useState(null);
  const [pendingDriveFormat, setPendingDriveFormat] = useState(null);
  const [googleRequest, googleResponse, promptGoogleLogin] = Google.useAuthRequest({
    ...googleClientIds,
    responseType: ResponseType.Token,
    scopes: [GOOGLE_DRIVE_SCOPE],
    redirectUri: makeRedirectUri({ scheme: 'calc' }),
  });
  const initialValuesRef = useRef({});
  const [warningModal, setWarningModal] = useState({
    visible: false,
    type: null,
    title: '',
    message: '',
    rowIndex: null,
    field: null,
    fieldName: '',
    oldValue: '',
    newValue: '',
    rowTitle: '',
  });
  const [commentModal, setCommentModal] = useState({
    visible: false,
    rowIndex: null,
    text: '',
  });
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateDropdownVisible, setDateDropdownVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (visible) {
      setRows((calculations || []).map(normalizeCalculation));
      setFromDate('');
      setToDate('');
      setSearchVisible(false);
      setSearchText('');
    }
  }, [visible, calculations]);

  useEffect(() => {
    if (googleResponse?.type === 'success' && googleResponse.authentication?.accessToken) {
      setDriveAccessToken(googleResponse.authentication.accessToken);
    }
  }, [googleResponse]);

  const availableDates = Array.from(
    new Set(
      rows
        .map((r) => getDateKey(r.savedAt || r.createdAt))
        .filter((d) => d && d !== 'No Date')
    )
  ).sort((a, b) => {
    const timeA = parseDateKeyToTime(a);
    const timeB = parseDateKeyToTime(b);
    return timeB - timeA;
  });

  const filteredRows = rows.filter((r) => {
    if (searchText.trim()) {
      const searchValue = searchText.trim().toLowerCase();
      if (!String(r.title || '').toLowerCase().includes(searchValue)) return false;
    }

    const dateKey = getDateKey(r.savedAt || r.createdAt);

    if (fromDate || toDate) {
      const t = parseDateKeyToTime(dateKey);
      const firstT = fromDate ? parseDateKeyToTime(fromDate) : 0;
      const lastT = toDate ? parseDateKeyToTime(toDate) : Infinity;
      const fromT = Math.min(firstT, lastT);
      const toT = Math.max(firstT, lastT) + (toDate ? 86399999 : 0);
      if (t < fromT || t > toT) return false;
    }

    return true;
  }).sort((first, second) => (
    new Date(second.savedAt || second.createdAt).getTime()
    - new Date(first.savedAt || first.createdAt).getTime()
  ));

  const getFilterLabel = () => {
    if (fromDate && toDate) {
      return `${fromDate} ➔ ${toDate}`;
    }
    if (fromDate) {
      return `From ${fromDate}`;
    }
    if (toDate) {
      return `Up to ${toDate}`;
    }
    if (!fromDate && !toDate) {
      return 'All Dates';
    }
    return `${fromDate || 'Start'} - ${toDate || 'End'}`;
  };

  const handleCellChange = (index, field, value) => {
    setRows((prev) => {
      const updated = prev.map((item, idx) => {
        if (idx !== index) return item;
        const nextItem = { ...item, [field]: value };
        if (field === 'info') {
          nextItem.expression = value;
        }
        return nextItem;
      });
      if (field === 'title' || field === 'comment') {
        if (onUpdateCalculations) onUpdateCalculations(updated);
      }
      return updated;
    });
  };

  const handleNumberCellFocus = (index, field) => {
    initialValuesRef.current[`${index}-${field}`] = String(rows[index]?.[field] ?? '');
  };

  const handleNumberCellBlur = (index, field) => {
    const initial = initialValuesRef.current[`${index}-${field}`];
    if (initial === undefined) return;
    delete initialValuesRef.current[`${index}-${field}`];

    const current = String(rows[index]?.[field] ?? '');
    const trimmedInitial = initial.trim();
    const trimmedCurrent = current.trim();

    if (trimmedInitial !== trimmedCurrent) {
      const fieldLabels = {
        cred: 'Cred',
        fact: 'Fact',
        fcash: 'Fcash',
        info: 'Info',
      };
      const fieldName = fieldLabels[field] || field;
      const rowTitle = rows[index]?.title?.trim() || `Row #${index + 1}`;

      setWarningModal({
        visible: true,
        type: 'change_number',
        title: 'Confirm Number Change',
        message: `Are you sure you want to change ${fieldName} for "${rowTitle}"?`,
        rowIndex: index,
        field,
        fieldName,
        oldValue: initial,
        newValue: current,
        rowTitle,
      });
    } else if (onUpdateCalculations) {
      onUpdateCalculations(rows);
    }
  };

  const promptDeleteRow = (index) => {
    const row = rows[index];
    const rowTitle = row?.title?.trim() || `Row #${index + 1}`;
    setWarningModal({
      visible: true,
      type: 'delete_line',
      title: 'Confirm Line Deletion',
      message: `Are you sure you want to delete "${rowTitle}"? This line will be permanently removed.`,
      rowIndex: index,
      rowTitle,
      field: null,
      fieldName: '',
      oldValue: '',
      newValue: '',
    });
  };

  const handleConfirmWarning = () => {
    if (warningModal.type === 'delete_line') {
      const updated = rows.filter((_, idx) => idx !== warningModal.rowIndex);
      setRows(updated);
      if (onUpdateCalculations) {
        onUpdateCalculations(updated);
      }
    } else if (warningModal.type === 'change_number') {
      if (onUpdateCalculations) {
        onUpdateCalculations(rows);
      }
    }
    setWarningModal({ visible: false, type: null });
  };

  const handleCancelWarning = () => {
    if (warningModal.type === 'change_number') {
      const updated = rows.map((item, idx) => {
        if (idx !== warningModal.rowIndex) return item;
        const reverted = { ...item, [warningModal.field]: warningModal.oldValue };
        if (warningModal.field === 'info') {
          reverted.expression = warningModal.oldValue;
        }
        return reverted;
      });
      setRows(updated);
      if (onUpdateCalculations) {
        onUpdateCalculations(updated);
      }
    }
    setWarningModal({ visible: false, type: null });
  };

  const handleSaveComment = () => {
    if (commentModal.rowIndex !== null) {
      handleCellChange(commentModal.rowIndex, 'comment', commentModal.text);
    }
    setCommentModal({ visible: false, rowIndex: null, text: '' });
  };

  const handleCancelComment = () => {
    setCommentModal({ visible: false, rowIndex: null, text: '' });
  };

  const handleAddRow = () => {
    setFromDate('');
    setToDate('');
    setSearchText('');
    const now = new Date().toISOString();
    const newRow = {
      id: `${Date.now()}-${Math.random()}`,
      createdAt: now,
      savedAt: now,
      title: '',
      info: '',
      expression: '',
      comment: '',
      cred: '',
      fact: '',
      fcash: '',
      type: 'Add',
      value: '',
    };
    const updated = [newRow, ...rows];
    setRows(updated);
    if (onUpdateCalculations) {
      onUpdateCalculations(updated);
    }
  };

  const filterSummary = [
    searchText.trim() ? `Name: ${searchText.trim()}` : '',
    fromDate || toDate ? `Dates: ${getFilterLabel()}` : '',
  ].filter(Boolean).join(' | ');

  const handleSaveCsv = async () => {
    const csv = buildTableCsv(filteredRows);
    const fileName = `calculator-table-${new Date().toISOString().slice(0, 10)}.csv`;
    if (downloadCsv(csv, fileName)) return;

    try {
      const dataUri = `data:text/csv;charset=utf-8,${encodeURIComponent(`\ufeff${csv}`)}`;
      await Sharing.shareAsync(dataUri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } catch (error) {
      Alert.alert('CSV export failed', error.message);
    }
  };

  const handleDriveUpload = async (format) => {
    if (!googleClientIds.webClientId && !googleClientIds.androidClientId && !googleClientIds.iosClientId) {
      Alert.alert('Google Drive setup required', 'Add the EXPO_PUBLIC_GOOGLE_*_CLIENT_ID values before uploading to Google Drive.');
      return;
    }

    try {
      let accessToken = driveAccessToken;
      if (!accessToken) {
        const loginResult = await promptGoogleLogin();
        accessToken = loginResult?.authentication?.accessToken;
        if (accessToken) setDriveAccessToken(accessToken);
      }
      if (!accessToken) return;

      const date = new Date().toISOString().slice(0, 10);
      if (format === 'csv') {
        await uploadFileToGoogleDrive({
          accessToken,
          fileName: `calculator-table-${date}.csv`,
          mimeType: 'text/csv',
          content: `\ufeff${buildTableCsv(filteredRows)}`,
        });
      } else {
        if (Platform.OS === 'web') {
          throw new Error('PDF upload to Google Drive requires an Android or iOS build. Use Save PDF on web.');
        }
        const pdfUri = await createPdfUri(filteredRows, filterSummary);
        const pdfResponse = await fetch(pdfUri);
        const pdfBlob = await pdfResponse.blob();
        await uploadFileToGoogleDrive({
          accessToken,
          fileName: `calculator-table-${date}.pdf`,
          mimeType: 'application/pdf',
          content: pdfBlob,
        });
      }
      Alert.alert('Google Drive', `${format.toUpperCase()} uploaded successfully.`);
    } catch (error) {
      Alert.alert('Google Drive upload failed', error.message);
    }
  };

  const saveTableAsPdf = () =>
    shareAsPdf(filteredRows, {
      UTI: 'com.adobe.pdf',
      mimeType: 'application/pdf',
    }, filterSummary).catch((error) => console.log('PDF save error:', error));

  const shareTable = () =>
    shareAsPdf(filteredRows, {
      mimeType: 'application/pdf',
    }, filterSummary).catch((error) => console.log('Share error:', error));

  const handleClose = () => {
    if (onUpdateCalculations) {
      onUpdateCalculations(rows);
    }
    onClose();
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={handleClose}>
      <View style={[styles.modalBackdrop, styles.tableModalBackdrop]}>
        <View style={styles.tablePanel}>
          <View style={styles.tableTopHeader}>
            <View style={styles.tableTitleGroup}>
              <Text style={[styles.listTitle, styles.tableTitle]}>Calculator table</Text>
              <Pressable
                style={[styles.searchIconButton, searchVisible && styles.searchIconButtonActive]}
                onPress={() => setSearchVisible((current) => !current)}
                accessibilityLabel="Search table by name"
              >
                <Text style={styles.searchIcon}>⌕</Text>
              </Pressable>
            </View>
            {searchVisible ? (
              <View style={styles.searchInputContainer}>
                <TextInput
                  autoFocus
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Search names..."
                  placeholderTextColor="#94a3b8"
                  style={styles.tableSearchInput}
                />
                {searchText ? (
                  <Pressable onPress={() => setSearchText('')} style={styles.searchClearButton}>
                    <Text style={styles.searchClearText}>×</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Pressable
              style={styles.dateDropdownButton}
              onPress={() => setDateDropdownVisible(true)}
            >
              <Text style={styles.dateDropdownButtonText}>
                📅 {getFilterLabel()}
              </Text>
              <Text style={styles.dateDropdownArrow}>▼</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.tableVerticalScroll} showsVerticalScrollIndicator>
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
              <View>
                <View style={styles.tableHeaderRow}>
                  <View style={[styles.tableHeaderCell, styles.nameColumn]}>
                    <Text style={styles.tableHeaderText}>Name</Text>
                  </View>
                  <View style={[styles.tableHeaderCell, styles.infoColumn]}>
                    <Text style={styles.tableHeaderText}>Info</Text>
                  </View>
                  <View style={[styles.tableHeaderCell, styles.commentsColumn]}>
                    <Text style={styles.tableHeaderText}>Comments</Text>
                  </View>
                  <View style={[styles.tableHeaderCell, styles.credColumn, styles.headerCred]}>
                    <Text style={styles.tableHeaderText}>Cred</Text>
                  </View>
                  <View style={[styles.tableHeaderCell, styles.factColumn, styles.headerFact]}>
                    <Text style={styles.tableHeaderText}>Fact</Text>
                  </View>
                  <View style={[styles.tableHeaderCell, styles.fcashColumn, styles.headerFcash]}>
                    <Text style={styles.tableHeaderText}>Fcash</Text>
                  </View>
                  <View style={[styles.tableHeaderCell, styles.actionColumn]}>
                    <Text style={styles.tableHeaderText}></Text>
                  </View>
                </View>
                {filteredRows.length ? (
                  filteredRows.map((calc, idx) => {
                    const realIndex = rows.findIndex((r) => r.id === calc.id);
                    const index = realIndex !== -1 ? realIndex : idx;

                    return (
                      <View key={calc.id || `${calc.createdAt}-${index}`} style={styles.tableBodyRow}>
                      {/* Name section */}
                      <View style={[styles.tableCell, styles.nameColumn]}>
                        <TextInput
                          style={styles.cellInput}
                          value={calc.title}
                          onChangeText={(text) => handleCellChange(index, 'title', text)}
                          placeholder="Name"
                          placeholderTextColor="#64748b"
                        />
                        {calc.savedAt ? (
                          <Text style={styles.cellDateText}>
                            {formatSavedDate(calc.savedAt || calc.createdAt)}
                          </Text>
                        ) : null}
                      </View>

                      {/* Info section */}
                      <View style={[styles.tableCell, styles.infoColumn]}>
                        <TextInput
                          style={styles.cellInput}
                          value={calc.info}
                          onChangeText={(text) => handleCellChange(index, 'info', text)}
                          onFocus={() => handleNumberCellFocus(index, 'info')}
                          onBlur={() => handleNumberCellBlur(index, 'info')}
                          placeholder="Formula / Info"
                          placeholderTextColor="#64748b"
                        />
                      </View>

                      {/* Comments section (formerly Add) */}
                      <View style={[styles.tableCell, styles.commentsColumn]}>
                        <Pressable
                          style={styles.cellPressable}
                          onPress={() => setCommentModal({ visible: true, rowIndex: index, text: calc.comment || '' })}
                        >
                          <Text
                            style={[styles.cellPressableText, !calc.comment && { color: '#64748b' }]}
                            numberOfLines={1}
                          >
                            {calc.comment || 'Comment...'}
                          </Text>
                        </Pressable>
                      </View>

                      {/* Cred section */}
                      <View style={[styles.tableCell, styles.credColumn, calc.cred ? styles.savedItemRed : null]}>
                        <TextInput
                          style={[styles.cellInput, styles.cellInputNumber]}
                          value={String(calc.cred ?? '')}
                          onChangeText={(text) => handleCellChange(index, 'cred', text)}
                          onFocus={() => handleNumberCellFocus(index, 'cred')}
                          onBlur={() => handleNumberCellBlur(index, 'cred')}
                          placeholder="—"
                          placeholderTextColor="#64748b"
                          keyboardType="numeric"
                        />
                      </View>

                      {/* Fact section */}
                      <View style={[styles.tableCell, styles.factColumn, calc.fact ? styles.savedItemPurple : null]}>
                        <TextInput
                          style={[styles.cellInput, styles.cellInputNumber]}
                          value={String(calc.fact ?? '')}
                          onChangeText={(text) => handleCellChange(index, 'fact', text)}
                          onFocus={() => handleNumberCellFocus(index, 'fact')}
                          onBlur={() => handleNumberCellBlur(index, 'fact')}
                          placeholder="—"
                          placeholderTextColor="#64748b"
                          keyboardType="numeric"
                        />
                      </View>

                      {/* Fcash section */}
                      <View style={[styles.tableCell, styles.fcashColumn, calc.fcash ? styles.savedItemBlue : null]}>
                        <TextInput
                          style={[styles.cellInput, styles.cellInputNumber]}
                          value={String(calc.fcash ?? '')}
                          onChangeText={(text) => handleCellChange(index, 'fcash', text)}
                          onFocus={() => handleNumberCellFocus(index, 'fcash')}
                          onBlur={() => handleNumberCellBlur(index, 'fcash')}
                          placeholder="—"
                          placeholderTextColor="#64748b"
                          keyboardType="numeric"
                        />
                      </View>

                      {/* Delete action */}
                      <View style={[styles.tableCell, styles.actionColumn]}>
                        <Pressable onPress={() => promptDeleteRow(index)} style={styles.deleteButton} hitSlop={8}>
                          <Text style={styles.deleteButtonText}>✕</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
                ) : (
                  <Text style={styles.emptyList}>
                    {fromDate || toDate
                      ? `No saved calculations from ${fromDate || 'the beginning'} to ${toDate || 'the end'}.`
                      : 'No saved calculations yet.'}
                  </Text>
                )}
              </View>
            </ScrollView>
          </ScrollView>
          <View style={styles.tableFooter}>
            <View style={styles.tableActions}>
              <Pressable onPress={handleAddRow} style={styles.addRowButton}>
                <Text style={styles.addRowButtonText}>+ Add Row</Text>
              </Pressable>
              <Pressable onPress={saveTableAsPdf} style={[styles.closeButton, styles.tableActionButton]}>
                <Text style={styles.closeButtonText}>Save PDF</Text>
              </Pressable>
              <Pressable onPress={handleSaveCsv} style={[styles.closeButton, styles.tableActionButton, styles.csvButton]}>
                <Text style={styles.closeButtonText}>Save CSV</Text>
              </Pressable>
            </View>
            <View style={styles.tableActions}>
              <Pressable onPress={shareTable} style={[styles.closeButton, styles.tableActionButton]}>
                <Text style={styles.closeButtonText}>Share</Text>
              </Pressable>
              <Pressable onPress={() => handleDriveUpload('pdf')} style={[styles.closeButton, styles.tableActionButton, styles.driveButton]}>
                <Text style={styles.closeButtonText}>Drive PDF</Text>
              </Pressable>
              <Pressable onPress={() => handleDriveUpload('csv')} style={[styles.closeButton, styles.tableActionButton, styles.driveButton]}>
                <Text style={styles.closeButtonText}>Drive CSV</Text>
              </Pressable>
            </View>
            <Pressable onPress={handleClose} style={[styles.closeButton, styles.listCloseButton, styles.tableCloseButton]}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Warning Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={warningModal.visible}
        onRequestClose={handleCancelWarning}
      >
        <View style={styles.warningBackdrop}>
          <View style={styles.warningPanel}>
            <View style={styles.warningHeaderRow}>
              <View
                style={[
                  styles.warningIconContainer,
                  warningModal.type === 'delete_line'
                    ? styles.warningIconDelete
                    : styles.warningIconChange,
                ]}
              >
                <Text style={styles.warningIconText}>
                  {warningModal.type === 'delete_line' ? '🗑️' : '⚠️'}
                </Text>
              </View>
              <Text style={styles.warningTitle}>{warningModal.title}</Text>
            </View>

            <Text style={styles.warningMessage}>{warningModal.message}</Text>

            {warningModal.type === 'change_number' ? (
              <View style={styles.warningPreviewBox}>
                <View style={styles.warningPreviewCol}>
                  <Text style={styles.warningPreviewLabel}>Original</Text>
                  <Text style={styles.warningPreviewOld}>
                    {warningModal.oldValue || '(empty)'}
                  </Text>
                </View>
                <Text style={styles.warningPreviewArrow}>➔</Text>
                <View style={styles.warningPreviewCol}>
                  <Text style={styles.warningPreviewLabel}>New</Text>
                  <Text style={styles.warningPreviewNew}>
                    {warningModal.newValue || '(empty)'}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.warningActions}>
              <Pressable
                onPress={handleCancelWarning}
                style={[styles.closeButton, styles.warningCancelButton]}
              >
                <Text style={styles.warningCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmWarning}
                style={[
                  styles.closeButton,
                  warningModal.type === 'delete_line'
                    ? styles.warningConfirmButtonDelete
                    : styles.warningConfirmButton,
                ]}
              >
                <Text style={styles.warningConfirmText}>
                  {warningModal.type === 'delete_line' ? 'Confirm Delete' : 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Comments Editor Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={commentModal.visible}
        onRequestClose={handleCancelComment}
      >
        <View style={styles.commentModalBackdrop}>
          <View style={styles.commentModalPanel}>
            <Text style={styles.commentModalTitle}>Edit Comment</Text>
            <TextInput
              style={styles.commentModalInput}
              value={commentModal.text}
              onChangeText={(text) => setCommentModal((prev) => ({ ...prev, text }))}
              placeholder="Enter your comment here..."
              placeholderTextColor="#64748b"
              multiline
              autoFocus
            />
            <View style={styles.commentModalActions}>
              <Pressable
                onPress={handleCancelComment}
                style={styles.commentModalCancelButton}
              >
                <Text style={styles.commentModalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveComment}
                style={styles.commentModalSaveButton}
              >
                <Text style={styles.commentModalButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Filter Dropdown Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={dateDropdownVisible}
        onRequestClose={() => setDateDropdownVisible(false)}
      >
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => setDateDropdownVisible(false)}
        >
          <Pressable style={styles.dropdownPanel}>
            <Text style={styles.dropdownTitle}>Choose date range</Text>
            <View style={styles.quickActionsRow}>
              <Pressable
                style={styles.quickActionButton}
                onPress={() => {
                  setFromDate('');
                  setToDate('');
                }}
              >
                <Text style={styles.quickActionText}>All dates</Text>
              </Pressable>
              <Pressable
                style={styles.quickActionButton}
                onPress={() => {
                  setFromDate(availableDates[availableDates.length - 1] || '');
                  setToDate(availableDates[0] || '');
                }}
              >
                <Text style={styles.quickActionText}>All available</Text>
              </Pressable>
            </View>
            <View style={styles.rangeContainer}>
              <View style={styles.rangeCol}>
                <Text style={styles.rangeLabel}>From</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rangeScroll}>
                  {availableDates.map((dateStr) => (
                    <Pressable
                      key={`from-${dateStr}`}
                      style={[styles.rangePill, fromDate === dateStr && styles.rangePillSelected]}
                      onPress={() => setFromDate(dateStr)}
                    >
                      <Text style={[styles.rangePillText, fromDate === dateStr && styles.rangePillTextSelected]}>{dateStr}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.rangeCol}>
                <Text style={styles.rangeLabel}>To</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rangeScroll}>
                  {availableDates.map((dateStr) => (
                    <Pressable
                      key={`to-${dateStr}`}
                      style={[styles.rangePill, toDate === dateStr && styles.rangePillSelected]}
                      onPress={() => setToDate(dateStr)}
                    >
                      <Text style={[styles.rangePillText, toDate === dateStr && styles.rangePillTextSelected]}>{dateStr}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
            <Text style={styles.listSubtitle}>Rows in range: {filteredRows.length}</Text>
            <Pressable
              onPress={() => setDateDropdownVisible(false)}
              style={styles.dropdownCloseButton}
            >
              <Text style={styles.dropdownCloseButtonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}
