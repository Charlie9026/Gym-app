import { useMemo, useState } from 'react';
import { ChipGroup } from './ChipGroup';
import { MUSCLE_GROUPS, type AppData, type ExerciseType, type MuscleGroup, type SetEntry } from '../types';
import type { Update } from '../store';
import { notify } from '../dialog';
import { uid } from '../utils';
import { EXERCISE_TYPES, setScore, setText, topSet, typeOf } from '../sets';
import { relativeDay } from '../workout';
import { MUSCLE_CODE } from '../exercises';
import { ChevronIcon, PlusIcon, TrashIcon } from './Icons';

interface Props {
  data: AppData;
  update: Update;
  /** Open an exercise's progress chart. */
  onOpen: (exerciseId: string) => void;
}


type Filter = 'All' | 'Logged' | MuscleGroup;

const TYPE_BADGE: Record<ExerciseType, string> = { weight: 'weight', reps: 'reps only', time: 'time', distance: 'distance' };

interface Usage {
  sessions: number;
  best: SetEntry;
  last: string;
}

export function ExerciseLibrary({ data, update, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>('Chest');
  const [newType, setNewType] = useState<ExerciseType>('weight');
  const unit = data.settings.unit;

  const usage = useMemo(() => {
    const types = new Map(data.exercises.map((e) => [e.id, typeOf(e)]));
    const m = new Map<string, Usage>();
    for (const w of data.workouts) {
      for (const ex of w.exercises) {
        const type = types.get(ex.exerciseId) ?? 'weight';
        const best = topSet(ex.sets, type); // working sets only (warm-ups ignored)
        const u = m.get(ex.exerciseId);
        if (!u) m.set(ex.exerciseId, { sessions: 1, best, last: w.date });
        else {
          u.sessions++;
          u.last = w.date;
          if (setScore(best, type) > setScore(u.best, type)) u.best = best;
        }
      }
    }
    return m;
  }, [data.workouts, data.exercises]);

  const q = query.trim().toLowerCase();
  const visible = data.exercises.filter(
    (e) =>
      e.name.toLowerCase().includes(q) &&
      (filter === 'All' || (filter === 'Logged' ? usage.has(e.id) : e.muscle === filter)),
  );
  const groups = MUSCLE_GROUPS.map((g) => ({
    group: g,
    items: visible.filter((e) => e.muscle === g).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);
  const presentMuscles = MUSCLE_GROUPS.filter((g) => data.exercises.some((e) => e.muscle === g));

  const add = () => {
    const name = newName.trim();
    if (!name) return notify('Type a name for the exercise first.');
    if (data.exercises.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      return notify(`“${name}” is already in your library.`);
    }
    update((d) => ({
      ...d,
      exercises: [...d.exercises, { id: 'custom-' + uid(), name, muscle: newMuscle, custom: true, ...(newType !== 'weight' ? { type: newType } : {}) }],
    }));
    notify(`${name} added`);
    setNewName('');
    setNewType('weight');
    setAdding(false);
  };

  const remove = async (id: string, name: string) => {
    const n = usage.get(id)?.sessions ?? 0;
    if (n > 0) return notify(`${name} is used in ${n} logged session${n === 1 ? '' : 's'}, so it can’t be deleted.`);
    const inTemplates = data.templates.filter((t) => t.exercises.some((e) => e.exerciseId === id));
    if (inTemplates.length) {
      return notify(`${name} is in ${inTemplates.map((t) => t.name).join(', ')}. Remove it from there first.`);
    }
    if (data.activeWorkout?.exercises.some((e) => e.exerciseId === id)) {
      return notify(`${name} is in your current workout. Remove it there first.`);
    }
    const removed = data.exercises.find((x) => x.id === id);
    update((d) => ({ ...d, exercises: d.exercises.filter((x) => x.id !== id) }));
    notify(`Deleted ${name}`, {
      undo: () => removed && update((d) => (d.exercises.some((x) => x.id === id) ? d : { ...d, exercises: [...d.exercises, removed] })),
    });
  };

  return (
    <div className="screen">
      <header className="page-head">
        <div className="page-title-row">
          <h1>Exercises</h1>
          <button className="btn-secondary icon-text compact" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
            <PlusIcon /> New
          </button>
        </div>
        <div className="summary-chips">
          <span className="chip-stat"><strong>{data.exercises.length}</strong> exercises</span>
          <span className="chip-stat"><strong>{usage.size}</strong> logged</span>
        </div>
      </header>

      {adding && (
        <div className="card add-card">
          <h3>New exercise</h3>
          <input
            id="new-exercise-name"
            className="text-input"
            placeholder="e.g. Cable Lateral Raise"
            value={newName}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <ChipGroup
            label="Muscle group"
            kind="radio"
            wrap
            value={newMuscle}
            onChange={(m) => {
              setNewMuscle(m);
              if (m === 'Cardio') setNewType('distance');
            }}
            options={MUSCLE_GROUPS.map((m) => ({ value: m, label: m }))}
          />
          <span className="eyebrow">Logged as</span>
          <ChipGroup label="How it's logged" kind="radio" wrap value={newType} onChange={setNewType} options={EXERCISE_TYPES} />
          <div className="finish-row">
            <button className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn-primary" onClick={add}>Add exercise</button>
          </div>
        </div>
      )}

      <input
        id="exercise-search"
        className="search"
        placeholder="Search exercises…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ChipGroup
        label="Filter exercises"
        value={filter}
        onChange={setFilter}
        options={(['All', 'Logged', ...presentMuscles] as Filter[]).map((f) => ({ value: f, label: f }))}
      />

      {groups.map(({ group, items }) => (
        <section className="ex-group" key={group}>
          <div className="section-head">
            <h2>{group}</h2>
            <span className="muted small">{items.length}</span>
          </div>
          <div className="card list-card">
            {items.map((e) => {
              const u = usage.get(e.id);
              const content = (
                <>
                  <span className="muscle-badge" aria-hidden="true">{MUSCLE_CODE[e.muscle]}</span>
                  <span className="ex-row-text">
                    <span className="ex-row-name">
                      {e.name}
                      {typeOf(e) !== 'weight' && <span className="badge type">{TYPE_BADGE[typeOf(e)]}</span>}
                      {e.custom && <span className="badge">custom</span>}
                    </span>
                    <span className="muted small">
                      {u
                        ? `${u.sessions} session${u.sessions === 1 ? '' : 's'} · best ${setText(u.best, typeOf(e), unit)} · ${relativeDay(u.last)}`
                        : 'Not logged yet'}
                    </span>
                  </span>
                </>
              );
              return (
                <div className="ex-row" key={e.id}>
                  {u ? (
                    <button className="ex-row-main" onClick={() => onOpen(e.id)} aria-label={`${e.name}, view progress`}>
                      {content}
                      <span className="chev"><ChevronIcon /></span>
                    </button>
                  ) : (
                    <div className="ex-row-main">{content}</div>
                  )}
                  {e.custom && !u && (
                    <button className="icon-btn danger" aria-label={`Delete ${e.name}`} onClick={() => remove(e.id, e.name)}>
                      <TrashIcon />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {groups.length === 0 && (
        <div className="card center">
          <strong>No matches</strong>
          <p className="muted small">Try another search, or add it with the New button.</p>
        </div>
      )}
    </div>
  );
}
