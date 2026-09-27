// All services are injected so ordering and failures can be tested without real accounts.
export async function runAccountDeletion({ reauthenticate, assertCurrentUser, freezeLocal, blockCloudWrites, eraseCloudRecords, eraseLocalRecords, deleteIdentity }) {
  assertCurrentUser();
  const confirmed = await reauthenticate();
  if (!confirmed) return false;
  assertCurrentUser();
  await freezeLocal();
  await blockCloudWrites();
  assertCurrentUser();
  await eraseCloudRecords();
  await eraseLocalRecords();
  assertCurrentUser();
  // Delete Authentication last: earlier failures remain retryable with the same account.
  await deleteIdentity();
  return true;
}

export async function deleteRecordBatches({ listBatch, commitBatch }) {
  for (;;) {
    const records = await listBatch();
    if (!records.length) return;
    await commitBatch(records);
  }
}
