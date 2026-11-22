import { useExerciseMap, useToday } from '../hooks';
import { useMemo } from 'react';
import type { AppData, WorkoutTemplate } from '../types';
import { fmtWeight, workoutVolume } from '../utils';
import { relativeDay } from '../workout';
import { WorkoutBody } from './BodyMap';
import { caloriesOn, workoutCalories } from '../calories';
import { ChevronIcon, EditIcon, PlayIcon, PlusIcon, SparkleIcon } from './Icons';

interface Props {
  data: AppData;
  onStartEmpty: () => void;
  onStartTemplate: (t: WorkoutTemplate) => void;
  onEdit: (id: string | null) => void;
  /** Open the plan builder (a few questions, then ready-made workouts). */
  onBuildPlan: () => void;
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

export function WorkoutHome({ data, onStartEmpty, onStartTemplate, onEdit, onBuildPlan }: Props) {
  const unit = data.settings.unit;
  const exById = useExerciseMap(data.exercises);
  const now = useToday();
  const showKcal = caloriesOn(data.settings);
  const bodyKg = data.settings.bodyWeightKg;

  const week = useMemo(() => {
    const start = startOfWeek(now).getTime();
    const trained = new Set<number>();
    let volume = 0;
    let count = 0;
    let kcal = 0;
    for (const w of data.workouts) {
      const t = Date.parse(w.date);
      if (t < start) continue;
      // Whole calendar days since Monday; rounding absorbs clock-change days (23h/25h).
      const d = new Date(t);
      trained.add(Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start) / 86400000));
      volume += workoutVolume(w);
      kcal += workoutCalories(w, exById, bodyKg).total;
      count++;
    }
    return { trained, volume, count, kcal, today: (now.getDay() + 6) % 7 };
  }, [data.workouts, now, exById, bodyKg]);

  const lastWorkout = data.workouts[data.workouts.length - 1];

  // Per saved workout: last time it was done and typical duration.
  const usage = useMemo(() => {
    const m = new Map<string, { last: string; mins: number[] }>();
    for (const w of data.workouts) {
      if (!w.templateId) continue;
      const u = m.get(w.templateId) ?? { last: w.date, mins: [] };
      u.last = w.date;
      if (w.finishedAt) u.mins.push((Date.parse(w.finishedAt) - Date.parse(w.date)) / 60000);
      m.set(w.templateId, u);
    }
    return m;
  }, [data.workouts]);

  const today = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="screen home">
      <header className="home-head">
        <div className="eyebrow">{today}</div>
        <h1>Ready to train?</h1>
      </header>

      <section className="card week-card" aria-label="This week">
        <div className="eyebrow">This week</div>
        <div className="week-days">
          {DAY_LETTERS.map((l, i) => (
            <div
              key={i}
              className={
                'week-day' + (week.trained.has(i) ? ' trained' : '') + (i === week.today ? ' today' : '')
              }
              aria-label={`${l}${week.trained.has(i) ? ', trained' : ''}`}
            >
              <span>{l}</span>
              <i />
            </div>
          ))}
        </div>
        <div className={'week-stats' + (showKcal ? ' four' : '')}>
          <div>
            <div className="week-num">{week.count}</div>
            <div className="muted small">workout{week.count === 1 ? '' : 's'}</div>
          </div>
          <div>
            <div className="week-num">{week.volume ? fmtWeight(week.volume, unit) : '—'}</div>
            <div className="muted small">lifted</div>
          </div>
          {showKcal && (
            <div>
              <div className="week-num">{week.kcal ? week.kcal.toLocaleString() : '—'}</div>
              <div className="muted small">kcal burned</div>
            </div>
          )}
          <div>
            <div className="week-num">{lastWorkout ? relativeDay(lastWorkout.date) : '—'}</div>
            <div className="muted small">last session</div>
          </div>
        </div>
        {showKcal && !bodyKg && (
          <p className="muted small week-hint">Add your body weight in Settings to see calories burned.</p>
        )}
      </section>

      <button className="start-empty" onClick={onStartEmpty}>
        <span className="start-icon"><PlusIcon /></span>
        <span className="start-text">
          <strong>Start an empty workout</strong>
          <span className="small">Add exercises as you go</span>
        </span>
        <ChevronIcon />
      </button>

      <section className="my-workouts">
        <div className="section-head">
          <h2>My workouts</h2>
          <div className="row-actions">
            {data.templates.length > 0 && (
              <button className="btn-ghost small-btn" onClick={onBuildPlan}>
                <SparkleIcon /> Build a plan
              </button>
            )}
            <button className="btn-ghost small-btn" onClick={() => onEdit(null)}>
              <PlusIcon /> New
            </button>
          </div>
        </div>

        {data.templates.length === 0 ? (
          <div className="card center empty-templates">
            <strong>No saved workouts yet</strong>
            <p className="muted small">
              Not sure where to start? Answer a few quick questions and get a plan made for you. Or build your own, or
              start an empty workout and save it when you finish.
            </p>
            <button className="btn-primary icon-text" onClick={onBuildPlan}>
              <SparkleIcon /> Build me a plan
            </button>
            <button className="btn-ghost" onClick={() => onEdit(null)}>Create my own workout</button>
          </div>
        ) : (
          <div className="template-list">
            {data.templates.map((t) => {
              const sets = t.exercises.reduce((n, e) => n + e.sets.filter((s) => s.kind !== 'warmup').length, 0);
              const names = t.exercises.map((e) => exById.get(e.exerciseId)?.name ?? 'Exercise');
              const muscles = [...new Set(t.exercises.map((e) => exById.get(e.exerciseId)?.muscle).filter(Boolean))];
              const u = usage.get(t.id);
              const avgMins = u?.mins.length ? Math.round(u.mins.reduce((a, b) => a + b, 0) / u.mins.length) : null;
              return (
                <article className="card template-card" key={t.id}>
                  <div className="tpl-top">
                    <div className="tpl-title">
                      <h3>{t.name}</h3>
                      <div className="muted small">
                        {t.exercises.length} exercise{t.exercises.length === 1 ? '' : 's'} · {sets} set{sets === 1 ? '' : 's'}
                        {avgMins ? ` · ~${avgMins} min` : ''}
                      </div>
                    </div>
                    <button className="icon-btn" aria-label={`Edit ${t.name}`} onClick={() => onEdit(t.id)}>
                      <EditIcon />
                    </button>
                  </div>
                  <div className="tpl-body">
                    <div className="tpl-text">
                      {muscles.length > 0 && (
                        <div className="tags">
                          {muscles.slice(0, 4).map((m) => (
                            <span className="tag" key={m}>{m}</span>
                          ))}
                        </div>
                      )}
                      <p className="tpl-exercises muted small">
                        {names.length === 0
                          ? 'No exercises yet. Tap edit to add some.'
                          : names.slice(0, 3).join(' · ') + (names.length > 3 ? ` · +${names.length - 3} more` : '')}
                      </p>
                    </div>
                    {t.exercises.length > 0 && <WorkoutBody exercises={t.exercises} exById={exById} />}
                  </div>
                  <div className="tpl-foot">
                    <span className="muted small">{u ? `Last done ${relativeDay(u.last)}` : 'Not done yet'}</span>
                    <button
                      className="btn-primary start-btn"
                      onClick={() => onStartTemplate(t)}
                      disabled={t.exercises.length === 0}
                    >
                      <PlayIcon /> Start
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
