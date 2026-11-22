import { describe, expect, it } from 'vitest';
import { afterSetRemoved, cancelStopwatch, startStopwatch, stopStopwatch, stopwatchTarget } from './stopwatch';
import type { SetEntry, Workout } from './types';

const set = (p: Partial<SetEntry> = {}): SetEntry => ({ weight: 0, reps: 0, done: false, ...p });
const w = (sets: SetEntry[]): Workout => ({
  id: 'w', name: 'W', notes: '', date: '2026-11-22T10:00:00Z',
  exercises: [{ exerciseId: 'preset-squat', sets: [set({ weight: 100, reps: 5, done: true })] }, { exerciseId: 'preset-air-bike', sets }],
});

describe('stopwatch', () => {
  it('times the first set not done, and stopping fills its time and ticks it', () => {
    const started = startStopwatch(w([set({ seconds: 300, done: true }), set(), set()]), 1, 1000);
    expect(started.stopwatch).toEqual({ exerciseId: 'preset-air-bike', setIndex: 1, startedAt: 1000 });
    const stopped = stopStopwatch(started, 1000 + 754_400);
    expect(stopped.stopwatch).toBeUndefined();
    expect(stopped.exercises[1].sets[1]).toMatchObject({ seconds: 754, done: true });
    expect(stopped.exercises[1].sets[2].done).toBe(false);
  });
  it('adds a set when every set is done', () => {
    const started = startStopwatch(w([set({ seconds: 300, done: true })]), 1, 0);
    expect(started.exercises[1].sets).toHaveLength(2);
    expect(started.stopwatch?.setIndex).toBe(1);
  });
  it('keeps pointing at the right set when the exercise moves or a set above is removed', () => {
    const started = startStopwatch(w([set({ done: true, seconds: 60 }), set(), set()]), 1, 0);
    const moved = { ...started, exercises: [...started.exercises].reverse() };
    expect(stopwatchTarget(moved)).toEqual({ exIdx: 0, setIdx: 1 });
    expect(afterSetRemoved(started, 'preset-air-bike', 0).stopwatch?.setIndex).toBe(0);
    expect(afterSetRemoved(started, 'preset-air-bike', 2).stopwatch?.setIndex).toBe(1);
    expect(afterSetRemoved(started, 'preset-air-bike', 1).stopwatch).toBeUndefined();
    expect(afterSetRemoved(started, 'preset-squat', 0)).toBe(started);
  });
  it('cancelling leaves the sets alone', () => {
    const started = startStopwatch(w([set()]), 1, 0);
    const cancelled = cancelStopwatch(started);
    expect(cancelled.stopwatch).toBeUndefined();
    expect(cancelled.exercises[1].sets[0]).toEqual(set());
  });
});
