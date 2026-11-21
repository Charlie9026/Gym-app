/**
 * The sync engine's pure logic (no Firebase here, so it's unit-tested).
 *
 * Your data is split into records, each synced on its own:
 *   workout:<id>   one per finished workout
 *   template:<id>  one per saved workout
 *   exercises      your exercise list (custom exercises, per-exercise rest)
 *   settings       unit, theme, rest timer
 * The workout in progress is not synced; it stays on the device you're using.
 *
 * Each record carries the time it last changed. When the same record changed on
 * two devices, the most recent change wins. Deleting leaves a "deleted" marker so
 * the deletion reaches other devices instead of the record coming back.
 */
import type { AppData } from '../types';

export interface CloudRecord {
  key: string;
  /** The record as JSON, or null when it was deleted. */
  json: string | null;
  updatedAt: number;
}

/** Each record's current JSON. */
export function recordsOf(d: AppData): Map<string, string> {
  const m = new Map<string, string>();
  for (const w of d.workouts) m.set(`workout:${w.id}`, JSON.stringify(w));
  for (const t of d.templates) m.set(`template:${t.id}`, JSON.stringify(t));
  m.set('exercises', JSON.stringify(d.exercises));
  m.set('settings', JSON.stringify(d.settings));
  return m;
}

/** Which records changed or disappeared between two versions of the data. */
export function diffRecords(prev: AppData, next: AppData): { changed: string[]; removed: string[] } {
  const a = recordsOf(prev);
  const b = recordsOf(next);
  const changed: string[] = [];
  const removed: string[] = [];
  for (const [k, v] of b) if (a.get(k) !== v) changed.push(k);
  for (const k of a.keys()) if (!b.has(k)) removed.push(k);
  return { changed, removed };
}

/** Put records (from the cloud) into the data. Unknown keys are ignored. */
export function applyRecords(d: AppData, recs: Pick<CloudRecord, 'key' | 'json'>[]): AppData {
  let workouts = d.workouts;
  let templates = d.templates;
  let exercises = d.exercises;
  let settings = d.settings;
  for (const r of recs) {
    const [kind, id] = splitKey(r.key);
    if (kind === 'workout') {
      workouts = workouts.filter((w) => w.id !== id);
      if (r.json) workouts = [...workouts, JSON.parse(r.json)];
    } else if (kind === 'template') {
      const i = templates.findIndex((t) => t.id === id);
      const rest = templates.filter((t) => t.id !== id);
      if (!r.json) templates = rest;
      else if (i < 0) templates = [...rest, JSON.parse(r.json)];
      else templates = [...rest.slice(0, i), JSON.parse(r.json), ...rest.slice(i)]; // keep its place in the list
    } else if (kind === 'exercises' && r.json) {
      exercises = JSON.parse(r.json);
    } else if (kind === 'settings' && r.json) {
      settings = JSON.parse(r.json);
    }
  }
  if (workouts !== d.workouts) workouts = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  return { ...d, workouts, templates, exercises, settings };
}

function splitKey(key: string): [string, string] {
  const i = key.indexOf(':');
  return i < 0 ? [key, ''] : [key.slice(0, i), key.slice(i + 1)];
}

/**
 * First sync on a device: decide what to take from the cloud and what to send.
 * `stamps` are this device's last-change times per record (missing = data from
 * before sync was turned on, which loses to anything already in the cloud).
 */
export function mergePlan(local: AppData, stamps: Record<string, number>, remote: CloudRecord[]): { pull: CloudRecord[]; push: string[] } {
  const mine = recordsOf(local);
  const theirs = new Map(remote.map((r) => [r.key, r]));
  const pull: CloudRecord[] = [];
  const push: string[] = [];
  for (const r of remote) {
    const myTime = stamps[r.key] ?? 0;
    const same = r.json !== null && mine.get(r.key) === r.json;
    if (same) continue;
    if (r.updatedAt > myTime) pull.push(r);
    else if (mine.has(r.key) || stamps[r.key] !== undefined) push.push(r.key); // ours is newer (or we deleted it later)
  }
  for (const k of mine.keys()) if (!theirs.has(k)) push.push(k);
  return { pull, push };
}

/** What to upload for a key right now: its JSON, or null as a "deleted" marker. */
export function recordFor(d: AppData, key: string): string | null {
  return recordsOf(d).get(key) ?? null;
}
