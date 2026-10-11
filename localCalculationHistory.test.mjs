import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./localCalculationHistory.js', import.meta.url), 'utf8');
const { createLocalCalculationHistory, HISTORY_KEY } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('keeps newest 100, persists deletion and reloads without account/cloud data', async () => {
  const values = new Map();
  const storage = { getItem: async key => values.get(key), setItem: async (key, value) => { values.set(key, value); } };
  const history = createLocalCalculationHistory(storage);
  await Promise.all(Array.from({ length: 101 }, (_, i) => history.add(`${i} + 1`, i + 1)));
  let rows = await history.load();
  assert.equal(rows.length, 100);
  assert.equal(rows[0].expression, '100 + 1');
  assert.equal(rows.at(-1).expression, '1 + 1');
  assert.equal(new Set(rows.map(row => row.id)).size, 100);
  await history.remove(rows[20].id);
  rows = await createLocalCalculationHistory(storage).load();
  assert.equal(rows.length, 99);
  assert.ok(!rows.some(row => row.expression === '80 + 1'));
  assert.deepEqual([...values.keys()], [HISTORY_KEY]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['expression', 'id', 'result']);
});

test('queues changes behind hydration and recovers from a failed write', async () => {
  let resolveRead, fail = true;
  const storage = { getItem: () => new Promise(resolve => { resolveRead = resolve; }), setItem: async () => { if (fail) throw Error('disk full'); } };
  const history = createLocalCalculationHistory(storage);
  const initial = history.load();
  const addition = history.add('2 + 2', 4);
  await Promise.resolve();
  resolveRead(JSON.stringify([{ id: 'old', expression: '1 + 1', result: '2' }]));
  await initial;
  await assert.rejects(addition, /disk full/);
  assert.equal((await history.load()).length, 1);
  fail = false;
  await history.add('3 + 3', 6);
  assert.equal((await history.load()).length, 2);
  await history.add('1 / 0', 'Error');
  assert.equal((await history.load()).length, 2);
});
