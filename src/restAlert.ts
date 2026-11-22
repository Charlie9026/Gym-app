/**
 * Alerts when a rest ends: a chime scheduled on the Web Audio clock (so it
 * plays on time even if the page's timers are throttled in the background),
 * and an optional system notification where the browser allows it.
 */
let ctx: AudioContext | null = null;

/** Call from a tap (e.g. ticking a set): browsers only allow audio after a user gesture. */
export function primeAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** Schedule a soft two-note chime for the given time. Returns a cancel function. */
export function scheduleChime(atMs: number): () => void {
  if (!ctx) return () => {};
  const c = ctx;
  const start = c.currentTime + Math.max(0, (atMs - Date.now()) / 1000);
  const oscs: OscillatorNode[] = [];
  [
    [880, 0],
    [1318.5, 0.18],
  ].forEach(([freq, offset]) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = start + offset;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.65);
    oscs.push(osc);
  });
  return () =>
    oscs.forEach((o) => {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    });
}

export type NotifyResult = 'granted' | 'denied' | 'unsupported';

/** Ask for notification permission. In an embedded viewer this is refused. */
export async function requestNotify(): Promise<NotifyResult> {
  try {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    const r = await Notification.requestPermission();
    return r === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

const canNotify = () => 'Notification' in window && Notification.permission === 'granted';

/**
 * Show a system notification. Goes through the service worker where there is one
 * (Android only allows that), otherwise straight from the page.
 */
export async function showNotice(title: string, options: NotificationOptions & { timestamp?: number }): Promise<void> {
  if (!canNotify()) return;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) return await reg.showNotification(title, options);
  } catch {
    /* fall back to a page notification */
  }
  try {
    new Notification(title, options);
  } catch {
    /* not allowed here */
  }
}

/** Remove notifications with this tag (e.g. once you're back in the app). */
export async function closeNotices(tag: string): Promise<void> {
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    for (const n of (await reg?.getNotifications({ tag })) ?? []) n.close();
  } catch {
    /* nothing to close */
  }
}

/** Show "Rest over" at the given time if the app is in the background. Returns a cancel function. */
export function scheduleNotification(atMs: number): () => void {
  if (!canNotify()) return () => {};
  const t = window.setTimeout(() => {
    if (!document.hidden) return; // the on-screen bar already shows it
    void showNotice('Rest over', { body: 'Time for your next set.', tag: 'gym-rest' });
  }, Math.max(0, atMs - Date.now()));
  return () => clearTimeout(t);
}
