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
