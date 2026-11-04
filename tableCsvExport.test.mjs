import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('./tableCsvExport.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export function filterCalculationsForDateRange', 'function filterCalculationsForDateRange');
const moduleSource = `
  const normalizeCalculation = row => ({ ...row });
  ${source}
  export { filterCalculationsForDateRange };
`;
const { filterCalculationsForDateRange } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);

test('menu CSV filters to the selected date range and sorts rows newest first', () => {
  const rows = [
    { id: 'october-early', title: 'October early', savedAt: '2026-10-02T10:00:00Z' },
    { id: 'november-early', title: 'November early', savedAt: '2026-11-01T10:00:00Z' },
    { id: 'september', title: 'September', savedAt: '2026-09-20T10:00:00Z' },
    { id: 'november-late', title: 'November late', savedAt: '2026-11-02T10:00:00Z' },
    { id: 'outside', title: 'Outside', savedAt: '2026-08-31T10:00:00Z' },
    { id: 'deleted', title: 'Deleted', savedAt: '2026-11-02T11:00:00Z', deletedAt: '2026-11-03T10:00:00Z' },
  ];

  const filtered = filterCalculationsForDateRange(rows, '01/09/2026', '02/11/2026');
  assert.deepEqual(filtered.map(row => row.id), [
    'november-late',
    'november-early',
    'october-early',
    'september',
  ]);
});
