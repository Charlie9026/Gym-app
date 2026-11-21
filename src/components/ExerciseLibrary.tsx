import { useMemo, useState } from 'react';
import { MUSCLE_GROUPS, type AppData, type MuscleGroup } from '../types';
import type { Update } from '../store';
import { uid } from '../utils';

export function ExerciseLibrary({ data, update }: { data: AppData; update: Update }) {
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>('Chest');

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of data.workouts) for (const ex of w.exercises) m.set(ex.exerciseId, (m.get(ex.exerciseId) ?? 0) + 1);
    return m;
  }, [data.workouts]);

  const q = query.trim().toLowerCase();
  const groups = MUSCLE_GROUPS.map((g) => ({
    group: g,
    items: data.exercises
      .filter((e) => e.muscle === g && e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    if (data.exercises.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      alert(`“${name}” already exists.`);
      return;
    }
    update((d) => ({
      ...d,
      exercises: [...d.exercises, { id: 'custom-' + uid(), name, muscle: newMuscle, custom: true }],
    }));
    setNewName('');
  };

  return (
    <div className="screen">
      <h1>Exercises</h1>
      <div className="card">
        <h3>Add custom exercise</h3>
        <div className="add-row">
          <input
            className="text-input"
            placeholder="e.g. Cable Lateral Raise"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <select className="select" value={newMuscle} onChange={(e) => setNewMuscle(e.target.value as MuscleGroup)}>
            {MUSCLE_GROUPS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <button className="btn-primary" onClick={add}>Add</button>
        </div>
      </div>

      <input className="search" placeholder="Search exercises…" value={query} onChange={(e) => setQuery(e.target.value)} />

      {groups.map(({ group, items }) => (
        <div key={group}>
          <h2>{group}</h2>
          <div className="card list-card">
            {items.map((e) => {
              const n = usage.get(e.id) ?? 0;
              return (
                <div className="list-row" key={e.id}>
                  <span>
                    {e.name} {e.custom && <span className="badge">custom</span>}
                  </span>
                  <span className="row-actions">
                    <span className="muted small">{n ? `${n} session${n === 1 ? '' : 's'}` : ''}</span>
                    {e.custom && (
                      <button
                        className="icon-btn danger"
                        aria-label={`Delete ${e.name}`}
                        onClick={() => {
                          if (n > 0) {
                            alert(`${e.name} is used in ${n} logged session(s), so it can’t be deleted.`);
                            return;
                          }
                          if (confirm(`Delete ${e.name}?`))
                            update((d) => ({ ...d, exercises: d.exercises.filter((x) => x.id !== e.id) }));
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {groups.length === 0 && <div className="card center muted">No matches.</div>}
    </div>
  );
}
