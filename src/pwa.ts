/**
 * Installed-app extras: the offline service worker, and keeping the screen
 * awake during a workout. Both quietly do nothing where they aren't allowed
 * (for example inside the claude.ai page viewer).
 */
import { useEffect } from 'react';
import { isEmbedded } from './env';

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (isEmbedded) return; // service workers aren't allowed inside another page
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* not allowed here (e.g. a file:// address); the app works without it */
    });
  });
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

/** Keep the screen on while `on` is true (re-requested when you return to the app). */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } };
    if (!on || !nav.wakeLock) return;
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.hidden || lock) return;
      try {
        const l = await nav.wakeLock!.request('screen');
        if (cancelled) void l.release();
        else lock = l;
      } catch {
        /* refused (low battery, not allowed here); nothing to do */
      }
    };
    const onVisible = () => {
      lock = null; // the browser drops the lock when the page is hidden
      void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [on]);
}

export type StorageProtection = 'protected' | 'not-protected' | 'unknown';

/** Whether the browser has promised not to clear the app's data under storage pressure. */
export async function storageProtection(): Promise<StorageProtection> {
  try {
    if (!navigator.storage?.persisted) return 'unknown';
    return (await navigator.storage.persisted()) ? 'protected' : 'not-protected';
  } catch {
    return 'unknown';
  }
}

/**
 * Ask the browser to keep the app's data even when the device is low on space.
 * Most browsers decide silently (installed apps and frequently used sites get it);
 * the result can be checked with storageProtection().
 */
export async function requestStorageProtection(): Promise<StorageProtection> {
  try {
    if (!navigator.storage?.persist) return 'unknown';
    if (await navigator.storage.persisted()) return 'protected';
    return (await navigator.storage.persist()) ? 'protected' : 'not-protected';
  } catch {
    return 'unknown';
  }
}

/** Once there's something worth keeping (a logged workout), ask for storage protection. */
export function useStorageProtection(hasData: boolean) {
  useEffect(() => {
    if (hasData && !isEmbedded) void requestStorageProtection();
  }, [hasData]);
}
