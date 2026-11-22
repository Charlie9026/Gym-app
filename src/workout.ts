import type { AppData, ExerciseType, SetEntry, TemplateExercise, Workout, WorkoutTemplate } from './types';
import type { AnySet } from './sets';
import { defaultWorkoutName, uid } from './utils';

/** Start a new active workout, optionally pre-filled from a saved workout or a past session. */
export function newWorkoutFrom(source?: WorkoutTemplate | Workout): Workout {
  const isTemplate = !!source && 'createdAt' in source;
  return {
    id: uid(),
    date: new Date().toISOString(),
    name: source?.name ?? defaultWorkoutName(),
    notes: '',
    templateId: isTemplate ? source.id : undefined,
    exercises:
      source?.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        // Start empty: the logger shows the previous numbers as faded hints.
        sets: ex.sets.map((s) => ({ weight: 0, reps: 0, done: false, ...(s.kind ? { kind: s.kind } : {}) })),
      })) ?? [],
  };
}

export function templateExercisesFrom(w: Workout): TemplateExercise[] {
  return w.exercises.map((ex) => ({
    exerciseId: ex.exerciseId,
    sets: ex.sets.map((s) => ({
      weight: s.weight,
      reps: s.reps,
      ...(s.seconds ? { seconds: s.seconds } : {}),
      ...(s.meters ? { meters: s.meters } : {}),
      ...(s.kind ? { kind: s.kind } : {}),
    })),
  }));
}

export function newTemplate(name: string, exercises: TemplateExercise[] = []): WorkoutTemplate {
  const now = new Date().toISOString();
  return { id: 'tpl-' + uid(), name, exercises, createdAt: now, updatedAt: now };
}

/**
 * A saved workout updated from today's sets keeps its rep ranges: where a set
 * had a target like 6–8 or 12+, the target stays and only the weight (and
 * time/distance) carries forward. Sets are matched by exercise, then warm-ups
 * with warm-ups and working sets with working sets, in order (so skipping the
 * warm-up doesn't shift the ranges onto the wrong sets).
 */
export function keepRepTargets(saved: TemplateExercise[], today: TemplateExercise[]): TemplateExercise[] {
  return today.map((ex, i) => {
    const before = saved[i]?.exerciseId === ex.exerciseId ? saved[i] : saved.find((s) => s.exerciseId === ex.exerciseId);
    if (!before) return ex;
    const warm = before.sets.filter((s) => s.kind);
    const work = before.sets.filter((s) => !s.kind);
    let w = 0;
    let k = 0;
    return {
      ...ex,
      sets: ex.sets.map((s) => {
        const old = s.kind ? warm[w++] : work[k++];
        if (!old || (!old.repsTo && !old.repsOpen)) return s;
        return { ...s, reps: old.reps, ...(old.repsTo ? { repsTo: old.repsTo } : {}), ...(old.repsOpen ? { repsOpen: true } : {}) };
      }),
    };
  });
}

/** True when exercise order or set counts differ (weights/reps are ignored). */
export function structureChanged(a: TemplateExercise[], b: TemplateExercise[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((ex, i) => ex.exerciseId !== b[i].exerciseId || ex.sets.length !== b[i].sets.length);
}

export function relativeDay(iso: string): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(new Date(iso))) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** The most recent logged sets for an exercise (for "Previous" and faded hints). */
export function lastSetsFor(workouts: Workout[], exerciseId: string): SetEntry[] {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const ex = workouts[i].exercises.find((e) => e.exerciseId === exerciseId);
    if (ex) return ex.sets;
  }
  return [];
}

/** Starting sets for an exercise added in an editor: last time's sets, or sensible defaults by type. */
export function startingSets(data: AppData, exerciseId: string, type: ExerciseType): AnySet[] {
  const last = lastSetsFor(data.workouts, exerciseId);
  if (last.length) return last.map(({ weight, reps, seconds, meters, kind }) => ({ weight, reps, seconds, meters, kind }));
  if (type === 'time') return [{ weight: 0, reps: 0, seconds: 30 }, { weight: 0, reps: 0, seconds: 30 }];
  if (type === 'distance') return [{ weight: 0, reps: 0, meters: 0, seconds: 0 }];
  if (type === 'steps') return [{ weight: 0, reps: 0, seconds: 0 }];
  const reps = type === 'reps' ? 10 : 8;
  return [0, 1, 2].map(() => ({ weight: 0, reps }));
}
