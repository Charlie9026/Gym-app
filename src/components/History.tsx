import { useMemo, useState } from 'react';
import { ask, askText, notify } from '../dialog';
import type { AppData, Workout } from '../types';
import type { Update } from '../store';
import { e1rm, fmtDate, fmtDuration, fmtWeight, toDisplay, workoutVolume } from '../utils';
import { newTemplate, newWorkoutFrom, templateExercisesFrom } from '../workout';
import { ChevronIcon, TrashIcon } from './Icons';
import { SetPills } from './SetPills';
import { CountUp } from './CountUp';

interface Props {
  data: AppData;
  update: Update;
  onRepeat: () => void;
}

function weekStart(d: Date): number {
  const k = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - k).getTime();
}

function weekLabel(start: number): string {
  const now = new Date();
  const thisWeek = weekStart(now);
  if (start === thisWeek) return 'This week';
  // Calendar arithmetic (not 7×24h) so weeks spanning a clock change still match.
  const tw = new Date(thisWeek);
  if (start === new Date(tw.getFullYear(), tw.getMonth(), tw.getDate() - 7).getTime()) return 'Last week';
  const s = new Date(start);
  const end = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${fmt(new Date(start))} – ${fmt(end)}`;
}

export function History({ data, update, onRepeat }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const unit = data.settings.unit;
  const exById = useMemo(() => new Map(data.exercises.map((e) => [e.id, e])), [data.exercises]);

  const weeks = useMemo(() => {
    const groups: { start: number; workouts: Workout[]; volume: number }[] = [];
    for (const w of [...data.workouts].reverse()) {
      const start = weekStart(new Date(w.date));
      let g = groups[groups.length - 1];
      if (!g || g.start !== start) groups.push((g = { start, workouts: [], volume: 0 }));
      g.workouts.push(w);
      g.volume += workoutVolume(w);
    }
    return groups;
  }, [data.workouts]);

  if (data.workouts.length === 0) {
    return (
      <div className="screen">
        <h1>History</h1>
        <div className="card center">
          <strong>No workouts yet</strong>
          <p className="muted small">Finish a workout and it shows up here, grouped by week.</p>
        </div>
      </div>
    );
  }

  const totalVolume = weeks.reduce((n, g) => n + g.volume, 0);
  const name = (id: string) => exById.get(id)?.name ?? 'Deleted exercise';

  const saveAsTemplate = async (w: Workout) => {
    const n = await askText('Save this to My workouts', w.name, { confirmLabel: 'Save workout', placeholder: 'e.g. Chest day' });
    if (!n) return;
    update((d) => ({ ...d, templates: [...d.templates, newTemplate(n, templateExercisesFrom(w))] }));
    notify(`${n} added to My workouts`);
  };

  const remove = async (w: Workout) => {
    const ok = await ask(`Delete “${w.name}” from ${fmtDate(w.date)}?`, { confirmLabel: 'Delete' });
    if (ok) update((d) => ({ ...d, workouts: d.workouts.filter((x) => x.id !== w.id) }));
  };

  return (
    <div className="screen">
      <header className="page-head">
        <h1>History</h1>
        <div className="summary-chips">
          <span className="chip-stat">
            <strong><CountUp value={data.workouts.length} from={0} /></strong> workout{data.workouts.length === 1 ? '' : 's'}
          </span>
          <span className="chip-stat">
            <strong><CountUp value={toDisplay(totalVolume, unit)} from={0} /> {unit}</strong> lifted
          </span>
        </div>
      </header>

      {weeks.map((g) => (
        <section className="week-group" key={g.start}>
          <div className="section-head">
            <h2>{weekLabel(g.start)}</h2>
            <span className="muted small">
              <CountUp value={g.workouts.length} from={0} /> workout{g.workouts.length === 1 ? '' : 's'} ·{' '}
              <CountUp value={toDisplay(g.volume, unit)} from={0} /> {unit}
            </span>
          </div>

          {g.workouts.map((w) => {
            const isOpen = open === w.id;
            const d = new Date(w.date);
            const sets = w.exercises.reduce((n, e) => n + e.sets.length, 0);
            return (
              <article className={'card workout-card' + (isOpen ? ' open' : '')} key={w.id}>
                <button className="workout-head" onClick={() => setOpen(isOpen ? null : w.id)} aria-expanded={isOpen}>
                  <span className="date-tile" aria-hidden="true">
                    <span>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                    <strong>{d.getDate()}</strong>
                  </span>
                  <span className="workout-title">
                    <h3>{w.name}</h3>
                    <span className="meta">
                      {w.finishedAt && <span>{fmtDuration(w.date, w.finishedAt)}</span>}
                      <span>{fmtWeight(workoutVolume(w), unit)}</span>
                      <span>
                        {sets} set{sets === 1 ? '' : 's'}
                      </span>
                    </span>
                  </span>
                  <span className="chev"><ChevronIcon /></span>
                </button>

                {/* Both views stay mounted so opening and closing can animate their height. */}
                <div className={'collapse' + (isOpen ? '' : ' open')} inert={isOpen} aria-hidden={isOpen}>
                  <div className="collapse-inner">
                  <ul className="ex-summary">
                    {w.exercises.map((ex, i) => {
                      const best = ex.sets.reduce((a, b) => (e1rm(b) > e1rm(a) ? b : a), ex.sets[0]);
                      return (
                        <li key={i}>
                          <span className="ex-name">{name(ex.exerciseId)}</span>
                          <span className="ex-best">
                            <span className="muted">
                              {ex.sets.length} set{ex.sets.length === 1 ? '' : 's'} ·
                            </span>{' '}
                            {best.weight > 0 ? `${toDisplay(best.weight, unit).toLocaleString()} ${unit} × ${best.reps}` : `${best.reps} reps`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  </div>
                </div>

                <div className={'collapse' + (isOpen ? ' open' : '')} inert={!isOpen} aria-hidden={!isOpen}>
                  <div className="collapse-inner">
                  <div className="workout-detail">
                    {w.exercises.map((ex, i) => (
                      <div key={i} className="detail-ex">
                        <div className="detail-ex-head">
                          <strong>{name(ex.exerciseId)}</strong>
                          <span className="muted small">{exById.get(ex.exerciseId)?.muscle}</span>
                        </div>
                        <SetPills sets={ex.sets} unit={unit} />
                      </div>
                    ))}
                    {w.notes && <p className="notes-view">{w.notes}</p>}
                    <div className="detail-actions">
                      <button
                        className="btn-primary"
                        disabled={!!data.activeWorkout}
                        title={data.activeWorkout ? 'Finish your current workout first' : undefined}
                        onClick={() => {
                          update((dd) => ({ ...dd, activeWorkout: newWorkoutFrom(w) }));
                          onRepeat();
                        }}
                      >
                        Repeat
                      </button>
                      <button className="btn-secondary" onClick={() => saveAsTemplate(w)}>
                        Save to My workouts
                      </button>
                      <button className="icon-btn danger big-icon" aria-label={`Delete ${w.name}`} onClick={() => remove(w)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
