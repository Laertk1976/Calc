import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { collection, doc, getDocsFromServer, limit, query, runTransaction, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { auth, db } from './authClient';
import { calculationStore } from './calculationStorage';
import { reauthenticateWithGoogle } from './googleSignIn';
import { deleteRecordBatches, runAccountDeletion } from './accountDeletionFlow';

export function deleteCurrentAccount(user, password, provider) {
  const userId = user?.uid;
  const assertCurrentUser = () => {
    if (!userId || auth.currentUser?.uid !== userId) throw new Error('The signed-in account changed. Reopen Account and try again.');
  };
  return runAccountDeletion({
    assertCurrentUser,
    reauthenticate: async () => {
      if (provider === 'google.com') return reauthenticateWithGoogle(user);
      if (provider !== 'password' || !user.email || !password) throw new Error('Enter your password to confirm account deletion.');
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      return true;
    },
    freezeLocal: () => calculationStore.beginAccountDeletion(userId),
    blockCloudWrites: async () => {
      assertCurrentUser();
      const ref = doc(db, 'accountDeletions', userId);
      await runTransaction(db, async transaction => {
        const marker = await transaction.get(ref);
        if (!marker.exists()) transaction.set(ref, { requestedAt: serverTimestamp() });
      });
    },
    eraseCloudRecords: () => deleteRecordBatches({
      listBatch: async () => {
        assertCurrentUser();
        const result = await getDocsFromServer(query(collection(db, 'calculations'), where('userId', '==', userId), limit(400)));
        return result.docs;
      },
      commitBatch: async records => {
        assertCurrentUser();
        const batch = writeBatch(db);
        records.forEach(record => batch.delete(record.ref));
        await batch.commit();
      },
    }),
    eraseLocalRecords: () => calculationStore.clearAccountForDeletion(userId),
    deleteIdentity: () => deleteUser(user),
  });
}
