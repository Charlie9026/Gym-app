import { describe, expect, it } from 'vitest';
import { MAX_STRENGTH, MAX_WEEK_POINTS, STRENGTH_STANDARDS, checkName, cleanCode, consistency, newFriendCode, publicEntry, strength, tierFor, weekId } from './leaderboard';
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
  const session = (exercises: Workout['exercises'], daysAgo = 2): Workout => ({
    id: 'w' + n++, name: 'W', notes: '', date: new Date(NOW.getTime() - daysAgo * 86400000).toISOString(), exercises,
  });
  it('averages your best 3 lifts, each compared to its own standard', () => {
    const w = [session([
      { exerciseId: 'preset-squat', sets: [set({ weight: 120, reps: 1 })] }, // 1.5× / 1.25 → 120
      { exerciseId: 'preset-bench-press', sets: [set({ weight: 80, reps: 1 }), set({ weight: 200, reps: 20 })] }, // 20 reps don't count → 1.0× / 1.0 → 100
      { exerciseId: 'preset-deadlift', sets: [set({ weight: 200, reps: 1, kind: 'warmup' }), set({ weight: 150, reps: 1 })] }, // warm-ups don't count → 1.875 / 1.5 → 125
      { exerciseId: 'preset-overhead-press', sets: [set({ weight: 40, reps: 1 })] }, // 0.5 / 0.65 → 77, not in the best 3
      { exerciseId: 'preset-chest-fly', sets: [set({ weight: 60, reps: 1 })] }, // small single-muscle moves don't count
    ])];
    const s = strength(w, 80, NOW)!;
    expect(s.top.map((l) => [l.id, l.score])).toEqual([['preset-deadlift', 125], ['preset-squat', 120], ['preset-bench-press', 100]]);
    expect(s.score).toBe(Math.round((125 + 120 + 100) / 3));
    expect(s.top[0].ratio).toBe(1.88);
  });
  it('doesn’t let a big machine number win: leg press is compared to a leg press standard', () => {
    const s = strength([session([{ exerciseId: 'preset-leg-press', sets: [set({ weight: 200, reps: 1 })] }])], 80, NOW)!;
    expect(s.top[0].score).toBe(100); // 2.5× body weight is just the intermediate standard
    expect(s.score).toBe(33); // one lift: the other two count as 0
  });
  it('counts body weight plus added weight for pull-ups, chin-ups and dips', () => {
    const s = strength([session([{ exerciseId: 'preset-pull-up', sets: [set({ weight: 20, reps: 5 })] }])], 80, NOW)!;
    expect(s.top[0].ratio).toBe(Math.round(((100 * (1 + 5 / 30)) / 80) * 100) / 100);
  });
  it('only counts the last 90 days and known exercises, and needs a body weight', () => {
    const old = session([{ exerciseId: 'preset-squat', sets: [set({ weight: 200, reps: 1 })] }], 120);
    const custom = session([{ exerciseId: 'custom-x', sets: [set({ weight: 500, reps: 1 })] }]);
    expect(strength([old, custom], 80, NOW)).toEqual({ score: 0, top: [] });
    expect(strength([old], undefined, NOW)).toBeNull();
  });
  it('only counts big multi-joint lifts, has standards for real exercises only, and caps silly numbers', () => {
    for (const small of ['preset-chest-fly', 'preset-dumbbell-curl', 'preset-leg-curl', 'preset-lateral-raise', 'preset-calf-raise']) {
      expect(STRENGTH_STANDARDS[small], small).toBeUndefined();
    }
    for (const id of Object.keys(STRENGTH_STANDARDS)) expect(exById.has(id), id).toBe(true);
    const s = strength([session([{ exerciseId: 'preset-overhead-press', sets: [set({ weight: 300, reps: 1 })] }])], 80, NOW)!;
    expect(s.top[0].score).toBe(MAX_STRENGTH);
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
    expect(Object.keys(e).sort()).toEqual(['code', 'last4', 'lifts', 'name', 'points', 'streak', 'strength', 'tier', 'weekId']);
    expect(JSON.stringify(e)).not.toContain('80'); // body weight isn't in it
    expect(JSON.stringify(e)).not.toContain('ratio'); // nor anything it could be worked out from
    expect(e).toMatchObject({ name: 'Sam', weekId: '2026-W47', points: 10, tier: 'bronze', strength: 49, lifts: { l1: { id: 'preset-bench-press', score: 146 } } });
  });
});
