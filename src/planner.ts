/**
 * Plan builder: turns a few multiple-choice answers into saved workouts, from
 * well-known beginner-friendly layouts (full body, upper/lower, push/pull/legs)
 * and the app's own exercises. No AI and nothing sent anywhere: it's a set of
 * rules, so it works offline and gives the same plan for the same answers.
 */
import type { ExerciseType, TemplateExercise, TemplateSet } from './types';

export type Goal = 'muscle' | 'strength' | 'fat' | 'general';
export type Experience = 'new' | 'some' | 'confident';
export type Equipment = 'gym' | 'dumbbells' | 'bodyweight';
export type Joint = 'knees' | 'back' | 'shoulders';

export interface PlanAnswers {
  goal: Goal;
  experience: Experience;
  days: 2 | 3 | 4 | 5;
  minutes: 30 | 45 | 60;
  equipment: Equipment;
  avoid: Joint[];
}

export interface PlannedWorkout {
  name: string;
  exercises: TemplateExercise[];
}

export interface Plan {
  workouts: PlannedWorkout[];
  /** How to use it, e.g. "Train 3 days a week, doing A, B and C in turn." */
  howTo: string;
  /** Short tips for these answers. */
  tips: string[];
}

type Pattern = 'squat' | 'hinge' | 'lunge' | 'hpush' | 'vpush' | 'hpull' | 'vpull' | 'biceps' | 'triceps' | 'delts' | 'calves' | 'core' | 'finisher';

interface Option {
  id: string;
  type: ExerciseType;
  /** Equipment it can be done with. */
  equip: Equipment[];
  /** Joints it loads a lot (left out when you ask to go easy on them). */
  stress?: Joint[];
  /** Only offered to confident lifters. */
  advanced?: boolean;
  /** A small single-joint move standing in for a big one (goes after the big lifts). */
  iso?: boolean;
}

const ALL: Equipment[] = ['gym', 'dumbbells', 'bodyweight'];
const GYM_DB: Equipment[] = ['gym', 'dumbbells'];

