/**
 * Cloud backup and sync. Keeps the local data (which the app always uses, so it
 * works offline) in step with your Firebase account:
 *  - on sign-in, merges this device's data with the cloud (see mergePlan)
 *  - after each change, uploads just the records that changed
 *  - applies changes made on your other devices as they arrive
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData } from '../types';
import type { Update } from '../store';
import { isEmbedded } from '../env';
import { activeConfig, useEmulator } from './config';
import { applyRecords, diffRecords, mergePlan, recordFor, type CloudRecord } from './records';
import type { Cloud, CloudUser } from './firebase';

export type CloudStatus =
  | 'unavailable' // not set up (no Firebase config) or not allowed here
  | 'connecting'
  | 'signed-out'
  | 'syncing' // changes on their way to the cloud
  | 'synced'
  | 'offline' // will catch up when back online
  | 'error';

const META_KEY = 'gym-app-sync-v1';

/** This device's sync bookkeeping: which account, and when each record last changed here. */
interface SyncMeta {
  uid: string | null;
  stamps: Record<string, number>;
}

function loadMeta(): SyncMeta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? 'null');
    if (m && typeof m === 'object' && m.stamps) return m;
  } catch {
    /* fall through */
  }
  return { uid: null, stamps: {} };
}

function saveMeta(m: SyncMeta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* storage full or blocked; sync still works for this session */
  }
}

export interface CloudSync {
  available: boolean;
  status: CloudStatus;
  user: CloudUser | null;
  lastSynced: number | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccount: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useCloudSync(data: AppData, update: Update): CloudSync {
  const available = !!activeConfig && !isEmbedded;
  const [initialMeta] = useState(loadMeta);
  const metaRef = useRef<SyncMeta>(initialMeta);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [status, setStatus] = useState<CloudStatus>(!available ? 'unavailable' : initialMeta.uid ? 'connecting' : 'signed-out');
  const [lastSynced, setLastSynced] = useState<number | null>(null);

  const cloudRef = useRef<Promise<Cloud> | null>(null);
  const dataRef = useRef(data);
  const userRef = useRef<CloudUser | null>(null);
  /** The data as last reconciled with the cloud; null until the first merge on sign-in. */
  const baseRef = useRef<AppData | null>(null);
  const queueRef = useRef(new Set<string>());
  const flushTimer = useRef<number | undefined>(undefined);
  const stopListening = useRef<(() => void) | null>(null);

  useEffect(() => {
    dataRef.current = data;
  });

  const loadCloud = useCallback((): Promise<Cloud> => {
    cloudRef.current ??= import('./firebase').then((m) => m.createCloud(activeConfig!, useEmulator));
    return cloudRef.current;
  }, []);

  /** Upload queued records shortly after the last change (one burst, not one per keystroke). */
  const flushSoon = useCallback(() => {
    clearTimeout(flushTimer.current);
    flushTimer.current = window.setTimeout(async () => {
      const u = userRef.current;
      if (!u || !queueRef.current.size) return;
      const cloud = await loadCloud();
      const keys = [...queueRef.current];
      queueRef.current.clear();
      for (const key of keys) {
        const rec: CloudRecord = { key, json: recordFor(dataRef.current, key), updatedAt: metaRef.current.stamps[key] ?? Date.now() };
        cloud.write(u.uid, rec).catch(() => {
          setStatus('error');
          queueRef.current.add(key); // try again with the next change
        });
      }
    }, 800);
  }, [loadCloud]);

  const startSync = useCallback(
    async (u: CloudUser) => {
      const cloud = await loadCloud();
      const meta = metaRef.current;
      if (meta.uid !== u.uid) {
        // A different account on this device: this device's data joins it as data
        // from before sync (anything already in that account wins on conflicts).
        metaRef.current = { uid: u.uid, stamps: {} };
        saveMeta(metaRef.current);
      }
      setStatus('syncing');
      let first = true;
      stopListening.current?.();
      stopListening.current = cloud.listen(
        u.uid,
        (recs, info) => {
          const stamps = metaRef.current.stamps;
          if (first) {
            first = false;
            const plan = mergePlan(dataRef.current, stamps, recs);
            for (const r of plan.pull) stamps[r.key] = r.updatedAt;
            const now = Date.now();
            for (const k of plan.push) {
              stamps[k] = Math.max(stamps[k] ?? 0, now);
              queueRef.current.add(k);
            }
            update((d) => {
              const next = plan.pull.length ? applyRecords(d, plan.pull) : d;
              baseRef.current = next;
              return next;
            });
            saveMeta(metaRef.current);
            if (plan.push.length) flushSoon();
          } else {
            // Changes from your other devices (our own uploads echo back with the same time and are skipped).
            const fresh = recs.filter((r) => r.updatedAt > (stamps[r.key] ?? 0));
            if (fresh.length) {
              for (const r of fresh) stamps[r.key] = r.updatedAt;
              update((d) => {
                const next = applyRecords(d, fresh);
                baseRef.current = next;
                return next;
              });
              saveMeta(metaRef.current);
            }
          }
          if (info.hasPendingWrites || queueRef.current.size) setStatus('syncing');
          else if (info.fromCache) setStatus('offline');
          else {
            setStatus('synced');
            setLastSynced(Date.now());
          }
        },
        () => setStatus('error'),
      );
    },
    [loadCloud, update, flushSoon],
  );

  // Follow the signed-in account (restored automatically on later visits).
  const watching = useRef(false);
  const watch = useCallback(async () => {
    if (watching.current) return;
    watching.current = true;
    const cloud = await loadCloud();
    cloud.onUser((u) => {
      userRef.current = u;
      setUser(u);
      if (u) void startSync(u);
      else {
        stopListening.current?.();
        stopListening.current = null;
        baseRef.current = null;
        setStatus('signed-out');
      }
    });
  }, [loadCloud, startSync]);

  // If you were signed in last time, reconnect at start-up.
  useEffect(() => {
    if (available && metaRef.current.uid) void watch();
  }, [available, watch]);

  // Your changes: find the records that changed and queue them for upload.
  useEffect(() => {
    const base = baseRef.current;
    if (!base || !userRef.current) return;
    const { changed, removed } = diffRecords(base, data);
    baseRef.current = data;
    if (!changed.length && !removed.length) return;
    const now = Date.now();
    for (const k of [...changed, ...removed]) {
      metaRef.current.stamps[k] = now;
      queueRef.current.add(k);
    }
    saveMeta(metaRef.current);
    setStatus('syncing');
    flushSoon();
  }, [data, flushSoon]);

  // Back online: send anything that failed while offline.
  useEffect(() => {
    const onOnline = () => queueRef.current.size && flushSoon();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushSoon]);

  const withCloud = useCallback(
    async (fn: (c: Cloud) => Promise<void>) => {
      const cloud = await loadCloud();
      await watch();
      await fn(cloud);
    },
    [loadCloud, watch],
  );

  return {
    available,
    status,
    user,
    lastSynced,
    signInWithGoogle: () => withCloud((c) => c.signInWithGoogle()),
    signInWithEmail: (e, p) => withCloud((c) => c.signInWithEmail(e, p)),
    createAccount: (e, p) => withCloud((c) => c.createAccount(e, p)),
    resetPassword: (e) => withCloud((c) => c.resetPassword(e)),
    signOut: async () => {
      const cloud = await loadCloud();
      await cloud.signOut();
      // Your data stays on this device; it just stops syncing.
      metaRef.current = { uid: null, stamps: {} };
      saveMeta(metaRef.current);
    },
  };
}
