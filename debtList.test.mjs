import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const url = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const utils = url(await readFile(new URL('./calculatorUtils.js', import.meta.url), 'utf8'));
const history = url((await readFile(new URL('./calculationHistory.js', import.meta.url), 'utf8')).replace("'./calculatorUtils'", JSON.stringify(utils)));
const { applyCalculationChange, getCalculationListResults } = await import(history);
const { debtNames, debtRows, monthDistance } = await import(url((await readFile(new URL('./debtList.js', import.meta.url), 'utf8')).replace("'./calculationHistory'", JSON.stringify(history))));
const rows = [
  { id: 'a', type: 'Cred', value: '20', createdAt: '2025-12-31T12:00:00', title: 'A' },
  { id: 'b', cred: '0', createdAt: '2026-01-01T12:00:00' },
  { id: 'c', cred: '30', createdAt: '2026-01-31T12:00:00' },
  { id: 'd', cred: '40', createdAt: '2026-02-01T12:00:00', deletedAt: '2026-03-01' },
  { id: 'e', fact: '50', createdAt: '2026-02-01T12:00:00' },
];
test('name selection includes unpaid and paid debts across months but excludes partial matches', () => {
  const entries = [
    { id: 'a', title: 'Anna', cred: '20', createdAt: '2026-01-01T12:00:00' },
    { id: 'b', title: ' Anna ', cred: '0', paidOffAt: '2026-03-01', paidOffAmount: '30', createdAt: '2026-02-01T12:00:00' },
    { id: 'c', title: 'Annabelle', cred: '50', createdAt: '2026-02-01T12:00:00' },
    { id: 'd', title: 'Anna', cred: '40', deletedAt: '2026-03-01' },
    { id: 'e', title: 'Invoice only', fact: '60' },
  ];
  assert.deepEqual(debtNames(entries, ' ANN '), ['Anna', 'Annabelle']);
  assert.deepEqual(debtNames(entries, 'missing'), []);
  const selected = debtRows(entries, '', '', 'anna');
  assert.deepEqual(selected.map(row => row.id), ['b', 'a']);
  assert.equal(selected.reduce((sum, row) => sum + Number(row.cred), 0), 20);
  assert.deepEqual(debtRows(entries, '2026-02', '2026-02', 'Anna').map(row => row.id), ['b']);
  assert.equal(debtRows(entries).length, 3);
});
test('month filter includes whole boundary months, zero debts, and legacy debts', () => {
  assert.deepEqual(debtRows(rows, '2026-01', '2026-01').map(row => row.id), ['c', 'b']);
  assert.equal(debtRows(rows).length, 3);
  assert.equal(debtRows(rows, '', '2025-12').length, 1);
  assert.equal(debtRows(rows, '2026-02').length, 0);
});
test('distance counts calendar months across years rather than days', () => {
  assert.equal(monthDistance('2025-12-31T12:00:00', new Date(2026, 0, 1)), 1);
  assert.equal(monthDistance('2026-01-01T12:00:00', new Date(2026, 0, 31)), 0);
  assert.equal(monthDistance('invalid'), null);
});
test('debt edits survive serialization and update shared results and totals', () => {
  const updated = JSON.parse(JSON.stringify(applyCalculationChange(rows, { type: 'edit', id: 'a', changes: { cred: '75', title: 'Updated', comment: 'Note' } })));
  assert.equal(debtRows(updated).reduce((sum, row) => sum + Number(row.cred), 0), 105);
  const row = updated.find(row => row.id === 'a');
  assert.deepEqual(getCalculationListResults(row), [{ label: 'Cred', value: '75' }]);
  assert.equal(row.history.length, 1);
  assert.equal(row.title, 'Updated');
});

test('payoff saves amount and exact timestamp, zeroes results, and supports undo', () => {
  const at = '2026-09-23T12:34:56.789Z';
  const paid = JSON.parse(JSON.stringify(applyCalculationChange(rows, { type: 'edit', id: 'a', payOff: true, changes: { comment: 'Paid today' } }, at)));
  const row = paid.find(item => item.id === 'a');
  assert.equal(row.cred, '0');
  assert.equal(row.paidOffAt, at);
  assert.equal(row.paidOffAmount, '20');
  assert.equal(row.createdAt, rows[0].createdAt);
  assert.deepEqual(getCalculationListResults(row), [{ label: 'Cred', value: '0' }]);
  assert.equal(debtRows(paid).length, 3);
  const edited = applyCalculationChange(paid, { type: 'edit', id: 'a', changes: { title: 'Renamed' } });
  assert.equal(edited.find(item => item.id === 'a').paidOffAt, at);
  const undone = applyCalculationChange(paid, { type: 'undo', id: 'a', eventId: row.history.at(-1).id });
  assert.equal(undone.find(item => item.id === 'a').cred, '20');
  assert.equal(undone.find(item => item.id === 'a').paidOffAt, '');
  assert.throws(() => applyCalculationChange(paid, { type: 'edit', id: 'a', payOff: true, changes: {} }));
  const reopened = applyCalculationChange(paid, { type: 'edit', id: 'a', changes: { cred: '10' } });
  assert.equal(reopened.find(item => item.id === 'a').paidOffAt, '');
  assert.equal(reopened.find(item => item.id === 'a').history[0].after.paidOffAt, at);
});

test('direct payoff undo retains later edits and rejects stale requests', () => {
  const paidAt = '2026-09-23T12:34:56.789Z';
  let changed = applyCalculationChange(rows, { type: 'edit', id: 'a', payOff: true, changes: {} }, paidAt);
  changed = applyCalculationChange(changed, { type: 'edit', id: 'a', changes: { title: 'Updated name', comment: 'Keep this' } });
  const request = { type: 'edit', id: 'a', undoPayOff: true, paidOffAt: paidAt, changes: {} };
  assert.throws(() => applyCalculationChange(changed, { ...request, paidOffAt: 'stale' }));
  const restored = applyCalculationChange(changed, request);
  const row = restored.find(item => item.id === 'a');
  assert.equal(row.cred, '20');
  assert.equal(row.title, 'Updated name');
  assert.equal(row.comment, 'Keep this');
  assert.equal(row.paidOffAt, '');
  assert.equal(debtRows(restored).length, 3);
  assert.throws(() => applyCalculationChange(restored, request));
});
