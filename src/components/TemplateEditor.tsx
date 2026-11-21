import { useState } from 'react';
import type { AppData, TemplateExercise, TemplateSet } from '../types';
import type { Update } from '../store';
import { ask, notify } from '../dialog';
import { newTemplate } from '../workout';
import { ExerciseListEditor } from './ExerciseListEditor';
import { BackIcon } from './Icons';

interface Props {
  data: AppData;
  update: Update;
  /** Saved workout to edit, or null to create a new one. */
  templateId: string | null;
  onClose: () => void;
}

export function TemplateEditor({ data, update, templateId, onClose }: Props) {
  const existing = data.templates.find((t) => t.id === templateId) ?? null;
  const [name, setName] = useState(existing?.name ?? '');
  const [exercises, setExercises] = useState<TemplateExercise[]>(existing?.exercises ?? []);

  const dirty =
    name !== (existing?.name ?? '') || JSON.stringify(exercises) !== JSON.stringify(existing?.exercises ?? []);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return notify('Give this workout a name first.');
    if (exercises.length === 0) return notify('Add at least one exercise.');
    // Keep at least one set per exercise; empty targets are fine in a saved workout.
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

  const remove = () => {
    if (!existing) return;
    const at = data.templates.findIndex((t) => t.id === existing.id);
    update((d) => ({ ...d, templates: d.templates.filter((t) => t.id !== existing.id) }));
    notify(`Deleted ${existing.name}`, {
      undo: () =>
        update((d) =>
          d.templates.some((t) => t.id === existing.id)
            ? d
            : { ...d, templates: [...d.templates.slice(0, at), existing, ...d.templates.slice(at)] },
        ),
    });
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

      <ExerciseListEditor<TemplateSet>
        data={data}
        update={update}
        exercises={exercises}
        onChange={setExercises}
        blankSet={() => ({ weight: 0, reps: 0 })}
        emptyText="Add the exercises for this workout. You can set target weights, reps or times for each set."
      />

      {existing && (
        <button className="btn-danger full" onClick={remove}>Delete workout</button>
      )}
    </div>
  );
}
