import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { runAccountDeletion, deleteRecordBatches } = await import(url(await readFile('accountDeletionFlow.js', 'utf8')));

function steps(overrides = {}) {
  const calls = [];
  const actions = Object.fromEntries(['reauthenticate', 'freezeLocal', 'blockCloudWrites', 'eraseCloudRecords', 'eraseLocalRecords', 'deleteIdentity'].map(name => [name, async () => { calls.push(name); return true; }]));
  return { calls, options: { ...actions, assertCurrentUser: () => {}, ...overrides } };
}

test('deletion verifies identity and blocks uploads before removing records and auth', async () => {
  const { calls, options } = steps();
  assert.equal(await runAccountDeletion(options), true);
  assert.deepEqual(calls, ['reauthenticate', 'freezeLocal', 'blockCloudWrites', 'eraseCloudRecords', 'eraseLocalRecords', 'deleteIdentity']);
});
test('cancelled or rejected reauthentication never starts deletion', async () => {
  const { calls, options } = steps({ reauthenticate: async () => false });
  assert.equal(await runAccountDeletion(options), false);
  assert.deepEqual(calls, []);
  options.reauthenticate = async () => { throw new Error('wrong password'); };
  await assert.rejects(runAccountDeletion(options), /wrong password/);
  assert.deepEqual(calls, []);
});
test('a changed account aborts after reauthentication before any mutation', async () => {
  let validations = 0;
  const { calls, options } = steps({ assertCurrentUser: () => { if (++validations > 1) throw new Error('different account'); } });
  await assert.rejects(runAccountDeletion(options), /different account/);
  assert.deepEqual(calls, ['reauthenticate']);
});
for (const failingStep of ['blockCloudWrites', 'eraseCloudRecords', 'eraseLocalRecords']) {
  test(`${failingStep} failure leaves the authentication account available for retry`, async () => {
    const { calls, options } = steps({ [failingStep]: async () => { throw new Error('unavailable'); } });
    await assert.rejects(runAccountDeletion(options), /unavailable/);
    assert.equal(calls.includes('deleteIdentity'), false);
  });
}
test('batch removal handles more than one batch and retries after partial failure', async () => {
  let records = Array.from({ length: 905 }, (_, id) => id);
  let commits = 0;
  const listBatch = async () => records.slice(0, 400);
  await assert.rejects(deleteRecordBatches({ listBatch, commitBatch: async batch => {
    if (++commits === 2) throw new Error('connection lost');
    records = records.filter(id => !batch.includes(id));
  } }), /connection lost/);
  assert.equal(records.length, 505);
  const batchSizes = [];
  await deleteRecordBatches({ listBatch, commitBatch: async batch => {
    batchSizes.push(batch.length); records = records.filter(id => !batch.includes(id));
  } });
  assert.deepEqual(batchSizes, [400, 105]);
  assert.deepEqual(records, []);
});
