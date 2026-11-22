import { describe, expect, it } from 'vitest';
import { loadLabel, muscleLoad } from './muscles';
import { PRESET_EXERCISES } from './exercises';
import type { Exercise, SetEntry } from './types';

const exById = new Map<string, Exercise>(PRESET_EXERCISES.map((e) => [e.id, e]));
const sets = (n: number, warmups = 0): SetEntry[] => [
  ...Array.from({ length: warmups }, () => ({ weight: 20, reps: 10, done: true, kind: 'warmup' as const })),
  ...Array.from({ length: n }, () => ({ weight: 60, reps: 8, done: true })),
];

describe('muscle load', () => {
  it('scales by working sets, with half credit for helper muscles', () => {
    const load = muscleLoad([
      { exerciseId: 'preset-bench-press', sets: sets(4, 2) }, // warm-ups don't count
      { exerciseId: 'preset-dumbbell-curl', sets: sets(2) },
    ], exById);
    expect(load.Chest).toBe(1);
    expect(load.Triceps).toBe(0.5); // 4 sets × ½ from bench press
    expect(load.Shoulders).toBe(0.5);
    expect(load.Biceps).toBe(0.5);
    expect(load.Quads).toBeUndefined();
  });
  it('spreads full body and cardio over the big muscles, and ignores unknown exercises', () => {
    const load = muscleLoad([
      { exerciseId: 'preset-running', sets: sets(1) },
      { exerciseId: 'gone', sets: sets(3) },
    ], exById);
    expect(Object.keys(load).sort()).toEqual(['Calves', 'Glutes', 'Hamstrings', 'Quads']);
    expect(muscleLoad([], exById)).toEqual({});
  });
  it('describes the main muscles for screen readers', () => {
    expect(loadLabel({ Chest: 1, Triceps: 0.5, Biceps: 0.2 })).toBe('Body diagram: works chest and triceps');
    expect(loadLabel({})).toBe('Body diagram: no muscles highlighted');
  });
});
