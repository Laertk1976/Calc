import { evaluateExpression, pretty } from './calculatorUtils';

export const HISTORY_FIELDS = {
  title: 'Name', info: 'Info', comment: 'Comment', cred: 'Cred', fact: 'Fact', fcash: 'Fcash',
  paidOffAt: 'Paid off at', paidOffAmount: 'Paid off amount',
};
const snapshotFields = [...Object.keys(HISTORY_FIELDS), 'expression', 'value', 'type'];

export function normalizeCalculation(calc) {
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

export function latestUndoableChange(rows) {
  return rows.flatMap((row) => {
    const event = row.history?.at(-1);
    return event && ['edit', 'delete'].includes(event.type) ? [{ row, event }] : [];
  }).sort((a, b) => b.event.at.localeCompare(a.event.at))[0] || null;
}

// Only the requested row/fields change; deleted rows remain in storage for recovery.
export function applyCalculationChange(calculations, change, at = new Date().toISOString()) {
  const rows = calculations.map(normalizeCalculation);
  if (change.type === 'add') return [normalizeCalculation(change.row), ...rows];
  const row = rows.find((item) => item.id === change.id);
  if (!row) throw new Error('This calculation no longer exists. Reopen the table and try again.');
  let next = { ...row };
  if (change.type === 'edit') {
    if (row.deletedAt) throw new Error('Restore this calculation before editing it.');
    for (const [field, value] of Object.entries(change.changes)) {
      if (!(field in HISTORY_FIELDS)) throw new Error('Unknown calculation field.');
      next[field] = value;
      if (field === 'info') next.expression = value;
    }
    if (change.undoPayOff) {
      if (!row.paidOffAt || row.paidOffAt !== change.paidOffAt || Number(row.cred) !== 0) {
        throw new Error('This payoff has changed. Reopen the debt list and try again.');
      }
      next.cred = row.paidOffAmount;
      next.paidOffAt = '';
      next.paidOffAmount = '';
    } else if (change.payOff) {
      const amount = Number(String(next.cred).replace(/,/g, ''));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a positive debt amount to pay off.');
      next.paidOffAt = at;
      next.paidOffAmount = String(amount);
      next.cred = '0';
    } else if ('cred' in change.changes && Number(String(next.cred).replace(/,/g, '')) !== 0) {
      next.paidOffAt = '';
      next.paidOffAmount = '';
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
    if (!event || event.id !== change.eventId || !['edit', 'delete'].includes(event.type)) {
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
