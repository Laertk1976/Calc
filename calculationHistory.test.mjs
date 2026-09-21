import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleUrl = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const utils = moduleUrl(await readFile(new URL('./calculatorUtils.js', import.meta.url), 'utf8'));
const source = (await readFile(new URL('./calculationHistory.js', import.meta.url), 'utf8')).replace("'./calculatorUtils'", JSON.stringify(utils));
const { normalizeCalculation, applyCalculationChange: apply, latestUndoableChange, getCalculationListResults } = await import(moduleUrl(source));
const original = { createdAt: '2026-09-16T12:00:00.000Z', title: 'Customer', expression: '2 + 3', value: '5', type: 'Add' };
const id = original.createdAt;
const time = '2026-09-16T13:00:00.000Z';

test('list results follow table amount edits, zero, clearing, and undo', () => {
  for (const type of ['Cred', 'Fact', 'Fcash']) {
    const field = type.toLowerCase();
    let rows = apply([{ ...original, type }], { type: 'edit', id, changes: { [field]: '12' } });
    assert.deepEqual(getCalculationListResults(rows[0]), [{ label: type, value: '12' }]);
    rows = apply(rows, { type: 'edit', id, changes: { [field]: 0 } });
    assert.deepEqual(getCalculationListResults(rows[0]), [{ label: type, value: '0' }]);
    rows = apply(rows, { type: 'edit', id, changes: { [field]: '' } });
    assert.deepEqual(getCalculationListResults(rows[0]), []);
    rows = apply(rows, { type: 'undo', id, eventId: rows[0].history.at(-1).id });
    assert.deepEqual(getCalculationListResults(rows[0]), [{ label: type, value: '0' }]);
  }
});

test('list shows all populated amount columns and current info results', () => {
  const [row] = apply([original], { type: 'edit', id, changes: { cred: '10', fact: '20', fcash: '30' } });
  assert.deepEqual(getCalculationListResults(row), [
    { label: 'Cred', value: '10' }, { label: 'Fact', value: '20' }, { label: 'Fcash', value: '30' },
  ]);
  for (const [info, expected] of [['7 + 2 = 9', '9'], ['7 + 2', '9'], ['0', '0']]) {
    const [edited] = apply([original], { type: 'edit', id, changes: { info } });
    assert.deepEqual(getCalculationListResults(edited), [{ label: '', value: expected }]);
  }
  assert.deepEqual(getCalculationListResults({ ...original, info: '' }), []);
  assert.deepEqual(getCalculationListResults(original), [{ label: '', value: '5' }]);
});

test('legacy records retain their displayed values without inventing history', () => {
  const row = normalizeCalculation(original);
  assert.equal(row.info, '2 + 3 = 5');
  assert.equal(row.comment, '5');
  assert.deepEqual(row.history, []);
  assert.equal(apply([original], { type: 'edit', id, changes: { title: 'Customer' } })[0].history.length, 0);
});

test('an edit stores exact before/after values and leaves its input untouched', () => {
  const [row] = apply([original], { type: 'edit', id, changes: { info: '7 + 2 = 9' } }, time);
  assert.equal(row.expression, '7 + 2 = 9');
  assert.equal(row.history[0].before.info, '2 + 3 = 5');
  assert.equal(row.history[0].after.info, '7 + 2 = 9');
  assert.equal(row.history[0].at, time);
  assert.equal(original.expression, '2 + 3');
  assert.equal(original.history, undefined);
});

test('delete survives JSON storage and restore preserves all values and edits', () => {
  let rows = apply([original], { type: 'edit', id, changes: { comment: 'Paid cash' } });
  rows = apply(rows, { type: 'delete', id }, time);
  assert.equal(rows.filter((row) => !row.deletedAt).length, 0);
  assert.equal(rows[0].deletedAt, time);
  rows = apply(JSON.parse(JSON.stringify(rows)), { type: 'restore', id });
  assert.equal(rows[0].deletedAt, undefined);
  assert.equal(rows[0].comment, 'Paid cash');
  assert.deepEqual(rows[0].history.map((event) => event.type), ['edit', 'delete', 'restore']);
});

test('undo restores an edited row without reverting unrelated records', () => {
  let rows = apply([original, { ...original, id: 'other', title: 'Other' }], { type: 'edit', id, changes: { cred: '15' } }, time);
  const eventId = rows[0].history.at(-1).id;
  rows = apply(rows, { type: 'edit', id: 'other', changes: { title: 'Updated other' } });
  rows = apply(rows, { type: 'undo', id, eventId });
  assert.equal(rows[0].cred, '');
  assert.equal(rows[1].title, 'Updated other');
  assert.equal(rows[0].history.at(-1).type, 'undo');
});

test('undo deletion restores the same record without a duplicate', () => {
  let rows = apply([original], { type: 'delete', id });
  const eventId = rows[0].history.at(-1).id;
  rows = apply(rows, { type: 'undo', id, eventId });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, id);
  assert.equal(rows[0].deletedAt, undefined);
});

