import type { AppData, TemplateExercise, Workout, WorkoutTemplate } from './types';
import { newTemplate } from './workout';

/**
 * A realistic sample week: Chest & Arms, Back & Shoulders and Legs twice each,
 * with a rest day on Thursday, ending today. Ids start with "demo-" so the
 * sample can be removed again.
 */

/** [exercise, working sets, reps, kg, kg added in round 2, warm-ups as [kg, reps]] */
type WeightRow = [exerciseId: string, sets: number, reps: number, kg: number, stepKg: number, warmups?: [number, number][]];
/** Timed (seconds) or reps-only rows, with the amount added in round 2. */
type OtherRow = { exerciseId: string; sets: number; seconds?: number; reps?: number; step: number };
type Plan = { name: string; exercises: (WeightRow | OtherRow)[] };

const id = (name: string) => 'preset-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const PLANS: Plan[] = [
  {
    name: 'Chest and arms day',
    exercises: [
      [id('Bench Press'), 4, 8, 70, 2.5, [[40, 10], [55, 5]]],
      [id('Incline Dumbbell Press'), 3, 10, 24, 2],
      [id('Chest Fly'), 3, 12, 14, 0],
      [id('Barbell Curl'), 3, 10, 30, 2.5],
      [id('Tricep Pushdown'), 3, 12, 27.5, 2.5],
    ],
  },
  {
    name: 'Back and shoulders day',
    exercises: [
      [id('Deadlift'), 3, 5, 120, 5, [[80, 5]]],
      [id('Lat Pulldown'), 3, 10, 55, 2.5],
      [id('Barbell Row'), 3, 8, 65, 2.5],
      [id('Overhead Press'), 4, 8, 40, 2.5],
      [id('Lateral Raise'), 3, 15, 8, 1],
      { exerciseId: id('Pull-Up'), sets: 3, reps: 8, step: 1 },
    ],
  },
  {
    name: 'Leg day',
    exercises: [
      [id('Squat'), 4, 6, 95, 5, [[60, 8], [80, 3]]],
      [id('Romanian Deadlift'), 3, 8, 80, 5],
      [id('Leg Press'), 3, 10, 160, 10],
      [id('Leg Curl'), 3, 12, 40, 2.5],
      [id('Calf Raise'), 4, 15, 60, 5],
      { exerciseId: id('Plank'), sets: 3, seconds: 45, step: 15 },
    ],
  },
];

const DURATIONS = [56, 63, 61, 52, 66, 58];

export const isDemoId = (x?: string) => !!x && x.startsWith('demo-');

export function hasDemoData(d: AppData): boolean {
  return d.workouts.some((w) => isDemoId(w.id));
}

function sessionExercises(plan: Plan, round: 0 | 1): TemplateExercise[] {
  return plan.exercises.map((row) => {
    if (!Array.isArray(row)) {
      // Plank (time) or Pull-Up (reps): a little more in the second session.
      const { exerciseId, sets, seconds, reps, step } = row;
      return {
        exerciseId,
        sets: Array.from({ length: sets }, (_, i) =>
          seconds
            ? { weight: 0, reps: 0, seconds: seconds + step * round - (i === sets - 1 ? 10 : 0) }
            : { weight: 0, reps: (reps ?? 0) + step * round - (i === sets - 1 ? 1 : 0) },
        ),
      };
    }
    const [exerciseId, sets, reps, kg, step, warmups = []] = row;
    return {
      exerciseId,
      // Warm-ups first; second session is a touch heavier; the last set drops a rep, like a real session.
      sets: [
        ...warmups.map(([w, r]) => ({ weight: w, reps: r, kind: 'warmup' as const })),
        ...Array.from({ length: sets }, (_, i) => ({
          weight: kg + step * round,
          reps: i === sets - 1 && reps > 6 ? reps - 1 : reps,
        })),
      ],
    };
  });
}

export function addDemoWeek(d: AppData): AppData {
  const now = new Date();
  // The 7 days ending today; Thursday is the rest day.
  const days: Date[] = [];
  for (let back = 6; back >= 0; back--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    if (day.getDay() !== 4) days.push(day);
  }

  // Reuse saved workouts with the same name rather than duplicating them.
  const templates: WorkoutTemplate[] = [...d.templates];
  const templateFor = PLANS.map((plan) => {
    const existing = templates.find((t) => t.name.toLowerCase() === plan.name.toLowerCase());
    if (existing) return existing;
    const t = { ...newTemplate(plan.name, sessionExercises(plan, 1)), id: 'demo-tpl-' + templates.length };
    templates.push(t);
    return t;
  });

  const workouts: Workout[] = days.slice(0, 6).map((day, i) => {
    const plan = PLANS[i % 3];
    const round = (i < 3 ? 0 : 1) as 0 | 1;
    const evening = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 17, 30);
    const latest = new Date(now.getTime() - (DURATIONS[i] + 15) * 60000);
    const start = evening < latest ? evening : latest;
    return {
      id: `demo-w${i}`,
      date: start.toISOString(),
      finishedAt: new Date(start.getTime() + DURATIONS[i] * 60000).toISOString(),
      name: plan.name,
      notes: '',
      templateId: templateFor[i % 3].id,
      exercises: sessionExercises(plan, round).map((ex) => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets.map((s) => ({ ...s, done: true })),
      })),
    };
  });

  const all = [...d.workouts.filter((w) => !isDemoId(w.id)), ...workouts].sort((a, b) => a.date.localeCompare(b.date));
  return { ...d, workouts: all, templates };
}

export function removeDemoWeek(d: AppData): AppData {
  return {
    ...d,
    workouts: d.workouts.filter((w) => !isDemoId(w.id)),
    templates: d.templates.filter((t) => !isDemoId(t.id)),
  };
}
