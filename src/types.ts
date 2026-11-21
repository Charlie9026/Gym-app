export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Legs'
  | 'Shoulders'
  | 'Arms'
  | 'Core'
  | 'Full Body'
  | 'Cardio'
  | 'Other';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Full Body',
  'Cardio',
  'Other',
];

export interface Exercise {
  id: string;
  name: string;
  muscle: MuscleGroup;
  custom?: boolean;
}

/** Weight is always stored in kilograms; converted for display. */
export interface SetEntry {
  weight: number;
  reps: number;
  done: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: SetEntry[];
}

export interface Workout {
  id: string;
  /** ISO timestamp of when the workout started */
  date: string;
  name: string;
  notes: string;
  exercises: WorkoutExercise[];
  /** ISO timestamp of when the workout was finished */
  finishedAt?: string;
}

export type Unit = 'kg' | 'lb';

export interface Settings {
  unit: Unit;
  /** Colour theme id from themes.ts */
  theme?: string;
}

export interface AppData {
  version: 1;
  exercises: Exercise[];
  workouts: Workout[];
  activeWorkout: Workout | null;
  settings: Settings;
}
