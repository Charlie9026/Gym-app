import { useExerciseMap, useToday } from '../hooks';
import { useMemo, useRef, useState } from 'react';
import { useSlidingHighlight } from '../slidingHighlight';
import type { AppData, Workout, WorkoutTemplate } from '../types';
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

const NO_WORKOUTS: Workout[] = [];

/** "45 min" or "1h 5m". */
const fmtMinutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`);

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
    const byDay: Workout[][] = Array.from({ length: 7 }, () => []);
    let volume = 0;
    let count = 0;
    let kcal = 0;
    for (const w of data.workouts) {
      const t = Date.parse(w.date);
      if (t < start) continue;
      // Whole calendar days since Monday; rounding absorbs clock-change days (23h/25h).
      const d = new Date(t);
      const day = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start) / 86400000);
      trained.add(day);
      byDay[day]?.push(w);
      volume += workoutVolume(w);
      kcal += workoutCalories(w, exById, bodyKg).total;
      count++;
    }
    return { start, trained, byDay, volume, count, kcal, today: (now.getDay() + 6) % 7 };
  }, [data.workouts, now, exById, bodyKg]);

  const lastWorkout = data.workouts[data.workouts.length - 1];

  // Tapping a day shows that day's stats in the card; tapping it again goes back to the week.
  const [selected, setSelected] = useState<number | null>(null);
  const daysRef = useRef<HTMLDivElement>(null);
  const dayPillRef = useRef<HTMLSpanElement>(null);
  useSlidingHighlight(daysRef, dayPillRef, { active: '.week-day.selected', axis: 'x' }, [selected]);
  const dayDate = selected === null ? null : new Date(week.start + selected * 86400000 + 12 * 3600000); // midday: safe on clock-change days
  const dayWorkouts = selected === null ? NO_WORKOUTS : week.byDay[selected];
  const day = useMemo(() => {
    let volume = 0;
    let kcal = 0;
    let mins = 0;
    for (const w of dayWorkouts) {
      volume += workoutVolume(w);
      kcal += workoutCalories(w, exById, bodyKg).total;
      if (w.finishedAt) mins += Math.max(0, Math.round((Date.parse(w.finishedAt) - Date.parse(w.date)) / 60000));
    }
    return { volume, kcal, mins };
  }, [dayWorkouts, exById, bodyKg]);

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
        <div className="week-head">
          <div className="eyebrow">
            {dayDate ? dayDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }) : 'This week'}
          </div>
          {selected !== null && (
            <button className="btn-ghost small-btn week-back" onClick={() => setSelected(null)}>
              Show week
            </button>
          )}
        </div>
        <div className="week-days" ref={daysRef}>
          <span className={'week-pill' + (selected === null ? ' off' : '')} ref={dayPillRef} aria-hidden="true" />
          {DAY_LETTERS.map((l, i) => {
            const name = new Date(week.start + i * 86400000 + 12 * 3600000).toLocaleDateString(undefined, { weekday: 'long' });
            return (
              <button
                key={i}
                type="button"
                className={
                  'week-day' +
                  (week.trained.has(i) ? ' trained' : '') +
                  (i === week.today ? ' today' : '') +
                  (i === selected ? ' selected' : '')
                }
                aria-pressed={i === selected}
                aria-label={`${name}${week.trained.has(i) ? ', trained' : ''}${i === week.today ? ', today' : ''}`}
                onClick={() => setSelected((s) => (s === i ? null : i))}
              >
                <span>{l}</span>
                <i />
              </button>
            );
          })}
        </div>
        <div className={'week-stats' + (showKcal ? ' four' : '')} key={selected ?? 'week'}>
          {selected === null ? (
            <>
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
            </>
          ) : (
            <>
              <div>
                <div className="week-num">{dayWorkouts.length}</div>
                <div className="muted small">workout{dayWorkouts.length === 1 ? '' : 's'}</div>
              </div>
              <div>
                <div className="week-num">{day.volume ? fmtWeight(day.volume, unit) : '—'}</div>
                <div className="muted small">lifted</div>
              </div>
              {showKcal && (
                <div>
                  <div className="week-num">{day.kcal ? day.kcal.toLocaleString() : '—'}</div>
                  <div className="muted small">kcal burned</div>
                </div>
              )}
              <div>
                <div className="week-num">{day.mins ? fmtMinutes(day.mins) : '—'}</div>
                <div className="muted small">time</div>
              </div>
            </>
          )}
        </div>
        {selected !== null && (
          <div className="day-detail" key={`d${selected}`}>
            {dayWorkouts.length > 0 ? (
              <ul className="day-list">
                {dayWorkouts.map((w) => {
                  const sets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.kind !== 'warmup').length, 0);
                  const mins = w.finishedAt ? Math.round((Date.parse(w.finishedAt) - Date.parse(w.date)) / 60000) : 0;
                  return (
                    <li key={w.id}>
                      <strong>{w.name}</strong>
                      <span className="muted small">
                        {[
                          mins > 0 ? fmtMinutes(mins) : null,
                          `${w.exercises.length} exercise${w.exercises.length === 1 ? '' : 's'}`,
                          `${sets} set${sets === 1 ? '' : 's'}`,
                        ].filter(Boolean).join(' · ')}
                      </span>
                      <span className="muted small day-exercises">
                        {w.exercises.map((e) => exById.get(e.exerciseId)?.name ?? 'Exercise').join(' · ')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted small day-empty">
                {selected > week.today
                  ? 'Still to come. Nothing planned yet.'
                  : selected === week.today
                    ? 'Nothing logged yet today.'
                    : 'Rest day. No workouts logged.'}
              </p>
            )}
          </div>
        )}
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
