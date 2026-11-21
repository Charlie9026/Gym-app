import type { TemplateExercise, Workout, WorkoutTemplate } from './types';
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
