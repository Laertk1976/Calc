import { normalizeCalculation } from './calculationHistory';

export function monthKey(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthDistance(value, now = new Date()) {
  if (!monthKey(value)) return null;
  const date = new Date(value);
  return (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth();
}

export const debtNameKey = name => String(name || '').trim().normalize('NFC').toLowerCase();
const amountValue = value => {
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  if (!normalized) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
};
const dateValue = value => {
  const timestamp = new Date(value || '').getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};
const rowDateValue = row => {
  const savedAt = dateValue(row.savedAt);
  return Number.isFinite(savedAt) ? savedAt : dateValue(row.createdAt);
};
const rowDate = row => Number.isFinite(dateValue(row.savedAt)) ? row.savedAt
  : Number.isFinite(dateValue(row.createdAt)) ? row.createdAt : '';

export function groupDebtRows(rows, amountField = 'cred') {
  const paidField = amountField === 'fact' ? 'invoicePaidOffAmount' : 'paidOffAmount';
  const groups = new Map();
  for (const row of rows) {
    const key = debtNameKey(row.title) || `untitled:${row.id}`;
    if (!groups.has(key)) groups.set(key, { key, title: row.title, rows: [], total: 0, paidTotal: 0 });
    const group = groups.get(key);
    group.rows.push(row);
    group.total += amountValue(row[amountField]);
    group.paidTotal += amountValue(row[paidField]);
  }
  return [...groups.values()].map(group => {
    const datedRows = [...group.rows].sort((a, b) => rowDateValue(b) - rowDateValue(a));
    const latestRow = datedRows.find(row => Number.isFinite(rowDateValue(row)));
    return {
      ...group,
      rows: datedRows,
      latestAt: latestRow ? rowDate(latestRow) : '',
      total: Number.isFinite(group.total) ? Number(group.total.toPrecision(15)) : NaN,
      paidTotal: Number.isFinite(group.paidTotal) ? Number(group.paidTotal.toPrecision(15)) : NaN,
      originalTotal: Number.isFinite(group.total + group.paidTotal) ? Number((group.total + group.paidTotal).toPrecision(15)) : NaN,
    };
  }).sort((a, b) => dateValue(b.latestAt) - dateValue(a.latestAt));
}

export function selectedDebtRows(calculations, ids, amountField = 'cred') {
  const rowsById = new Map(calculations.map(normalizeCalculation).map(row => [row.id, row]));
  return ids.map(id => rowsById.get(id)).filter(row =>
    row && row[amountField] !== '' && row[amountField] !== null && row[amountField] !== undefined
      && (!row.deletedAt || row.history.at(-1)?.type === 'delete')
  );
}

export function debtNames(calculations, query = '', amountField = 'cred') {
  const names = new Map();
  for (const row of debtRows(calculations, '', '', null, amountField)) {
    const key = debtNameKey(row.title);
    if (key && key.includes(debtNameKey(query)) && !names.has(key)) names.set(key, row.title.trim());
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

export function debtRows(calculations, from = '', to = '', name = null, amountField = 'cred', unpaidOnly = false) {
  return calculations.filter(row => !row.deletedAt).map(normalizeCalculation)
    .filter(row => row[amountField] !== '' && row[amountField] !== null && row[amountField] !== undefined)
    .filter(row => !unpaidOnly || (!row[amountField === 'fact' ? 'invoicePaidOffAt' : 'paidOffAt'] && Number(String(row[amountField]).replace(/,/g, '')) > 0))
    .filter(row => name === null || debtNameKey(row.title) === debtNameKey(name))
    .filter(row => {
      const month = monthKey(row.savedAt || row.createdAt);
      const date = new Date(row.savedAt || row.createdAt);
      const day = month ? `${month}-${String(date.getDate()).padStart(2, '0')}` : '';
      return (!from && !to) || (day && (!from || day.slice(0, from.length) >= from) && (!to || day.slice(0, to.length) <= to));
    }).sort((a, b) => rowDateValue(b) - rowDateValue(a));
}
