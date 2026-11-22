import { useMemo, useState, type ReactNode } from 'react';
import { ChipGroup } from './ChipGroup';
import type { AppData, ExerciseType, SetEntry, Units } from '../types';
import { e1rm, fmtDate, fmtWeight, toDisplay } from '../utils';
import {
  MEASURES,
  fmtTime,
  paceOf,
  setCountText,
  toDistDisplay,
  topSet,
  typeOf,
  unitsOf,
  workingSets,
  type Measure,
} from '../sets';
import { LineChart, type Point } from './LineChart';
import { SetPills, SetText } from './SetPills';
import { MorphSelect } from './MorphSelect';
import { StatCards, type StatItem } from './StatCards';
import { CountUp, TrendBadge } from './CountUp';
import { CalendarIcon, ClockIcon, RepeatIcon, RouteIcon, StackIcon, TrophyIcon, WeightIcon } from './Icons';
import { MUSCLE_CODE } from '../exercises';
import { useExerciseMap } from '../hooks';
import { caloriesOn, workoutCalories } from '../calories';

interface Session {
  date: string;
  sets: SetEntry[];
  /** Calories for this exercise in that workout (0 when off or unknown). */
  kcal: number;
}

/** Extra chart measure for every exercise once calories can be shown. */
const KCAL_MEASURE: Measure = {
  id: 'calories',
  label: 'Calories burned',
  unitLabel: () => 'kcal',
  value: () => 0, // filled in from the session (needs the whole workout)
  format: (v) => Math.round(v).toLocaleString(),
};

type Range = '1m' | '3m' | 'all';
const RANGES: { value: Range; label: string }[] = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: 'all', label: 'All' },
];
const RANGE_TREND_LABEL: Record<Range, string> = { '1m': 'in the last month', '3m': 'in the last 3 months', all: 'since first session' };

function rangeStart(range: Range): number {
  if (range === 'all') return -Infinity;
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - (range === '1m' ? 1 : 3), d.getDate()).getTime();
}

const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** The four stat cards for an exercise, by type (working sets only). */
function statsFor(type: ExerciseType, sessions: Session[], units: Units): StatItem[] {
  const unit = units.weight;
  const d = units.distance;
  const all = sessions.flatMap((s) => s.sets.map((set) => ({ ...set, date: s.date })));
  const bestBy = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, b) => (f(b) > f(a) ? b : a), xs[0]);
  const count = `${sessions.length} session${sessions.length === 1 ? '' : 's'}`;

  if (type === 'reps') {
    const most = bestBy(all, (x) => x.reps);
    const bestSession = bestBy(sessions, (s) => sumOf(s.sets.map((x) => x.reps)));
    return [
      { label: 'Most reps', icon: <RepeatIcon />, value: most.reps, sub: fmtDate(most.date) },
      { label: 'Best session', icon: <StackIcon />, value: sumOf(bestSession.sets.map((x) => x.reps)), unit: 'reps', sub: fmtDate(bestSession.date) },
      { label: 'Total reps', icon: <TrophyIcon />, value: sumOf(all.map((x) => x.reps)), sub: count },
      { label: 'Sessions', icon: <CalendarIcon />, value: sessions.length, sub: `since ${fmtDate(sessions[0].date)}` },
    ];
  }
  if (type === 'time') {
    const longest = bestBy(all, (x) => x.seconds ?? 0);
    const bestSession = bestBy(sessions, (s) => sumOf(s.sets.map((x) => x.seconds ?? 0)));
    return [
      { label: 'Longest set', icon: <ClockIcon />, value: longest.seconds ?? 0, format: fmtTime, sub: fmtDate(longest.date) },
      { label: 'Best session', icon: <StackIcon />, value: sumOf(bestSession.sets.map((x) => x.seconds ?? 0)), format: fmtTime, sub: fmtDate(bestSession.date) },
      { label: 'Total time', icon: <TrophyIcon />, value: sumOf(all.map((x) => x.seconds ?? 0)), format: fmtTime, sub: count },
      { label: 'Sessions', icon: <CalendarIcon />, value: sessions.length, sub: `since ${fmtDate(sessions[0].date)}` },
    ];
  }
  if (type === 'distance') {
    const dist = (s: Session) => toDistDisplay(sumOf(s.sets.map((x) => x.meters ?? 0)), d);
    const km = (n: number) => (Math.round(n * 100) / 100).toLocaleString(); // distances keep 2 decimals, as elsewhere
    const longest = bestBy(sessions, dist);
    const paced = all.filter((x) => paceOf(x, d) > 0);
    const fastest = paced.length ? paced.reduce((a, b) => (paceOf(b, d) < paceOf(a, d) ? b : a)) : null;
    return [
      { label: 'Longest', icon: <RouteIcon />, value: dist(longest), format: km, unit: d, sub: fmtDate(longest.date) },
      {
        label: 'Best pace', icon: <ClockIcon />, value: fastest ? paceOf(fastest, d) : 0, format: (n) => (n ? fmtTime(n) : '—'),
        unit: fastest ? `/${d}` : undefined, sub: fastest ? fmtDate(fastest.date) : 'needs distance and time',
      },
      { label: 'Total distance', icon: <StackIcon />, value: toDistDisplay(sumOf(all.map((x) => x.meters ?? 0)), d), format: km, unit: d, sub: count },
      { label: 'Sessions', icon: <CalendarIcon />, value: sessions.length, sub: `since ${fmtDate(sessions[0].date)}` },
    ];
  }
  const heaviest = bestBy(all, (x) => x.weight);
  const bestE1 = bestBy(all, e1rm);
  const mostReps = bestBy(all, (x) => x.reps);
  const vol = (s: Session) => sumOf(s.sets.map((x) => x.weight * x.reps));
  const bestVol = bestBy(sessions, vol);
  return [
    { label: 'Heaviest', icon: <WeightIcon />, value: toDisplay(heaviest.weight, unit), unit, sub: `${heaviest.reps} reps · ${fmtDate(heaviest.date)}` },
    { label: 'Best est. 1RM', icon: <TrophyIcon />, value: toDisplay(e1rm(bestE1), unit), unit, sub: `${fmtWeight(bestE1.weight, unit)} × ${bestE1.reps} reps` },
    { label: 'Most reps', icon: <RepeatIcon />, value: mostReps.reps, sub: `at ${fmtWeight(mostReps.weight, unit)}` },
    { label: 'Best volume', icon: <StackIcon />, value: toDisplay(vol(bestVol), unit), unit, sub: fmtDate(bestVol.date) },
  ];
}

