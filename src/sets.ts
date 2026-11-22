/**
 * Rules for sets that depend on the exercise type (weight × reps, reps only,
 * time, distance) and on warm-up vs working sets. Every screen uses these so
 * they all agree on what a set means, how it's written and what "best" is.
 */
import type { DistUnit, DistanceUnit, Exercise, ExerciseType, SetEntry, Settings, TemplateSet, Units } from './types';
import { e1rm, toDisplay } from './utils';

export type AnySet = TemplateSet | SetEntry;

export const EXERCISE_TYPES: { value: ExerciseType; label: string }[] = [
  { value: 'weight', label: 'Weight × reps' },
  { value: 'reps', label: 'Reps only' },
  { value: 'time', label: 'Time' },
  { value: 'distance', label: 'Distance' },
  { value: 'steps', label: 'Steps' },
];

export const typeOf = (ex?: Pick<Exercise, 'type'>): ExerciseType => ex?.type ?? 'weight';
export const isWarmup = (s: AnySet) => s.kind === 'warmup';
export const workingSets = <T extends AnySet>(sets: T[]): T[] => sets.filter((s) => !isWarmup(s));

/** True when a set holds the numbers its type needs. */
export function hasValue(s: AnySet, type: ExerciseType): boolean {
  if (type === 'time') return (s.seconds ?? 0) > 0;
  if (type === 'distance') return (s.meters ?? 0) > 0 || (s.seconds ?? 0) > 0;
  if (type === 'steps') return s.reps > 0 || (s.seconds ?? 0) > 0;
  return s.reps > 0;
}

/** Type-agnostic version (for places that don't know the exercise). */
export const hasAnyValue = (s: AnySet) => s.reps > 0 || (s.seconds ?? 0) > 0 || (s.meters ?? 0) > 0;

// ---------- distance & time ----------
/** The units to show, from the settings. */
export const unitsOf = (s: Pick<Settings, 'unit' | 'distanceUnit'>): Units => ({ weight: s.unit, distance: appDistanceUnit(s) });

/** The app-wide distance unit: chosen in Settings, else following the weight unit (kg → km, lb → mi). */
export const appDistanceUnit = (s: Pick<Settings, 'unit' | 'distanceUnit'>): DistanceUnit =>
  s.distanceUnit ?? (s.unit === 'lb' ? 'mi' : 'km');
const M_PER: Record<DistUnit, number> = { m: 1, km: 1000, mi: 1609.344, yd: 0.9144 };
/** Distance units an exercise can use, in the order they're offered. */
export const DIST_UNITS: DistUnit[] = ['m', 'km', 'mi', 'yd'];
/** Metres and yards are shown as whole numbers, km and miles to 2 decimals. */
export const toDistDisplay = (m: number, d: DistUnit) => {
  const f = d === 'm' || d === 'yd' ? 1 : 100;
  return Math.round((m / M_PER[d]) * f) / f;
};
export const fromDistDisplay = (v: number, d: DistUnit) => v * M_PER[d];

/** Machines that show metres: rowing and ski ergs, and pools. */
const METRE_PRESETS = new Set(['preset-rowing-machine', 'preset-ski-erg', 'preset-swimming']);
const isSwim = (ex: Pick<Exercise, 'id' | 'name'>) => ex.id === 'preset-swimming' || /swim/i.test(ex.name);

/** The distance unit an exercise is shown in: its own choice, a default for its machine, then Settings. */
export function distUnitFor(ex: Pick<Exercise, 'id' | 'distanceUnit'> | undefined, units: Units): DistUnit {
  return ex?.distanceUnit ?? (ex && METRE_PRESETS.has(ex.id) ? 'm' : units.distance);
}

/** Units for one exercise: its distance unit, with pace per 500 m (100 m for swimming) or per 100 yd. */
export function unitsFor(ex: Pick<Exercise, 'id' | 'name' | 'distanceUnit'> | undefined, units: Units): Units {
  const distance = distUnitFor(ex, units);
  const paceEvery = distance === 'm' ? (ex && isSwim(ex) ? 100 : 500) : distance === 'yd' ? 100 : 1;
  return { ...units, distance, paceEvery };
}

/** "/km", "/500m", "/100yd". */
export const paceUnit = (u: Units) => `/${(u.paceEvery ?? 1) > 1 ? u.paceEvery : ''}${u.distance}`;

