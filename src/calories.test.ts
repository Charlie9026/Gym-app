import { describe, expect, it } from 'vitest';
import { activityOf, caloriesOn, cardioEstimate, workoutCalories } from './calories';
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
  it('shares lifting by sets over the workout time left after cardio', () => {
    const w = workout(
      [
        { exerciseId: 'preset-bench-press', sets: [set({ weight: 80, reps: 8 }), set({ weight: 80, reps: 8 }), set({ weight: 80, reps: 8, done: false })] },
        { exerciseId: 'preset-squat', sets: [set({ weight: 100, reps: 5 }), set({ weight: 100, reps: 5 })] },
        { exerciseId: 'preset-exercise-bike', sets: [set({ seconds: 600 })] },
      ],
      25,
    );
    const c = workoutCalories(w, exById, 75);
    const lifting = 5 * 75 * (15 / 60); // 25 min − 10 min of bike, MET 5
    expect(c.byExercise[0]).toBeCloseTo(lifting / 2);
    expect(c.byExercise[1]).toBeCloseTo(lifting / 2);
    expect(c.byExercise[2]).toBeCloseTo(6.8 * 75 * (10 / 60));
    expect(c.estimated).toBe(true);
  });
  it('keeps lifting time sensible when a workout was left running', () => {
    const w = workout([{ exerciseId: 'preset-squat', sets: [set({ weight: 100, reps: 5 }), set({ weight: 100, reps: 5 })] }], 600);
    expect(workoutCalories(w, exById, 70).total).toBe(Math.round(5 * 70 * (10 / 60))); // capped at 5 min per set
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
