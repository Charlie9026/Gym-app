import { describe, expect, it } from 'vitest';
import { MAX_WEEK_POINTS, checkName, cleanCode, consistency, newFriendCode, publicEntry, strength, tierFor, weekId } from './leaderboard';
import { PRESET_EXERCISES } from './exercises';
import type { Exercise, SetEntry, Workout } from './types';

const exById = new Map<string, Exercise>(PRESET_EXERCISES.map((e) => [e.id, e]));
const set = (p: Partial<SetEntry>): SetEntry => ({ weight: 0, reps: 0, done: true, ...p });
let n = 0;
/** A workout on a local date: `sets` working sets of bench press. */
const lift = (y: number, m: number, d: number, sets = 3, weight = 60, reps = 8): Workout => ({
  id: 'w' + n++, name: 'W', notes: '', date: new Date(y, m - 1, d, 18).toISOString(),
  exercises: [{ exerciseId: 'preset-bench-press', sets: Array.from({ length: sets }, () => set({ weight, reps })) }],
});
const NOW = new Date(2026, 10, 22, 20); // Sunday 22 Nov 2026 (week 2026-W47)

describe('weeks', () => {
  it('uses ISO week ids, Monday to Sunday', () => {
    expect(weekId(new Date(2026, 10, 16))).toBe('2026-W47'); // Monday
    expect(weekId(new Date(2026, 10, 22))).toBe('2026-W47'); // Sunday
    expect(weekId(new Date(2026, 10, 23))).toBe('2026-W48');
    expect(weekId(new Date(2027, 0, 1))).toBe('2026-W53'); // early January can belong to the last week of the year before
    expect(weekId(new Date(2025, 11, 29))).toBe('2026-W01');
  });
});

describe('consistency points', () => {
  it('scores days trained (once a day), full days and the weekly goal', () => {
    const w = [
      lift(2026, 11, 16, 10), // full day: 10 + 5
      lift(2026, 11, 16, 3), // a second workout the same day doesn't count again
      lift(2026, 11, 18, 3), // 10
      lift(2026, 11, 20, 3), // 10, and the goal of 3 days is reached: +25
    ];
    const c = consistency(w, exById, 3, NOW);
    expect(c).toMatchObject({ weekId: '2026-W47', points: 60, daysThisWeek: 3, streak: 1, goal: 3 });
  });
  it('counts 20 minutes of cardio as a full day', () => {
    const run = { ...lift(2026, 11, 17, 0), exercises: [{ exerciseId: 'preset-running', sets: [set({ meters: 5000, seconds: 1500 })] }] };
    expect(consistency([run], exById, 3, NOW).points).toBe(15);
  });
  it('adds 5% per week in a row the goal was reached before, up to 50%', () => {
    const weeks = (count: number) =>
      Array.from({ length: count }, (_, i) => [0, 2, 4].map((d) => lift(2026, 11, 16 - 7 * i + d))).flat(); // 3 days a week
    expect(consistency(weeks(1), exById, 3, NOW).points).toBe(55);
    expect(consistency(weeks(3), exById, 3, NOW).points).toBe(Math.round(55 * 1.1));
    expect(consistency(weeks(30), exById, 3, NOW).points).toBe(Math.round(55 * 1.5));
    expect(consistency(weeks(30), exById, 3, NOW).streak).toBe(30);
  });
  it('ranks by the last 4 weeks', () => {
    expect(tierFor(0).tier.id).toBe('bronze');
    expect(tierFor(79).next?.id).toBe('silver');
    expect(tierFor(180).tier.id).toBe('gold');
    expect(tierFor(10_000).tier.id).toBe('diamond');
    expect(tierFor(10_000).next).toBeNull();
  });
  it('can never go over the most a week can score', () => {
    const everyDay = Array.from({ length: 7 * 30 }, (_, i) => lift(2026, 11, 22 - i, 12));
    const c = consistency(everyDay, exById, 3, NOW);
    expect(c.points).toBe(MAX_WEEK_POINTS);
    expect(MAX_WEEK_POINTS).toBe(195);
  });
});

describe('strength', () => {
  it('adds the best squat, bench and deadlift and divides by body weight', () => {
    const w = [
      { ...lift(2026, 11, 20), exercises: [
        { exerciseId: 'preset-squat', sets: [set({ weight: 120, reps: 1 }), set({ weight: 100, reps: 5 })] }, // best: 120 (1 rep) vs 116.7
        { exerciseId: 'preset-bench-press', sets: [set({ weight: 80, reps: 1 }), set({ weight: 200, reps: 20 })] }, // 20 reps don't count
        { exerciseId: 'preset-deadlift', sets: [set({ weight: 160, reps: 1, kind: 'warmup' }), set({ weight: 150, reps: 1 })] }, // warm-ups don't count
      ] },
    ];
    expect(strength(w, 80, NOW)).toEqual({ score: Math.round(((120 + 80 + 150) / 80) * 100), ratios: { squat: 1.5, bench: 1, deadlift: 1.88 } });
  });
  it('only counts the last 90 days, and needs a body weight', () => {
    const old = { ...lift(2026, 6, 1), exercises: [{ exerciseId: 'preset-squat', sets: [set({ weight: 200, reps: 1 })] }] };
    expect(strength([old], 80, NOW)?.score).toBe(0);
    expect(strength([old], undefined, NOW)).toBeNull();
  });
});

describe('names and codes', () => {
  it('accepts friendly nicknames only', () => {
    expect(checkName('  Big   Lifter ')).toEqual({ ok: true, name: 'Big Lifter' });
    expect(checkName('Zoë_99')).toMatchObject({ ok: true });
    expect(checkName('a')).toMatchObject({ ok: false });
    expect(checkName('x'.repeat(21))).toMatchObject({ ok: false });
    expect(checkName('<script>')).toMatchObject({ ok: false });
    expect(checkName('sh.it head')).toEqual({ ok: false, reason: 'Please pick a friendlier name.' });
  });
  it('makes and reads friend codes', () => {
    const code = newFriendCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(cleanCode(` ${code.toLowerCase().slice(0, 3)} ${code.slice(3)} `)).toBe(code);
    expect(cleanCode('ABC10O')).toBeNull(); // 0, 1 and O are never used
    expect(cleanCode('ABC')).toBeNull();
  });
});

describe('public entry', () => {
  it('shares points, rank and strength ratios, never body weight or weights', () => {
    const e = publicEntry([lift(2026, 11, 20, 3, 100, 5)], exById, { name: 'Sam', code: 'ABCDEF', goal: 3, bodyKg: 80 }, NOW);
    expect(Object.keys(e).sort()).toEqual(['code', 'last4', 'name', 'points', 'ratios', 'streak', 'strength', 'tier', 'weekId']);
    expect(JSON.stringify(e)).not.toContain('80'); // body weight isn't in it
    expect(e).toMatchObject({ name: 'Sam', weekId: '2026-W47', points: 10, tier: 'bronze', ratios: { squat: 0, bench: 1.46, deadlift: 0 } });
  });
});
