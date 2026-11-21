import { useState } from 'react';
import type { AppData, SetEntry, Workout, WorkoutExercise } from '../types';
import type { Update } from '../store';
import { ask, notify } from '../dialog';
import { hasValue, typeOf } from '../sets';
import { ExerciseListEditor } from './ExerciseListEditor';
import { BackIcon } from './Icons';

interface Props {
  data: AppData;
  update: Update;
  workout: Workout;
  onClose: () => void;
}

const toDateInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Edit a finished workout: name, date, exercises, sets (incl. warm-ups) and notes. */
export function WorkoutEditor({ data, update, workout, onClose }: Props) {
  const [name, setName] = useState(workout.name);
  const [date, setDate] = useState(toDateInput(workout.date));
  const [notes, setNotes] = useState(workout.notes);
  const [exercises, setExercises] = useState<WorkoutExercise[]>(workout.exercises);

  const dirty =
    name !== workout.name ||
    date !== toDateInput(workout.date) ||
    notes !== workout.notes ||
    JSON.stringify(exercises) !== JSON.stringify(workout.exercises);

  const save = () => {
    const typeFor = (id: string) => typeOf(data.exercises.find((e) => e.id === id));
    // Drop sets without a value, then exercises left with no sets.
    const clean = exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => hasValue(s, typeFor(e.exerciseId))).map((s) => ({ ...s, done: true })) }))
      .filter((e) => e.sets.length > 0);
    if (clean.length === 0) return notify('Add at least one set with a value, or delete this workout instead.');
    if (!date) return notify('Pick a date for this workout.');

    // Keep the original time of day; move the finish time by the same amount.
    const old = new Date(workout.date);
    const [y, m, d] = date.split('-').map(Number);
    const start = new Date(y, m - 1, d, old.getHours(), old.getMinutes(), old.getSeconds());
    const shift = start.getTime() - old.getTime();
    const edited: Workout = {
      ...workout,
      name: name.trim() || workout.name,
      notes,
      exercises: clean,
      date: start.toISOString(),
      finishedAt: workout.finishedAt ? new Date(Date.parse(workout.finishedAt) + shift).toISOString() : undefined,
    };
    update((dd) => ({
      ...dd,
      workouts: dd.workouts.map((w) => (w.id === workout.id ? edited : w)).sort((a, b) => a.date.localeCompare(b.date)),
    }));
    notify('Changes saved');
    onClose();
  };

  const back = async () => {
    if (dirty && !(await ask('Discard your changes to this workout?', { confirmLabel: 'Discard' }))) return;
    onClose();
  };

  const remove = () => {
    update((dd) => ({ ...dd, workouts: dd.workouts.filter((w) => w.id !== workout.id) }));
    notify(`Deleted ${workout.name}`, {
      undo: () =>
        update((dd) =>
          dd.workouts.some((w) => w.id === workout.id)
            ? dd
            : { ...dd, workouts: [...dd.workouts, workout].sort((a, b) => a.date.localeCompare(b.date)) },
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
        <span className="eyebrow">Edit past workout</span>
        <button className="btn-primary" onClick={save}>Save</button>
      </div>

      <input
        id="past-workout-name"
        className="title-input name-input"
        value={name}
        placeholder="Workout name"
        onChange={(e) => setName(e.target.value)}
        aria-label="Workout name"
      />
      <label className="date-field">
        <span className="eyebrow">Date</span>
        <input id="past-workout-date" className="text-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <ExerciseListEditor<SetEntry>
        data={data}
        update={update}
        exercises={exercises}
        onChange={setExercises}
        blankSet={() => ({ weight: 0, reps: 0, done: true })}
        emptyText="This workout has no exercises. Add one, or delete the workout."
      />

      <textarea
        id="past-workout-notes"
        className="notes"
        placeholder="Notes (how it felt, sleep, etc.)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <button className="btn-danger full" onClick={remove}>Delete workout</button>
    </div>
  );
}