test('stale undo cannot overwrite a newer edit', () => {
  let rows = apply([original], { type: 'edit', id, changes: { title: 'First' } });
  const eventId = rows[0].history.at(-1).id;
  rows = apply(rows, { type: 'edit', id, changes: { title: 'Second' } });
  assert.throws(() => apply(rows, { type: 'undo', id, eventId }), /changed since/);
});

test('sequential field updates preserve prior edits', () => {
  let rows = apply([original], { type: 'edit', id, changes: { title: 'Updated' } });
  rows = apply(rows, { type: 'edit', id, changes: { fact: '20' } });
  assert.equal(rows[0].title, 'Updated');
  assert.equal(rows[0].fact, '20');
  assert.equal(rows[0].history.length, 2);
});

test('repeat delete and restore do not create misleading events', () => {
  const deleted = apply([original], { type: 'delete', id });
  assert.equal(apply(deleted, { type: 'delete', id })[0].history.length, 1);
  const restored = apply(deleted, { type: 'restore', id });
  assert.equal(apply(restored, { type: 'restore', id })[0].history.length, 2);
  assert.throws(() => apply(deleted, { type: 'edit', id, changes: { title: 'No' } }), /Restore/);
});

test('quick undo finds the latest eligible row and ignores completed undo', () => {
  let rows = apply([original], { type: 'delete', id }, time);
  const candidate = latestUndoableChange(rows);
  assert.equal(candidate.event.type, 'delete');
  rows = apply(rows, { type: 'undo', id, eventId: candidate.event.id });
  assert.equal(latestUndoableChange(rows), null);
});

async function storageHarness(initial) {
  let stored = JSON.stringify(initial);
  let failWrite = false;
  let writes = 0;
  const key = `__historyTest${Math.random().toString(36).slice(2)}`;
  globalThis[key] = {
    getItem: async () => stored,
    setItem: async (_, value) => {
      if (failWrite) throw new Error('Storage unavailable');
      stored = value;
      writes += 1;
    },
  };
  const mockStorage = moduleUrl(`export default globalThis[${JSON.stringify(key)}];`);
  const mockFirestore = moduleUrl('export const addDoc=()=>{},collection=()=>{},doc=()=>{},getDocsFromServer=()=>{},runTransaction=()=>{},query=()=>{},serverTimestamp=()=>{},where=()=>{},writeBatch=()=>{};');
  const mockAuth = moduleUrl('export const db = null;');
  const offline = moduleUrl((await readFile(new URL('./offlineCalculationStore.js', import.meta.url), 'utf8')).replace("'./calculationHistory'", JSON.stringify(moduleUrl(source))));
  const storageSource = (await readFile(new URL('./calculationStorage.js', import.meta.url), 'utf8'))
    .replace("'@react-native-async-storage/async-storage'", JSON.stringify(mockStorage))
    .replace("'firebase/firestore'", JSON.stringify(mockFirestore))
    .replace("'./authClient'", JSON.stringify(mockAuth))
    .replace("'./offlineCalculationStore'", JSON.stringify(offline))
    .replace("'./calculationHistory'", JSON.stringify(moduleUrl(source)));
  const api = await import(moduleUrl(storageSource));
  return { api, setFailure: (value) => { failWrite = value; }, corrupt: () => { stored = '{'; }, writes: () => writes };
}

test('storage queues rapid edits and retains deletion across reload', async () => {
  const { api } = await storageHarness([original]);
  await Promise.all([
    api.updateSavedCalculations({ type: 'edit', id, changes: { title: 'Queued name' } }),
    api.updateSavedCalculations({ type: 'edit', id, changes: { comment: 'Queued comment' } }),
  ]);
  await api.updateSavedCalculations({ type: 'delete', id });
  const [deleted] = await api.getSavedCalculations();
  assert.equal(deleted.title, 'Queued name');
  assert.equal(deleted.comment, 'Queued comment');
  assert.equal(deleted.history.length, 3);
  assert.ok(deleted.deletedAt);
  await api.updateSavedCalculations({ type: 'restore', id });
  assert.equal((await api.getSavedCalculations())[0].deletedAt, undefined);
});

test('failed writes reject without losing data and the next save still works', async () => {
  const harness = await storageHarness([original]);
  harness.setFailure(true);
  await assert.rejects(harness.api.updateSavedCalculations({ type: 'delete', id }), /Storage unavailable/);
  assert.equal((await harness.api.getSavedCalculations())[0].deletedAt, undefined);
  harness.setFailure(false);
  await harness.api.updateSavedCalculations({ type: 'edit', id, changes: { title: 'Retry' } });
  assert.equal((await harness.api.getSavedCalculations())[0].title, 'Retry');
});

test('unreadable storage is not silently replaced with an empty history', async () => {
  const harness = await storageHarness([original]);
  harness.corrupt();
  await assert.rejects(harness.api.updateSavedCalculations({ type: 'delete', id }));
  assert.equal(harness.writes(), 0);
});
