import { applyCalculationChange, normalizeCalculation } from './calculationHistory';

const DEVICE_KEY = 'calculatorCalculations';
export const AUTO_SYNC_INTERVAL_MS = 8 * 60 * 60 * 1000;
const keyFor = (userId) => userId ? `${DEVICE_KEY}:user:${encodeURIComponent(userId)}` : DEVICE_KEY;
const freshState = () => ({ version: 1, rows: [], queue: [], remoteIds: {}, importedIds: [], lastSyncedAt: null });
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const visibleRows = rows => rows.filter(row => !row.permanentlyDeletedAt);

// Reapply only fields changed locally. Other fields changed on another device
// survive, and both devices' history entries remain available.
export function mergeRemoteCalculation(current, operation) {
  if (current?.permanentlyDeletedAt) return normalizeCalculation(current);
  if (operation.after?.permanentlyDeletedAt) return normalizeCalculation(operation.after);
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
  for (const event of operation.after.history || []) {
    if (!events.has(event.id) || event.type === 'purged') events.set(event.id, event);
  }
  merged.history = [...events.values()];
  return merged;
}

export function createOfflineCalculationStore({ storage, remote, now = () => new Date().toISOString() }) {
  let localWrites = Promise.resolve();
  const syncs = new Map();
  const listeners = new Map();
  const statuses = new Map();
  const deleting = new Set();
  const assertWritable = (userId, state) => {
    if (deleting.has(userId) || state.deletionPending) {
      throw Object.assign(new Error('Account deletion is pending. Finish deleting the account before making changes.'), { code: 'account-deletion-pending' });
    }
  };
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
      rows: visibleRows(state.rows),
      status: { phase: userId ? (state.queue.length ? 'pending' : 'checking') : 'local', ...status, ...(state.deletionPending ? { phase: 'deleting' } : {}), deletionPending: Boolean(state.deletionPending), pending: state.queue.length, lastSyncedAt: state.lastSyncedAt },
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
      assertWritable(userId, state);
      const rows = applyCalculationChange(state.rows, change, now());
      const id = change.type === 'add' ? change.row.id : change.id;
      const before = state.rows.find((row) => row.id === id) || null;
      const after = rows.find((row) => row.id === id);
      if (same(before, after)) return visibleRows(state.rows);
      const permanent = change.type === 'permanentDelete';
      const scrub = value => value?.history ? { ...value, history: value.history.map(event => event.id === change.eventId ? { id: event.id, at: event.at, type: 'purged' } : event) } : value;
      const historyDeletion = change.type === 'deleteHistoryEvent';
      const pending = permanent ? state.queue.filter(item => item.rowId !== id) : historyDeletion
        ? state.queue.map(item => item.rowId === id ? { ...item, before: scrub(item.before), after: scrub(item.after) } : item)
        : state.queue;
      const queue = userId ? [...pending, { id: operationId(), rowId: id, before: permanent ? null : historyDeletion ? scrub(before) : before, after }] : [];
      const next = await persist(userId, { ...state, rows, queue });
      statuses.set(userId, { phase: userId ? 'pending' : 'local' });
      notify(userId, next);
      return visibleRows(next.rows);
    });
  }

  async function importDeviceCalculations(userId) {
    if (!userId) throw new Error('Sign in before importing device calculations.');
    return serialize(async () => {
      const device = await read(null);
      const state = await read(userId);
      assertWritable(userId, state);
      const imported = new Set(state.importedIds);
      for (const row of device.rows) {
        if (row.permanentlyDeletedAt) continue;
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
      return visibleRows(state.rows);
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
        assertWritable(userId, latest);
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
        assertWritable(userId, await read(userId));
        const result = await remote.push(userId, operation, state.remoteIds[operation.rowId]);
        state = await serialize(async () => {
          const latest = await read(userId);
          assertWritable(userId, latest);
          const queue = latest.queue.filter((item) => item.id !== operation.id);
          const stillDirty = queue.some((item) => item.rowId === operation.rowId);
          const rows = latest.rows.map((row) => row.id === operation.rowId && !stillDirty ? normalizeCalculation(result.row) : row);
          return persist(userId, { ...latest, rows, queue, remoteIds: { ...latest.remoteIds, [operation.rowId]: result.docId } });
        });
        notify(userId, state);
      }
      state = await serialize(async () => {
        const latest = await read(userId);
        assertWritable(userId, latest);
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

  async function scheduledSync(userId, automatic) {
    const allowed = await serialize(async () => {
      const state = await read(userId);
      if (deleting.has(userId) || state.deletionPending) return false;
      const timestamp = now();
      const previous = state.lastSyncAttemptAt || state.lastSyncedAt;
      const elapsed = Date.parse(timestamp) - Date.parse(previous);
      if (automatic && previous && elapsed >= 0 && elapsed < AUTO_SYNC_INTERVAL_MS) {
        if (!statuses.has(userId)) statuses.set(userId, { phase: state.queue.length ? 'pending' : state.lastSyncedAt ? 'synced' : 'offline' });
        return false;
      }
      // Persist the schedule so reopening the app does not cause extra cloud reads.
      await persist(userId, { ...state, lastSyncAttemptAt: timestamp });
      return true;
    });
    return allowed ? runSync(userId) : notify(userId, await read(userId));
  }

  function sync(userId, { automatic = false } = {}) {
    if (!userId || !remote) return Promise.resolve(null);
    if (!syncs.has(userId)) syncs.set(userId, scheduledSync(userId, automatic).finally(() => syncs.delete(userId)));
    return syncs.get(userId);
  }

  async function beginAccountDeletion(userId) {
    if (!userId) throw new Error('Sign in before deleting your account.');
    deleting.add(userId);
    return serialize(async () => {
      const state = await read(userId);
      const next = await persist(userId, { ...state, deletionPending: true });
      return notify(userId, next);
    });
  }

  async function clearAccountForDeletion(userId) {
    if (!userId) throw new Error('An account ID is required.');
    deleting.add(userId);
    return serialize(async () => {
      // Keep only a local stop flag: stale async operations must not recreate data.
      const next = await persist(userId, { ...freshState(), deletionPending: true });
      return notify(userId, next);
    });
  }

  return {
    change, sync, importDeviceCalculations, beginAccountDeletion, clearAccountForDeletion,
    getRows: async (userId = null) => visibleRows((await read(userId)).rows),
    getSnapshot: async (userId = null) => notify(userId, await read(userId)),
    getImportCount: async (userId) => {
      if (!userId) return 0;
      const state = await read(userId);
      return visibleRows((await read(null)).rows).filter((row) => !state.importedIds.includes(row.id)).length;
    },
    subscribe(userId, listener) {
      if (!listeners.has(userId)) listeners.set(userId, new Set());
      listeners.get(userId).add(listener);
      return () => listeners.get(userId)?.delete(listener);
    },
  };
}