export function fmtTime(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Parse "90", "1:30" or "1:02:30" into seconds; null if it isn't a time. */
export function parseTime(text: string): number | null {
  const t = text.trim();
  if (!t) return 0;
  if (!/^\d+(:\d{0,2}){0,2}$/.test(t)) return null;
  const parts = t.split(':').map((p) => (p === '' ? 0 : Number(p)));
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** Seconds per pace unit (e.g. per km, or per 500 m); 0 when it can't be worked out. */
export function paceOf(s: AnySet, u: Pick<Units, 'distance' | 'paceEvery'>): number {
  const d = (s.meters ?? 0) / M_PER[u.distance] / (u.paceEvery ?? 1);
  return d > 0 && (s.seconds ?? 0) > 0 ? (s.seconds as number) / d : 0;
}

// ---------- rep ranges (saved workouts) ----------
/** A set's rep target: "10", "6–8" or "12+". */
export function repTarget(s: Pick<TemplateSet, 'reps' | 'repsTo' | 'repsOpen'>): string {
  if (s.repsOpen) return `${s.reps}+`;
  if (s.repsTo && s.repsTo > s.reps) return `${s.reps}–${s.repsTo}`;
  return String(s.reps);
}

/** Read "10", "6-8", "6–8" or "12+" into reps fields; null if it isn't one of those. */
export function parseRepTarget(text: string): Pick<TemplateSet, 'reps' | 'repsTo' | 'repsOpen'> | null {
  const t = text.trim().replace(/\s+/g, '');
  if (t === '') return { reps: 0 };
  let m = /^(\d{1,3})\+$/.exec(t);
  if (m) return { reps: Number(m[1]), repsOpen: true };
  m = /^(\d{1,3})[-–](\d{1,3})$/.exec(t);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => x - y);
    return a === b ? { reps: a } : { reps: a, repsTo: b };
  }
  m = /^(\d{1,3})$/.exec(t);
  return m ? { reps: Number(m[1]) } : null;
}

/** True when a set has a rep range ("6–8" or "12+"). */
export const hasRepRange = (s: AnySet) => ('repsOpen' in s && !!s.repsOpen) || ('repsTo' in s && !!s.repsTo && s.repsTo > s.reps);

// ---------- describing a set ----------
export interface SetPart {
  value: string;
  unit?: string;
}

/** A set broken into value/unit parts, e.g. [{72.5,kg},{8,reps}]; rendered by SetText. */
export function setParts(s: AnySet, type: ExerciseType, units: Units): SetPart[] {
  const unit = units.weight;
  const dist = units.distance;
  const n = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (type === 'time') return [{ value: fmtTime(s.seconds ?? 0) }];
  if (type === 'distance') {
    const parts: SetPart[] = [];
    if (s.meters) parts.push({ value: n(toDistDisplay(s.meters, dist)), unit: dist });
    if (s.seconds) parts.push({ value: fmtTime(s.seconds), unit: parts.length ? 'time' : undefined });
    return parts.length ? parts : [{ value: '0', unit: dist }];
  }
  if (type === 'steps') {
    const parts: SetPart[] = [];
    if (s.reps) parts.push({ value: s.reps.toLocaleString(), unit: s.reps === 1 ? 'step' : 'steps' });
    if (s.seconds) parts.push({ value: fmtTime(s.seconds), unit: parts.length ? 'time' : undefined });
    return parts.length ? parts : [{ value: '0', unit: 'steps' }];
  }
  const reps = { value: String(s.reps), unit: s.reps === 1 ? 'rep' : 'reps' };
  if (type === 'weight' && s.weight > 0) return [{ value: n(toDisplay(s.weight, unit)), unit }, reps];
  return [reps];
}

/** Plain-text version, e.g. "72.5 kg × 8" or "5.2 km in 25:10". */
export function setText(s: AnySet, type: ExerciseType, units: Units): string {
  const unit = units.weight;
  if (type === 'time') return fmtTime(s.seconds ?? 0);
  if (type === 'distance') {
    const d = s.meters ? `${toDistDisplay(s.meters, units.distance)} ${units.distance}` : '';
    const t = s.seconds ? fmtTime(s.seconds) : '';
    return d && t ? `${d} in ${t}` : d || t || '—';
  }
  if (type === 'steps') {
    const st = s.reps ? `${s.reps.toLocaleString()} step${s.reps === 1 ? '' : 's'}` : '';
    const t = s.seconds ? fmtTime(s.seconds) : '';
    return st && t ? `${st} in ${t}` : st || t || '—';
  }
  if (type === 'weight' && s.weight > 0) return `${toDisplay(s.weight, unit).toLocaleString()} ${unit} × ${s.reps}`;
  return `${s.reps} reps`;
}

/** How "good" a single set is, for picking the top set. */
export function setScore(s: AnySet, type: ExerciseType): number {
  if (type === 'time') return s.seconds ?? 0;
  if (type === 'distance') return (s.meters ?? 0) * 1e6 + (s.seconds ? 1e6 / s.seconds : 0);
  if (type === 'steps') return s.reps * 1e6 + (s.seconds ?? 0); // most steps, then longest
  if (type === 'reps') return s.reps;
  return e1rm(s) || s.reps / 1000; // bodyweight-style sets in a weight exercise still rank by reps
}

