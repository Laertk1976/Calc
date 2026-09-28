import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

let env;
const recent = () => ({ auth_time: Math.floor(Date.now() / 1000) });
const userDb = (uid = 'owner', claims = recent()) => env.authenticatedContext(uid, claims).firestore();
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-calc-deletion',
    firestore: { host: '127.0.0.1', port: 8185, rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});
beforeEach(() => env.clearFirestore());
after(async () => { await env?.cleanup(); });

test('sync transaction can read a missing record and create it for its owner', async () => {
  const owner = userDb();
  const ref = doc(owner, 'calculations', 'local-owner-new');
  await assertSucceeds(runTransaction(owner, async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) transaction.set(ref, { userId: 'owner', payload: { title: 'New calculation' } });
  }));
  await assertFails(getDoc(doc(userDb('other'), 'calculations', ref.id)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'calculations', 'missing')));
});

test('normal account can save, query and edit only its own records', async () => {
  const owner = userDb();
  const other = userDb('other');
  await assertSucceeds(setDoc(doc(owner, 'calculations', 'one'), { userId: 'owner', payload: { title: 'Test' } }));
  await assertSucceeds(getDocs(query(collection(owner, 'calculations'), where('userId', '==', 'owner'))));
  await assertFails(getDoc(doc(other, 'calculations', 'one')));
  await assertFails(deleteDoc(doc(other, 'calculations', 'one')));
  await assertFails(updateDoc(doc(owner, 'calculations', 'one'), { userId: 'other' }));
  await assertFails(setDoc(doc(other, 'calculations', 'fake'), { userId: 'owner' }));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'calculations', 'one')));
});

test('deletion marker requires fresh authentication and ownership', async () => {
  const stale = userDb('owner', { auth_time: Math.floor(Date.now() / 1000) - 600 });
  await assertFails(setDoc(doc(stale, 'accountDeletions', 'owner'), { requestedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(userDb('other'), 'accountDeletions', 'owner'), { requestedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(userDb(), 'accountDeletions', 'owner'), { requestedAt: serverTimestamp(), email: 'unneeded@example.test' }));
  await assertSucceeds(setDoc(doc(userDb(), 'accountDeletions', 'owner'), { requestedAt: serverTimestamp() }));
  await assertFails(getDoc(doc(userDb('other'), 'accountDeletions', 'owner')));
});

test('marker blocks old sessions from recreating records but permits complete owner deletion', async () => {
  const owner = userDb();
  const oldSession = userDb('owner', { auth_time: Math.floor(Date.now() / 1000) - 3600 });
  await setDoc(doc(owner, 'calculations', 'one'), { userId: 'owner', payload: { deletedAt: 'test', history: [{ value: 'sensitive' }] } });
  await setDoc(doc(owner, 'accountDeletions', 'owner'), { requestedAt: serverTimestamp() });
  await assertFails(updateDoc(doc(oldSession, 'calculations', 'one'), { payload: { title: 'resurrect' } }));
  await assertFails(setDoc(doc(oldSession, 'calculations', 'new'), { userId: 'owner' }));
  const rows = await assertSucceeds(getDocs(query(collection(owner, 'calculations'), where('userId', '==', 'owner'))));
  const batch = writeBatch(owner);
  rows.docs.forEach(row => batch.delete(row.ref));
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(owner, 'accountDeletions', 'owner')));
  await assertFails(deleteDoc(doc(owner, 'accountDeletions', 'owner')));
  await assertFails(updateDoc(doc(owner, 'accountDeletions', 'owner'), { requestedAt: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(userDb('other'), 'calculations', 'other-record'), { userId: 'other' }));
});
