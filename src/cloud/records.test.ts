import { describe, expect, it } from 'vitest';
import { applyRecords, diffRecords, mergePlan, recordFor, recordsOf } from './records';
import { emptyData } from '../store';
import type { AppData, Workout } from '../types';

const w = (id: string, date: string, weight = 100): Workout => ({
  id,
  date,
  name: id,
  notes: '',
  exercises: [{ exerciseId: 'preset-squat', sets: [{ weight, reps: 5, done: true }] }],
});
const data = (workouts: Workout[]): AppData => ({ ...emptyData(), workouts });

describe('records', () => {
  it('splits data into per-workout, per-template, exercises and settings records (not the active workout)', () => {
    const d = { ...data([w('a', '2026-11-01T00:00:00Z')]), activeWorkout: w('live', '2026-11-21T00:00:00Z') };
    expect([...recordsOf(d).keys()].sort()).toEqual(['exercises', 'settings', 'workout:a']);
  });
  it('finds what changed and what was deleted', () => {
    const a = data([w('a', '2026-11-01T00:00:00Z'), w('b', '2026-11-02T00:00:00Z')]);
    const b = data([w('a', '2026-11-01T00:00:00Z', 105), w('c', '2026-11-03T00:00:00Z')]);
    expect(diffRecords(a, b)).toEqual({ changed: ['workout:a', 'workout:c'], removed: ['workout:b'] });
    expect(diffRecords(a, a)).toEqual({ changed: [], removed: [] });
  });
  it('applies cloud records, keeping workouts in date order, and handles deletes', () => {
    const d = data([w('b', '2026-11-02T00:00:00Z')]);
    const next = applyRecords(d, [
      { key: 'workout:a', json: JSON.stringify(w('a', '2026-11-01T00:00:00Z')) },
      { key: 'workout:b', json: null },
      { key: 'settings', json: JSON.stringify({ unit: 'lb' }) },
    ]);
    expect(next.workouts.map((x) => x.id)).toEqual(['a']);
    expect(next.settings.unit).toBe('lb');
  });
  it('gives null (a deleted marker) for a record that no longer exists', () => {
    expect(recordFor(data([]), 'workout:gone')).toBeNull();
  });
});

describe('first sync on a device (merge)', () => {
  const remoteA = { key: 'workout:a', json: JSON.stringify(w('a', '2026-11-01T00:00:00Z', 110)), updatedAt: 2000 };
  it('takes newer cloud records and sends records the cloud lacks', () => {
    const local = data([w('a', '2026-11-01T00:00:00Z', 100), w('mine', '2026-11-05T00:00:00Z')]);
    const plan = mergePlan(local, { 'workout:a': 1000 }, [remoteA]);
    expect(plan.pull.map((r) => r.key)).toEqual(['workout:a']);
    expect(plan.push).toContain('workout:mine');
    expect(plan.push).not.toContain('workout:a');
  });
  it('keeps a local change that is newer than the cloud copy', () => {
    const local = data([w('a', '2026-11-01T00:00:00Z', 120)]);
    const plan = mergePlan(local, { 'workout:a': 3000 }, [remoteA]);
    expect(plan.pull).toEqual([]);
    expect(plan.push).toContain('workout:a');
  });
  it('lets the cloud win over data from before sync was turned on', () => {
    const local = data([w('a', '2026-11-01T00:00:00Z', 100)]);
    expect(mergePlan(local, {}, [remoteA]).pull.map((r) => r.key)).toEqual(['workout:a']);
  });
  it('respects deletes in both directions', () => {
    // deleted in the cloud after our last change → pull the delete
    const local = data([w('a', '2026-11-01T00:00:00Z')]);
    expect(mergePlan(local, { 'workout:a': 1000 }, [{ key: 'workout:a', json: null, updatedAt: 2000 }]).pull).toHaveLength(1);
    // we deleted it after the cloud's copy → push our delete
    const plan = mergePlan(data([]), { 'workout:a': 3000 }, [remoteA]);
    expect(plan.push).toContain('workout:a');
    expect(plan.pull).toEqual([]);
  });
  it('skips records that are already identical', () => {
    const local = data([w('a', '2026-11-01T00:00:00Z', 110)]);
    const plan = mergePlan(local, {}, [remoteA, { key: 'settings', json: JSON.stringify(local.settings), updatedAt: 1 }, { key: 'exercises', json: JSON.stringify(local.exercises), updatedAt: 1 }]);
    expect(plan.pull).toEqual([]);
    expect(plan.push).toEqual([]);
  });
});
