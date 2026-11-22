import { ask, askText, notify } from '../dialog';
import { useEffect, useState } from 'react';
import type { AppData, Exercise, ExerciseType, SetEntry, Workout, WorkoutExercise, Units } from '../types';
import type { Update } from '../store';
import { completedSets, defaultWorkoutName, e1rm, fmtWeight } from '../utils';
import {
  DEFAULT_REST_SECONDS,
  fmtTime,
  hasValue,
  isWarmup,
  paceOf,
  toDistDisplay,
  typeOf,
  unitsFor,
  unitsOf,
  paceUnit,
  repTarget,
  workingSets,
  type AnySet,
} from '../sets';
import { SetsTable } from './SetsTable';
import { RestChip } from './RestChip';
import { CaloriesChip } from './CaloriesChip';
import { afterSetRemoved, startStopwatch, stopStopwatch, stopwatchTarget } from '../stopwatch';
import { StopwatchIcon } from './Icons';
import { DistanceChip } from './DistanceChip';
import { caloriesOn, cardioEstimate, isCardio, withCalories } from '../calories';
import { ExercisePicker } from './ExercisePicker';
import { keepRepTargets, lastSetsFor, newTemplate, newWorkoutFrom, structureChanged, templateExercisesFrom } from '../workout';
import { useExerciseMap } from '../hooks';
import { WorkoutHome } from './WorkoutHome';
import { TemplateEditor } from './TemplateEditor';
import { PlanBuilder } from './PlanBuilder';

interface Props {
  data: AppData;
  update: Update;
  /** Called with the new personal bests and the finished workout's id. */
  onFinished: (prs: string[], workoutId: string) => void;
  /** A stopwatch is starting (the rest timer gives way to it). */
  onStopwatchStart: () => void;
  /** Start the rest timer (lives in App so it keeps running across tabs). */
  onRest: (ms: number) => void;
}

/** What's missing when a set can't be ticked yet, by exercise type. */
const MISSING_VALUE: Record<ExerciseType, string> = {
  weight: 'Enter the reps for this set first.',
  reps: 'Enter the reps for this set first.',
  time: 'Enter a time for this set first.',
  distance: 'Enter a distance or time for this set first.',
  steps: 'Enter the steps or a time for this set first.',
};

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

