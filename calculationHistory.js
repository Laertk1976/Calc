import { evaluateExpression, pretty } from './calculatorUtils';

export const HISTORY_FIELDS = {
  title: 'Name', info: 'Info', comment: 'Comment', cred: 'Cred', fact: 'Fact', fcash: 'Fcash',
  invoicePaidOffAt: 'Paid off at', invoicePaidOffAmount: 'Paid off amount',
  paidOffAt: 'Paid off at', paidOffAmount: 'Paid off amount',
};
const snapshotFields = [...Object.keys(HISTORY_FIELDS), 'expression', 'value', 'type'];

export function normalizeCalculation(calc) {
  if (calc.permanentlyDeletedAt) return { id: calc.id, permanentlyDeletedAt: calc.permanentlyDeletedAt };
  const type = calc.type || 'Add';
  const rawVal = calc.value || '';
  const expression = calc.expression;
  const info = !expression || expression === rawVal ? pretty(String(rawVal))
    : expression.includes('=') ? expression : `${expression} = ${pretty(String(rawVal))}`;
  return {
    ...calc,
    id: calc.id || calc.createdAt || `${Date.now()}-${Math.random()}`,
    createdAt: calc.createdAt || new Date().toISOString(),
    savedAt: calc.savedAt || calc.createdAt || new Date().toISOString(),
    title: calc.title || '',
    info: calc.info !== undefined ? calc.info : info,
    expression: expression || calc.info || rawVal,
    comment: calc.comment !== undefined ? calc.comment : (type === 'Add' ? rawVal : ''),
    cred: calc.cred !== undefined ? calc.cred : (type === 'Cred' ? rawVal : ''),
    fact: calc.fact !== undefined ? calc.fact : (type === 'Fact' ? rawVal : ''),
    fcash: calc.fcash !== undefined ? calc.fcash : (type === 'Fcash' ? rawVal : ''),
    history: Array.isArray(calc.history) ? calc.history : [],
  };
}

export function getCalculationListResults(calculation) {
  const row = normalizeCalculation(calculation);
  const amounts = ['cred', 'fact', 'fcash']
    .filter((field) => row[field] !== '' && row[field] !== null && row[field] !== undefined)
    .map((field) => ({ label: HISTORY_FIELDS[field], value: String(row[field]) }));
  if (amounts.length || ['Cred', 'Fact', 'Fcash'].includes(row.type)) return amounts;
  const resultText = String(row.info ?? '').split('=').pop().trim();
  const result = resultText ? evaluateExpression(resultText) : 'Error';
  return result === 'Error' ? [] : [{ label: '', value: pretty(String(result)) }];
}

function snapshot(row) {
  return Object.fromEntries(snapshotFields.map((field) => [field, row[field] ?? '']));
}

export function canUndoHistoryEvent(event) {
  return Boolean(event && ['edit', 'delete'].includes(event.type)
    && event.before && typeof event.before === 'object' && !Array.isArray(event.before));
}

// Old/synced entries may lack snapshots. Build display copies without changing saved data.
export function getCalculationHistoryEvents(rows, search = '', deletedOnly = false) {
  const query = search.toLowerCase();
  return rows.flatMap((row) => (Array.isArray(row.history) ? row.history : [])
    .filter((event) => event && event.type !== 'purged')
    .map((event) => ({ row, event: { ...event, before: event.before || {}, after: event.after || {} } })))
    .filter(({ row, event }) => (!deletedOnly || (row.deletedAt && event.type === 'delete' && row.history.at(-1)?.id === event.id))
      && [row.title, event.before.title, event.after.title].some((title) => String(title || '').toLowerCase().includes(query)))
    .sort((a, b) => String(b.event.at || '').localeCompare(String(a.event.at || '')));
}

export function latestUndoableChange(rows) {
  return rows.flatMap((row) => {
    const event = Array.isArray(row.history) ? row.history.at(-1) : null;
    return canUndoHistoryEvent(event) ? [{ row, event }] : [];
  }).sort((a, b) => String(b.event.at || '').localeCompare(String(a.event.at || '')))[0] || null;
}

