import { useMemo, useState } from 'react';
import type { AppData, SetEntry } from '../types';
import { e1rm, fmtDate, fmtWeight, toDisplay } from '../utils';
import { LineChart, type Point } from './LineChart';
import { SetPills, SetText, topSet } from './SetPills';
import { MorphSelect } from './MorphSelect';
import { MUSCLE_CODE } from '../exercises';

type Metric = 'e1rm' | 'max' | 'volume';
const METRICS: { id: Metric; label: string }[] = [
  { id: 'e1rm', label: 'Est. 1RM' },
  { id: 'max', label: 'Heaviest set' },
  { id: 'volume', label: 'Volume' },
];

interface Session {
  date: string;
  sets: SetEntry[];
}

export function Progress({ data, initialExercise }: { data: AppData; initialExercise?: string }) {
  const unit = data.settings.unit;

  // Exercises that have history, most recently trained first.
  const trained = useMemo(() => {
    const lastSeen = new Map<string, string>();
    for (const w of data.workouts) for (const ex of w.exercises) lastSeen.set(ex.exerciseId, w.date);
    return data.exercises
      .filter((e) => lastSeen.has(e.id))
      .sort((a, b) => lastSeen.get(b.id)!.localeCompare(lastSeen.get(a.id)!));
  }, [data.workouts, data.exercises]);

  const [selected, setSelected] = useState<string>(initialExercise ?? '');
  const [metric, setMetric] = useState<Metric>('e1rm');
  const exerciseId = trained.some((e) => e.id === selected) ? selected : trained[0]?.id;

  const sessions: Session[] = useMemo(
    () =>
      data.workouts.flatMap((w) =>
        w.exercises
          .filter((ex) => ex.exerciseId === exerciseId)
          .map((ex) => ({ date: w.date, sets: ex.sets })),
      ),
    [data.workouts, exerciseId],
  );

  if (trained.length === 0) {
    return (
      <div className="screen">
        <h1>Progress</h1>
        <div className="card center muted">Log a workout to start seeing progress charts.</div>
      </div>
    );
  }

  const metricOf = (s: Session): number => {
    if (metric === 'e1rm') return Math.max(...s.sets.map(e1rm));
    if (metric === 'max') return Math.max(...s.sets.map((x) => x.weight));
    return s.sets.reduce((sum, x) => sum + x.weight * x.reps, 0);
  };
  const points: Point[] = sessions.map((s) => ({ date: s.date, value: toDisplay(metricOf(s), unit) }));

  const allSets = sessions.flatMap((s) => s.sets.map((set) => ({ ...set, date: s.date })));
  const heaviest = allSets.reduce((a, b) => (b.weight > a.weight ? b : a), allSets[0]);
  const bestE1 = allSets.reduce((a, b) => (e1rm(b) > e1rm(a) ? b : a), allSets[0]);
  const mostReps = allSets.reduce((a, b) => (b.reps > a.reps ? b : a), allSets[0]);
  const bestVol = sessions.reduce((a, b) =>
    b.sets.reduce((s, x) => s + x.weight * x.reps, 0) > a.sets.reduce((s, x) => s + x.weight * x.reps, 0) ? b : a,
  );
  const bestVolValue = bestVol.sets.reduce((s, x) => s + x.weight * x.reps, 0);

  const first = points[0]?.value ?? 0;
  const last = points[points.length - 1]?.value ?? 0;
  const change = first ? ((last - first) / first) * 100 : 0;
  const name = trained.find((e) => e.id === exerciseId)?.name ?? '';

  return (
    <div className="screen">
      <h1>Progress</h1>
      <MorphSelect
        label="Exercise"
        hideLabel
        value={exerciseId}
        onChange={setSelected}
        options={trained.map((e) => ({ value: e.id, label: e.name, badge: MUSCLE_CODE[e.muscle], hint: e.muscle }))}
      />

      <div className="stats">
        <Stat label="Heaviest" value={fmtWeight(heaviest.weight, unit)} sub={`${heaviest.reps} reps · ${fmtDate(heaviest.date)}`} />
        <Stat label="Best est. 1RM" value={fmtWeight(e1rm(bestE1), unit)} sub={`${fmtWeight(bestE1.weight, unit)} × ${bestE1.reps} reps`} />
        <Stat label="Most reps" value={`${mostReps.reps}`} sub={`at ${fmtWeight(mostReps.weight, unit)}`} />
        <Stat label="Best volume" value={fmtWeight(bestVolValue, unit)} sub={fmtDate(bestVol.date)} />
      </div>

      <div className="card">
        <div className="chips">
          {METRICS.map((m) => (
            <button key={m.id} className={'chip' + (m.id === metric ? ' active' : '')} onClick={() => setMetric(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="chart-title">
          <span>{name} · {METRICS.find((m) => m.id === metric)!.label} ({unit})</span>
          {points.length > 1 && (
            <span className={'trend' + (change < 0 ? ' down' : '')}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% since first session
            </span>
          )}
        </div>
        <LineChart
          points={points}
          label={`${name} ${metric} over time`}
          format={(v) => `${Math.round(v * 10) / 10}`}
        />
        {points.length === 1 && <p className="muted small center-text">Log this exercise again to see a trend.</p>}
      </div>

      <h2>Sessions</h2>
      <div className="session-list">
        {[...sessions].reverse().map((s, i) => (
          <article className="card session" key={i}>
            <div className="session-head">
              <div>
                <h3>{fmtDate(s.date)}</h3>
                <span className="muted small">
                  {s.sets.length} set{s.sets.length === 1 ? '' : 's'} ·{' '}
                  {s.sets.reduce((n, x) => n + x.reps, 0)} reps
                </span>
              </div>
              <div className="session-metric">
                <span className="eyebrow">{METRICS.find((m) => m.id === metric)!.label}</span>
                <strong>
                  {toDisplay(metricOf(s), unit).toLocaleString()} <span className="unit">{unit}</span>
                </strong>
              </div>
            </div>
            <div className="top-set">
              <span className="eyebrow">Top set</span>
              <span className="top-set-value">
                <SetText set={topSet(s.sets)} unit={unit} />
              </span>
            </div>
            <SetPills sets={s.sets} unit={unit} />
          </article>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="stat">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="muted small">{sub}</div>
    </div>
  );
}
