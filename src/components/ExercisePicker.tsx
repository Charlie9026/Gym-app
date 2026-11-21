import { useMemo, useState } from 'react';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../types';
import type { Update } from '../store';
import { uid } from '../utils';

interface Props {
  exercises: Exercise[];
  update: Update;
  onPick: (id: string) => void;
  onClose: () => void;
}

export function ExercisePicker({ exercises, update, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | 'All'>('All');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises
      .filter((e) => (muscle === 'All' || e.muscle === muscle) && e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, query, muscle]);

  const exactMatch = exercises.some((e) => e.name.toLowerCase() === query.trim().toLowerCase());

  const createCustom = () => {
    const name = query.trim();
    if (!name) return;
    const ex: Exercise = {
      id: 'custom-' + uid(),
      name,
      muscle: muscle === 'All' ? 'Other' : muscle,
      custom: true,
    };
    update((d) => ({ ...d, exercises: [...d.exercises, ex] }));
    onPick(ex.id);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add exercise">
        <div className="modal-header">
          <h2>Add exercise</h2>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        <input
          className="search"
          autoFocus
          placeholder="Search or create…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="chips">
          {(['All', ...MUSCLE_GROUPS] as const).map((m) => (
            <button key={m} className={'chip' + (m === muscle ? ' active' : '')} onClick={() => setMuscle(m)}>
              {m}
            </button>
          ))}
        </div>
        <ul className="pick-list">
          {query.trim() && !exactMatch && (
            <li>
              <button className="pick-item create" onClick={createCustom}>
                + Create “{query.trim()}”
                <span className="muted">{muscle === 'All' ? 'Other' : muscle}</span>
              </button>
            </li>
          )}
          {filtered.map((e) => (
            <li key={e.id}>
              <button className="pick-item" onClick={() => onPick(e.id)}>
                {e.name}
                <span className="muted">{e.muscle}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && !query.trim() && <li className="muted pad">No exercises in this group.</li>}
        </ul>
      </div>
    </div>
  );
}