/** Exercises for each movement, best first. Joint-friendly ones come later as fallbacks. */
const OPTIONS: Record<Pattern, Option[]> = {
  squat: [
    { id: 'preset-squat', type: 'weight', equip: ['gym'], stress: ['knees', 'back'], advanced: true },
    { id: 'preset-leg-press', type: 'weight', equip: ['gym'], stress: ['knees'] },
    { id: 'preset-goblet-squat', type: 'weight', equip: GYM_DB, stress: ['knees'] },
    { id: 'preset-bodyweight-squat', type: 'reps', equip: ['bodyweight'], stress: ['knees'] },
    { id: 'preset-hip-thrust', type: 'weight', equip: ['gym'] },
    { id: 'preset-glute-bridge', type: 'weight', equip: ALL },
  ],
  hinge: [
    { id: 'preset-deadlift', type: 'weight', equip: ['gym'], stress: ['back'], advanced: true },
    { id: 'preset-romanian-deadlift', type: 'weight', equip: ['gym'], stress: ['back'] },
    { id: 'preset-dumbbell-romanian-deadlift', type: 'weight', equip: GYM_DB, stress: ['back'] },
    { id: 'preset-hip-thrust', type: 'weight', equip: ['gym'] },
    { id: 'preset-glute-bridge', type: 'weight', equip: ALL },
    { id: 'preset-leg-curl', type: 'weight', equip: ['gym'] },
  ],
  lunge: [
    { id: 'preset-bulgarian-split-squat', type: 'weight', equip: ALL, stress: ['knees'] },
    { id: 'preset-lunge', type: 'weight', equip: ALL, stress: ['knees'] },
    { id: 'preset-leg-curl', type: 'weight', equip: ['gym'] },
    { id: 'preset-glute-bridge', type: 'weight', equip: ALL },
  ],
  hpush: [
    { id: 'preset-bench-press', type: 'weight', equip: ['gym'], stress: ['shoulders'] },
    { id: 'preset-dumbbell-bench-press', type: 'weight', equip: GYM_DB },
    { id: 'preset-incline-dumbbell-press', type: 'weight', equip: GYM_DB },
    { id: 'preset-push-up', type: 'reps', equip: ALL },
  ],
  vpush: [
    { id: 'preset-overhead-press', type: 'weight', equip: ['gym'], stress: ['shoulders', 'back'], advanced: true },
    { id: 'preset-dumbbell-shoulder-press', type: 'weight', equip: GYM_DB, stress: ['shoulders'] },
    { id: 'preset-pike-push-up', type: 'reps', equip: ['bodyweight'], stress: ['shoulders'] },
    { id: 'preset-lateral-raise', type: 'weight', equip: GYM_DB, iso: true },
  ],
  hpull: [
    { id: 'preset-seated-cable-row', type: 'weight', equip: ['gym'] },
    { id: 'preset-dumbbell-row', type: 'weight', equip: GYM_DB },
    { id: 'preset-barbell-row', type: 'weight', equip: ['gym'], stress: ['back'], advanced: true },
    { id: 'preset-inverted-row', type: 'reps', equip: ['bodyweight'] },
  ],
  vpull: [
    { id: 'preset-lat-pulldown', type: 'weight', equip: ['gym'] },
    { id: 'preset-pull-up', type: 'reps', equip: ['gym', 'bodyweight'], stress: ['shoulders'] },
    { id: 'preset-chin-up', type: 'reps', equip: ['gym', 'bodyweight'], stress: ['shoulders'] },
    { id: 'preset-dumbbell-row', type: 'weight', equip: ['dumbbells'] },
  ],
  biceps: [
    { id: 'preset-dumbbell-curl', type: 'weight', equip: GYM_DB },
    { id: 'preset-hammer-curl', type: 'weight', equip: GYM_DB },
    { id: 'preset-cable-curl', type: 'weight', equip: ['gym'] },
    { id: 'preset-chin-up', type: 'reps', equip: ['bodyweight'], stress: ['shoulders'] },
  ],
  triceps: [
    { id: 'preset-tricep-pushdown', type: 'weight', equip: ['gym'] },
    { id: 'preset-overhead-tricep-extension', type: 'weight', equip: GYM_DB },
    { id: 'preset-dips', type: 'reps', equip: ['bodyweight'], stress: ['shoulders'] },
    { id: 'preset-push-up', type: 'reps', equip: ['bodyweight'] },
  ],
  delts: [
    { id: 'preset-lateral-raise', type: 'weight', equip: GYM_DB },
    { id: 'preset-face-pull', type: 'weight', equip: ['gym'] },
    { id: 'preset-rear-delt-fly', type: 'weight', equip: GYM_DB },
    { id: 'preset-pike-push-up', type: 'reps', equip: ['bodyweight'], stress: ['shoulders'] },
  ],
  calves: [{ id: 'preset-calf-raise', type: 'weight', equip: ALL }],
  core: [
    { id: 'preset-plank', type: 'time', equip: ALL },
    { id: 'preset-dead-bug', type: 'reps', equip: ALL },
    { id: 'preset-hanging-leg-raise', type: 'reps', equip: ['gym'], advanced: true },
    { id: 'preset-cable-crunch', type: 'weight', equip: ['gym'] },
    { id: 'preset-side-plank', type: 'time', equip: ALL },
  ],
  finisher: [
    { id: 'preset-exercise-bike', type: 'distance', equip: ['gym'] },
    { id: 'preset-rowing-machine', type: 'distance', equip: ['gym'], stress: ['back'] },
    { id: 'preset-jump-rope', type: 'time', equip: ['dumbbells', 'bodyweight'], stress: ['knees'] },
    { id: 'preset-burpee', type: 'reps', equip: ['dumbbells', 'bodyweight'], stress: ['knees', 'shoulders'] },
    { id: 'preset-walking', type: 'distance', equip: ALL },
  ],
};

/** A slot in a workout: a movement, and which of its suitable exercises to use (for variety between days). */
type Slot = [Pattern, number?];

