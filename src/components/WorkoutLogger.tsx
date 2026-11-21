import { ask } from '../dialog';
import { useEffect, useMemo, useState } from 'react';
import type { AppData, SetEntry, Workout, WorkoutExercise } from '../types';
import type { Update } from '../store';
import {
  completedSets,
  e1rm,
  fmtDate,
  fmtWeight,
  fromDisplay,
  toDisplay,
} from '../utils';
import { ExercisePicker } from './ExercisePicker';
import { NumberInput } from './NumberInput';
import { newWorkoutFrom } from '../workout';

interface Props {
  data: AppData;
  update: Update;
  onFinished: (prs: string[]) => void;
}

const REST_SECONDS = 90;

/** Most recent finished sets for an exercise, used as the "previous" hint. */
function lastSetsFor(workouts: Workout[], exerciseId: string): SetEntry[] {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const ex = workouts[i].exercises.find((e) => e.exerciseId === exerciseId);
    if (ex) return ex.sets;
  }
  return [];
}

function useElapsed(startIso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - Date.parse(startIso)) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function WorkoutLogger({ data, update, onFinished }: Props) {
  const active = data.activeWorkout;
  const lastWorkout = data.workouts[data.workouts.length - 1];

  if (!active) {
    return (
      <div className="screen">
        <h1>Workout</h1>
        <div className="card center">
          <p className="muted">Ready to train?</p>
          <button
            className="btn-primary big"
            onClick={() => update((d) => ({ ...d, activeWorkout: newWorkoutFrom() }))}
          >
            Start empty workout
          </button>
          {lastWorkout && (
            <button
              className="btn-secondary big"
              onClick={() => update((d) => ({ ...d, activeWorkout: newWorkoutFrom(lastWorkout) }))}
            >
              Repeat “{lastWorkout.name}”
              <span className="muted small"> · {fmtDate(lastWorkout.date)}</span>
            </button>
          )}
        </div>
        <p className="muted small center-text">
          Tip: you can also repeat any past workout from the History tab.
        </p>
      </div>
    );
  }

  return <ActiveWorkout data={data} active={active} update={update} onFinished={onFinished} />;
}

