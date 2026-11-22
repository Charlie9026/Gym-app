import { describe, expect, it } from 'vitest';
import { activityOf, caloriesOn, cardioEstimate, liftSetCalories, workoutCalories } from './calories';
import { PRESET_EXERCISES } from './exercises';
import type { Exercise, SetEntry, Workout } from './types';

const exById = new Map<string, Exercise>(PRESET_EXERCISES.map((e) => [e.id, e]));
const set = (p: Partial<SetEntry>): SetEntry => ({ weight: 0, reps: 0, done: true, ...p });
const workout = (exercises: Workout['exercises'], minutes?: number): Workout => ({
  id: 'w', name: 'W', notes: '', date: '2026-11-20T10:00:00Z', exercises,
  ...(minutes ? { finishedAt: new Date(Date.parse('2026-11-20T10:00:00Z') + minutes * 60000).toISOString() } : {}),
});

describe('calories', () => {
  it('estimates a 5 km run in 25 minutes for 70 kg at about 380 kcal (ACSM)', () => {
    const w = workout([{ exerciseId: 'preset-running', sets: [set({ meters: 5000, seconds: 1500 })] }]);
    // 12 km/h = 200 m/min → (3.5 + 40) / 3.5 = 12.4 MET × 70 kg × 25/60 h
    expect(workoutCalories(w, exById, 70).total).toBe(Math.round(((3.5 + 40) / 3.5) * 70 * (25 / 60)));
  });
  it('uses a typical speed when only a distance is logged', () => {
    const w = workout([{ exerciseId: 'preset-walking', sets: [set({ meters: 5000 })] }]);
    // 5 km at 5 km/h = 1 hour
    expect(workoutCalories(w, exById, 80).total).toBe(Math.round(((3.5 + 0.1 * (5000 / 60)) / 3.5) * 80));
  });
  it('estimates lifting from each set: more weight or more reps always burns more', () => {
    const bench = (sets: Partial<SetEntry>[], minutes: number) =>
      workoutCalories(workout([{ exerciseId: 'preset-bench-press', sets: sets.map(set) }], minutes), exById, 75).byExercise[0];
    const light = bench([{ weight: 70, reps: 8 }, { weight: 70, reps: 8 }, { weight: 70, reps: 8 }, { weight: 70, reps: 7 }], 60);
    const heavier = bench([{ weight: 72.5, reps: 8 }, { weight: 72.5, reps: 8 }, { weight: 72.5, reps: 8 }, { weight: 72.5, reps: 7 }], 30);
    const moreReps = bench([{ weight: 72.5, reps: 10 }, { weight: 72.5, reps: 9 }, { weight: 72.5, reps: 8 }, { weight: 72.5, reps: 7 }], 10);
    expect(light).toBeLessThan(heavier);
    expect(heavier).toBeLessThan(moreReps);
  });
  it("doesn't depend on how long the workout was open", () => {
    const ex = [{ exerciseId: 'preset-squat', sets: [set({ weight: 100, reps: 5 })] }];
    expect(workoutCalories(workout(ex, 5), exById, 70).total).toBe(workoutCalories(workout(ex, 600), exById, 70).total);
    expect(workoutCalories(workout(ex), exById, 70).total).toBe(workoutCalories(workout(ex, 45), exById, 70).total);
  });
  it('works out a lifting set as its time plus the work done', () => {
    // 2.5 min at MET 3.5 for 80 kg, plus 100 kg × 9.81 × 0.4 m × 5 reps at 20% efficiency.
    expect(liftSetCalories(set({ weight: 100, reps: 5 }), 80)).toBeCloseTo(3.5 * 80 * (2.5 / 60) + (100 * 9.81 * 0.4 * 5) / 0.2 / 4184);
    // Bodyweight sets lift part of your body weight.
    expect(liftSetCalories(set({ reps: 10 }), 80)).toBeCloseTo(3.5 * 80 * (2.5 / 60) + (0.65 * 80 * 9.81 * 0.4 * 10) / 0.2 / 4184);
  });
  it('adds cardio on top of lifting', () => {
    const w = workout([
      { exerciseId: 'preset-squat', sets: [set({ weight: 100, reps: 5 })] },
      { exerciseId: 'preset-exercise-bike', sets: [set({ seconds: 600 })] },
    ], 30);
    const c = workoutCalories(w, exById, 75);
    expect(c.byExercise[0]).toBeCloseTo(liftSetCalories(set({ weight: 100, reps: 5 }), 75));
    expect(c.byExercise[1]).toBeCloseTo(6.8 * 75 * (10 / 60));
    expect(c.estimated).toBe(true);
  });
  it('uses typed-in calories instead of the estimate, even without a body weight', () => {
    const w = workout([
      { exerciseId: 'preset-rowing-machine', sets: [set({ meters: 2000, seconds: 480 })], calories: 150 },
      { exerciseId: 'preset-bench-press', sets: [set({ weight: 60, reps: 10 })] },
    ]);
    expect(workoutCalories(w, exById, undefined)).toEqual({ total: 150, byExercise: [150, 0], estimated: false });
    expect(workoutCalories(w, exById, 70).byExercise[0]).toBe(150);
  });
  it('guesses custom cardio from its name', () => {
    const custom = (name: string, extra: Partial<Exercise> = {}) => activityOf({ id: 'c', name, muscle: 'Cardio', type: 'distance', ...extra });
    expect(custom('Treadmill Run')).toBe('run');
    expect(custom('Incline Treadmill Walk')).toBe('incline');
    expect(custom('Spin Class')).toBe('bike');
    expect(custom('Assault Bike')).toBe('airbike');
    expect(custom('Hollow Hold', { muscle: 'Core', type: 'time' })).toBe('hold');
    expect(custom('Battle Ropes')).toBe('rope');
  });
  it('gives a live estimate for cardio only with a body weight', () => {
    const ex = { exerciseId: 'preset-stair-climber', sets: [set({ seconds: 1200 })] };
    expect(cardioEstimate(ex, exById.get('preset-stair-climber'), undefined)).toBeNull();
    expect(cardioEstimate(ex, exById.get('preset-stair-climber'), 70)).toBe(Math.round(9 * 70 * (20 / 60)));
  });
  it('is on unless switched off', () => {
    expect(caloriesOn({})).toBe(true);
    expect(caloriesOn({ showCalories: false })).toBe(false);
  });
});