export function WorkoutLogger({ data, update, onFinished, onRest, onStopwatchStart }: Props) {
  const active = data.activeWorkout;
  // undefined = not editing; null = creating a new saved workout; string = editing that one
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [planning, setPlanning] = useState(false);

  if (planning) {
    return (
      <PlanBuilder
        data={data}
        update={update}
        onClose={() => {
          setPlanning(false);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  if (editing !== undefined) {
    return (
      <TemplateEditor
        key={editing ?? 'new'}
        data={data}
        update={update}
        templateId={editing}
        onClose={() => {
          setEditing(undefined);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  if (!active) {
    return (
      <WorkoutHome
        data={data}
        onStartEmpty={() => update((d) => ({ ...d, activeWorkout: newWorkoutFrom() }))}
        onStartTemplate={(t) => update((d) => ({ ...d, activeWorkout: newWorkoutFrom(t) }))}
        onEdit={setEditing}
        onBuildPlan={() => {
          setPlanning(true);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  return <ActiveWorkout data={data} active={active} update={update} onFinished={onFinished} onRest={onRest} onStopwatchStart={onStopwatchStart} />;
}

function ActiveWorkout({
  data,
  active,
  update,
  onFinished,
  onRest,
  onStopwatchStart,
}: Props & { active: Workout }) {
  const [picking, setPicking] = useState(false);
  const elapsed = useElapsed(active.date);
  const units = unitsOf(data.settings);
  const timing = stopwatchTarget(active);
  const showKcal = caloriesOn(data.settings);
  const exById = useExerciseMap(data.exercises);

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
    // Fields start empty; last time's numbers show as faded hints.
    const sets: SetEntry[] = Array.from({ length: Math.max(1, prev.length) }, () => ({
      weight: 0,
      reps: 0,
      done: false,
    }));
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

  const template = active.templateId ? data.templates.find((t) => t.id === active.templateId) : undefined;

  const saveAsTemplate = async () => {
    const name = await askText('Save this to My workouts', active.name, {
      detail: 'It will appear on the Workout screen so you can start it in one tap next time.',
      confirmLabel: 'Save workout',
      placeholder: 'e.g. Chest day',
    });
    if (!name) return;
    const t = newTemplate(name, templateExercisesFrom(active));
    update((d) => ({
      ...d,
      templates: [...d.templates, t],
      activeWorkout: d.activeWorkout ? { ...d.activeWorkout, templateId: t.id, name } : null,
    }));
    notify(`${name} added to My workouts`);
  };

  const finish = async () => {
    // A running stopwatch counts: its time goes into the set it was timing.
    const timed = stopStopwatch(active);
    const exercises = timed.exercises
      .map((ex) => ({ ...ex, sets: completedSets(ex.sets) }))
      .filter((ex) => ex.sets.length > 0);
    if (exercises.length === 0) {
      const ok = await ask('No sets are marked as done. Discard this workout?', { confirmLabel: 'Discard' });
      if (ok) update((d) => ({ ...d, activeWorkout: null }));
      return;
    }
    const name = active.name.trim() || defaultWorkoutName(new Date(active.date));
    const finished: Workout = { ...timed, name, exercises, finishedAt: new Date().toISOString() };
    const prs = findPRs(data.workouts, finished, exById, units);
    const done = templateExercisesFrom(finished);

    // Work out what happens to My workouts.
    let created: ReturnType<typeof newTemplate> | null = null;
    let replaceExercises = false;
    if (!template) {
      const name = await askText('Save this to My workouts?', active.name, {
        detail: 'Saved workouts appear on the Workout screen, ready to start in one tap.',
        confirmLabel: 'Save workout',
        cancelLabel: 'Not now',
        placeholder: 'e.g. Chest day',
      });
      if (name) created = newTemplate(name, done);
    } else if (structureChanged(template.exercises, done)) {
      replaceExercises = await ask(`Update “${template.name}” to match today?`, {
        detail: 'You changed the exercises or number of sets. Keep it as is to leave the saved workout unchanged.',
        confirmLabel: 'Update',
        cancelLabel: 'Keep as is',
        danger: false,
      });
    } else {
      // Same exercises and sets: carry today's weights and reps forward for next time.
      replaceExercises = true;
    }

    update((d) => ({
      ...d,
      workouts: [...d.workouts, { ...finished, templateId: created?.id ?? finished.templateId }],
      templates: created
        ? [...d.templates, created]
        : replaceExercises && template
          ? d.templates.map((t) =>
              t.id === template.id ? { ...t, exercises: keepRepTargets(t.exercises, done), updatedAt: new Date().toISOString() } : t,
            )
          : d.templates,
      activeWorkout: null,
    }));
    if (created) notify(`${created.name} added to My workouts`);
    onFinished(prs, finished.id);
  };

  const discard = () => {
    const kept = active;
    update((d) => ({ ...d, activeWorkout: null }));
    notify('Workout discarded', { undo: () => update((d) => ({ ...d, activeWorkout: kept })) });
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
      {template && <div className="from-template muted small">From My workouts · {template.name}</div>}

      {active.exercises.length === 0 && (
        <div className="card center muted">Add your first exercise to get going.</div>
      )}

      {active.exercises.map((ex, exIdx) => {
        const info = exById.get(ex.exerciseId);
        const type = typeOf(info);
        const exName = info?.name ?? 'this exercise';
        const prev = lastSetsFor(data.workouts, ex.exerciseId);
        const targets = template?.exercises.find((t) => t.exerciseId === ex.exerciseId)?.sets ?? [];
        // The saved workout's rep range for the working sets, e.g. "6–8" (shown as a reminder).
        const ranged = targets.find((t) => !t.kind && (t.repsTo || t.repsOpen));
        const target = ranged ? repTarget(ranged) : null;
        /** Faded suggestion for a set: last session, then the saved workout, then the set above. */
        const hintFor = (i: number): AnySet | undefined => {
          if (prev[i]) return prev[i];
          if (targets[i]) return targets[i];
          const above = ex.sets[i - 1];
          if (above && hasValue(above, type)) return above;
          return (i > 0 ? hintFor(i - 1) : undefined) ?? prev[prev.length - 1] ?? targets[targets.length - 1];
        };
        const toggleDone = (i: number) => {
          const s = ex.sets[i];
          if (s.done) return setSet(exIdx, i, { done: false });
          // Ticking with empty fields accepts the faded suggestion.
          const h = hintFor(i);
          const filled = {
            weight: s.weight || h?.weight || 0,
            reps: s.reps || h?.reps || 0,
            seconds: s.seconds || h?.seconds || 0,
            meters: s.meters || h?.meters || 0,
          };
          if (!hasValue(filled, type)) return notify(MISSING_VALUE[type]);
          setSet(exIdx, i, { ...filled, done: true });
          const restMs = (info?.restSeconds ?? data.settings.restSeconds ?? DEFAULT_REST_SECONDS) * 1000;
          if (restMs > 0) onRest(restMs);
        };
        const removeSet = (i: number) => {
          if (ex.sets.length <= 1) return notify('An exercise needs at least one set. Remove the exercise instead.');
          const removed = ex.sets[i];
          setActive((w) =>
            afterSetRemoved(
              { ...w, exercises: w.exercises.map((e, k) => (k === exIdx ? { ...e, sets: e.sets.filter((_, x) => x !== i) } : e)) },
              ex.exerciseId,
              i,
            ),
          );
          notify(`Set removed from ${exName}`, {
            undo: () => setExercise(exIdx, (e) => ({ ...e, sets: [...e.sets.slice(0, i), removed, ...e.sets.slice(i)] })),
          });
        };
        const removeExercise = () => {
          setActive((w) => ({ ...w, exercises: w.exercises.filter((_, k) => k !== exIdx) }));
          notify(`${info?.name ?? 'Exercise'} removed`, {
            undo: () => setActive((w) => ({ ...w, exercises: [...w.exercises.slice(0, exIdx), ex, ...w.exercises.slice(exIdx)] })),
          });
        };
        return (
          <div className="card" key={exIdx}>
            <div className="ex-header">
              <div className="ex-title">
                <h3>{info?.name ?? 'Unknown exercise'}</h3>
                <div className="ex-pills">
                  {target && (
                    <span className="target-chip" title="Rep range from your saved workout">
                      Aim for {target} reps
                    </span>
                  )}
                  {info && <RestChip exercise={info} defaultSeconds={data.settings.restSeconds ?? DEFAULT_REST_SECONDS} update={update} />}
                  {info && typeOf(info) === 'distance' && <DistanceChip exercise={info} units={units} update={update} />}
                  {showKcal && isCardio(info) && (
                    <CaloriesChip
                      name={exName}
                      value={ex.calories}
                      estimate={cardioEstimate(ex, info, data.settings.bodyWeightKg)}
                      onChange={(kcal) => setExercise(exIdx, (e) => withCalories(e, kcal))}
                    />
                  )}
                </div>
              </div>
              <div className="row-actions">
                <button className="icon-btn" aria-label={`Move ${exName} up`} onClick={() => moveExercise(exIdx, -1)}>↑</button>
                <button className="icon-btn" aria-label={`Move ${exName} down`} onClick={() => moveExercise(exIdx, 1)}>↓</button>
                <button className="icon-btn danger" aria-label={`Remove ${exName}`} onClick={removeExercise}>
                  ✕
                </button>
              </div>
            </div>
            <SetsTable
              type={type}
              units={unitsFor(info, units)}
              timeOnly={!!info?.timeOnly}
              exerciseName={info?.name ?? 'Exercise'}
              sets={ex.sets}
              mode="log"
              prev={prev}
              hintFor={hintFor}
              onChange={(i, patch) => setSet(exIdx, i, patch)}
              onToggleDone={toggleDone}
              onToggleWarmup={(i) => setSet(exIdx, i, { kind: isWarmup(ex.sets[i]) ? undefined : 'warmup' })}
              onRemove={removeSet}
              onAdd={() => setExercise(exIdx, (e) => ({ ...e, sets: [...e.sets, { weight: 0, reps: 0, done: false }] }))}
              timingIndex={timing?.exIdx === exIdx ? timing.setIdx : undefined}
            />
            {(type === 'time' || type === 'distance' || type === 'steps') && !active.stopwatch && (
              <button
                className="btn-secondary stopwatch-start"
                onClick={() => {
                  onStopwatchStart();
                  setActive((w) => startStopwatch(w, exIdx));
                }}
              >
                <StopwatchIcon /> Start stopwatch
              </button>
            )}
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

      {!template && active.exercises.length > 0 && (
        <button className="btn-ghost full" onClick={saveAsTemplate}>Save to My workouts</button>
      )}

      <div className="finish-row">
        <button className="btn-danger" onClick={discard}>Discard</button>
        <button className="btn-primary" onClick={finish}>Finish workout</button>
      </div>


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

function findPRs(
  history: Workout[],
  w: Workout,
  exById: Map<string, Exercise>,
  units: Units,
): string[] {
  const prs: string[] = [];
  for (const ex of w.exercises) {
    const info = exById.get(ex.exerciseId);
    const type = typeOf(info);
    const name = info?.name ?? 'Exercise';
    const u = unitsFor(info, units);
    const prior = workingSets(
      history.flatMap((h) => h.exercises.filter((e) => e.exerciseId === ex.exerciseId).flatMap((e) => e.sets)),
    );
    const now = workingSets(ex.sets);
    if (prior.length === 0 || now.length === 0) continue; // first time is a baseline, not a PR
    const best = (sets: SetEntry[], f: (s: SetEntry) => number) => Math.max(...sets.map(f));
    if (type === 'weight') {
      if (best(now, (s) => s.weight) > best(prior, (s) => s.weight)) prs.push(`${name}: heaviest weight ${fmtWeight(best(now, (s) => s.weight), units.weight)}`);
      else if (best(now, e1rm) > best(prior, e1rm) + 0.01) prs.push(`${name}: best est. 1RM ${fmtWeight(best(now, e1rm), units.weight)}`);
      else if (best(now, (s) => (s.weight ? 0 : s.reps)) > best(prior, (s) => (s.weight ? 0 : s.reps))) prs.push(`${name}: most reps ${best(now, (s) => s.reps)}`);
    } else if (type === 'reps') {
      if (best(now, (s) => s.reps) > best(prior, (s) => s.reps)) prs.push(`${name}: most reps ${best(now, (s) => s.reps)}`);
    } else if (type === 'time') {
      if (best(now, (s) => s.seconds ?? 0) > best(prior, (s) => s.seconds ?? 0)) prs.push(`${name}: longest ${fmtTime(best(now, (s) => s.seconds ?? 0))}`);
    } else if (type === 'steps') {
      if (best(now, (s) => s.reps) > best(prior, (s) => s.reps)) prs.push(`${name}: most steps ${best(now, (s) => s.reps).toLocaleString()}`);
      else if (best(now, (s) => s.seconds ?? 0) > best(prior, (s) => s.seconds ?? 0)) prs.push(`${name}: longest ${fmtTime(best(now, (s) => s.seconds ?? 0))}`);
    } else {
      const far = (s: SetEntry) => s.meters ?? 0;
      const pace = (s: SetEntry) => paceOf(s, u) || Infinity;
      if (best(now, far) > best(prior, far)) prs.push(`${name}: longest ${toDistDisplay(best(now, far), u.distance)} ${u.distance}`);
      else if (Math.min(...now.map(pace)) < Math.min(...prior.map(pace))) prs.push(`${name}: fastest pace ${fmtTime(Math.min(...now.map(pace)))} ${paceUnit(u)}`);
    }
  }
  return prs;
}