/** Small summary under a session's date, by type. */
function sessionSummary(type: ExerciseType, sets: SetEntry[], units: Units): string {
  const w = workingSets(sets);
  const counts = setCountText(sets);
  if (type === 'time') return `${counts} · ${fmtTime(sumOf(w.map((x) => x.seconds ?? 0)))} total`;
  if (type === 'distance') return `${counts} · ${toDistDisplay(sumOf(w.map((x) => x.meters ?? 0)), units.distance)} ${units.distance}`;
  return `${counts} · ${sumOf(w.map((x) => x.reps))} reps`;
}

export function Progress({ data, initialExercise }: { data: AppData; initialExercise?: string }) {
  const units = unitsOf(data.settings);
  const exById = useExerciseMap(data.exercises);
  const showKcal = caloriesOn(data.settings);
  const bodyKg = data.settings.bodyWeightKg;

  // Exercises that have history, most recently trained first.
  const trained = useMemo(() => {
    const lastSeen = new Map<string, string>();
    for (const w of data.workouts) for (const ex of w.exercises) lastSeen.set(ex.exerciseId, w.date);
    return data.exercises
      .filter((e) => lastSeen.has(e.id))
      .sort((a, b) => lastSeen.get(b.id)!.localeCompare(lastSeen.get(a.id)!));
  }, [data.workouts, data.exercises]);

  const [selected, setSelected] = useState<string>(initialExercise ?? '');
  const [metricId, setMetricId] = useState<string>('');
  const [range, setRange] = useState<Range>('all');
  const exerciseId = trained.some((e) => e.id === selected) ? selected : trained[0]?.id;
  const exercise = trained.find((e) => e.id === exerciseId);
  const type = typeOf(exercise);

  // Sessions for this exercise, counting working sets only (warm-ups are left out of progress).
  const sessions: Session[] = useMemo(
    () =>
      data.workouts.flatMap((w) => {
        const kcal = showKcal ? workoutCalories(w, exById, bodyKg).byExercise : [];
        return w.exercises
          .map((ex, i) => ({ ex, kcal: kcal[i] ?? 0 }))
          .filter(({ ex }) => ex.exerciseId === exerciseId)
          .map(({ ex, kcal }) => ({ date: w.date, sets: ex.sets, kcal }))
          .filter((s) => workingSets(s.sets).length > 0);
      }),
    [data.workouts, exerciseId, showKcal, exById, bodyKg],
  );

  if (trained.length === 0 || !exercise) {
    return (
      <div className="screen">
        <h1>Progress</h1>
        <div className="card center muted">Log a workout to start seeing progress charts.</div>
      </div>
    );
  }

  const measures = showKcal && sessions.some((s) => s.kcal > 0) ? [...MEASURES[type], KCAL_MEASURE] : MEASURES[type];
  const measure = measures.find((m) => m.id === metricId) ?? measures[0];
  const unitLabel = measure.unitLabel(units);
  const valueOf = (s: Session) => (measure === KCAL_MEASURE ? s.kcal : measure.value(s.sets, units));

  // Chart points for the chosen range (sessions without a value for this measure are skipped).
  const from = rangeStart(range);
  const charted = sessions.filter((s) => Date.parse(s.date) >= from && valueOf(s) > 0);
  const points: Point[] = charted.map((s) => ({ date: s.date, value: valueOf(s) }));

  // PR markers: sessions that beat every earlier session (across all history, not just the range).
  const prDates = new Set<string>();
  let best: number | null = null;
  for (const s of sessions) {
    const v = valueOf(s);
    if (v <= 0) continue;
    const better = best === null ? false : measure.lowerIsBetter ? v < best : v > best;
    if (better) prDates.add(s.date);
    if (best === null || (measure.lowerIsBetter ? v < best : v > best)) best = v;
  }
  const prs = charted.map((s) => prDates.has(s.date));

  const first = points[0]?.value ?? 0;
  const last = points[points.length - 1]?.value ?? 0;
  const raw = first ? ((last - first) / first) * 100 : 0;
  const change = measure.lowerIsBetter ? -raw : raw;

  const stats = sessions.length ? statsFor(type, sessions.map((s) => ({ ...s, sets: workingSets(s.sets) })), units) : [];

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

      {sessions.length === 0 ? (
        <div className="card center muted">Only warm-up sets are logged for {exercise.name} so far.</div>
      ) : (
        <>
          <StatCards items={stats} />

          <div className="card">
            <div className="chart-controls">
              <ChipGroup
                label="Chart measure"
                value={measure.id}
                onChange={setMetricId}
                options={measures.map((m) => ({ value: m.id, label: m.label }))}
              />
              <ChipGroup label="Date range" variant="segmented" kind="radio" value={range} onChange={setRange} options={RANGES} />
            </div>
            <div className="chart-title">
              <span>
                {exercise.name} · {measure.label}
                {unitLabel ? ` (${unitLabel})` : ''}
              </span>
              {points.length > 1 && <TrendBadge change={change} label={RANGE_TREND_LABEL[range]} />}
            </div>
            {points.length === 0 ? (
              <p className="muted small center-text chart-empty">
                No sessions {range === '1m' ? 'in the last month' : 'in the last 3 months'}. Try a longer range.
              </p>
            ) : (
              <LineChart
                points={points}
                prs={prs}
                animKey={`${exerciseId}-${measure.id}-${range}`}
                label={`${exercise.name} ${measure.label} over time`}
                format={measure.format}
              />
            )}
            {points.length === 1 && <p className="muted small center-text">Log this exercise again to see a trend.</p>}
            {prs.some(Boolean) && (
              <p className="chart-legend muted small">
                <span className="legend-pr" aria-hidden="true" /> New best
              </p>
            )}
          </div>

          <h2>Sessions</h2>
          <div className="session-list">
            {[...sessions].reverse().map((s, i) => (
              <SessionCard
                key={i}
                title={fmtDate(s.date)}
                summary={sessionSummary(type, s.sets, units)}
                metricLabel={measure.label}
                metric={<CountUp value={valueOf(s)} format={measure.format} />}
                unitLabel={unitLabel}
                top={<SetText set={topSet(s.sets, type)} type={type} units={units} />}
                pills={<SetPills sets={s.sets} type={type} units={units} />}
                pr={prDates.has(s.date)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SessionCard(p: {
  title: string;
  summary: string;
  metricLabel: string;
  metric: ReactNode;
  unitLabel: string;
  top: ReactNode;
  pills: ReactNode;
  pr: boolean;
}) {
  return (
    <article className="card session">
      <div className="session-head">
        <div>
          <h3>
            {p.title}
            {p.pr && <span className="pr-chip">New best</span>}
          </h3>
          <span className="muted small">{p.summary}</span>
        </div>
        <div className="session-metric">
          <span className="eyebrow">{p.metricLabel}</span>
          <strong>
            {p.metric} {p.unitLabel && <span className="unit">{p.unitLabel}</span>}
          </strong>
        </div>
      </div>
      <div className="top-set">
        <span className="eyebrow">Top set</span>
        <span className="top-set-value">{p.top}</span>
      </div>
      {p.pills}
    </article>
  );
}
