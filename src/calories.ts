/**
 * Calories burned, estimated from body weight with MET values (how many times
 * your resting energy use an activity takes; kcal = MET × kg × hours), from the
 * Compendium of Physical Activities, and the ACSM equations for walking and
 * running speed. For cardio you can type in the number from your machine or
 * watch instead (WorkoutExercise.calories), which replaces the estimate.
 *
 * These are rough guides: real numbers vary a lot from person to person.
 */
import type { Exercise, Settings, SetEntry, Workout, WorkoutExercise } from './types';
import { typeOf } from './sets';
import { completedSets } from './utils';

/** Calories are shown unless switched off in Settings. */
export const caloriesOn = (s: Pick<Settings, 'showCalories'>) => s.showCalories !== false;

/**
 * Lifting is estimated per set from what you did, never from how long the app was open:
 *  - the set and its rest: 2.5 minutes at MET 3.5 (Compendium 02054, resistance training
 *    with rest between sets), which scales with body weight;
 *  - plus the work itself: weight × reps × a typical 0.4 m bar path, at about 20% muscle
 *    efficiency, so more weight or more reps always means more calories.
 */
const SET_MINUTES = 2.5;
const SET_MET = 3.5;
const LIFT_METRES = 0.4;
const MUSCLE_EFFICIENCY = 0.2;
const J_PER_KCAL = 4184;
/** Bodyweight moves (push-ups, pull-ups, dips…) lift roughly this share of your body weight. */
const BODYWEIGHT_SHARE = 0.65;

/** Calories for one lifting set. A bodyweight move lifts part of your body weight plus any added weight. */
export function liftSetCalories(s: SetEntry, bodyKg: number, bodyweightMove = false): number {
  const base = SET_MET * bodyKg * (SET_MINUTES / 60);
  const load = bodyweightMove ? BODYWEIGHT_SHARE * bodyKg + s.weight : s.weight > 0 ? s.weight : BODYWEIGHT_SHARE * bodyKg;
  const work = (load * 9.81 * LIFT_METRES * s.reps) / MUSCLE_EFFICIENCY / J_PER_KCAL;
  return base + work;
}

type Activity = 'run' | 'walk' | 'incline' | 'cycle' | 'bike' | 'row' | 'elliptical' | 'swim' | 'ski' | 'airbike' | 'stairs' | 'rope' | 'hold' | 'cardio';

/** MET for activities that don't depend on speed here. */
const MET: Record<Exclude<Activity, 'run' | 'walk' | 'incline' | 'cycle'>, number> = {
  bike: 6.8, // stationary cycling, moderate
  row: 7, // rowing machine, moderate
  elliptical: 5,
  swim: 7, // freestyle, moderate
  ski: 7, // ski erg, similar to rowing
  airbike: 8, // air bike, vigorous intervals
  stairs: 9, // stair climber machine
  rope: 11, // jump rope, moderate pace
  hold: 3.8, // planks, hangs and other holds
  cardio: 7, // other cardio
};

/** Typical speed in km/h, to estimate the time when only a distance was logged. */
const TYPICAL_KMH: Record<Activity, number> = {
  run: 10, walk: 5, incline: 4.5, cycle: 20, bike: 22, row: 12, elliptical: 8, swim: 2.5, ski: 11, airbike: 20,
  stairs: 3, rope: 0, hold: 0, cardio: 8,
};

const BY_PRESET: Record<string, Activity> = {
  'preset-running': 'run',
  'preset-walking': 'walk',
  'preset-incline-walk': 'incline',
  'preset-cycling': 'cycle',
  'preset-exercise-bike': 'bike',
  'preset-rowing-machine': 'row',
  'preset-elliptical': 'elliptical',
  'preset-swimming': 'swim',
  'preset-ski-erg': 'ski',
  'preset-air-bike': 'airbike',
  'preset-stair-climber': 'stairs',
  'preset-jump-rope': 'rope',
};

/** Which activity an exercise is, for timed and distance exercises (custom ones are guessed from the name). */
export function activityOf(ex: Pick<Exercise, 'id' | 'name' | 'muscle' | 'type'>): Activity {
  const preset = BY_PRESET[ex.id];
  if (preset) return preset;
  const n = ex.name.toLowerCase();
  if (/incline/.test(n) && /walk|tread/.test(n)) return 'incline';
  if (/run|jog|sprint/.test(n)) return 'run';
  if (/walk|hike/.test(n)) return 'walk';
  if (/air ?bike|assault|echo bike/.test(n)) return 'airbike';
  if (/spin|exercise bike|stationary/.test(n)) return 'bike';
  if (/cycl|bike|ride/.test(n)) return 'cycle';
  if (/row/.test(n)) return 'row';
  if (/ellip|cross ?trainer/.test(n)) return 'elliptical';
  if (/swim/.test(n)) return 'swim';
  if (/ski/.test(n)) return 'ski';
  if (/stair|step ?mill/.test(n)) return 'stairs';
  if (/rope|skip/.test(n)) return 'rope';
  if (typeOf(ex) === 'time' && ex.muscle !== 'Cardio') return 'hold';
  return 'cardio';
}

