import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const url = (s) => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const utils = url(await readFile('calculatorUtils.js', 'utf8'));
const history = url((await readFile('calculationHistory.js', 'utf8')).replace("'./calculatorUtils'", JSON.stringify(utils)));
const { createOfflineCalculationStore } = await import(url((await readFile('offlineCalculationStore.js', 'utf8')).replace("'./calculationHistory'", JSON.stringify(history))));
function fixture() {
  const data = new Map();
  const cloud = new Map();
  let online = false;
  const storage = { getItem: async (key) => data.get(key), setItem: async (key, value) => data.set(key, value) };
  const remote = {
    list: async () => { if (!online) throw Object.assign(new Error('offline'), { code: 'unavailable' }); return [...cloud.values()]; },
    push: async (_, op) => { const result = { row: op.after, docId: op.rowId }; cloud.set(op.rowId, result); return result; },
  };
  return { storage, remote, cloud, connect: () => { online = true; } };
}
const row = { id: 'one', title: 'Work', value: '5', createdAt: '2026-09-17T10:00:00Z' };

test('account deletion blocks saves and sync across restart and clears only that account', async () => {
  const f = fixture(); f.connect();
  let reads = 0;
  f.remote.list = async () => { reads++; return []; };
  let store = createOfflineCalculationStore(f);
  await store.change({ type: 'add', row }, 'a');
  await store.change({ type: 'add', row }, 'b');
  await store.change({ type: 'add', row });
  await store.beginAccountDeletion('a');
  await assert.rejects(store.change({ type: 'edit', id: row.id, changes: { title: 'No' } }, 'a'), /deletion/);
  store = createOfflineCalculationStore(f);
  await store.sync('a');
  await store.sync('a', { automatic: true });
  assert.equal(reads, 0);
  await assert.rejects(store.importDeviceCalculations('a'), /deletion/);
  await store.clearAccountForDeletion('a');
  assert.deepEqual(await store.getRows('a'), []);
  assert.equal((await store.getSnapshot('a')).status.pending, 0);
  assert.equal((await store.getSnapshot('a')).status.deletionPending, true);
  assert.equal((await store.getRows('b')).length, 1);
  assert.equal((await store.getRows()).length, 1);
});

test('a sync response arriving during deletion cannot restore records or upload its queue', async () => {
  const f = fixture(); f.connect();
  let releaseList;
  let startedList;
  const started = new Promise(resolve => { startedList = resolve; });
  f.remote.list = async () => { startedList(); return new Promise(resolve => { releaseList = resolve; }); };
  const store = createOfflineCalculationStore(f);
  await store.change({ type: 'add', row }, 'a');
  const syncing = store.sync('a');
  await started;
  await store.beginAccountDeletion('a');
  await store.clearAccountForDeletion('a');
  releaseList([{ row, docId: 'cloud-one' }]);
  await syncing;
  assert.deepEqual(await store.getRows('a'), []);
  assert.equal(f.cloud.size, 0);
  assert.equal((await store.getSnapshot('a')).status.phase, 'deleting');
});

test('automatic sync waits eight hours across edits and restarts; manual sync can override', async () => {
  const f = fixture(); f.connect();
  let time = Date.parse('2026-09-27T00:00:00Z');
  let reads = 0;
  const list = f.remote.list;
  f.remote.list = async (...args) => { reads++; return list(...args); };
  const options = { ...f, now: () => new Date(time).toISOString() };
  let store = createOfflineCalculationStore(options);
  await store.sync('account', { automatic: true });
  assert.equal(reads, 1);
  await store.change({ type: 'add', row }, 'account');
  assert.equal(reads, 1);
  assert.equal(f.cloud.size, 0);
  time += 7 * 60 * 60 * 1000;
  store = createOfflineCalculationStore(options);
  await store.sync('account', { automatic: true });
  assert.equal(reads, 1);
  assert.equal((await store.getRows('account')).length, 1);
  assert.equal((await store.getSnapshot('account')).status.pending, 1);
  time += 60 * 60 * 1000;
  await store.sync('account', { automatic: true });
  assert.equal(reads, 2);
  assert.equal(f.cloud.size, 1);
  await store.change({ type: 'edit', id: row.id, changes: { title: 'Updated' } }, 'account');
  await store.sync('account');
  assert.equal(reads, 3);
  assert.equal(f.cloud.get(row.id).row.title, 'Updated');
});

