import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./proAccess.js', import.meta.url), 'utf8');
const { accessibleRecords, localDay, cachedProAccess } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('free access shows the local day only without deleting older records', () => {
  const now = new Date(2026, 9, 8, 12);
  const records = [
    { id: 'today', savedAt: new Date(2026, 9, 8, 0).toISOString() },
    { id: 'yesterday', savedAt: new Date(2026, 9, 7, 23, 59).toISOString() },
    { id: 'tomorrow', savedAt: new Date(2026, 9, 9, 0).toISOString() },
    { id: 'legacy', createdAt: now.toISOString() },
    { id: 'invalid', savedAt: 'invalid' },
    { id: 'deleted', savedAt: now.toISOString(), deletedAt: now.toISOString() },
  ];
  const original = JSON.stringify(records);
  assert.deepEqual(accessibleRecords(records, false, localDay(now)).map(r => r.id), ['today', 'legacy']);
  assert.equal(accessibleRecords(records, true), records);
  assert.deepEqual(accessibleRecords(records, false, localDay(new Date(2026, 9, 9))).map(r => r.id), ['tomorrow']);
  assert.equal(JSON.stringify(records), original);
});

test('offline Pro cache cannot carry across accounts and expires after seven days', () => {
  const now = Date.now();
  const cache = { uid: 'alice', active: true, checkedAt: now };
  assert.equal(cachedProAccess(cache, 'alice', now), true);
  assert.equal(cachedProAccess(cache, 'bob', now), false);
  assert.equal(cachedProAccess(cache, null, now), false);
  assert.equal(cachedProAccess(cache, 'alice', now + 7 * 86400000), false);
  assert.equal(cachedProAccess(cache, 'alice', now - 1), false);
  assert.equal(cachedProAccess({ ...cache, active: false }, 'alice', now), false);
});

test('Pro purchase messages and price placeholders exist in all five languages', async () => {
  const translations = JSON.parse(await readFile(new URL('./locales/pro.json', import.meta.url), 'utf8'));
  for (const lang of ['en', 'hy', 'ru', 'ja', 'hi']) {
    assert.deepEqual(Object.keys(translations[lang]).sort(), Object.keys(translations.en).sort());
    for (const [key, value] of Object.entries(translations[lang])) {
      assert.ok(value.trim());
      assert.deepEqual(value.match(/{{.*?}}/g), translations.en[key].match(/{{.*?}}/g));
    }
  }
});
