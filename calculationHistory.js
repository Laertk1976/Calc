import { pretty } from './calculatorUtils';

export const HISTORY_FIELDS = {
  title: 'Name', info: 'Info', comment: 'Comment', cred: 'Cred', fact: 'Fact', fcash: 'Fcash',
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
