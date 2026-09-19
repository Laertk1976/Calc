import DateRangeCalendar from './DateRangeCalendar';
import SyncStatus from './SyncStatus';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import KeyboardModalFrame from './KeyboardModalFrame';
import useCalculatorStyles from '../useCalculatorStyles';
import { evaluateExpression, formatSavedDate, pretty } from '../calculatorUtils';
import { uploadFileToGoogleDrive } from '../googleDrive';
import { shareRowSummary } from '../shareUtils';
import useDriveAuthorization from '../useDriveAuthorization';
import { latestUndoableChange, normalizeCalculation } from '../calculationHistory';
import CalculationHistoryModal from './CalculationHistoryModal';
import { buildDriveExportFileName } from '../driveExportNames';

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

function formatNumberDisplay(val) {
  if (!val && val !== 0) return '';
  const num = Number(String(val).replace(/,/g, ''));
  return Number.isNaN(num) ? String(val) : pretty(String(val));
}

function getFormulaResult(value) {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const resultPart = raw.includes('=') ? raw.split('=').pop().trim() : raw;
  const normalized = resultPart
    .replace(/,/g, '')
    .replace(/\*/g, ' × ')
    .replace(/–|—/g, ' − ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return null;

  const directNumber = Number(normalized);
  if (Number.isFinite(directNumber)) return directNumber;

  const expression = normalized.replace(/\s*([÷×−+])\s*/g, ' $1 ').trim();
  const evaluated = evaluateExpression(expression);

  if (evaluated === 'Error' || !Number.isFinite(Number(evaluated))) return null;
  return Number(evaluated);
}

function getInfoGrandTotal(calculations) {
  return calculations.reduce((totals, calc) => {
    const rawInfo = calc?.info || calc?.expression || '';
    const result = getFormulaResult(rawInfo);

    if (result === null) return totals;

    totals.total += result;
    totals.hasValue = true;
    return totals;
  }, { total: 0, hasValue: false });
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
    .cell-info-total {
      margin-top: 4px;
      font-size: 7.5px;
      font-weight: 700;
      color: #166534;
      letter-spacing: 0.15px;
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
  syncStatus,
  onRetrySync,
  visible,
  calculations,
  onClose,
  onUpdateCalculations,
}) {
  const styles = useCalculatorStyles();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [rows, setRows] = useState(() => (calculations || []).filter((row) => !row.deletedAt).map(normalizeCalculation));
  const [historyVisible, setHistoryVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const undoable = latestUndoableChange(calculations || []);
  const [driveUploadBusy, setDriveUploadBusy] = useState(false);
  const driveAuthorization = useDriveAuthorization();
  const initialValuesRef = useRef({});
  const initialNamesRef = useRef(new Map());
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
  const [fromDate, setFromDate] = useState(() => getDateKey(new Date()));
  const [toDate, setToDate] = useState(() => getDateKey(new Date()));
  const [dateDropdownVisible, setDateDropdownVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const tableHeaderScrollRef = useRef(null);
  const tableBodyScrollRef = useRef(null);
  const commentInputRef = useRef(null);

  const syncTableHorizontalScroll = (event, targetRef) => {
    targetRef.current?.scrollTo({
      x: event.nativeEvent.contentOffset.x,
      animated: false,
    });
  };

  useEffect(() => {
    if (visible) {
      setRows((calculations || []).filter((row) => !row.deletedAt).map(normalizeCalculation));
    }
  }, [visible, calculations]);

  useEffect(() => {
    if (visible) {
      const today = getDateKey(new Date());
      setFromDate(today);
      setToDate(today);
      setSearchVisible(false);
      setSearchText('');
    }
  }, [visible]);

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
      if (fromDate === toDate) return fromDate;
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
    }
  };

  const promptDeleteRow = (index) => {
    const row = rows[index];
    const rowTitle = row?.title?.trim() || `Row #${index + 1}`;
    setWarningModal({
      visible: true,
      type: 'delete_line',
      title: 'Confirm Line Deletion',
      message: `Delete "${rowTitle}"? You can undo this or restore it from History later.`,
      rowIndex: index,
      rowTitle,
      field: null,
      fieldName: '',
      oldValue: '',
      newValue: '',
    });
  };

  const commitChange = async (change) => {
    setSaving(true);
    try {
      await onUpdateCalculations(change);
      return true;
    } catch (error) {
      setRows((calculations || []).filter((row) => !row.deletedAt).map(normalizeCalculation));
      Alert.alert('Change not saved', error?.message || 'Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmWarning = async () => {
    if (saving) return;
    if (warningModal.type === 'delete_line') {
      await commitChange({ type: 'delete', id: rows[warningModal.rowIndex].id });
    } else if (warningModal.type === 'change_number') {
      await commitChange({ type: 'edit', id: rows[warningModal.rowIndex].id, changes: { [warningModal.field]: warningModal.newValue } });
    }
    setWarningModal({ visible: false, type: null });
  };

  const handleCancelWarning = () => {
    if (saving) return;
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
    }
    setWarningModal({ visible: false, type: null });
  };

  const handleSaveComment = () => {
    if (commentModal.rowIndex !== null) {
      commitChange({ type: 'edit', id: rows[commentModal.rowIndex].id, changes: { comment: commentModal.text } });
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
    commitChange({ type: 'add', row: newRow });
  };

  const filterSummary = [
    searchText.trim() ? `Name: ${searchText.trim()}` : '',
    fromDate || toDate ? `Dates: ${getFilterLabel()}` : '',
  ].filter(Boolean).join(' | ');

  const infoGrandTotal = getInfoGrandTotal(filteredRows);
  const sectionTotals = filteredRows.reduce((totals, calc) => {
    ['cred', 'fact', 'fcash'].forEach((field) => {
      const raw = calc?.[field];
      if (raw === '' || raw === null || raw === undefined) return;

      const num = Number(String(raw).replace(/,/g, ''));
      if (Number.isFinite(num) && num !== 0) totals[field] += num;
    });
    return totals;
  }, { cred: 0, fact: 0, fcash: 0 });
  const hasAnyTotals = infoGrandTotal.hasValue || sectionTotals.cred || sectionTotals.fact || sectionTotals.fcash;
  const totalLabel = infoGrandTotal.hasValue ? `TOTAL: ${pretty(String(Math.round(infoGrandTotal.total * 10000) / 10000))}` : 'TOTAL';

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
    if (driveUploadBusy) return;

    if (format === 'pdf' && Platform.OS === 'web') {
      Alert.alert('PDF upload unavailable', 'Google Drive PDF upload requires an Android or iOS build. Use Save PDF on web.');
      return;
    }

    if (!driveAuthorization.configured) {
      Alert.alert('Google Drive setup required', 'Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID before uploading to Google Drive.');
      return;
    }

    if (!driveAuthorization.ready) {
      Alert.alert('Google Drive is not ready', 'Please wait a moment and try again. If this continues, restart the app after rebuilding it.');
      return;
    }

    setDriveUploadBusy(true);
    try {
      const accessToken = await driveAuthorization.authorize();
      if (!accessToken) {
        Alert.alert('Google Drive sign-in cancelled', 'Sign in to Google to upload the table.');
        return;
      }

      const fileName = buildDriveExportFileName(filteredRows, format);
      if (format === 'csv') {
        await uploadFileToGoogleDrive({
          accessToken,
          fileName,
          mimeType: 'text/csv',
          content: `\ufeff${buildTableCsv(filteredRows)}`,
        });
      } else {
        const pdfUri = await createPdfUri(filteredRows, filterSummary);
        const pdfResponse = await fetch(pdfUri);
        const pdfBlob = await pdfResponse.blob();
        await uploadFileToGoogleDrive({
          accessToken,
          fileName,
          mimeType: 'application/pdf',
          content: pdfBlob,
        });
      }
      Alert.alert('Google Drive', `Saved to Calculator/${fileName}`);
    } catch (error) {
      Alert.alert('Google Drive upload failed', error?.message || 'The upload could not be completed.');
    } finally {
      setDriveUploadBusy(false);
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
    if (saving || warningModal.visible) return;
    const dirtyIndex = rows.findIndex((row) => {
      const saved = (calculations || []).find((item) => (item.id || item.createdAt) === row.id);
      return saved && ['info', 'cred', 'fact', 'fcash'].some((field) => String(row[field] ?? '') !== String(normalizeCalculation(saved)[field] ?? ''));
    });
    if (dirtyIndex !== -1) {
      const row = rows[dirtyIndex];
      const saved = normalizeCalculation(calculations.find((item) => (item.id || item.createdAt) === row.id));
      const field = ['info', 'cred', 'fact', 'fcash'].find((key) => String(row[key] ?? '') !== String(saved[key] ?? ''));
      initialValuesRef.current[`${dirtyIndex}-${field}`] = String(saved[field] ?? '');
      handleNumberCellBlur(dirtyIndex, field);
      return;
    }
    const pending = Object.keys(initialValuesRef.current)[0];
    if (pending) {
      const [index, field] = pending.split('-');
      handleNumberCellBlur(Number(index), field);
      return;
    }
    onClose();
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={handleClose}>
      <KeyboardModalFrame style={[styles.modalBackdrop, styles.tableModalBackdrop]} onKeyboardVisibilityChange={setKeyboardVisible}>
        <View style={[styles.tablePanel, { pointerEvents: saving ? 'none' : 'auto' }]}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <Pressable onPress={() => setHistoryVisible(true)} disabled={saving} style={styles.authButton} accessibilityRole="button">
              <Text style={styles.authButtonText}>History</Text>
            </Pressable>
            {undoable ? (
              <Pressable disabled={saving} onPress={() => commitChange({ type: 'undo', id: undoable.row.id, eventId: undoable.event.id })} style={styles.authButton} accessibilityRole="button">
                <Text style={styles.authButtonText}>{undoable.event.type === 'delete' ? 'Undo delete' : 'Undo edit'}</Text>
              </Pressable>
            ) : null}
            {saving ? <Text style={{ color: '#cbd5e1' }}>Saving...</Text> : null}
          </View>
          <SyncStatus syncStatus={syncStatus} onRetrySync={onRetrySync} />
          <View style={styles.tableTopHeader}>
            <View style={styles.tableTitleGroup}>
              <Text style={[styles.listTitle, styles.tableTitle]}>Calculator table</Text>
              <Pressable
                style={({ pressed }) => [styles.searchIconButton, searchVisible && styles.searchIconButtonActive, pressed && styles.pressed]}
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
                  <Pressable onPress={() => setSearchText('')} style={({ pressed }) => [styles.searchClearButton, pressed && styles.pressed]}>
                    <Text style={styles.searchClearText}>×</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.dateDropdownButton, pressed && styles.pressed]}
              onPress={() => setDateDropdownVisible(true)}
            >
              <Text style={styles.dateDropdownButtonText}>
                📅 {getFilterLabel()}
              </Text>
              <Text style={styles.dateDropdownArrow}>▼</Text>
            </Pressable>
          </View>
          <Text style={styles.listSubtitle} accessibilityLiveRegion="polite">
            {filteredRows.length === rows.length
              ? `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`
              : `${filteredRows.length} of ${rows.length} rows`}
          </Text>
          <ScrollView
            ref={tableHeaderScrollRef}
            horizontal
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            style={styles.tableHeaderScroll}
          >
            <View style={styles.tableHeaderRow}>
                  <View style={[styles.tableHeaderCell, styles.rowNumberColumn]}>
                    <Text style={styles.tableHeaderText}>#</Text>
                  </View>
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
                    <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={[styles.tableHeaderText, styles.tableHeaderTextCompact]}>Cred</Text>
                  </View>
                  <View style={[styles.tableHeaderCell, styles.factColumn, styles.headerFact]}>
                    <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={[styles.tableHeaderText, styles.tableHeaderTextCompact]}>Fact</Text>
                  </View>
                  <View style={[styles.tableHeaderCell, styles.fcashColumn, styles.headerFcash]}>
                    <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={[styles.tableHeaderText, styles.tableHeaderTextCompact]}>Fcash</Text>
                  </View>
                  <View style={[styles.tableHeaderCell, styles.actionColumn]}>
                    <Text style={styles.tableHeaderText}></Text>
                  </View>
            </View>
          </ScrollView>
          <ScrollView
            style={styles.tableVerticalScroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            removeClippedSubviews={false}
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            <ScrollView
              ref={tableBodyScrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              removeClippedSubviews={false}
              horizontal
              showsHorizontalScrollIndicator
              style={styles.tableScroll}
              nestedScrollEnabled
              directionalLockEnabled
              alwaysBounceHorizontal={false}
              onScroll={(event) => syncTableHorizontalScroll(event, tableHeaderScrollRef)}
              scrollEventThrottle={16}
            >
              <View>
                {filteredRows.length ? (
                  filteredRows.map((calc, idx) => {
                    const realIndex = rows.findIndex((r) => r.id === calc.id);
                    const index = realIndex !== -1 ? realIndex : idx;

                    return (
                      <View key={calc.id || `${calc.createdAt}-${index}`} style={styles.tableBodyRow}>
                      <View style={[styles.tableCell, styles.rowNumberColumn]}>
                        <Text style={styles.tableCellText}>{idx + 1}</Text>
                      </View>
                      {/* Name section */}
                      <View style={[styles.tableCell, styles.nameColumn]}>
                        <View style={styles.shareCellRow}>
                          <TextInput
                            style={[styles.cellInput, styles.nameInput]}
                            value={calc.title}
                            onFocus={() => initialNamesRef.current.set(calc.id, calc.title || '')}
                            onChangeText={(text) => handleCellChange(index, 'title', text)}
                            onBlur={() => {
                              const initialName = initialNamesRef.current.get(calc.id);
                              initialNamesRef.current.delete(calc.id);
                              if (initialName !== undefined && initialName !== (calc.title || '')) {
                                void commitChange({ type: 'edit', id: calc.id, changes: { title: calc.title } });
                              }
                            }}
                            autoComplete="off"
                            importantForAutofill="no"
                            autoCorrect={false}
                            placeholder="Name"
                            placeholderTextColor="#64748b"
                          />
                          <Pressable
                            onPress={() => shareRowSummary(calc)}
                            style={({ pressed }) => [styles.shareRowButton, pressed && styles.pressed]}
                            hitSlop={{ top: 8, bottom: 8, left: 0, right: 4 }}
                            accessibilityLabel="Share this row"
                          >
                            <Text style={styles.shareRowButtonText}>↗</Text>
                          </Pressable>
                        </View>
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
                          style={({ pressed }) => [styles.cellPressable, pressed && styles.pressed]}
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
                        <Pressable onPress={() => promptDeleteRow(index)} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]} hitSlop={8}>
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

                {filteredRows.length && hasAnyTotals ? (
                  <View style={styles.tableTotalRow}>
                    <View style={[styles.tableCell, styles.rowNumberColumn, styles.totalSummaryCell]} />
                    <View style={[styles.tableCell, styles.nameColumn, styles.totalSummaryCell]} />
                    <View style={[styles.tableCell, styles.infoColumn, styles.totalSummaryCell]}>
                      <Text style={styles.totalSummaryLabel}>{totalLabel}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.commentsColumn, styles.totalSummaryCell]} />
                    <View style={[styles.tableCell, styles.credColumn, styles.totalSummaryCell]}>
                      <Text style={styles.totalSummaryValue}>{sectionTotals.cred ? pretty(String(Math.round(sectionTotals.cred * 10000) / 10000)) : '-'}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.factColumn, styles.totalSummaryCell]}>
                      <Text style={styles.totalSummaryValue}>{sectionTotals.fact ? pretty(String(Math.round(sectionTotals.fact * 10000) / 10000)) : '-'}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.fcashColumn, styles.totalSummaryCell]}>
                      <Text style={styles.totalSummaryValue}>{sectionTotals.fcash ? pretty(String(Math.round(sectionTotals.fcash * 10000) / 10000)) : '-'}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.actionColumn, styles.totalSummaryCell]} />
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </ScrollView>
          <View style={[styles.tableFooter, keyboardVisible && { display: 'none' }]}>
            <View style={styles.tableActions}>
              <Pressable onPress={handleAddRow} style={({ pressed }) => [styles.addRowButton, pressed && styles.pressed]}>
                <Text style={styles.addRowButtonText}>+ Add Row</Text>
              </Pressable>
              <Pressable onPress={saveTableAsPdf} style={({ pressed }) => [styles.closeButton, styles.tableActionButton, pressed && styles.pressed]}>
                <Text style={styles.closeButtonText}>Save PDF</Text>
              </Pressable>
              <Pressable onPress={handleSaveCsv} style={({ pressed }) => [styles.closeButton, styles.tableActionButton, styles.csvButton, pressed && styles.pressed]}>
                <Text style={styles.closeButtonText}>Save CSV</Text>
              </Pressable>
            </View>
            <View style={styles.tableActions}>
              <Pressable onPress={shareTable} style={({ pressed }) => [styles.closeButton, styles.tableActionButton, pressed && styles.pressed]}>
                <Text style={styles.closeButtonText}>Share</Text>
              </Pressable>
              <Pressable disabled={driveUploadBusy} onPress={() => handleDriveUpload('pdf')} style={({ pressed }) => [styles.closeButton, styles.tableActionButton, styles.driveButton, driveUploadBusy && styles.disabledButton, pressed && styles.pressed]}>
                <Text style={styles.closeButtonText}>{driveUploadBusy ? 'Connecting...' : 'Drive PDF'}</Text>
              </Pressable>
              <Pressable disabled={driveUploadBusy} onPress={() => handleDriveUpload('csv')} style={({ pressed }) => [styles.closeButton, styles.tableActionButton, styles.driveButton, driveUploadBusy && styles.disabledButton, pressed && styles.pressed]}>
                <Text style={styles.closeButtonText}>{driveUploadBusy ? 'Connecting...' : 'Drive CSV'}</Text>
              </Pressable>
            </View>
            <Pressable onPress={handleClose} style={({ pressed }) => [styles.closeButton, styles.listCloseButton, styles.tableCloseButton, pressed && styles.pressed]}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardModalFrame>

      {/* Warning Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={warningModal.visible}
        onRequestClose={handleCancelWarning}
      >
        <KeyboardModalFrame style={styles.warningBackdrop}>
          <View style={[styles.warningPanel, { flexShrink: 1 }]}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
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

            </ScrollView>
            <View style={[styles.warningActions, { flexShrink: 0 }]}>
              <Pressable
                onPress={handleCancelWarning}
                style={({ pressed }) => [styles.closeButton, styles.warningCancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.warningCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmWarning}
                disabled={saving}
                style={({ pressed }) => [
                  styles.closeButton,
                  warningModal.type === 'delete_line'
                    ? styles.warningConfirmButtonDelete
                    : styles.warningConfirmButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.warningConfirmText}>
                  {warningModal.type === 'delete_line' ? 'Confirm Delete' : 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardModalFrame>
      </Modal>

      {/* Comments Editor Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={commentModal.visible}
        onRequestClose={handleCancelComment}
        onShow={() => commentInputRef.current?.focus()}
      >
        <KeyboardModalFrame style={styles.commentModalBackdrop}>
          <View style={[styles.commentModalPanel, { flexShrink: 1 }]}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
            <Text style={styles.commentModalTitle}>Edit Comment</Text>
            <TextInput
              ref={commentInputRef}
              style={styles.commentModalInput}
              value={commentModal.text}
              onChangeText={(text) => setCommentModal((prev) => ({ ...prev, text }))}
              placeholder="Enter your comment here..."
              placeholderTextColor="#64748b"
              multiline
              autoFocus={Platform.OS === 'web'}
              showSoftInputOnFocus
            />
            </ScrollView>
            <View style={[styles.commentModalActions, { flexShrink: 0 }]}>
              <Pressable
                onPress={handleCancelComment}
                style={({ pressed }) => [styles.commentModalCancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.commentModalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveComment}
                style={({ pressed }) => [styles.commentModalSaveButton, pressed && styles.pressed]}
              >
                <Text style={styles.commentModalButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardModalFrame>
      </Modal>

      {/* Date Filter Dropdown Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={dateDropdownVisible}
        onRequestClose={() => setDateDropdownVisible(false)}
      >
        <KeyboardModalFrame style={styles.dropdownBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss date picker"
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            onPress={() => setDateDropdownVisible(false)}
          />
          <View style={[styles.dropdownPanel, { maxHeight: '90%' }]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 4 }}>
              <Text style={styles.dropdownTitle}>Choose date range</Text>
              {dateDropdownVisible && <DateRangeCalendar fromDate={fromDate} toDate={toDate} onChange={(from, to) => { setFromDate(from); setToDate(to); }} />}
              <Text style={styles.listSubtitle}>{getFilterLabel()}</Text>
              <Text style={styles.listSubtitle}>Rows in range: {filteredRows.length}</Text>
              <Pressable
                onPress={() => setDateDropdownVisible(false)}
                style={({ pressed }) => [styles.dropdownCloseButton, pressed && styles.pressed]}
              >
                <Text style={styles.dropdownCloseButtonText}>Apply dates</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardModalFrame>
      </Modal>
      <CalculationHistoryModal
        visible={historyVisible}
        calculations={calculations || []}
        saving={saving}
        onChange={commitChange}
        onClose={() => setHistoryVisible(false)}
      />
    </Modal>
  );
}
