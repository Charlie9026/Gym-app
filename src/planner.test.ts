import { describe, expect, it } from 'vitest';
import { PLAN_OPTIONS, buildPlan, type Equipment, type Experience, type Goal, type Joint, type PlanAnswers } from './planner';
import { PRESET_EXERCISES } from './exercises';

const presets = new Map(PRESET_EXERCISES.map((e) => [e.id, e]));
const goals: Goal[] = ['muscle', 'strength', 'fat', 'general'];
const levels: Experience[] = ['new', 'some', 'confident'];
const kit: Equipment[] = ['gym', 'dumbbells', 'bodyweight'];
const avoids: Joint[][] = [[], ['knees'], ['back'], ['shoulders'], ['knees', 'back', 'shoulders']];

/** Every combination of answers. */
const everyAnswer: PlanAnswers[] = goals.flatMap((goal) =>
  levels.flatMap((experience) =>
    ([2, 3, 4, 5] as const).flatMap((days) =>
      ([30, 45, 60] as const).flatMap((minutes) => kit.flatMap((equipment) => avoids.map((avoid) => ({ goal, experience, days, minutes, equipment, avoid })))),
    ),
  ),
);
const option = (id: string) => Object.values(PLAN_OPTIONS).flat().find((o) => o.id === id)!;

describe('plan builder', () => {
  it('only uses exercises the app has, with matching types', () => {
    for (const o of Object.values(PLAN_OPTIONS).flat()) {
      expect(presets.has(o.id), o.id).toBe(true);
      expect(presets.get(o.id)!.type ?? 'weight', o.id).toBe(o.type);
    }
  });

  it.each([[2, 2], [3, 3], [4, 4], [5, 5]] as const)('makes a workout for each training day (%i days)', (days, n) => {
    expect(buildPlan({ goal: 'muscle', experience: 'some', days, minutes: 45, equipment: 'gym', avoid: [] }).workouts).toHaveLength(n);
  });

  it('fits every answer: equipment, joints, experience and time', () => {
    for (const a of everyAnswer) {
      const plan = buildPlan(a);
      for (const w of plan.workouts) {
        const ids = w.exercises.map((e) => e.exerciseId);
        const label = `${JSON.stringify(a)} ${w.name}`;
        expect(ids.length, label).toBeGreaterThanOrEqual(3);
        expect(ids.length, label).toBeLessThanOrEqual({ 30: 4, 45: 5, 60: 6 }[a.minutes]);
        expect(new Set(ids).size, label).toBe(ids.length); // no exercise twice in a workout
        for (const id of ids) {
          const o = option(id);
          expect(o.equip, `${label} ${id}`).toContain(a.equipment);
          for (const j of a.avoid) expect(o.stress ?? [], `${label} ${id}`).not.toContain(j);
          if (a.experience !== 'confident') expect(o.advanced, `${label} ${id}`).toBeFalsy();
        }
        for (const e of w.exercises) expect(e.sets.length, label).toBeGreaterThan(0);
      }
    }
  });

  it('sets reps by goal and sets by experience, with a warm-up before the first lift', () => {
    const strong = buildPlan({ goal: 'strength', experience: 'confident', days: 3, minutes: 60, equipment: 'gym', avoid: [] }).workouts[0];
    expect(strong.exercises[0].exerciseId).toBe('preset-squat');
    expect(strong.exercises[0].sets[0]).toMatchObject({ kind: 'warmup' });
    expect(strong.exercises[0].sets.filter((s) => !s.kind).map((s) => s.reps)).toEqual([5, 5, 5, 5]);
    expect(strong.exercises[3].sets.map((s) => s.reps)).toEqual([8, 8, 8]);

    const beginner = buildPlan({ goal: 'muscle', experience: 'new', days: 3, minutes: 45, equipment: 'gym', avoid: [] }).workouts[0];
    expect(beginner.exercises[0].exerciseId).toBe('preset-leg-press'); // no barbell squat for beginners
    expect(beginner.exercises[1].sets).toEqual([{ weight: 0, reps: 10 }, { weight: 0, reps: 10 }]);
  });

  it('puts big lifts before small ones', () => {
    // Small = only ever listed for small movements (Push-Up, say, is also a chest exercise).
    const smallPatterns = ['delts', 'biceps', 'triceps', 'calves', 'core'];
    const big = new Set(Object.entries(PLAN_OPTIONS).filter(([p]) => !smallPatterns.includes(p) && p !== 'finisher').flatMap(([, os]) => os.map((o) => o.id)));
    const small = new Set(smallPatterns.flatMap((p) => PLAN_OPTIONS[p as keyof typeof PLAN_OPTIONS].map((o) => o.id)).filter((id) => !big.has(id)));
    const isSmall = (id: string) => small.has(id) || !!option(id).iso;
    for (const a of everyAnswer.filter((x) => x.goal !== 'fat')) {
      for (const w of buildPlan(a).workouts) {
        const flags = w.exercises.map((e) => isSmall(e.exerciseId));
        expect(flags, `${JSON.stringify(a)} ${w.name}`).toEqual([...flags].sort((x, y) => Number(x) - Number(y)));
      }
    }
    // With shoulders ticked, Upper B no longer opens with a lateral raise.
    const upperB = buildPlan({ goal: 'muscle', experience: 'some', days: 4, minutes: 45, equipment: 'gym', avoid: ['shoulders'] }).workouts[2];
    expect(upperB.exercises[0].exerciseId).not.toBe('preset-lateral-raise');
    expect(upperB.exercises.find((e) => e.exerciseId === 'preset-lateral-raise')?.sets.some((s) => s.kind)).toBeFalsy();
  });
  it('ends fat-loss workouts with steady cardio', () => {
    for (const equipment of kit) {
      const w = buildPlan({ goal: 'fat', experience: 'some', days: 3, minutes: 30, equipment, avoid: ['knees'] }).workouts[0];
      const last = option(w.exercises[w.exercises.length - 1].exerciseId);
      expect(['distance', 'time']).toContain(last.type);
    }
  });

  it('varies the exercises between days', () => {
    const [a, b, c] = buildPlan({ goal: 'muscle', experience: 'some', days: 3, minutes: 60, equipment: 'gym', avoid: [] }).workouts;
    expect(a.exercises.map((e) => e.exerciseId)).not.toEqual(c.exercises.map((e) => e.exerciseId));
    expect(new Set([...a.exercises, ...b.exercises, ...c.exercises].map((e) => e.exerciseId)).size).toBeGreaterThanOrEqual(12);
  });

  it('explains how to use it', () => {
    const p = buildPlan({ goal: 'general', experience: 'new', days: 3, minutes: 45, equipment: 'bodyweight', avoid: ['back'] });
    expect(p.howTo).toBe('Train 3 days a week, doing A, B and C in turn, with a rest day between workouts.');
    expect(p.tips.join(' ')).toContain('lower back');
  });
});
