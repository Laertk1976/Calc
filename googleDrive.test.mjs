import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const importFile = async (file) => import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(file, import.meta.url))).toString('base64')}`);
const { buildDriveExportFileName: name } = await importFile('./driveExportNames.js');
const { uploadFileToGoogleDrive: upload } = await importFile('./googleDrive.js');
const date = new Date(2026, 8, 16, 0, 5, 9);
const args = { accessToken: 'account-a', fileName: 'Eric.pdf', mimeType: 'application/pdf', content: new Blob(['PDF content']) };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('filenames use only the local export date and format', () => {
  assert.equal(name([{ title: 'Eric' }, { title: 'Vardan' }], 'pdf', date), '2026-09-16.pdf');
  assert.equal(name([{ title: 'Eric' }], 'csv', date), '2026-09-16.csv');
  assert.equal(name([], 'pdf', date), '2026-09-16.pdf');
  assert.equal(name([], 'csv', new Date(2026, 0, 2, 23, 59)), '2026-01-02.csv');
  assert.throws(() => name([], 'txt', date), /Unsupported export format/);
});
test('existing writable Calculator folder receives upload without recreation', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return reply({ files: [{ id: 'folder-a', capabilities: { canAddChildren: true } }] });
    return reply({ id: 'file-a' });
  });
  assert.deepEqual(await upload(args), { id: 'file-a' });
  const query = new URL(calls[0].url).searchParams.get('q');
  assert.match(query, /trashed = false/);
  assert.match(query, /'root' in parents/);
  assert.match(query, /application\/vnd.google-apps.folder/);
  assert.equal(calls.length, 2);
  assert.match(await calls[1].options.body.text(), /"parents":\["folder-a"\]/);
  assert.match(await calls[1].options.body.text(), /PDF content/);
});

test('missing folder is created before CSV upload', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return reply(calls.length === 1 ? { files: [] } : { id: calls.length === 2 ? 'new-folder' : 'csv-file' });
  });
  await upload({ ...args, fileName: 'Eric.csv', mimeType: 'text/csv', content: '\ufeffname,value\nEric,5' });
  assert.deepEqual(JSON.parse(calls[1].options.body), { name: 'Calculator', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] });
  const multipart = await calls[2].options.body.text();
  assert.match(multipart, /"parents":\["new-folder"\]/);
  assert.match(multipart, /Eric,5/);
  assert.match(multipart, /Content-Type: text\/csv/);
});

test('lookup checks later pages and skips read-only folders', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return reply({ files: [{ id: 'read-only', capabilities: { canAddChildren: false } }], nextPageToken: 'next-page' });
    if (calls.length === 2) return reply({ files: [{ id: 'writable', capabilities: { canAddChildren: true } }] });
    return reply({ id: 'uploaded' });
  });
  await upload(args);
  assert.equal(new URL(calls[1].url).searchParams.get('pageToken'), 'next-page');
  assert.match(await calls[2].options.body.text(), /"parents":\["writable"\]/);
});

test('folder lookup failure prevents upload and preserves Google error message', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return reply({ error: { message: 'Drive API disabled' } }, 403); });
  await assert.rejects(upload(args), /Drive API disabled/);
  assert.equal(calls, 1);
});

test('folder creation failure does not upload into Drive root', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ++calls === 1 ? reply({ files: [] }) : reply({ error: { message: 'Cannot create folder' } }, 403));
  await assert.rejects(upload(args), /Cannot create folder/);
  assert.equal(calls, 2);
});

test('later uploads recheck folders and use the currently authorized account', async (t) => {
  const parents = [];
  let lookups = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!url.includes('/upload/')) {
      lookups++;
      return reply({ files: [{ id: options.headers.Authorization, capabilities: { canAddChildren: true } }] });
    }
    parents.push(await options.body.text());
    return reply({ id: 'file' });
  });
  await upload(args);
  await upload({ ...args, accessToken: 'account-b' });
  await upload(args);
  assert.equal(lookups, 3);
  assert.match(parents[0], /Bearer account-a/);
  assert.match(parents[1], /Bearer account-b/);
});

test('simultaneous exports share a folder lookup for the same token', async (t) => {
  let lookups = 0;
  let creations = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.includes('/upload/')) return reply({ id: 'file' });
    if (options.method === 'POST') { creations++; return reply({ id: 'folder' }); }
    lookups++;
    return reply({ files: [] });
  });
  await Promise.all([upload(args), upload({ ...args, fileName: 'Second.pdf' })]);
  assert.equal(lookups, 1);
  assert.equal(creations, 1);
});
