import type { SetEntry, Unit, Workout } from './types';

const LB_PER_KG = 2.20462;

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function toDisplay(kg: number, unit: Unit): number {
  const v = unit === 'kg' ? kg : kg * LB_PER_KG;
  return Math.round(v * 10) / 10;
}

export function fromDisplay(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value / LB_PER_KG;
}

export function fmtWeight(kg: number, unit: Unit): string {
  return `${toDisplay(kg, unit).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`;
}

/** Estimated one-rep max (Epley formula). */
export function e1rm(set: Pick<SetEntry, 'weight' | 'reps'>): number {
  if (set.reps <= 0 || set.weight <= 0) return 0;
  if (set.reps === 1) return set.weight;
  return set.weight * (1 + set.reps / 30);
}

/** Sets ticked off that hold a value (reps, time or distance). */
export function completedSets(sets: SetEntry[]): SetEntry[] {
  return sets.filter((s) => s.done && (s.reps > 0 || (s.seconds ?? 0) > 0 || (s.meters ?? 0) > 0));
}

/** Total weight lifted (weight × reps), counting working sets only. */
export function workoutVolume(w: Workout): number {
  return w.exercises.reduce(
    (sum, ex) =>
      sum +
      completedSets(ex.sets)
        .filter((set) => set.kind !== 'warmup')
        .reduce((s, set) => s + set.weight * set.reps, 0),
    0,
  );
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fmtDuration(startIso: string, endIso?: string): string {
  if (!endIso) return '';
  const mins = Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function defaultWorkoutName(date = new Date()): string {
  const h = date.getHours();
  const part = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  return `${part} Workout`;
}
