export const DATA_BACKUP_FORMAT = 'calc-data-backup';
export const DATA_BACKUP_VERSION = 1;
export const CALCULATION_STORAGE_KEY = 'calculatorCalculations';
export const LOCAL_HISTORY_STORAGE_KEY = 'calc.localCalculationHistory.v1';
const LOCAL_HISTORY_LIMIT = 500;

const isObject = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const isCalculationKey = key => key === CALCULATION_STORAGE_KEY || key.startsWith(`${CALCULATION_STORAGE_KEY}:user:`);

function assertStore(key, value) {
  if (!isCalculationKey(key)) throw new Error('The backup contains an unsupported data store.');
  if ((key === CALCULATION_STORAGE_KEY) !== Array.isArray(value)) {
    throw new Error('The backup contains a calculation store with the wrong data format.');
  }
  const rows = Array.isArray(value) ? value : value?.rows;
  if (!Array.isArray(rows) || rows.some(row => !isObject(row) || typeof row.id !== 'string')) {
    throw new Error('The backup contains invalid saved calculations.');
  }
  if (rows.some(row => row.history !== undefined && (!Array.isArray(row.history)
    || row.history.some(event => !isObject(event) || typeof event.id !== 'string')))) {
    throw new Error('The backup contains invalid calculation history.');
  }
  if (!Array.isArray(value) && (value.version !== 1 || !Array.isArray(value.queue))) {
    throw new Error('The backup contains an unsupported calculation storage version.');
  }
}

export function parseDataBackup(value) {
  let backup = value;
  if (typeof value === 'string') {
    try { backup = JSON.parse(value); } catch { throw new Error('This file is not a valid Calc backup.'); }
  }
  if (!isObject(backup) || backup.format !== DATA_BACKUP_FORMAT || backup.version !== DATA_BACKUP_VERSION
    || !Array.isArray(backup.calculationStores) || !Array.isArray(backup.localHistory)) {
    throw new Error('This file is not a supported Calc backup.');
  }
  if (backup.singleCalculation !== undefined && backup.singleCalculation !== true) throw new Error('The backup contains an invalid single-card marker.');
  const keys = new Set();
  for (const store of backup.calculationStores) {
    if (!isObject(store) || typeof store.key !== 'string' || keys.has(store.key)) {
      throw new Error('The backup contains invalid calculation storage entries.');
    }
    assertStore(store.key, store.value);
    if (store.key !== CALCULATION_STORAGE_KEY) {
      const encodedUserId = store.key.slice(`${CALCULATION_STORAGE_KEY}:user:`.length);
      let userId;
      try { userId = decodeURIComponent(encodedUserId); } catch { throw new Error('The backup contains an invalid account data key.'); }
      if (!userId || encodeURIComponent(userId) !== encodedUserId) {
        throw new Error('The backup contains an invalid account data key.');
      }
    }
    keys.add(store.key);
  }
  if (backup.localHistory.some(item => !isObject(item) || typeof item.id !== 'string'
    || typeof item.expression !== 'string' || typeof item.result !== 'string')) {
    throw new Error('The backup contains invalid recent calculation history.');
  }
  return backup;
}

export function createDataBackup(calculationStores, localHistory, createdAt = new Date().toISOString()) {
  return parseDataBackup({
    format: DATA_BACKUP_FORMAT,
    version: DATA_BACKUP_VERSION,
    createdAt,
    calculationStores,
    localHistory,
  });
}

export function createSingleCalculationBackup(row, createdAt = new Date().toISOString()) {
  if (!isObject(row) || typeof row.id !== 'string') throw new Error('A saved calculation is required for this backup.');
  return { ...createDataBackup([{ key: CALCULATION_STORAGE_KEY, value: [row] }], [], createdAt), singleCalculation: true };
}

export function mergeSingleCalculationBackup(existingValue, backupValue) {
  const existing = stateFor(existingValue);
  const backup = stateFor(backupValue);
  const rows = [...existing.rows];
  const byId = new Map(rows.map((row, index) => [row.id, index]));
  let added = 0;
  let conflicts = 0;
  let historyAdded = 0;
  for (const incoming of backup.rows) {
    const index = byId.get(incoming.id);
    if (index === undefined) {
      byId.set(incoming.id, rows.length);
      rows.push(incoming);
      added += 1;
      historyAdded += (incoming.history || []).length;
      continue;
    }
    conflicts += 1;
    const current = rows[index];
    if (current.permanentlyDeletedAt) continue;
    const history = new Map((current.history || []).map(event => [event.id, event]));
    for (const event of incoming.history || []) {
      if (!history.has(event.id)) { history.set(event.id, event); historyAdded += 1; }
    }
    rows[index] = { ...current, ...incoming, history: [...history.values()] };
  }
  return {
    value: Array.isArray(existingValue) ? rows : { ...existing, rows },
    added, conflicts, historyAdded,
  };
}

function stateFor(value) {
  return Array.isArray(value)
    ? { version: 1, rows: value, queue: [], remoteIds: {}, importedIds: [], lastSyncedAt: null }
    : value;
}

export function mergeCalculationStore(existingValue, backupValue, { replaceConflicts = false } = {}) {
  const existing = stateFor(existingValue);
  const backup = stateFor(backupValue);
  const rows = [...existing.rows];
  const byId = new Map(rows.map((row, index) => [row.id, index]));
  let added = 0;
  let conflicts = 0;
  let historyAdded = 0;
  for (const incoming of backup.rows) {
    const index = byId.get(incoming.id);
    if (index === undefined) {
      byId.set(incoming.id, rows.length);
      rows.push(incoming);
      added += 1;
      historyAdded += (incoming.history || []).length;
      continue;
    }
    conflicts += 1;
    const current = rows[index];
    if (current.permanentlyDeletedAt) continue;
    const events = new Map((current.history || []).map(event => [event.id, event]));
    for (const event of incoming.history || []) {
      if (!events.has(event.id)) {
        events.set(event.id, event);
        historyAdded += 1;
      }
    }
    rows[index] = replaceConflicts
      ? { ...current, ...incoming, history: [...events.values()] }
      : { ...current, history: [...events.values()] };
  }
  const state = {
    ...existing,
    rows,
    remoteIds: { ...(backup.remoteIds || {}), ...(existing.remoteIds || {}) },
    importedIds: [...new Set([...(existing.importedIds || []), ...(backup.importedIds || [])])],
  };
  return {
    value: Array.isArray(existingValue) ? rows : state,
    added,
    conflicts,
    historyAdded,
  };
}

export function mergeLocalHistory(existing = [], incoming = []) {
  const byId = new Map(existing.map(entry => [entry.id, entry]));
  let added = 0;
  for (const entry of incoming) {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, entry);
      added += 1;
    }
  }
  return {
    entries: [...byId.values()].sort((a, b) => b.id.localeCompare(a.id)).slice(0, LOCAL_HISTORY_LIMIT),
    added,
  };
}