/** MET at a speed (m/min) for activities where speed matters. */
function metAt(a: Activity, mPerMin: number): number {
  // ACSM: oxygen use (ml/kg/min) = 3.5 resting + a cost per metre; 3.5 ml/kg/min = 1 MET.
  if (a === 'run') return (3.5 + 0.2 * mPerMin) / 3.5;
  if (a === 'walk') return (3.5 + 0.1 * mPerMin) / 3.5;
  if (a === 'incline') return (3.5 + 0.1 * mPerMin + 1.8 * mPerMin * 0.08) / 3.5; // assumes an 8% incline
  if (a === 'cycle') {
    const kmh = (mPerMin * 60) / 1000;
    return kmh < 16 ? 4 : kmh < 19 ? 6.8 : kmh < 22 ? 8 : kmh < 25 ? 10 : 12;
  }
  return MET[a as keyof typeof MET] ?? MET.cardio;
}

/** Seconds a set of a timed or distance exercise took (estimated from distance when no time was logged). */
/** Steps a minute on a stair climber, to estimate the time when only steps were logged. */
const STEPS_PER_MIN = 70;

function setSeconds(s: SetEntry, a: Activity): number {
  if (s.seconds) return s.seconds;
  if (s.reps > 0 && !s.meters) return (s.reps / STEPS_PER_MIN) * 60; // steps exercises keep steps in reps
  const kmh = TYPICAL_KMH[a];
  return s.meters && kmh ? (s.meters / 1000 / kmh) * 3600 : 0;
}

function cardioCalories(sets: SetEntry[], a: Activity, kg: number): number {
  let kcal = 0;
  for (const s of sets) {
    const sec = setSeconds(s, a);
    if (sec <= 0) continue;
    const speed = s.meters ? s.meters / (sec / 60) : (TYPICAL_KMH[a] * 1000) / 60;
    kcal += metAt(a, speed) * kg * (sec / 3600);
  }
  return kcal;
}

export interface WorkoutCalories {
  /** Total for the workout (rounded). 0 when nothing could be worked out. */
  total: number;
  /** Per exercise, in the workout's order (not rounded). */
  byExercise: number[];
  /** True when at least one number is an estimate (rather than typed in). */
  estimated: boolean;
}

/** Calories for a workout; without a body weight only typed-in numbers count. */
export function workoutCalories(w: Workout, exById: Map<string, Exercise>, bodyKg: number | undefined): WorkoutCalories {
  const kg = bodyKg && bodyKg > 0 ? bodyKg : 0;
  const done = w.exercises.map((ex) => completedSets(ex.sets));
  const info = w.exercises.map((ex) => exById.get(ex.exerciseId));
  const isLift = (i: number) => {
    const t = typeOf(info[i]);
    return t === 'weight' || t === 'reps';
  };

  let estimated = false;
  const byExercise = w.exercises.map((ex: WorkoutExercise, i) => {
    if (ex.calories && ex.calories > 0) return ex.calories;
    if (!kg || !done[i].length) return 0;
    estimated = true;
    if (isLift(i)) return done[i].reduce((n, s) => n + liftSetCalories(s, kg, typeOf(info[i]) === 'reps'), 0);
    return info[i] ? cardioCalories(done[i], activityOf(info[i]!), kg) : 0;
  });
  return { total: Math.round(byExercise.reduce((a, b) => a + b, 0)), byExercise, estimated };
}

/** Estimate for a timed or distance exercise from its done sets, or null without a body weight. */
export function cardioEstimate(ex: WorkoutExercise, info: Exercise | undefined, bodyKg: number | undefined): number | null {
  if (!bodyKg || !info) return null;
  return Math.round(cardioCalories(completedSets(ex.sets), activityOf(info), bodyKg));
}

/** "1,234 kcal". */
export const fmtKcal = (n: number) => `${Math.round(n).toLocaleString()} kcal`;

/** Cardio gets a calories pill to type in a machine's number (holds like planks don't). */
export function isCardio(ex: Exercise | undefined): boolean {
  if (!ex) return false;
  const t = typeOf(ex);
  return t === 'distance' || t === 'steps' || (t === 'time' && activityOf(ex) !== 'hold');
}

/** The exercise with its typed-in calories set, or removed (back to the estimate). */
export function withCalories<T extends { calories?: number }>(ex: T, kcal: number | undefined): T {
  const copy = { ...ex };
  if (kcal && kcal > 0) copy.calories = Math.round(kcal);
  else delete copy.calories;
  return copy;
}