/** Best working set (ties go to the earliest); falls back to all sets if there are only warm-ups. */
export function topSet<T extends AnySet>(sets: T[], type: ExerciseType): T {
  const pool = workingSets(sets).length ? workingSets(sets) : sets;
  return pool.reduce((a, b) => (setScore(b, type) > setScore(a, type) ? b : a));
}

/** "4 sets" or "4 sets + 2 warm-up". */
export function setCountText(sets: AnySet[]): string {
  const w = sets.filter(isWarmup).length;
  const n = sets.length - w;
  return `${n} set${n === 1 ? '' : 's'}${w ? ` + ${w} warm-up` : ''}`;
}

// ---------- progress measures per type ----------
export interface Measure {
  id: string;
  label: string;
  /** Unit shown next to values ('' for none). */
  unitLabel: (units: Units) => string;
  /** Value of one session (working sets only), in display units. */
  value: (sets: AnySet[], units: Units) => number;
  /** Formats a value for axes and labels. */
  format: (v: number) => string;
  /** For pace, a lower number is better. */
  lowerIsBetter?: boolean;
}

const num = (v: number) => (Math.round(v * 10) / 10).toLocaleString();
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : 0);

export const MEASURES: Record<ExerciseType, Measure[]> = {
  weight: [
    { id: 'e1rm', label: 'Est. 1RM', unitLabel: (u) => u.weight, value: (s, u) => toDisplay(max(workingSets(s).map(e1rm)), u.weight), format: num },
    { id: 'max', label: 'Heaviest set', unitLabel: (u) => u.weight, value: (s, u) => toDisplay(max(workingSets(s).map((x) => x.weight)), u.weight), format: num },
    { id: 'volume', label: 'Volume', unitLabel: (u) => u.weight, value: (s, u) => toDisplay(sum(workingSets(s).map((x) => x.weight * x.reps)), u.weight), format: num },
  ],
  reps: [
    { id: 'maxReps', label: 'Most reps', unitLabel: () => 'reps', value: (s) => max(workingSets(s).map((x) => x.reps)), format: num },
    { id: 'totalReps', label: 'Total reps', unitLabel: () => 'reps', value: (s) => sum(workingSets(s).map((x) => x.reps)), format: num },
  ],
  time: [
    { id: 'longest', label: 'Longest set', unitLabel: () => '', value: (s) => max(workingSets(s).map((x) => x.seconds ?? 0)), format: fmtTime },
    { id: 'totalTime', label: 'Total time', unitLabel: () => '', value: (s) => sum(workingSets(s).map((x) => x.seconds ?? 0)), format: fmtTime },
  ],
  distance: [
    { id: 'distance', label: 'Distance', unitLabel: (u) => u.distance, value: (s, u) => toDistDisplay(sum(workingSets(s).map((x) => x.meters ?? 0)), u.distance), format: (v) => (Math.round(v * 100) / 100).toLocaleString() },
    {
      id: 'pace', label: 'Pace', unitLabel: paceUnit, lowerIsBetter: true,
      value: (s, u) => {
        const w = workingSets(s);
        return paceOf({ weight: 0, reps: 0, meters: sum(w.map((x) => x.meters ?? 0)), seconds: sum(w.map((x) => x.seconds ?? 0)) }, u);
      },
      format: fmtTime,
    },
    { id: 'duration', label: 'Time', unitLabel: () => '', value: (s) => sum(workingSets(s).map((x) => x.seconds ?? 0)), format: fmtTime },
  ],
  steps: [
    { id: 'steps', label: 'Steps', unitLabel: () => 'steps', value: (s) => sum(workingSets(s).map((x) => x.reps)), format: (v) => Math.round(v).toLocaleString() },
    {
      id: 'stepRate', label: 'Steps per min', unitLabel: () => '/min',
      value: (s) => {
        const w = workingSets(s).filter((x) => x.reps > 0 && (x.seconds ?? 0) > 0);
        const t = sum(w.map((x) => x.seconds ?? 0));
        return t > 0 ? sum(w.map((x) => x.reps)) / (t / 60) : 0;
      },
      format: (v) => Math.round(v).toLocaleString(),
    },
    { id: 'duration', label: 'Time', unitLabel: () => '', value: (s) => sum(workingSets(s).map((x) => x.seconds ?? 0)), format: fmtTime },
  ],
};

// ---------- rest times ----------
export const REST_OPTIONS = [0, 30, 60, 90, 120, 180, 300];
export const DEFAULT_REST_SECONDS = 90;

/** "Off", "30s", "1 min", "1 min 30s"; short form uses "1:30". */
export function restLabel(sec: number, short = false): string {
  if (sec === 0) return 'Off';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (s) return short ? `${m}:${String(s).padStart(2, '0')}` : `${m} min ${s}s`;
  return `${m} min`;
}