/** Workouts for each layout; slots are in priority order and cut to fit the time. */
const LAYOUTS: Record<'full2' | 'full3' | 'upperLower' | 'ppl', { name: string; slots: Slot[] }[]> = {
  full2: [
    { name: 'Full body A', slots: [['squat'], ['hpush'], ['hpull'], ['hinge', 1], ['delts'], ['core'], ['biceps']] },
    { name: 'Full body B', slots: [['hinge'], ['vpush'], ['vpull'], ['lunge'], ['hpush', 1], ['core', 1], ['triceps']] },
  ],
  full3: [
    { name: 'Full body A', slots: [['squat'], ['hpush'], ['hpull'], ['hinge', 1], ['delts'], ['core']] },
    { name: 'Full body B', slots: [['hinge'], ['vpush'], ['vpull'], ['lunge'], ['biceps'], ['core', 1]] },
    { name: 'Full body C', slots: [['squat', 1], ['hpush', 1], ['hpull', 1], ['lunge', 1], ['triceps'], ['calves']] },
  ],
  upperLower: [
    { name: 'Upper A', slots: [['hpush'], ['hpull'], ['vpush'], ['vpull'], ['biceps'], ['triceps'], ['delts']] },
    { name: 'Lower A', slots: [['squat'], ['hinge', 1], ['lunge'], ['calves'], ['core'], ['hinge', 2]] },
    { name: 'Upper B', slots: [['vpush'], ['vpull'], ['hpush', 1], ['hpull', 1], ['delts'], ['biceps', 1], ['triceps', 1]] },
    { name: 'Lower B', slots: [['hinge'], ['squat', 1], ['lunge', 1], ['calves'], ['core', 1], ['hinge', 2]] },
  ],
  ppl: [
    { name: 'Push', slots: [['hpush'], ['vpush'], ['hpush', 1], ['delts'], ['triceps'], ['triceps', 1]] },
    { name: 'Pull', slots: [['vpull'], ['hpull'], ['hpull', 1], ['delts', 1], ['biceps'], ['biceps', 1]] },
    { name: 'Legs', slots: [['squat'], ['hinge'], ['lunge'], ['hinge', 2], ['calves'], ['core']] },
    { name: 'Upper', slots: [['hpush', 1], ['vpull'], ['vpush', 1], ['hpull', 1], ['biceps'], ['triceps']] },
    { name: 'Lower', slots: [['hinge', 1], ['squat', 1], ['lunge', 1], ['calves'], ['core', 1], ['core']] },
  ],
};

/** Single-joint and core movements, done after the big lifts. */
const SMALL: Pattern[] = ['biceps', 'triceps', 'delts', 'calves', 'core'];

/** Exercises listed for a big movement (so Chin-Up counts as big even when it fills an arms slot). */
const BIG_IDS = new Set(
  (Object.keys(OPTIONS) as Pattern[]).filter((p) => !SMALL.includes(p) && p !== 'finisher').flatMap((p) => OPTIONS[p].filter((o) => !o.iso).map((o) => o.id)),
);

/** Movements to fill a workout that came out short, gentlest first. */
const TOP_UP: Pattern[] = ['core', 'hpush', 'hpull', 'hinge', 'calves', 'squat', 'delts', 'triceps', 'biceps'];

const EXERCISES_FOR_MINUTES = { 30: 4, 45: 5, 60: 6 } as const;

/** Exercises that suit the answers for a movement, in order. */
function suitable(p: Pattern, a: PlanAnswers): Option[] {
  return OPTIONS[p].filter(
    (o) => o.equip.includes(a.equipment) && !o.stress?.some((j) => a.avoid.includes(j)) && !(o.advanced && a.experience !== 'confident'),
  );
}

/** Sets for one exercise. Weights start empty: you fill them in the first time. */
function setsFor(o: Option, slotIndex: number, a: PlanAnswers): TemplateSet[] {
  const count = a.experience === 'new' ? 2 : a.experience === 'some' ? 3 : slotIndex === 0 ? 4 : 3;
  const working = (s: TemplateSet) => Array.from({ length: count }, () => ({ ...s }));
  if (o.type === 'time') {
    const seconds = o.id === 'preset-jump-rope' ? 60 : a.experience === 'new' ? 30 : a.experience === 'some' ? 45 : 60;
    return working({ weight: 0, reps: 0, seconds });
  }
  if (o.type === 'distance') return [{ weight: 0, reps: 0, seconds: a.minutes === 60 ? 900 : 600 }]; // one steady 10–15 minutes
  const main = slotIndex < 2; // the first two exercises are the big lifts
  const reps =
    o.type === 'reps'
      ? a.experience === 'new' ? 8 : 10
      : a.goal === 'strength' ? (main ? 5 : 8) : a.goal === 'fat' ? 12 : a.goal === 'muscle' ? 10 : 10;
  const sets = working({ weight: 0, reps });
  // A lighter warm-up set before the first big lift with weights.
  if (slotIndex === 0 && o.type === 'weight' && !o.iso) sets.unshift({ weight: 0, reps: 10, kind: 'warmup' });
  return sets;
}

