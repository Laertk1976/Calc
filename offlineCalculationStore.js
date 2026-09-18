import { applyCalculationChange, normalizeCalculation } from './calculationHistory';

const DEVICE_KEY = 'calculatorCalculations';
const keyFor = (userId) => userId ? `${DEVICE_KEY}:user:${encodeURIComponent(userId)}` : DEVICE_KEY;
const freshState = () => ({ version: 1, rows: [], queue: [], remoteIds: {}, importedIds: [], lastSyncedAt: null });
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Reapply only fields changed locally. Other fields changed on another device
// survive, and both devices' history entries remain available.
export function mergeRemoteCalculation(current, operation) {
  if (!current) return operation.after;
  if (!operation.before) return current; // Existing cloud row wins over a device import.
  const merged = { ...current };
  const fields = new Set([...Object.keys(operation.before), ...Object.keys(operation.after)]);
  for (const field of fields) {
    if (field === 'history' || field === 'id') continue;
    if (!same(operation.before[field], operation.after[field])) {
      if (operation.after[field] === undefined) delete merged[field];
      else merged[field] = operation.after[field];
    }
  }
  const events = new Map((current.history || []).map((event) => [event.id, event]));
  for (const event of operation.after.history || []) if (!events.has(event.id)) events.set(event.id, event);
  merged.history = [...events.values()];
  return merged;
}

export function createOfflineCalculationStore({ storage, remote, now = () => new Date().toISOString() }) {
  let localWrites = Promise.resolve();
  const syncs = new Map();
  const listeners = new Map();
  const statuses = new Map();
  const serialize = (task) => {
    const result = localWrites.catch(() => {}).then(task);
    localWrites = result;
    return result;
  };
  const operationId = () => `${now()}-${Math.random().toString(36).slice(2)}`;

  async function read(userId) {
    const raw = await storage.getItem(keyFor(userId));
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    const state = !userId && Array.isArray(parsed) ? { ...freshState(), rows: parsed } : parsed;
    if (!state || state.version !== 1 || !Array.isArray(state.rows) || !Array.isArray(state.queue)) {
      throw new Error('Saved calculations could not be read. Your device data has not been overwritten.');
    }
    return { ...freshState(), ...state, rows: state.rows.map((row, index) => normalizeCalculation({ ...row, id: row.id || row.createdAt || `legacy-${index}` })) };
  }

  function notify(userId, state, status = statuses.get(userId)) {
    const snapshot = {
      rows: state.rows,
      status: { phase: userId ? (state.queue.length ? 'pending' : 'checking') : 'local', ...status, pending: state.queue.length, lastSyncedAt: state.lastSyncedAt },
    };
    for (const listener of listeners.get(userId) || []) listener(snapshot);
    return snapshot;
  }

  async function persist(userId, state) {
    await storage.setItem(keyFor(userId), JSON.stringify(userId ? state : state.rows));
    return state;
  }

  async function change(change, userId = null) {
    return serialize(async () => {
      const state = await read(userId);
      const rows = applyCalculationChange(state.rows, change, now());
      const id = change.type === 'add' ? change.row.id : change.id;
      const before = state.rows.find((row) => row.id === id) || null;
      const after = rows.find((row) => row.id === id);
      if (same(before, after)) return state.rows;
      const queue = userId ? [...state.queue, { id: operationId(), rowId: id, before, after }] : [];
      const next = await persist(userId, { ...state, rows, queue });
      statuses.set(userId, { phase: userId ? 'pending' : 'local' });
      notify(userId, next);
      return next.rows;
    });
  }

  async function importDeviceCalculations(userId) {
    if (!userId) throw new Error('Sign in before importing device calculations.');
    return serialize(async () => {
      const device = await read(null);
      const state = await read(userId);
      const imported = new Set(state.importedIds);
      for (const row of device.rows) {
        if (imported.has(row.id)) continue;
        if (!state.rows.some((item) => item.id === row.id)) {
          state.rows.push(row);
          state.queue.push({ id: operationId(), rowId: row.id, before: null, after: row });
        }
        imported.add(row.id);
      }
      state.importedIds = [...imported];
      await persist(userId, state);
      statuses.set(userId, { phase: 'pending' });
      notify(userId, state);
      return state.rows;
    });
  }

  async function withDeadline(task) {
    let timer;
    try {
      return await Promise.race([task, new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('Connection unavailable. Changes will sync automatically when reachable.'), { code: 'deadline-exceeded' })), 12000);
      })]);
    } finally { clearTimeout(timer); }
  }

  async function runSync(userId) {
    let state = await read(userId);
    statuses.set(userId, { phase: 'syncing' });
    notify(userId, state);
    try {
      const records = await withDeadline(remote.list(userId));
      state = await serialize(async () => {
        const latest = await read(userId);
        const dirty = new Set(latest.queue.map((item) => item.rowId));
        const rows = new Map(records.map(({ row }) => [row.id, normalizeCalculation(row)]));
        for (const row of latest.rows) if (dirty.has(row.id)) rows.set(row.id, row);
        const remoteIds = { ...latest.remoteIds };
        for (const record of records) remoteIds[record.row.id] = record.docId;
        return persist(userId, { ...latest, rows: [...rows.values()], remoteIds });
      });
      notify(userId, state);
      // Snapshot the queue. Edits made during upload remain durable for the next pass.
      for (const operation of state.queue) {
        const result = await remote.push(userId, operation, state.remoteIds[operation.rowId]);
        state = await serialize(async () => {
          const latest = await read(userId);
          const queue = latest.queue.filter((item) => item.id !== operation.id);
          const stillDirty = queue.some((item) => item.rowId === operation.rowId);
          const rows = latest.rows.map((row) => row.id === operation.rowId && !stillDirty ? normalizeCalculation(result.row) : row);
          return persist(userId, { ...latest, rows, queue, remoteIds: { ...latest.remoteIds, [operation.rowId]: result.docId } });
        });
        notify(userId, state);
      }
      state = await serialize(async () => {
        const latest = await read(userId);
        return persist(userId, { ...latest, lastSyncedAt: latest.queue.length ? latest.lastSyncedAt : now() });
      });
      statuses.set(userId, { phase: state.queue.length ? 'pending' : 'synced' });
    } catch (error) {
      state = await read(userId);
      const offline = ['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(String(error.code || '').replace(/^.*\//, ''));
      statuses.set(userId, { phase: offline ? 'offline' : 'error', error: error.message || 'Sync could not finish. Try again.' });
    }
    return notify(userId, state);
  }

  function sync(userId) {
    if (!userId || !remote) return Promise.resolve(null);
    if (!syncs.has(userId)) syncs.set(userId, runSync(userId).finally(() => syncs.delete(userId)));
    return syncs.get(userId);
  }

  return {
    change, sync, importDeviceCalculations,
    getRows: async (userId = null) => (await read(userId)).rows,
    getSnapshot: async (userId = null) => notify(userId, await read(userId)),
    getImportCount: async (userId) => {
      if (!userId) return 0;
      const state = await read(userId);
      return (await read(null)).rows.filter((row) => !state.importedIds.includes(row.id)).length;
    },
    subscribe(userId, listener) {
      if (!listeners.has(userId)) listeners.set(userId, new Set());
      listeners.get(userId).add(listener);
      return () => listeners.get(userId)?.delete(listener);
    },
  };
}
