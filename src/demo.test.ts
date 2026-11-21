import { describe, expect, it } from 'vitest';
import { addDemoWeek, hasDemoData, removeDemoWeek } from './demo';
import { emptyData } from './store';

describe('sample week', () => {
  const d = addDemoWeek(emptyData());
  it('adds six workouts over seven days with Thursday off, and three saved workouts', () => {
    expect(d.workouts).toHaveLength(6);
    expect(d.workouts.some((w) => new Date(w.date).getDay() === 4)).toBe(false);
    expect(d.templates.map((t) => t.name)).toEqual(['Chest and arms day', 'Back and shoulders day', 'Leg day']);
    expect(hasDemoData(d)).toBe(true);
  });
  it('includes warm-ups, a timed and a reps-only exercise', () => {
    const sets = d.workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets));
    expect(sets.some((s) => s.kind === 'warmup')).toBe(true);
    expect(sets.some((s) => (s.seconds ?? 0) > 0)).toBe(true);
    expect(d.workouts.some((w) => w.exercises.some((e) => e.exerciseId === 'preset-pull-up'))).toBe(true);
  });
  it('is removed cleanly, keeping the user’s own workouts', () => {
    const mine = { ...d, workouts: [...d.workouts, { id: 'mine', date: new Date().toISOString(), name: 'Mine', notes: '', exercises: [] }] };
    const r = removeDemoWeek(mine);
    expect(r.workouts.map((w) => w.id)).toEqual(['mine']);
    expect(r.templates).toHaveLength(0);
    expect(hasDemoData(r)).toBe(false);
  });
});