/** The plan for a set of answers. */
/** Exported for tests: the exercise table. */
export const PLAN_OPTIONS = OPTIONS;

export function buildPlan(a: PlanAnswers): Plan {
  const layout =
    a.days === 2 ? 'full2' : a.days === 3 ? 'full3' : a.days === 4 || a.experience === 'new' ? 'upperLower' : 'ppl';
  const count = EXERCISES_FOR_MINUTES[a.minutes];

  const workouts = LAYOUTS[layout].map(({ name, slots }) => {
    // Fat loss ends each workout with steady cardio, in place of the last exercise.
    const lifts = a.goal === 'fat' ? count - 1 : count;
    const used = new Set<string>();
    const chosen: { o: Option; small: boolean }[] = [];
    const take = (o: Option, pattern: Pattern) => {
      used.add(o.id);
      chosen.push({ o, small: !!o.iso || (SMALL.includes(pattern) && !BIG_IDS.has(o.id)) });
    };
    for (const [pattern, pick = 0] of slots) {
      if (chosen.length >= lifts) break;
      const options = suitable(pattern, a).filter((o) => !used.has(o.id));
      // Use the requested variation if there is one, otherwise the best one left.
      const o = options[Math.min(pick, options.length - 1)];
      if (o) take(o, pattern);
    }
    // With lots left out (e.g. bodyweight only and every joint ticked), top up from other movements.
    for (const pattern of TOP_UP) {
      if (chosen.length >= Math.min(lifts, 3)) break;
      const o = suitable(pattern, a).find((x) => !used.has(x.id));
      if (o) take(o, pattern);
    }
    // Big lifts first (they get the warm-up and the most effort), small moves after.
    const ordered = [...chosen.filter((c) => !c.small), ...chosen.filter((c) => c.small)];
    const exercises: TemplateExercise[] = ordered.map(({ o }, i) => ({ exerciseId: o.id, sets: setsFor(o, i, a) }));
    if (a.goal === 'fat') {
      const f = suitable('finisher', a)[0];
      if (f) exercises.push({ exerciseId: f.id, sets: setsFor(f, exercises.length, a) });
    }
    return { name, exercises };
  });

  const letters = workouts.map((w) => w.name.replace(/^Full body /, '')).join(', ').replace(/, ([^,]*)$/, ' and $1');
  const howTo =
    layout === 'ppl'
      ? `Train 5 days a week: Push, Pull, Legs, Upper and Lower, with a rest day or two in between.`
      : layout === 'upperLower'
        ? `Train ${a.days} days a week, going Upper A, Lower A, Upper B, Lower B in turn.`
        : `Train ${a.days} days a week, doing ${letters} in turn, with a rest day between workouts.`;

  const tips = [
    a.experience === 'new'
      ? 'Start light: pick weights you could lift a few more times than the reps shown. Good form first.'
      : 'Add a little weight (or a rep) when every set feels doable. The app shows last time’s numbers to beat.',
    a.goal === 'strength'
      ? 'Rest 2–3 minutes after the big lifts. You can set rest for each exercise from its Rest pill.'
      : a.goal === 'fat'
        ? 'Keep rests short (about a minute) and finish with the cardio at a pace you can talk at.'
        : 'Rest about 1½ minutes between sets.',
    ...(a.avoid.length ? [`Exercises that are hard on your ${listJoints(a.avoid)} were left out. Stop anything that hurts.`] : []),
  ];
  return { workouts, howTo, tips };
}

const listJoints = (j: Joint[]) => (j.length === 1 ? j[0] : `${j.slice(0, -1).join(', ')} and ${j[j.length - 1]}`).replace('back', 'lower back');
