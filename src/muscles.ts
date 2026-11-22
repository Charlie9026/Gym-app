/**
 * How much a workout works each muscle group, for the body diagram. Counts
 * working sets (warm-ups left out) for each exercise's muscle group, plus half a
 * set for the helper muscles of big compound lifts (bench press also works
 * triceps and shoulders). Scaled so the most-worked muscle is 1.
 */
import type { Exercise, MuscleGroup } from './types';
import type { AnySet } from './sets';
import type { MuscleLoad } from './components/BodyMap';

/** Helper muscles for compound presets. */
const HELPERS: Record<string, MuscleGroup[]> = {
  'preset-bench-press': ['Triceps', 'Shoulders'],
  'preset-incline-bench-press': ['Shoulders', 'Triceps'],
  'preset-dumbbell-bench-press': ['Triceps', 'Shoulders'],
  'preset-incline-dumbbell-press': ['Shoulders', 'Triceps'],
  'preset-push-up': ['Triceps', 'Shoulders', 'Core'],
  'preset-dips': ['Triceps', 'Shoulders'],
  'preset-close-grip-bench-press': ['Chest', 'Shoulders'],
  'preset-overhead-press': ['Triceps', 'Core'],
  'preset-dumbbell-shoulder-press': ['Triceps'],
  'preset-pike-push-up': ['Triceps', 'Chest'],
  'preset-deadlift': ['Hamstrings', 'Glutes', 'Quads'],
  'preset-barbell-row': ['Biceps', 'Shoulders'],
  'preset-dumbbell-row': ['Biceps', 'Shoulders'],
  'preset-seated-cable-row': ['Biceps', 'Shoulders'],
  'preset-inverted-row': ['Biceps', 'Shoulders'],
  'preset-lat-pulldown': ['Biceps'],
  'preset-pull-up': ['Biceps'],
  'preset-chin-up': ['Biceps'],
  'preset-squat': ['Glutes', 'Hamstrings', 'Core'],
  'preset-front-squat': ['Glutes', 'Core'],
  'preset-hack-squat': ['Glutes'],
  'preset-leg-press': ['Glutes', 'Hamstrings'],
  'preset-goblet-squat': ['Glutes', 'Core'],
  'preset-bodyweight-squat': ['Glutes'],
  'preset-lunge': ['Glutes', 'Hamstrings'],
  'preset-bulgarian-split-squat': ['Glutes', 'Hamstrings'],
  'preset-romanian-deadlift': ['Glutes', 'Back'],
  'preset-dumbbell-romanian-deadlift': ['Glutes', 'Back'],
  'preset-good-morning': ['Glutes', 'Back'],
  'preset-hip-thrust': ['Hamstrings'],
  'preset-glute-bridge': ['Hamstrings'],
  'preset-face-pull': ['Back'],
  'preset-rear-delt-fly': ['Back'],
  'preset-kettlebell-swing': ['Glutes', 'Hamstrings', 'Core'],
  'preset-clean': ['Quads', 'Glutes', 'Back', 'Shoulders'],
  'preset-burpee': ['Chest', 'Quads', 'Core'],
};

/** What "Full Body" and "Cardio" exercises count towards. */
const SPREAD: Partial<Record<MuscleGroup, MuscleGroup[]>> = {
  'Full Body': ['Quads', 'Glutes', 'Hamstrings', 'Back', 'Chest', 'Shoulders', 'Core'],
  Cardio: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
};

/** The diagram's muscle groups (Full Body, Cardio and Other have no single spot). */
export const MAPPED: MuscleGroup[] = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Quads', 'Hamstrings', 'Glutes', 'Calves'];

export function muscleLoad(exercises: { exerciseId: string; sets: AnySet[] }[], exById: Map<string, Exercise>): MuscleLoad {
  const raw: MuscleLoad = {};
  const add = (m: MuscleGroup, n: number) => (raw[m] = (raw[m] ?? 0) + n);
  for (const ex of exercises) {
    const info = exById.get(ex.exerciseId);
    if (!info) continue;
    const sets = ex.sets.filter((s) => s.kind !== 'warmup').length || ex.sets.length;
    if (!sets) continue;
    const spread = SPREAD[info.muscle];
    if (spread) spread.forEach((m) => add(m, sets * 0.5));
    else if (MAPPED.includes(info.muscle)) add(info.muscle, sets);
    for (const h of HELPERS[info.id] ?? []) add(h, sets * 0.5);
  }
  const top = Math.max(0, ...Object.values(raw).map((v) => v ?? 0));
  if (!top) return {};
  return Object.fromEntries(Object.entries(raw).map(([m, v]) => [m, (v ?? 0) / top])) as MuscleLoad;
}

/** "Works chest, triceps and shoulders" (main muscles first), for screen readers. */
export function loadLabel(load: MuscleLoad): string {
  const main = (Object.entries(load) as [MuscleGroup, number][])
    .filter(([, v]) => v >= 0.5)
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m.toLowerCase());
  if (!main.length) return 'Body diagram: no muscles highlighted';
  const list = main.length === 1 ? main[0] : `${main.slice(0, -1).join(', ')} and ${main[main.length - 1]}`;
  return `Body diagram: works ${list}`;
}
