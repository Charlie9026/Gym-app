import { useMemo, useState } from 'react';
import { ChipGroup } from './ChipGroup';
import { MUSCLE_GROUPS, type AppData, type MuscleGroup, type SetEntry } from '../types';
import type { Update } from '../store';
import { ask, notify } from '../dialog';
import { e1rm, toDisplay, uid } from '../utils';
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
  const unit = data.settings.unit;

  const usage = useMemo(() => {
    const m = new Map<string, Usage>();
    for (const w of data.workouts) {
      for (const ex of w.exercises) {
        const best = ex.sets.reduce((a, b) => (e1rm(b) > e1rm(a) ? b : a), ex.sets[0]);
        const u = m.get(ex.exerciseId);
        if (!u) m.set(ex.exerciseId, { sessions: 1, best, last: w.date });
        else {
          u.sessions++;
          u.last = w.date;
          if (e1rm(best) > e1rm(u.best)) u.best = best;
        }
      }
    }
    return m;
  }, [data.workouts]);

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
      exercises: [...d.exercises, { id: 'custom-' + uid(), name, muscle: newMuscle, custom: true }],
    }));
    notify(`${name} added`);
    setNewName('');
    setAdding(false);
  };

  const remove = async (id: string, name: string) => {
    const n = usage.get(id)?.sessions ?? 0;
    if (n > 0) return notify(`${name} is used in ${n} logged session${n === 1 ? '' : 's'}, so it can’t be deleted.`);
    if (await ask(`Delete ${name}?`, { confirmLabel: 'Delete' })) {
      update((d) => ({ ...d, exercises: d.exercises.filter((x) => x.id !== id) }));
    }
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
            onChange={setNewMuscle}
            options={MUSCLE_GROUPS.map((m) => ({ value: m, label: m }))}
          />
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
                      {e.custom && <span className="badge">custom</span>}
                    </span>
                    <span className="muted small">
                      {u
                        ? `${u.sessions} session${u.sessions === 1 ? '' : 's'} · best ${
                            u.best.weight > 0 ? `${toDisplay(u.best.weight, unit).toLocaleString()} ${unit} × ${u.best.reps}` : `${u.best.reps} reps`
                          } · ${relativeDay(u.last)}`
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
