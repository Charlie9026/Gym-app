import { describe, expect, it } from 'vitest';
import { emptyData, isAppData, migrate } from './store';
import type { AppData } from './types';

const base = (): AppData => ({ ...emptyData(), exercises: [] });

describe('migrate', () => {
  it('splits old Arms and Legs groups (presets by id, custom exercises by name)', () => {
    const d = migrate({
      ...base(),
      exercises: [
        { id: 'preset-barbell-curl', name: 'Barbell Curl', muscle: 'Arms' as never },
        { id: 'c1', name: 'Cable Kickback', muscle: 'Arms' as never, custom: true },
        { id: 'c2', name: 'Spider Curl', muscle: 'Arms' as never, custom: true },
        { id: 'preset-leg-curl', name: 'Leg Curl', muscle: 'Legs' as never },
        { id: 'c3', name: 'Donkey Calf Raise', muscle: 'Legs' as never, custom: true },
        { id: 'c4', name: 'Sissy Squat', muscle: 'Legs' as never, custom: true },
      ],
    });
    const m = (id: string) => d.exercises.find((e) => e.id === id)?.muscle;
    expect([m('preset-barbell-curl'), m('c1'), m('c2')]).toEqual(['Biceps', 'Triceps', 'Biceps']);
    expect([m('preset-leg-curl'), m('c3'), m('c4')]).toEqual(['Hamstrings', 'Calves', 'Quads']);
  });
  it('gives presets saved before exercise types their type', () => {
    const d = migrate({ ...base(), exercises: [{ id: 'preset-plank', name: 'Plank', muscle: 'Core' }] });
    expect(d.exercises.find((e) => e.id === 'preset-plank')?.type).toBe('time');
  });
  it('adds presets that are missing and keeps custom exercises', () => {
    const d = migrate({ ...base(), exercises: [{ id: 'mine', name: 'Mine', muscle: 'Other', custom: true }] });
    expect(d.exercises.some((e) => e.id === 'mine')).toBe(true);
    expect(d.exercises.some((e) => e.id === 'preset-running' && e.type === 'distance')).toBe(true);
  });
  it('sorts workouts by date', () => {
    const w = (id: string, date: string) => ({ id, date, name: id, notes: '', exercises: [] });
    const d = migrate({ ...base(), workouts: [w('b', '2026-11-20T00:00:00Z'), w('a', '2026-11-10T00:00:00Z')] });
    expect(d.workouts.map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('isAppData', () => {
  it('accepts a backup and rejects other JSON', () => {
    expect(isAppData(emptyData())).toBe(true);
    expect(isAppData({ hello: 1 })).toBe(false);
    expect(isAppData(null)).toBe(false);
  });
});
