import { describe, expect, it } from 'vitest';
import { completedSets, e1rm, fmtWeight, fromDisplay, toDisplay, workoutVolume } from './utils';
import type { Workout } from './types';

describe('weights', () => {
  it('converts kg and lb for display, rounded to 0.1', () => {
    expect(toDisplay(100, 'kg')).toBe(100);
    expect(toDisplay(100, 'lb')).toBe(220.5);
    expect(fromDisplay(220.462, 'lb')).toBeCloseTo(100, 2);
    expect(fmtWeight(52270.5, 'kg')).toMatch(/52.?270\.5 kg/);
  });
  it('estimates a one-rep max (Epley)', () => {
    expect(e1rm({ weight: 100, reps: 1 })).toBe(100);
    expect(e1rm({ weight: 100, reps: 6 })).toBe(120);
    expect(e1rm({ weight: 0, reps: 10 })).toBe(0);
  });
});

describe('completed sets and volume', () => {
  const w: Workout = {
    id: 'w',
    date: '2026-11-21T10:00:00Z',
    name: 'Test',
    notes: '',
    exercises: [
      {
        exerciseId: 'preset-squat',
        sets: [
          { weight: 60, reps: 8, done: true, kind: 'warmup' },
          { weight: 100, reps: 5, done: true },
          { weight: 100, reps: 5, done: false },
        ],
      },
      { exerciseId: 'preset-plank', sets: [{ weight: 0, reps: 0, seconds: 60, done: true }] },
    ],
  };
  it('counts ticked sets that have a value of any kind', () => {
    expect(completedSets(w.exercises[0].sets)).toHaveLength(2);
    expect(completedSets(w.exercises[1].sets)).toHaveLength(1);
  });
  it('counts only working, ticked sets in volume', () => {
    expect(workoutVolume(w)).toBe(500);
  });
});
