import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./dataBackup.js', import.meta.url), 'utf8');
const { parseDataBackup, mergeCalculationStore, mergeLocalHistory, createSingleCalculationBackup } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('validates backup format, storage keys, calculation rows and recent history', () => {
  assert.throws(() => parseDataBackup('not json'), /valid Calc backup/);
  assert.throws(() => parseDataBackup({}), /supported Calc backup/);
  assert.throws(() => parseDataBackup({
    format: 'calc-data-backup', version: 1,
    calculationStores: [{ key: 'other-app-data', value: [] }], localHistory: [],
  }), /unsupported data store/);
  const backup = parseDataBackup({
    format: 'calc-data-backup', version: 1,
    calculationStores: [{ key: 'calculatorCalculations:user:user%40example.com', value: { version: 1, rows: [], queue: [] } }],
    localHistory: [],
  });
  assert.equal(backup.calculationStores.length, 1);
});

test('merges missing records and history without replacing existing values or purged events', () => {
  const current = {
    version: 1,
    rows: [
      { id: 'same', title: 'Current', history: [{ id: 'purged', at: '2', type: 'purged' }] },
    ],
    queue: [],
  };
  const incoming = {
    version: 1,
    rows: [
      { id: 'same', title: 'Backup', history: [{ id: 'purged', at: '2', type: 'edit' }, { id: 'old', at: '1', type: 'edit' }] },
      { id: 'new', title: 'New', history: [{ id: 'new-event', at: '3', type: 'edit' }] },
    ],
    queue: [],
  };
  const merged = mergeCalculationStore(current, incoming);
  assert.equal(merged.value.rows[0].title, 'Current');
  assert.equal(merged.value.rows[0].history[0].type, 'purged');
  assert.deepEqual(merged.value.rows[0].history[1], { id: 'old', at: '1', type: 'edit' });
  assert.equal(merged.added, 1);
  assert.equal(merged.conflicts, 1);
  assert.equal(merged.historyAdded, 2);
});

test('single card backup carries one row and receiver merge updates its fields', () => {
  const incoming = { id: 'card', title: 'Client', cred: '125', fact: '60', history: [{ id: 'remote-edit', at: '3', type: 'edit' }] };
  const backup = createSingleCalculationBackup(incoming);
  assert.equal(backup.singleCalculation, true);
  assert.deepEqual(backup.calculationStores[0].value, [incoming]);
  const current = [{ id: 'card', title: 'Old', cred: '100', history: [{ id: 'local-edit', at: '2', type: 'edit' }] }];
  const merged = mergeCalculationStore(current, backup.calculationStores[0].value, { replaceConflicts: backup.singleCalculation });
  assert.equal(merged.value[0].title, 'Client');
  assert.equal(merged.value[0].cred, '125');
  assert.deepEqual(merged.value[0].history.map(event => event.id), ['local-edit', 'remote-edit']);
});

test('merges recent results by ID, keeps existing results and limits history to 500', () => {
  const existing = [{ id: '1000', expression: 'existing', result: '1' }];
  const incoming = [
    { id: '1000', expression: 'overwrite', result: '2' },
    ...Array.from({ length: 105 }, (_, index) => ({ id: String(index).padStart(4, '0'), expression: 'x', result: '1' })),
  ];
  const merged = mergeLocalHistory(existing, incoming);
  assert.equal(merged.added, 105);
  assert.equal(merged.entries.length, 106);
  assert.equal(merged.entries.find(item => item.id === '1000').expression, 'existing');
});
