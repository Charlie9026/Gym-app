import { useMemo, useState } from 'react';
import type { AppData, TemplateExercise, TemplateSet } from '../types';
import type { Update } from '../store';
import { ask, notify } from '../dialog';
import { fromDisplay, toDisplay } from '../utils';
import { newTemplate } from '../workout';
import { ExercisePicker } from './ExercisePicker';
import { BackIcon, PlusIcon, TrashIcon } from './Icons';
import { NumberInput } from './NumberInput';

interface Props {
  data: AppData;
  update: Update;
  /** Saved workout to edit, or null to create a new one. */
  templateId: string | null;
  onClose: () => void;
}

/** Most recent logged sets for an exercise, to pre-fill a newly added exercise. */
function lastSets(data: AppData, exerciseId: string): TemplateSet[] {
  for (let i = data.workouts.length - 1; i >= 0; i--) {
    const ex = data.workouts[i].exercises.find((e) => e.exerciseId === exerciseId);
    if (ex) return ex.sets.map((s) => ({ weight: s.weight, reps: s.reps }));
  }
  return [
    { weight: 0, reps: 8 },
    { weight: 0, reps: 8 },
    { weight: 0, reps: 8 },
  ];
}

export function TemplateEditor({ data, update, templateId, onClose }: Props) {
  const existing = data.templates.find((t) => t.id === templateId) ?? null;
  const [name, setName] = useState(existing?.name ?? '');
  const [exercises, setExercises] = useState<TemplateExercise[]>(existing?.exercises ?? []);
  const [picking, setPicking] = useState(false);
  const unit = data.settings.unit;
  const exById = useMemo(() => new Map(data.exercises.map((e) => [e.id, e])), [data.exercises]);

  const dirty =
    name !== (existing?.name ?? '') || JSON.stringify(exercises) !== JSON.stringify(existing?.exercises ?? []);

  const setEx = (i: number, fn: (e: TemplateExercise) => TemplateExercise) =>
    setExercises((xs) => xs.map((e, j) => (j === i ? fn(e) : e)));

  const setSet = (i: number, s: number, patch: Partial<TemplateSet>) =>
    setEx(i, (e) => ({ ...e, sets: e.sets.map((x, k) => (k === s ? { ...x, ...patch } : x)) }));

  const move = (i: number, dir: -1 | 1) =>
    setExercises((xs) => {
      const j = i + dir;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return notify('Give this workout a name first.');
    if (exercises.length === 0) return notify('Add at least one exercise.');
    const clean = exercises.map((e) => ({ ...e, sets: e.sets.length ? e.sets : [{ weight: 0, reps: 8 }] }));
    update((d) => {
      if (existing) {
        return {
          ...d,
          templates: d.templates.map((t) =>
            t.id === existing.id ? { ...t, name: trimmed, exercises: clean, updatedAt: new Date().toISOString() } : t,
          ),
        };
      }
      return { ...d, templates: [...d.templates, newTemplate(trimmed, clean)] };
    });
    notify(existing ? `Saved changes to ${trimmed}` : `${trimmed} added to My workouts`);
    onClose();
  };

  const back = async () => {
    if (dirty && !(await ask('Discard your changes to this workout?', { confirmLabel: 'Discard' }))) return;
    onClose();
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await ask(`Delete “${existing.name}” from My workouts?`, {
      confirmLabel: 'Delete',
      detail: 'Your logged history stays. Only the saved workout is removed.',
    });
    if (!ok) return;
    update((d) => ({ ...d, templates: d.templates.filter((t) => t.id !== existing.id) }));
    notify(`Deleted ${existing.name}`);
    onClose();
  };

  return (
    <div className="screen editor">
      <div className="editor-bar">
        <button className="btn-ghost back-btn" onClick={back}>
          <BackIcon /> Back
        </button>
        <span className="eyebrow">{existing ? 'Edit workout' : 'New workout'}</span>
        <button className="btn-primary" onClick={save}>Save</button>
      </div>

      <input
        id="template-name"
        className="title-input name-input"
        placeholder="Name, e.g. Chest day"
        value={name}
        autoFocus={!existing}
        onChange={(e) => setName(e.target.value)}
        aria-label="Workout name"
      />

      {exercises.length === 0 && (
        <div className="card center muted">Add the exercises for this workout. You can set target weights and reps for each set.</div>
      )}

      {exercises.map((ex, i) => {
        const info = exById.get(ex.exerciseId);
        return (
          <div className="card" key={ex.exerciseId + i}>
            <div className="ex-header">
              <div>
                <h3>{info?.name ?? 'Unknown exercise'}</h3>
                {info && <span className="muted small">{info.muscle}</span>}
              </div>
              <div className="row-actions">
                <button className="icon-btn" aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
                <button className="icon-btn" aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
                <button
                  className="icon-btn danger"
                  aria-label={`Remove ${info?.name ?? 'exercise'}`}
                  onClick={() => setExercises((xs) => xs.filter((_, j) => j !== i))}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
            <div className="tset-grid tset-head">
              <span>Set</span>
              <span>{unit}</span>
              <span>Reps</span>
              <span />
            </div>
            {ex.sets.map((s, k) => (
              <div className="tset-grid" key={k}>
                <span className="set-num static">{k + 1}</span>
                <NumberInput
                  ariaLabel={`${info?.name} set ${k + 1} weight`}
                  value={toDisplay(s.weight, unit)}
                  onChange={(n) => setSet(i, k, { weight: fromDisplay(n, unit) })}
                  placeholder="0"
                />
                <NumberInput
                  ariaLabel={`${info?.name} set ${k + 1} reps`}
                  value={s.reps}
                  decimals={false}
                  onChange={(n) => setSet(i, k, { reps: n })}
                  placeholder="0"
                />
                <button
                  className="icon-btn"
                  aria-label={`Remove set ${k + 1}`}
                  disabled={ex.sets.length <= 1}
                  onClick={() => setEx(i, (e) => ({ ...e, sets: e.sets.filter((_, x) => x !== k) }))}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="btn-ghost full"
              onClick={() =>
                setEx(i, (e) => {
                  const last = e.sets[e.sets.length - 1] ?? { weight: 0, reps: 8 };
                  return { ...e, sets: [...e.sets, { ...last }] };
                })
              }
            >
              + Add set
            </button>
          </div>
        );
      })}

      <button className="btn-secondary full icon-text" onClick={() => setPicking(true)}>
        <PlusIcon /> Add exercise
      </button>

      {existing && (
        <button className="btn-danger full" onClick={remove}>Delete workout</button>
      )}

      {picking && (
        <ExercisePicker
          exercises={data.exercises}
          update={update}
          onPick={(id) => {
            setExercises((xs) => [...xs, { exerciseId: id, sets: lastSets(data, id) }]);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
