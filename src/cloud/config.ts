import type { FirebaseOptions } from 'firebase/app';

/**
 * Your Firebase web app config: Firebase console → Project settings → General →
 * Your apps → SDK setup and configuration → Config. These values are public by
 * design (every web app ships them); your data is protected by the sign-in and
 * the security rules in firestore.rules.
 *
 * While this is null, cloud backup is switched off and Firebase is never loaded.
 */
export const firebaseConfig: FirebaseOptions | null = null;

/** `npm run test:sync` builds with this set, to test against the local Firebase emulator. */
export const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1';

export const activeConfig: FirebaseOptions | null = useEmulator
  ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-gym-log', appId: 'demo-app' }
  : firebaseConfig;
