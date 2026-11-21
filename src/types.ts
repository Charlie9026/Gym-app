export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Core'
  | 'Full Body'
  | 'Cardio'
  | 'Other';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
  'Full Body',
  'Cardio',
  'Other',
];

/**
 * How an exercise is logged:
 * - weight: weight × reps (e.g. Bench Press)
 * - reps: reps only, bodyweight (e.g. Push-Up)
 * - time: a duration (e.g. Plank)
 * - distance: distance and time (e.g. Running)
 */
export type ExerciseType = 'weight' | 'reps' | 'time' | 'distance';

export interface Exercise {
  id: string;
  name: string;
  muscle: MuscleGroup;
  custom?: boolean;
  /** Defaults to 'weight' when missing (older data). */
  type?: ExerciseType;
  /** Rest after a set of this exercise, in seconds; falls back to the app setting. */
  restSeconds?: number;
}

/** Warm-up sets are excluded from volume, PRs and progress. Missing = working set. */
export type SetKind = 'warmup';

/** Weight is always stored in kilograms and distance in metres; converted for display. */
export interface SetEntry {
  weight: number;
  reps: number;
  done: boolean;
  seconds?: number;
  meters?: number;
  kind?: SetKind;
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
  /** Saved workout this session was started from, if any */
  templateId?: string;
}

/** A target set in a saved workout. Weight in kg. */
export interface TemplateSet {
  weight: number;
  reps: number;
  seconds?: number;
  meters?: number;
  kind?: SetKind;
}

export interface TemplateExercise {
  exerciseId: string;
  sets: TemplateSet[];
}

/** A saved, reusable workout ("My workouts"). */
export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  createdAt: string;
  updatedAt: string;
}

export type Unit = 'kg' | 'lb';

export interface Settings {
  unit: Unit;
  /** Colour theme id from themes.ts */
  theme?: string;
  /** Rest timer length after ticking a set, in seconds; 0 turns it off. */
  restSeconds?: number;
  /** Play a chime when rest ends (default on). */
  restSound?: boolean;
  /** Show a system notification when rest ends, where the browser allows it. */
  restNotify?: boolean;
}

export interface AppData {
  version: 1;
  exercises: Exercise[];
  workouts: Workout[];
  templates: WorkoutTemplate[];
  activeWorkout: Workout | null;
  settings: Settings;
}
