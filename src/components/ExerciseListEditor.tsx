import { useState } from 'react';
import type { AppData, SetEntry } from '../types';
import { startingSets } from '../workout';
import { useExerciseMap } from '../hooks';
import type { Update } from '../store';
import { notify } from '../dialog';
import { DEFAULT_REST_SECONDS, isWarmup, typeOf, unitsFor, unitsOf, type AnySet } from '../sets';
import { ExercisePicker } from './ExercisePicker';
import { PlusIcon, TrashIcon } from './Icons';
import { RestChip } from './RestChip';
import { CaloriesChip } from './CaloriesChip';
import { DistanceChip } from './DistanceChip';
import { caloriesOn, cardioEstimate, isCardio, withCalories } from '../calories';
import { SetsTable, type SetPatch } from './SetsTable';

/**
 * Editable list of exercises and their sets, shared by the saved-workout editor
 * and the past-workout editor. Removing an exercise or a set offers Undo.
 */
export interface EditableExercise<S extends AnySet> {
  exerciseId: string;
  sets: S[];
  calories?: number;
}

interface Props<S extends AnySet> {
  data: AppData;
  update: Update;
  exercises: EditableExercise<S>[];
  onChange: (next: EditableExercise<S>[]) => void;
  /** A blank set of the right shape (e.g. done: true for past workouts). */
  blankSet: () => S;
  emptyText: string;
  /** Past workouts: show a calories pill on cardio to type in a machine's number. */
  calories?: boolean;
  /** Saved workouts: reps can be a range like 6–8 or 12+. */
  repRanges?: boolean;
}

export function ExerciseListEditor<S extends AnySet>({ data, update, exercises, onChange, blankSet, emptyText, calories, repRanges }: Props<S>) {
  const [picking, setPicking] = useState(false);
  const units = unitsOf(data.settings);
  const exById = useExerciseMap(data.exercises);

  const apply = (fn: (xs: EditableExercise<S>[]) => EditableExercise<S>[]) => onChange(fn(exercises));

  const setEx = (i: number, fn: (e: EditableExercise<S>) => EditableExercise<S>) =>
    apply((xs) => xs.map((e, j) => (j === i ? fn(e) : e)));

  const move = (i: number, dir: -1 | 1) =>
    apply((xs) => {
      const j = i + dir;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <>
      {exercises.length === 0 && <div className="card center muted">{emptyText}</div>}

      {exercises.map((ex, i) => {
        const info = exById.get(ex.exerciseId);
        const type = typeOf(info);
        const exName = info?.name ?? 'Exercise';
        const removeExercise = () => {
          onChange(exercises.filter((_, j) => j !== i));
          notify(`${exName} removed`, { undo: () => onChange([...exercises.slice(0, i), ex, ...exercises.slice(i)]) });
        };
        const removeSet = (k: number) => {
          if (ex.sets.length <= 1) return notify('An exercise needs at least one set. Remove the exercise instead.');
          const next = exercises.map((e, j) => (j === i ? { ...e, sets: e.sets.filter((_, x) => x !== k) } : e));
          onChange(next);
          notify(`Set removed from ${exName}`, { undo: () => onChange(exercises) });
        };
        return (
          <div className="card" key={ex.exerciseId + i}>
            <div className="ex-header">
              <div className="ex-title">
                <h3>{info?.name ?? 'Unknown exercise'}</h3>
                <div className="ex-pills">
                  {info && <RestChip exercise={info} defaultSeconds={data.settings.restSeconds ?? DEFAULT_REST_SECONDS} update={update} />}
                  {info && typeOf(info) === 'distance' && <DistanceChip exercise={info} units={units} update={update} />}
                  {calories && caloriesOn(data.settings) && isCardio(info) && (
                    <CaloriesChip
                      name={exName}
                      value={ex.calories}
                      estimate={cardioEstimate({ exerciseId: ex.exerciseId, sets: ex.sets as SetEntry[] }, info, data.settings.bodyWeightKg)}
                      onChange={(kcal) => setEx(i, (e) => withCalories(e, kcal))}
                    />
                  )}
                </div>
              </div>
              <div className="row-actions">
                <button className="icon-btn" aria-label={`Move ${exName} up`} onClick={() => move(i, -1)}>↑</button>
                <button className="icon-btn" aria-label={`Move ${exName} down`} onClick={() => move(i, 1)}>↓</button>
                <button className="icon-btn danger" aria-label={`Remove ${exName}`} onClick={removeExercise}>
                  <TrashIcon />
                </button>
              </div>
            </div>
            <SetsTable
              type={type}
              units={unitsFor(info, units)}
              timeOnly={!!info?.timeOnly}
              repRanges={repRanges}
              exerciseName={exName}
              sets={ex.sets}
              mode="edit"
              onChange={(k, patch: SetPatch) =>
                setEx(i, (e) => ({ ...e, sets: e.sets.map((x, n) => (n === k ? ({ ...x, ...patch } as S) : x)) }))
              }
              onToggleWarmup={(k) =>
                setEx(i, (e) => ({
                  ...e,
                  sets: e.sets.map((x, n) => (n === k ? ({ ...x, kind: isWarmup(x) ? undefined : 'warmup' } as S) : x)),
                }))
              }
              onRemove={removeSet}
              onAdd={() =>
                setEx(i, (e) => {
                  // New sets copy the last working set's targets.
                  const last = [...e.sets].reverse().find((x) => !isWarmup(x)) ?? e.sets[e.sets.length - 1];
                  const copy = last ? ({ ...last, kind: undefined } as S) : blankSet();
                  return { ...e, sets: [...e.sets, copy] };
                })
              }
            />
          </div>
        );
      })}

      <button className="btn-secondary full icon-text" onClick={() => setPicking(true)}>
        <PlusIcon /> Add exercise
      </button>

      {picking && (
        <ExercisePicker
          exercises={data.exercises}
          update={update}
          onPick={(id, created) => {
            const type = typeOf(created ?? data.exercises.find((e) => e.id === id));
            const sets = startingSets(data, id, type).map((s) => ({ ...blankSet(), ...s }) as S);
            onChange([...exercises, { exerciseId: id, sets }]);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
