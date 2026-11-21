/**
 * Everything that talks to Firebase. Loaded on demand (a separate download),
 * only once cloud backup is set up and you sign in.
 */
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
} from 'firebase/firestore';
import type { CloudRecord } from './records';

export interface CloudUser {
  uid: string;
  email: string | null;
  name: string | null;
}

export interface SnapshotInfo {
  /** Data came from the device's offline copy, not the server (e.g. no signal). */
  fromCache: boolean;
  /** Some of your changes haven't reached the server yet. */
  hasPendingWrites: boolean;
}

export type Cloud = ReturnType<typeof createCloud>;

export function createCloud(config: FirebaseOptions, emulator: boolean) {
  const app = initializeApp(config);
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  // Firestore keeps its own offline copy and queues changes made without signal,
  // so they're sent when you're back online (even if the app was closed meanwhile).
  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  if (emulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }

  const records = (uid: string) => collection(db, 'users', uid, 'records');

  return {
    onUser(cb: (u: CloudUser | null) => void) {
      return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email, name: u.displayName } : null));
    },
    signInWithGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()).then(() => undefined),
    signInWithEmail: (email: string, password: string) => signInWithEmailAndPassword(auth, email, password).then(() => undefined),
    createAccount: (email: string, password: string) => createUserWithEmailAndPassword(auth, email, password).then(() => undefined),
    resetPassword: (email: string) => sendPasswordResetEmail(auth, email),
    signOut: () => signOut(auth),

    /** Save one record (or a "deleted" marker). Resolves once the server has it. */
    write(uid: string, r: CloudRecord) {
      return setDoc(doc(records(uid), r.key), { json: r.json, updatedAt: r.updatedAt });
    },

    /** Every record for this account, now and whenever something changes. */
    listen(uid: string, cb: (recs: CloudRecord[], info: SnapshotInfo) => void, onError: (e: Error) => void) {
      return onSnapshot(
        records(uid),
        { includeMetadataChanges: true },
        (snap) => {
          const recs = snap.docs.map((d) => {
            const v = d.data() as { json: string | null; updatedAt: number };
            return { key: d.id, json: v.json ?? null, updatedAt: v.updatedAt ?? 0 };
          });
          cb(recs, { fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites });
        },
        onError,
      );
    },
  };
}
