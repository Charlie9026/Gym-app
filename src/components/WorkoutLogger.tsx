import { ask, askText, notify } from '../dialog';
import { useEffect, useMemo, useState } from 'react';
import type { AppData, SetEntry, Workout, WorkoutExercise } from '../types';
import type { Update } from '../store';
import {
  completedSets,
  e1rm,
  fmtWeight,
  fromDisplay,
  toDisplay,
} from '../utils';
import { ExercisePicker } from './ExercisePicker';
import { NumberInput } from './NumberInput';
import { newTemplate, newWorkoutFrom, structureChanged, templateExercisesFrom } from '../workout';
import { WorkoutHome } from './WorkoutHome';
import { TemplateEditor } from './TemplateEditor';

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
  // undefined = not editing; null = creating a new saved workout; string = editing that one
  const [editing, setEditing] = useState<string | null | undefined>(undefined);

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
      />
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
    const exercises = active.exercises
      .map((ex) => ({ ...ex, sets: completedSets(ex.sets) }))
      .filter((ex) => ex.sets.length > 0);
    if (exercises.length === 0) {
      const ok = await ask('No sets are marked as done. Discard this workout?', { confirmLabel: 'Discard' });
      if (ok) update((d) => ({ ...d, activeWorkout: null }));
      return;
    }
    const finished: Workout = { ...active, exercises, finishedAt: new Date().toISOString() };
    const prs = findPRs(data.workouts, finished, (id) => exById.get(id)?.name ?? 'Exercise', unit);
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
              t.id === template.id ? { ...t, exercises: done, updatedAt: new Date().toISOString() } : t,
            )
          : d.templates,
      activeWorkout: null,
    }));
    if (created) notify(`${created.name} added to My workouts`);
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
      {template && <div className="from-template muted small">From My workouts · {template.name}</div>}

      {active.exercises.length === 0 && (
        <div className="card center muted">Add your first exercise to get going.</div>
      )}

      {active.exercises.map((ex, exIdx) => {
        const info = exById.get(ex.exerciseId);
        const prev = lastSetsFor(data.workouts, ex.exerciseId);
        const targets = template?.exercises.find((t) => t.exerciseId === ex.exerciseId)?.sets ?? [];
        /** Faded suggestion for a set: last session, then the saved workout, then the set above. */
        const hintFor = (i: number): { weight: number; reps: number } | undefined => {
          if (prev[i]) return prev[i];
          if (targets[i]) return targets[i];
          const above = ex.sets[i - 1];
          if (above && (above.weight || above.reps)) return above;
          return (i > 0 ? hintFor(i - 1) : undefined) ?? prev[prev.length - 1] ?? targets[targets.length - 1];
        };
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
              const hint = hintFor(setIdx);
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
                    placeholder={hint?.weight ? String(toDisplay(hint.weight, unit)) : '0'}
                  />
                  <NumberInput
                    ariaLabel={`Set ${setIdx + 1} reps`}
                    value={s.reps}
                    decimals={false}
                    onChange={(n) => setSet(exIdx, setIdx, { reps: n })}
                    placeholder={hint?.reps ? String(hint.reps) : '0'}
                  />
                  <button
                    className={'check' + (s.done ? ' on' : '')}
                    aria-label={s.done ? 'Mark set not done' : 'Mark set done'}
                    aria-pressed={s.done}
                    onClick={() => {
                      if (s.done) return setSet(exIdx, setIdx, { done: false });
                      // Ticking with empty fields accepts the faded suggestion.
                      const weight = s.weight || hint?.weight || 0;
                      const reps = s.reps || hint?.reps || 0;
                      if (!reps) return notify('Enter the reps for this set first.');
                      setSet(exIdx, setIdx, { weight, reps, done: true });
                      setRestEnd(Date.now() + REST_SECONDS * 1000);
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
                setExercise(exIdx, (e) => ({ ...e, sets: [...e.sets, { weight: 0, reps: 0, done: false }] }))
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

      {!template && active.exercises.length > 0 && (
        <button className="btn-ghost full" onClick={saveAsTemplate}>Save to My workouts</button>
      )}

      <div className="finish-row">
        <button className="btn-danger" onClick={discard}>Discard</button>
        <button className="btn-primary" onClick={finish}>Finish workout</button>
      </div>

      {restEnd && <div className="rest-spacer" aria-hidden="true" />}
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
