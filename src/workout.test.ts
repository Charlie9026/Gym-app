import { describe, expect, it } from 'vitest';
import { emptyData } from './store';
import { keepRepTargets, lastSetsFor, newTemplate, newWorkoutFrom, startingSets, structureChanged, templateExercisesFrom } from './workout';
import type { Workout } from './types';

const workout: Workout = {
  id: 'w1',
  date: '2026-11-20T10:00:00Z',
  name: 'Legs',
  notes: '',
  exercises: [
    { exerciseId: 'preset-squat', sets: [{ weight: 60, reps: 8, done: true, kind: 'warmup' }, { weight: 100, reps: 5, done: true }] },
    { exerciseId: 'preset-plank', sets: [{ weight: 0, reps: 0, seconds: 60, done: true }] },
  ],
};

describe('starting a workout from a saved one', () => {
  it('starts with empty fields but keeps the set count and warm-ups', () => {
    const t = newTemplate('Legs', templateExercisesFrom(workout));
    const active = newWorkoutFrom(t);
    expect(active.templateId).toBe(t.id);
    expect(active.exercises[0].sets).toEqual([
      { weight: 0, reps: 0, done: false, kind: 'warmup' },
      { weight: 0, reps: 0, done: false },
    ]);
  });
  it('keeps times and distances in saved workouts', () => {
    expect(templateExercisesFrom(workout)[1].sets[0]).toEqual({ weight: 0, reps: 0, seconds: 60 });
  });
});

describe('structureChanged', () => {
  it('ignores weights but notices different exercises or set counts', () => {
    const a = templateExercisesFrom(workout);
    const heavier = a.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, weight: s.weight + 5 })) }));
    expect(structureChanged(a, heavier)).toBe(false);
    expect(structureChanged(a, a.slice(0, 1))).toBe(true);
    expect(structureChanged(a, [{ ...a[0], sets: a[0].sets.slice(1) }, a[1]])).toBe(true);
  });
});

describe('previous sets', () => {
  it('finds the most recent sets for an exercise', () => {
    const older = { ...workout, id: 'w0', exercises: [{ exerciseId: 'preset-squat', sets: [{ weight: 90, reps: 5, done: true }] }] };
    expect(lastSetsFor([older, workout], 'preset-squat')[1].weight).toBe(100);
    expect(lastSetsFor([older, workout], 'preset-bench-press')).toEqual([]);
  });
  it('suggests starting sets by type when there is no history', () => {
    const d = emptyData();
    expect(startingSets(d, 'x', 'weight')).toHaveLength(3);
    expect(startingSets(d, 'x', 'time')[0].seconds).toBe(30);
    expect(startingSets(d, 'x', 'distance')).toHaveLength(1);
  });
});

describe('keepRepTargets', () => {
  it('keeps a saved rep range while today’s weights carry forward', () => {
    const saved = [{ exerciseId: 'preset-squat', sets: [
      { weight: 40, reps: 10, kind: 'warmup' as const },
      { weight: 90, reps: 6, repsTo: 8 },
      { weight: 90, reps: 12, repsOpen: true },
    ] }];
    const today = [{ exerciseId: 'preset-squat', sets: [
      { weight: 50, reps: 10, kind: 'warmup' as const },
      { weight: 100, reps: 7 },
      { weight: 100, reps: 15 },
    ] }];
    expect(keepRepTargets(saved, today)[0].sets).toEqual([
      { weight: 50, reps: 10, kind: 'warmup' }, // no range: today's numbers
      { weight: 100, reps: 6, repsTo: 8 },
      { weight: 100, reps: 12, repsOpen: true },
    ]);
  });
  it('matches working sets in order when the warm-up was skipped', () => {
    const saved = [{ exerciseId: 'preset-squat', sets: [{ weight: 40, reps: 10, kind: 'warmup' as const }, { weight: 90, reps: 6, repsTo: 8 }] }];
    const today = [{ exerciseId: 'preset-squat', sets: [{ weight: 100, reps: 7 }] }];
    expect(keepRepTargets(saved, today)[0].sets).toEqual([{ weight: 100, reps: 6, repsTo: 8 }]);
  });
  it('leaves exercises and sets without a range alone', () => {
    const today = [{ exerciseId: 'preset-bench-press', sets: [{ weight: 60, reps: 9 }] }];
    expect(keepRepTargets([{ exerciseId: 'preset-squat', sets: [{ weight: 1, reps: 6, repsTo: 8 }] }], today)).toEqual(today);
    expect(keepRepTargets([{ exerciseId: 'preset-bench-press', sets: [{ weight: 50, reps: 8 }] }], today)).toEqual(today);
  });
});
