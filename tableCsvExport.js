import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { formatSavedDate, pretty } from './calculatorUtils';
import { normalizeCalculation } from './calculationHistory';
import { getPaidOffEntries } from './paidOff';
// Historical CSV layout also emitted synthetic payment rows; the importable
// export now keeps payments attached to their original calculation instead.
// import { getPaidOffEntries, getTablePaymentRows } from './paidOff';

function dateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function pickerKey(value) {
  const [day, month, year] = String(value || '').split('/');
  return year && month && day ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : '';
}

function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^[=+@\-\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function numberDisplay(value) {
  if (!value && value !== 0) return '';
  const number = Number(String(value).replace(/,/g, ''));
  return Number.isNaN(number) ? String(value) : pretty(String(value));
}

function paidOffText(row, t) {
  return getPaidOffEntries(row).map(entry => `${t(entry.category)}: ${numberDisplay(entry.amount)}`).join('\n');
}

const IMPORT_FIELDS = ['_calc_id', '_calc_type', '_calc_created_at', '_calc_saved_at', '_calc_debt_paid_at', '_calc_debt_paid_amount', '_calc_invoice_paid_at', '_calc_invoice_paid_amount'];

function buildTableCsv(rows, t) {
  const header = ['Name', 'Date', 'Info', 'Comments', 'Cred', 'Fact', 'Fcash', 'Paid off'].map(key => t(key));
  header.push(...IMPORT_FIELDS);
  const values = rows.map(row => {
    const normalized = normalizeCalculation(row);
    return [
      normalized.title || t('Untitled'),
      formatSavedDate(normalized.savedAt || normalized.createdAt),
      normalized.info || normalized.expression || '',
      normalized.comment || '',
      numberDisplay(normalized.cred),
      numberDisplay(normalized.fact),
      numberDisplay(normalized.fcash),
      paidOffText(normalized, t),
      normalized.id,
      normalized.type || 'Add',
      normalized.createdAt,
      normalized.savedAt,
      normalized.paidOffAt || '',
      normalized.paidOffAmount || '',
      normalized.invoicePaidOffAt || '',
      normalized.invoicePaidOffAmount || '',
    ];
  });
  return [header, ...values].map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function filterCalculationsForDateRange(calculations, fromDate, toDate) {
  const from = pickerKey(fromDate);
  const to = pickerKey(toDate);
  return (calculations || []).filter(row => !row.deletedAt && !row.permanentlyDeletedAt && !row.paymentOnly).map(normalizeCalculation)
    .filter(row => {
      const key = dateKey(row.savedAt || row.createdAt);
      return !!key && (!from || key >= from) && (!to || key <= to);
    });
}

function parseCsvRows(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); if (row.some(value => value !== '')) rows.push(row); }
  return rows;
}

function allLabelValues(key, t, i18n) {
  const values = new Set([key, t(key)]);
  for (const language of Object.values(i18n?.store?.data || {})) {
    const visit = value => {
      if (!value || typeof value !== 'object') return;
      if (typeof value[key] === 'string') values.add(value[key]);
      Object.values(value).forEach(visit);
    };
    visit(language);
  }
  return values;
}

function parseExportDate(value) {
  const match = String(value || '').match(/^(?:\d{1,2}:\d{2}\s+)?(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function parseTableCsv(text, t, i18n) {
  const data = parseCsvRows(text);
  if (data.length < 2) throw new Error('The CSV file has no calculation rows.');
  const headers = data[0].map(value => value.trim());
  const fieldKeys = ['Name', 'Date', 'Info', 'Comments', 'Cred', 'Fact', 'Fcash', 'Paid off'];
  const indexes = Object.fromEntries(fieldKeys.map(key => [key, headers.findIndex(header => allLabelValues(key, t, i18n).has(header))]));
  const required = ['Name'];
  // Older Calc CSVs did not include the round-trip metadata columns.
  // return getTablePaymentRows((calculations || []).filter(row => !row.deletedAt).map(normalizeCalculation));
  if (required.some(key => indexes[key] < 0) || !fieldKeys.slice(1).some(key => indexes[key] >= 0)) {
    throw new Error('This CSV does not appear to be an exported Calc file.');
  }
  const meta = Object.fromEntries(IMPORT_FIELDS.map(key => [key, headers.indexOf(key)]));
  const get = (cells, index) => index < 0 ? '' : String(cells[index] ?? '').trim();
  const rows = data.slice(1).map((cells, index) => {
    const info = get(cells, indexes.Info);
    const dateValue = get(cells, indexes.Date);
    const savedAt = get(cells, meta._calc_saved_at) || parseExportDate(dateValue) || new Date().toISOString();
    const cred = get(cells, indexes.Cred), fact = get(cells, indexes.Fact), fcash = get(cells, indexes.Fcash);
    const comment = get(cells, indexes.Comments), paidOff = get(cells, indexes['Paid off']);
    // Earlier table exports included display-only payment rows. The real calculation keeps its paid-off data in its own row.
    if (!info && !comment && !cred && !fact && !fcash && paidOff) return null;
    return normalizeCalculation({
      id: get(cells, meta._calc_id) || `csv-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      type: get(cells, meta._calc_type) || (cred ? 'Cred' : fact ? 'Fact' : fcash ? 'Fcash' : 'Add'),
      title: get(cells, indexes.Name), info, expression: info, comment,
      cred, fact, fcash, value: info.split('=').at(-1)?.trim() || '',
      createdAt: get(cells, meta._calc_created_at) || savedAt, savedAt,
      paidOffAt: get(cells, meta._calc_debt_paid_at), paidOffAmount: get(cells, meta._calc_debt_paid_amount),
      invoicePaidOffAt: get(cells, meta._calc_invoice_paid_at), invoicePaidOffAmount: get(cells, meta._calc_invoice_paid_amount),
    });
  }).filter(row => row?.title);
  if (!rows.length) throw new Error('No named calculations were found in this CSV.');
  return rows;
}

export async function shareTableCsv(rows, fromDate, toDate, t) {
  const csv = buildTableCsv(rows, t);
  const start = pickerKey(fromDate) || 'all';
  const end = pickerKey(toDate) || 'all';
  const fileName = `calculator-${start}-to-${end}.csv`;

  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && typeof File !== 'undefined' && navigator.share) {
      const file = new File([`\ufeff${csv}`], fileName, { type: 'text/csv;charset=utf-8' });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: fileName });
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }
    }
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, `\ufeff${csv}`);
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
}
