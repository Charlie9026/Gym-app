/**
 * Stopwatch for timing a set of a timed or distance exercise during a workout.
 * It's saved on the active workout with its start time, so it keeps counting
 * correctly if you switch apps, lock your phone or close the app.
 */
import type { SetEntry, Workout } from './types';

/** Where a workout's stopwatch points: the exercise and set, or null if they're gone. */
export function stopwatchTarget(w: Workout): { exIdx: number; setIdx: number } | null {
  const sw = w.stopwatch;
  if (!sw) return null;
  const exIdx = w.exercises.findIndex((e) => e.exerciseId === sw.exerciseId);
  if (exIdx < 0 || !w.exercises[exIdx].sets[sw.setIndex]) return null;
  return { exIdx, setIdx: sw.setIndex };
}

/** Start timing the first set not yet done in this exercise (adding a set if they're all done). */
export function startStopwatch(w: Workout, exIdx: number, now = Date.now()): Workout {
  const ex = w.exercises[exIdx];
  if (!ex) return w;
  let sets = ex.sets;
  let setIndex = sets.findIndex((s) => !s.done);
  if (setIndex < 0) {
    const blank: SetEntry = { weight: 0, reps: 0, done: false };
    sets = [...sets, blank];
    setIndex = sets.length - 1;
  }
  return {
    ...w,
    exercises: w.exercises.map((e, i) => (i === exIdx ? { ...e, sets } : e)),
    stopwatch: { exerciseId: ex.exerciseId, setIndex, startedAt: now },
  };
}

/** Seconds on the stopwatch (whole seconds). */
export const stopwatchSeconds = (startedAt: number, now = Date.now()) => Math.max(0, Math.round((now - startedAt) / 1000));

/** Stop: put the time into the set and tick it off. */
export function stopStopwatch(w: Workout, now = Date.now()): Workout {
  const t = stopwatchTarget(w);
  const seconds = w.stopwatch ? stopwatchSeconds(w.stopwatch.startedAt, now) : 0;
  const rest = cancelStopwatch(w);
  if (!t || seconds <= 0) return rest;
  return {
    ...rest,
    exercises: rest.exercises.map((e, i) =>
      i === t.exIdx ? { ...e, sets: e.sets.map((s, k) => (k === t.setIdx ? { ...s, seconds, done: true } : s)) } : e,
    ),
  };
}

/** Throw the stopwatch away without changing any set. */
export function cancelStopwatch(w: Workout): Workout {
  if (!w.stopwatch) return w;
  const copy = { ...w };
  delete copy.stopwatch;
  return copy;
}

/** Keep the stopwatch on the right set when a set of its exercise is removed (or drop it if that set goes). */
export function afterSetRemoved(w: Workout, exerciseId: string, removed: number): Workout {
  const sw = w.stopwatch;
  if (!sw || sw.exerciseId !== exerciseId) return w;
  if (removed === sw.setIndex) return cancelStopwatch(w);
  return removed < sw.setIndex ? { ...w, stopwatch: { ...sw, setIndex: sw.setIndex - 1 } } : w;
}