test('failed automatic attempts are throttled and a new account can restore immediately', async () => {
  const f = fixture();
  let reads = 0;
  const list = f.remote.list;
  f.remote.list = async (...args) => { reads++; return list(...args); };
  const options = { ...f, now: () => '2026-09-27T00:00:00Z' };
  let store = createOfflineCalculationStore(options);
  await store.change({ type: 'add', row }, 'account');
  await store.sync('account', { automatic: true });
  store = createOfflineCalculationStore(options);
  await store.sync('account', { automatic: true });
  assert.equal(reads, 1);
  assert.equal((await store.getSnapshot('account')).status.pending, 1);
  f.connect();
  await store.sync('other-account', { automatic: true });
  assert.equal(reads, 2);
  await store.sync('account');
  assert.equal(reads, 3);
  assert.equal((await store.getSnapshot('account')).status.pending, 0);
});

test('payoff time survives offline restart and later cloud upload', async () => {
  const f = fixture();
  const paidAt = '2026-09-23T12:34:56.789Z';
  let store = createOfflineCalculationStore({ ...f, now: () => paidAt });
  await store.change({ type: 'add', row: { ...row, type: 'Cred' } }, 'account');
  await store.change({ type: 'edit', id: row.id, payOff: true, changes: {} }, 'account');
  store = createOfflineCalculationStore(f);
  const saved = (await store.getRows('account'))[0];
  assert.equal(saved.paidOffAt, paidAt);
  assert.equal(saved.paidOffAmount, '5');
  assert.equal(saved.cred, '0');
  f.connect();
  await store.sync('account');
  assert.equal(f.cloud.get(row.id).row.paidOffAt, paidAt);
  assert.equal(f.cloud.get(row.id).row.cred, '0');
});
test('offline work survives restart and sync clears queue only after upload', async () => {
  const f = fixture();
  let store = createOfflineCalculationStore(f);
  await store.change({ type: 'add', row }, 'account');
  assert.equal((await store.sync('account')).status.phase, 'offline');
  store = createOfflineCalculationStore(f);
  assert.equal((await store.getRows('account'))[0].title, 'Work');
  assert.equal((await store.getSnapshot('account')).status.pending, 1);
  f.connect();
  const result = await store.sync('account');
  assert.equal(result.status.phase, 'synced');
  assert.equal(result.status.pending, 0);
  assert.ok(result.status.lastSyncedAt);
  await store.sync('account');
  assert.equal(f.cloud.size, 1);
});
test('accounts and guest work stay isolated', async () => {
  const store = createOfflineCalculationStore(fixture());
  await store.change({ type: 'add', row }, 'a');
  assert.deepEqual(await store.getRows('b'), []);
  assert.deepEqual(await store.getRows(), []);
});
test('failed upload preserves edits and deletions for retry', async () => {
  const f = fixture(); f.connect();
  const store = createOfflineCalculationStore(f);
  await store.change({ type: 'add', row }, 'a'); await store.sync('a');
  f.remote.push = async () => { throw Object.assign(new Error('denied'), { code: 'permission-denied' }); };
  await store.change({ type: 'edit', id: row.id, changes: { title: 'Edited' } }, 'a');
  await store.change({ type: 'delete', id: row.id }, 'a');
  const result = await store.sync('a');
  assert.equal(result.status.phase, 'error');
  assert.equal(result.status.pending, 2);
  assert.equal(result.rows[0].title, 'Edited');
  assert.ok(result.rows[0].deletedAt);
});
