// Read-only account-scoped measurement; outputs counts and sizes, never records.
const auth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { findUser } = require('firebase-tools/lib/gcp/auth');
const { Client } = require('firebase-tools/lib/apiv2');
const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
function decode(value) {
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, decode(v)]));
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  return value.stringValue ?? value.timestampValue ?? value.referenceValue ?? value.bytesValue;
}
(async () => {
  const email = process.argv[2];
  if (!email || !email.includes('@')) throw Error('Provide the account email.');
  const options = { project: 'calc-7271f', nonInteractive: true };
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw Error('Firebase CLI login required.');
  auth.setActiveAccount(options, account);
  await requireAuth(options);
  const user = await findUser(options.project, email);
  if (user.email?.toLowerCase() !== email.toLowerCase()) throw Error('Account mismatch.');
  const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
  const response = await client.post(`projects/${options.project}/databases/(default)/documents:runQuery`, {
    structuredQuery: { from: [{ collectionId: 'calculations' }], where: { fieldFilter: {
      field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: user.uid },
    } } },
  });
  const documents = response.body.filter(item => item.document).map(item => decode({ mapValue: { fields: item.document.fields } }));
  const rows = documents.map(doc => doc.payload).filter(row => row && !row.permanentlyDeletedAt);
  const histories = rows.filter(row => Array.isArray(row.history) && row.history.length);
  const events = histories.flatMap(row => row.history);
  const deleted = rows.filter(row => row.deletedAt);
  const stripHistory = ({ history, ...rest }) => rest;
  const historyBytes = histories.reduce((total, row) => total + bytes(row) - bytes(stripHistory(row)), 0);
  const deletedRowBytes = deleted.reduce((total, row) => total + bytes(stripHistory(row)), 0);
  console.log(JSON.stringify({ account: email, measuredAt: new Date().toISOString(),
    syncedRows: rows.length, rowsWithHistory: histories.length,
    visibleHistoryEvents: events.filter(event => event && event.type !== 'purged').length,
    purgedMarkers: events.filter(event => event?.type === 'purged').length,
    deletedRows: deleted.length, historyBytes, deletedRowBytes,
    historyAndDeletedRowsBytes: historyBytes + deletedRowBytes,
    allSyncedRowsJsonBytes: bytes(rows),
    measurement: 'UTF-8 JSON payload bytes; excludes database/index/cache overhead and pending local changes',
  }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
