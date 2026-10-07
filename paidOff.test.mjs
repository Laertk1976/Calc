import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const url = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const { getPaidOffEntries, getPaidOffTotal, getTablePaymentRows } = await import(url(await readFile(new URL('./paidOff.js', import.meta.url), 'utf8')));
const utils = url(await readFile(new URL('./calculatorUtils.js', import.meta.url), 'utf8'));
const { applyCalculationChange } = await import(url((await readFile(new URL('./calculationHistory.js', import.meta.url), 'utf8')).replace("'./calculatorUtils'", JSON.stringify(utils))));

test('payoffs populate both categories and undo removes only the selected payment', () => {
  let rows = [{ id: 'mixed', type: 'Add', cred: '25', fact: '75', createdAt: '2026-09-01' }];
  assert.deepEqual(getPaidOffEntries(rows[0]), []);
  rows = applyCalculationChange(rows, { type: 'edit', id: 'mixed', payOff: true, changes: {} }, '2026-09-02');
  rows = applyCalculationChange(rows, { type: 'edit', id: 'mixed', payOff: true, amountField: 'fact', changes: {} }, '2026-09-03');
  assert.deepEqual(getPaidOffEntries(rows[0]), [
    { category: 'Debt', amount: '25', at: '2026-09-02' },
    { category: 'Invoice', amount: '75', at: '2026-09-03' },
  ]);
  assert.equal(getPaidOffTotal(rows), 100);
  rows = applyCalculationChange(rows, { type: 'edit', id: 'mixed', undoPayOff: true, paidOffAt: '2026-09-02', changes: {} });
  assert.equal(getPaidOffTotal(rows), 75);
  assert.equal(getPaidOffEntries(rows[0])[0].category, 'Invoice');
  rows = applyCalculationChange(rows, { type: 'edit', id: 'mixed', changes: { fact: '90' } });
  assert.deepEqual(getPaidOffEntries(rows[0]), []);
});

test('old paid debts display and unpaid or cleared records stay empty', () => {
  const rows = [{ paidOffAt: '2026-01-01', paidOffAmount: '1,200' }, { cred: '100' }, { paidOffAt: '', paidOffAmount: '50' }];
  assert.equal(getPaidOffTotal(rows), 1200);
  assert.equal(getPaidOffEntries(rows[0])[0].category, 'Debt');
  assert.deepEqual(getPaidOffEntries(rows[1]), []);
  assert.deepEqual(getPaidOffEntries(rows[2]), []);
});

test('table attributes each payoff to its payment day without duplicating calculation totals', () => {
  const original = { id: 'mixed', title: 'Shop', savedAt: '2026-09-01T12:00:00', info: '100', cred: '0', fact: '0', fcash: '10',
    paidOffAt: '2026-10-07T15:00:00', paidOffAmount: '25', invoicePaidOffAt: '2026-10-08T10:00:00', invoicePaidOffAmount: '75' };
  const rows = getTablePaymentRows([original]);
  const onDay = day => rows.filter(row => row.savedAt.startsWith(day));
  assert.equal(getPaidOffTotal(onDay('2026-09-01')), 0);
  assert.equal(getPaidOffTotal(onDay('2026-10-07')), 25);
  assert.equal(getPaidOffTotal(onDay('2026-10-08')), 75);
  assert.equal(getPaidOffTotal(rows), 100);
  assert.equal(rows[0].info, '100');
  assert.equal(rows[0].fcash, '10');
  for (const row of rows.slice(1)) {
    assert.equal(row.paymentOnly, true);
    for (const field of ['info', 'expression', 'cred', 'fact', 'fcash']) assert.equal(row[field], '');
  }
  assert.equal(new Set(rows.map(row => row.id)).size, 3);
  assert.equal(original.paidOffAmount, '25');
  assert.deepEqual(getTablePaymentRows([{ ...original, deletedAt: '2026-10-09' }]), []);
  assert.equal(getTablePaymentRows([{ ...original, paidOffAt: '', invoicePaidOffAt: '' }]).length, 1);
});