// Only the requested row/fields change; deleted rows remain in storage for recovery.
export function applyCalculationChange(calculations, change, at = new Date().toISOString()) {
  const rows = calculations.map(normalizeCalculation);
  if (change.type === 'add') return [normalizeCalculation(change.row), ...rows];
  if (change.type === 'renameName') {
    const names = new Set(change.fromNames);
    const title = String(change.toName || '').trim();
    if (!title || !names.size) throw new Error('Choose a name and enter a new name.');
    const active = rows.filter(item => !item.deletedAt && !item.permanentlyDeletedAt);
    if ([...names].some(name => !active.some(item => item.title === name))) {
      throw new Error('These names have changed. Reopen Rename and try again.');
    }
    const combining = names.size > 1 || active.some(item => item.title === title && !names.has(title));
    if (combining && !change.mergeConfirmed) throw new Error('Confirm combining these names first.');
    return rows.map(item => {
      if (item.deletedAt || item.permanentlyDeletedAt || !names.has(item.title) || item.title === title) return item;
      const next = { ...item, title };
      next.history = [...item.history, {
        id: `${at}-${Math.random().toString(36).slice(2)}`, at, type: 'edit',
        before: snapshot(item), after: snapshot(next),
      }];
      return next;
    });
  }
  const row = rows.find((item) => item.id === change.id);
  if (!row) throw new Error('This calculation no longer exists. Reopen the table and try again.');
  if (row.permanentlyDeletedAt) throw new Error('This calculation was permanently deleted.');
  if (change.type === 'deleteHistoryEvent') {
    const event = row.history.find(item => item.id === change.eventId);
    if (!event || event.type === 'purged') throw new Error('This history entry no longer exists.');
    if (row.deletedAt && row.history.at(-1)?.id === event.id) throw new Error('Permanently delete the deleted calculation instead.');
    // Keep only ordering and identity so stale sync cannot restore this entry
    // or make an older edit eligible for undo.
    return rows.map(item => item.id === row.id ? {
      ...item, history: item.history.map(entry => entry.id === event.id ? { id: entry.id, at: entry.at, type: 'purged' } : entry),
    } : item);
  }
  if (change.type === 'permanentDelete') {
    if (!row.deletedAt) throw new Error('Only deleted calculations can be permanently deleted.');
    return rows.map(item => item.id === row.id ? { id: row.id, permanentlyDeletedAt: at } : item);
  }
  if (change.type === 'markShared') {
    if (row.sharedAt || row.deletedAt) return rows;
    return rows.map(item => item.id === row.id ? { ...item, sharedAt: at } : item);
  }
  let next = { ...row };
  if (change.type === 'edit') {
    if (row.deletedAt) throw new Error('Restore this calculation before editing it.');
    for (const [field, value] of Object.entries(change.changes)) {
      if (!(field in HISTORY_FIELDS)) throw new Error('Unknown calculation field.');
      next[field] = value;
      if (field === 'info') next.expression = value;
    }
    for (const amountField of ['cred', 'fact']) {
      const paidAt = amountField === 'fact' ? 'invoicePaidOffAt' : 'paidOffAt';
      const paidAmount = amountField === 'fact' ? 'invoicePaidOffAmount' : 'paidOffAmount';
      const payoffTarget = (change.amountField || 'cred') === amountField;
      if (change.undoPayOff && payoffTarget) {
        if (!row[paidAt] || row[paidAt] !== change.paidOffAt || Number(row[amountField]) !== 0) {
          throw new Error('This payoff has changed. Reopen the debt list and try again.');
        }
        next[amountField] = row[paidAmount];
        next[paidAt] = '';
        next[paidAmount] = '';
      } else if (change.payOff && payoffTarget) {
        const amount = Number(String(next[amountField]).replace(/,/g, ''));
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a positive debt amount to pay off.');
        next[paidAt] = at;
        next[paidAmount] = String(amount);
        next[amountField] = '0';
      } else if (amountField in change.changes && Number(String(next[amountField]).replace(/,/g, '')) !== 0) {
        next[paidAt] = '';
        next[paidAmount] = '';
      }
    }
    if (JSON.stringify(snapshot(row)) === JSON.stringify(snapshot(next))) return rows;
  } else if (change.type === 'delete') {
    if (row.deletedAt) return rows;
    next.deletedAt = at;
  } else if (change.type === 'restore') {
    if (!row.deletedAt) return rows;
    delete next.deletedAt;
  } else if (change.type === 'undo') {
    const event = row.history.at(-1);
    if (!canUndoHistoryEvent(event) || event.id !== change.eventId) {
      throw new Error('This calculation has changed since then. Open History to see its latest version.');
    }
    next = { ...next, ...event.before };
    delete next.deletedAt;
  } else {
    throw new Error('Unknown history action.');
  }
  next.history = [...row.history, {
    id: `${at}-${Math.random().toString(36).slice(2)}`,
    at, type: change.type, before: snapshot(row), after: snapshot(next),
  }];
  return rows.map((item) => item.id === row.id ? next : item);
}
