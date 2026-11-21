import type { Workout } from './types';
import { defaultWorkoutName, uid } from './utils';

export function newWorkoutFrom(template?: Workout): Workout {
  return {
    id: uid(),
    date: new Date().toISOString(),
    name: template?.name ?? defaultWorkoutName(),
    notes: '',
    exercises:
      template?.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets.map((s) => ({ ...s, done: false })),
      })) ?? [],
  };
}
