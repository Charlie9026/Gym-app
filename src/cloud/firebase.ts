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
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocsFromServer,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import type { CloudRecord } from './records';
import type { PublicEntry } from '../leaderboard';

/** A leaderboard entry as read back, with the account it belongs to. */
export type BoardEntry = PublicEntry & { uid: string };

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

    // ---------- leaderboards ----------
    /** Publish (or update) your public leaderboard entry. */
    publishEntry(uid: string, entry: PublicEntry) {
      return setDoc(doc(db, 'leaderboard', uid), { ...entry, updatedAt: serverTimestamp() });
    },

    /** Leave the leaderboards: remove your entry and free your friend code. */
    async removeEntry(uid: string, code: string | undefined) {
      await deleteDoc(doc(db, 'leaderboard', uid));
      if (code) await deleteDoc(doc(db, 'friendCodes', code)).catch(() => undefined);
    },

    /** Make sure a friend code points at you. False if someone else already has it. */
    async claimCode(uid: string, code: string): Promise<boolean> {
      const ref = doc(db, 'friendCodes', code);
      const existing = await getDoc(ref);
      if (existing.exists()) return existing.data().uid === uid;
      await setDoc(ref, { uid });
      return true;
    },

    /** Whose friend code this is, if anyone's. */
    async findCode(code: string): Promise<string | null> {
      const snap = await getDoc(doc(db, 'friendCodes', code));
      return snap.exists() ? (snap.data().uid as string) : null;
    },

    /** Entries for these accounts (friends). */
    async entries(uids: string[]): Promise<BoardEntry[]> {
      const out: BoardEntry[] = [];
      for (let i = 0; i < uids.length; i += 30) {
        const snap = await getDocsFromServer(query(collection(db, 'leaderboard'), where(documentId(), 'in', uids.slice(i, i + 30))));
        snap.forEach((d) => out.push({ ...(d.data() as PublicEntry), uid: d.id }));
      }
      return out;
    },

    /** Everyone's entries for this week (sorted on the phone, so no extra database index is needed). */
    async weekEntries(weekId: string): Promise<BoardEntry[]> {
      const snap = await getDocsFromServer(query(collection(db, 'leaderboard'), where('weekId', '==', weekId), limit(500)));
      return snap.docs.map((d) => ({ ...(d.data() as PublicEntry), uid: d.id }));
    },

    /** The strongest 100, by strength score. */
    async strengthEntries(): Promise<BoardEntry[]> {
      const snap = await getDocsFromServer(query(collection(db, 'leaderboard'), orderBy('strength', 'desc'), limit(100)));
      return snap.docs.map((d) => ({ ...(d.data() as PublicEntry), uid: d.id })).filter((e) => e.strength != null);
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
