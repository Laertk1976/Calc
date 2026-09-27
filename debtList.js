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

export function debtNames(calculations, query = '', amountField = 'cred') {
  const names = new Map();
  for (const row of debtRows(calculations, '', '', null, amountField)) {
    const key = debtNameKey(row.title);
    if (key && key.includes(debtNameKey(query)) && !names.has(key)) names.set(key, row.title.trim());
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

export function debtRows(calculations, from = '', to = '', name = null, amountField = 'cred') {
  return calculations.filter(row => !row.deletedAt).map(normalizeCalculation)
    .filter(row => row[amountField] !== '' && row[amountField] !== null && row[amountField] !== undefined)
    .filter(row => name === null || debtNameKey(row.title) === debtNameKey(name))
    .filter(row => {
      const month = monthKey(row.savedAt || row.createdAt);
      const date = new Date(row.savedAt || row.createdAt);
      const day = month ? `${month}-${String(date.getDate()).padStart(2, '0')}` : '';
      return (!from && !to) || (day && (!from || day.slice(0, from.length) >= from) && (!to || day.slice(0, to.length) <= to));
    }).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}
