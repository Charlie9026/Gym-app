import { ask } from '../dialog';
import { useMemo, useState } from 'react';
import type { AppData } from '../types';
import type { Update } from '../store';
import { e1rm, fmtDate, fmtDuration, fmtWeight, toDisplay, workoutVolume } from '../utils';
import { newWorkoutFrom } from '../workout';

interface Props {
  data: AppData;
  update: Update;
  onRepeat: () => void;
}

export function History({ data, update, onRepeat }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const unit = data.settings.unit;
  const exById = useMemo(() => new Map(data.exercises.map((e) => [e.id, e])), [data.exercises]);
  const workouts = [...data.workouts].reverse();

  if (workouts.length === 0) {
    return (
      <div className="screen">
        <h1>History</h1>
        <div className="card center muted">No workouts logged yet. Finish a workout and it’ll show up here.</div>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>History</h1>
      <p className="muted small">
        {workouts.length} workout{workouts.length === 1 ? '' : 's'} logged
      </p>
      {workouts.map((w) => {
        const isOpen = open === w.id;
        return (
          <div className="card" key={w.id}>
            <button className="history-head" onClick={() => setOpen(isOpen ? null : w.id)} aria-expanded={isOpen}>
              <div>
                <h3>{w.name}</h3>
                <div className="muted small">
                  {fmtDate(w.date)}
                  {w.finishedAt && ` · ${fmtDuration(w.date, w.finishedAt)}`}
                  {` · ${fmtWeight(workoutVolume(w), unit)} volume`}
                </div>
              </div>
              <span className="muted">{isOpen ? '▴' : '▾'}</span>
            </button>

            {!isOpen && (
              <ul className="summary-list">
                {w.exercises.map((ex, i) => {
                  const best = ex.sets.reduce((a, b) => (e1rm(b) > e1rm(a) ? b : a), ex.sets[0]);
                  return (
                    <li key={i}>
                      <span>
                        {ex.sets.length} × {exById.get(ex.exerciseId)?.name ?? 'Deleted exercise'}
                      </span>
                      <span className="muted">
                        {toDisplay(best.weight, unit)} {unit} × {best.reps}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {isOpen && (
              <div className="history-detail">
                {w.exercises.map((ex, i) => (
                  <div key={i} className="detail-ex">
                    <strong>{exById.get(ex.exerciseId)?.name ?? 'Deleted exercise'}</strong>
                    <ol>
                      {ex.sets.map((s, j) => (
                        <li key={j}>
                          {toDisplay(s.weight, unit)} {unit} × {s.reps}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
                {w.notes && <p className="notes-view">{w.notes}</p>}
                <div className="finish-row">
                  <button
                    className="btn-danger"
                    onClick={() =>
                      ask(`Delete “${w.name}” from ${fmtDate(w.date)}?`, { confirmLabel: 'Delete' }).then(
                        (ok) => ok && update((d) => ({ ...d, workouts: d.workouts.filter((x) => x.id !== w.id) })),
                      )
                    }
                  >
                    Delete
                  </button>
                  <button
                    className="btn-primary"
                    disabled={!!data.activeWorkout}
                    title={data.activeWorkout ? 'Finish your current workout first' : undefined}
                    onClick={() => {
                      update((d) => ({ ...d, activeWorkout: newWorkoutFrom(w) }));
                      onRepeat();
                    }}
                  >
                    Repeat workout
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
