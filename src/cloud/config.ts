import type { FirebaseOptions } from 'firebase/app';

/**
 * Your Firebase web app config: Firebase console → Project settings → General →
 * Your apps → SDK setup and configuration → Config. These values are public by
 * design (every web app ships them); your data is protected by the sign-in and
 * the security rules in firestore.rules.
 *
 * Set to null to switch cloud backup off (Firebase is then never loaded).
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: 'AIzaSyClUlSMY8kiwBT9ztXJyB_4yDvaXwnlpqU',
  authDomain: 'overload-b750c.firebaseapp.com',
  projectId: 'overload-b750c',
  storageBucket: 'overload-b750c.firebasestorage.app',
  messagingSenderId: '1068552901940',
  appId: '1:1068552901940:web:47a777d0ad905717be4161',
};

/** `npm run test:sync` builds with this set, to test against the local Firebase emulator. */
export const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1';

export const activeConfig: FirebaseOptions | null = useEmulator
  ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-gym-log', appId: 'demo-app' }
  : firebaseConfig;
