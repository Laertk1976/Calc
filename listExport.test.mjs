import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./listExport.js', import.meta.url), 'utf8');
const { buildListExport } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const options = { title: 'Debts', summary: 'Selected dates | Name: Client', t: value => value, formatDate: value => value };

test('exports only supplied rows and totals outstanding amounts separately from payoffs', () => {
  const result = buildListExport({ ...options, amountField: 'cred', rows: [
    { title: 'Client', cred: '1,200', fact: '999', createdAt: '2026-09-01', comment: 'First' },
    { title: 'Paid', cred: '0', paidOffAt: '2026-09-03', paidOffAmount: '300', invoicePaidOffAmount: '777' },
  ] });
  assert.ok(result.csv.includes('"TOTAL","","1200"'));
  assert.ok(result.csv.includes('"300","2026-09-03"'));
  assert.ok(!result.csv.includes('999'));
  assert.ok(!result.csv.includes('777'));
  assert.ok(result.html.includes(options.summary));
});

test('invoice export uses invoice amounts and payoff fields', () => {
  const result = buildListExport({ ...options, title: 'Invoices', amountField: 'fact', rows: [
    { title: 'Client', fact: '0', cred: '99', invoicePaidOffAt: '2026-09-04', invoicePaidOffAmount: '45', paidOffAmount: '22' },
  ] });
  assert.ok(result.csv.includes('"Invoice"'));
  assert.ok(result.csv.includes('"45","2026-09-04"'));
  assert.ok(result.csv.includes('"TOTAL","","0"'));
  assert.ok(!result.csv.includes('"22"'));
});

test('export escapes HTML and CSV and protects text from spreadsheet formulas', () => {
  const result = buildListExport({ ...options, amountField: 'cred', rows: [
    { title: '=1+1', cred: '-12', comment: '<script>"quoted",\nnext</script>' },
  ] });
  assert.ok(result.csv.includes('"\'=1+1"'));
  assert.ok(result.csv.includes('"-12"'));
  assert.ok(result.csv.includes('""quoted""'));
  assert.ok(result.html.includes('&lt;script&gt;'));
  assert.ok(!result.html.includes('<script>'));
});