function ActiveWorkout({
  data,
  active,
  update,
  onFinished,
}: Props & { active: Workout }) {
  const [picking, setPicking] = useState(false);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const elapsed = useElapsed(active.date);
  const unit = data.settings.unit;
  const exById = useMemo(() => new Map(data.exercises.map((e) => [e.id, e])), [data.exercises]);

  const setActive = (fn: (w: Workout) => Workout) =>
    update((d) => (d.activeWorkout ? { ...d, activeWorkout: fn(d.activeWorkout) } : d));

  const setExercise = (idx: number, fn: (ex: WorkoutExercise) => WorkoutExercise) =>
    setActive((w) => ({ ...w, exercises: w.exercises.map((ex, i) => (i === idx ? fn(ex) : ex)) }));

  const setSet = (exIdx: number, setIdx: number, patch: Partial<SetEntry>) =>
    setExercise(exIdx, (ex) => ({
      ...ex,
      sets: ex.sets.map((s, i) => (i === setIdx ? { ...s, ...patch } : s)),
    }));

  const addExercise = (exerciseId: string) => {
    const prev = lastSetsFor(data.workouts, exerciseId);
    const sets: SetEntry[] = prev.length
      ? prev.map((s) => ({ weight: s.weight, reps: s.reps, done: false }))
      : [{ weight: 0, reps: 0, done: false }];
    setActive((w) => ({ ...w, exercises: [...w.exercises, { exerciseId, sets }] }));
    setPicking(false);
  };

  const moveExercise = (idx: number, dir: -1 | 1) =>
    setActive((w) => {
      const j = idx + dir;
      if (j < 0 || j >= w.exercises.length) return w;
      const exercises = [...w.exercises];
      [exercises[idx], exercises[j]] = [exercises[j], exercises[idx]];
      return { ...w, exercises };
    });

  const finish = () => {
    const exercises = active.exercises
      .map((ex) => ({ ...ex, sets: completedSets(ex.sets) }))
      .filter((ex) => ex.sets.length > 0);
    if (exercises.length === 0) {
      ask('No sets are marked as done. Discard this workout?', { confirmLabel: 'Discard' }).then(
        (ok) => ok && update((d) => ({ ...d, activeWorkout: null })),
      );
      return;
    }
    const finished: Workout = { ...active, exercises, finishedAt: new Date().toISOString() };
    const prs = findPRs(data.workouts, finished, (id) => exById.get(id)?.name ?? 'Exercise', unit);
    update((d) => ({ ...d, workouts: [...d.workouts, finished], activeWorkout: null }));
    onFinished(prs);
  };

  const discard = () => {
    ask('Discard this workout? Everything logged in it will be lost.', { confirmLabel: 'Discard' }).then(
      (ok) => ok && update((d) => ({ ...d, activeWorkout: null })),
    );
  };

  return (
    <div className="screen">
      <div className="workout-header">
        <input
          className="title-input"
          value={active.name}
          aria-label="Workout name"
          onChange={(e) => setActive((w) => ({ ...w, name: e.target.value }))}
        />
        <span className="timer" aria-label="Elapsed time">{elapsed}</span>
      </div>

      {active.exercises.length === 0 && (
        <div className="card center muted">Add your first exercise to get going.</div>
      )}

      {active.exercises.map((ex, exIdx) => {
        const info = exById.get(ex.exerciseId);
        const prev = lastSetsFor(data.workouts, ex.exerciseId);
        return (
          <div className="card" key={exIdx}>
            <div className="ex-header">
              <h3>{info?.name ?? 'Unknown exercise'}</h3>
              <div className="row-actions">
                <button className="icon-btn" aria-label="Move up" onClick={() => moveExercise(exIdx, -1)}>↑</button>
                <button className="icon-btn" aria-label="Move down" onClick={() => moveExercise(exIdx, 1)}>↓</button>
                <button
                  className="icon-btn danger"
                  aria-label="Remove exercise"
                  onClick={() =>
                    ask(`Remove ${info?.name ?? 'this exercise'} from this workout?`, { confirmLabel: 'Remove' }).then(
                      (ok) =>
                        ok && setActive((w) => ({ ...w, exercises: w.exercises.filter((_, i) => i !== exIdx) })),
                    )
                  }
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="set-grid set-grid-head">
              <span>Set</span>
              <span>Previous</span>
              <span>{unit}</span>
              <span>Reps</span>
              <span>✓</span>
            </div>
            {ex.sets.map((s, setIdx) => {
              const p = prev[setIdx];
              return (
                <div className={'set-grid' + (s.done ? ' done' : '')} key={setIdx}>
                  <button
                    className="set-num"
                    title="Remove set"
                    onClick={() =>
                      ex.sets.length > 1 &&
                      setExercise(exIdx, (e) => ({ ...e, sets: e.sets.filter((_, i) => i !== setIdx) }))
                    }
                  >
                    {setIdx + 1}
                  </button>
                  <span className="muted small">
                    {p ? `${toDisplay(p.weight, unit)} × ${p.reps}` : '—'}
                  </span>
                  <NumberInput
                    ariaLabel={`Set ${setIdx + 1} weight`}
                    value={toDisplay(s.weight, unit)}
                    onChange={(n) => setSet(exIdx, setIdx, { weight: fromDisplay(n, unit) })}
                    placeholder="0"
                  />
                  <NumberInput
                    ariaLabel={`Set ${setIdx + 1} reps`}
                    value={s.reps}
                    decimals={false}
                    onChange={(n) => setSet(exIdx, setIdx, { reps: n })}
                    placeholder="0"
                  />
                  <button
                    className={'check' + (s.done ? ' on' : '')}
                    aria-label={s.done ? 'Mark set not done' : 'Mark set done'}
                    aria-pressed={s.done}
                    onClick={() => {
                      const done = !s.done;
                      setSet(exIdx, setIdx, { done });
                      if (done) setRestEnd(Date.now() + REST_SECONDS * 1000);
                    }}
                  >
                    ✓
                  </button>
                </div>
              );
            })}
            <button
              className="btn-ghost full"
              onClick={() =>
                setExercise(exIdx, (e) => {
                  const last = e.sets[e.sets.length - 1];
                  return {
                    ...e,
                    sets: [...e.sets, { weight: last?.weight ?? 0, reps: last?.reps ?? 0, done: false }],
                  };
                })
              }
            >
              + Add set
            </button>
          </div>
        );
      })}

      <button className="btn-secondary full" onClick={() => setPicking(true)}>
        + Add exercise
      </button>

      <textarea
        className="notes"
        placeholder="Notes (how it felt, sleep, etc.)"
        value={active.notes}
        onChange={(e) => setActive((w) => ({ ...w, notes: e.target.value }))}
      />

      <div className="finish-row">
        <button className="btn-danger" onClick={discard}>Discard</button>
        <button className="btn-primary" onClick={finish}>Finish workout</button>
      </div>

      {restEnd && <RestTimer end={restEnd} onChange={setRestEnd} />}

      {picking && (
        <ExercisePicker
          exercises={data.exercises}
          update={update}
          onPick={addExercise}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

function RestTimer({ end, onChange }: { end: number; onChange: (end: number | null) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((end - now) / 1000));
  useEffect(() => {
    if (left === 0) {
      navigator.vibrate?.([200, 100, 200]);
      const t = setTimeout(() => onChange(null), 3000);
      return () => clearTimeout(t);
    }
  }, [left, onChange]);
  return (
    <div className={'rest-bar' + (left === 0 ? ' over' : '')} role="status">
      <span>{left === 0 ? 'Rest over, next set!' : `Rest ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</span>
      <div className="row-actions">
        <button className="btn-ghost" onClick={() => onChange(end + 30_000)}>+30s</button>
        <button className="btn-ghost" onClick={() => onChange(null)}>Skip</button>
      </div>
    </div>
  );
}

function findPRs(
  history: Workout[],
  w: Workout,
  nameOf: (id: string) => string,
  unit: AppData['settings']['unit'],
): string[] {
  const prs: string[] = [];
  for (const ex of w.exercises) {
    const prior = history.flatMap(
      (h) => h.exercises.filter((e) => e.exerciseId === ex.exerciseId).flatMap((e) => e.sets),
    );
    if (prior.length === 0) continue; // first time isn't a PR, it's a baseline
    const priorMax = Math.max(...prior.map((s) => s.weight));
    const priorE1 = Math.max(...prior.map(e1rm));
    const max = Math.max(...ex.sets.map((s) => s.weight));
    const best = Math.max(...ex.sets.map(e1rm));
    if (max > priorMax) prs.push(`${nameOf(ex.exerciseId)}: heaviest weight ${fmtWeight(max, unit)}`);
    else if (best > priorE1 + 0.01)
      prs.push(`${nameOf(ex.exerciseId)}: best est. 1RM ${fmtWeight(best, unit)}`);
  }
  return prs;
}
