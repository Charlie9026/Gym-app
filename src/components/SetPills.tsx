import type { ExerciseType, Units } from '../types';
import { isWarmup, setParts, type AnySet } from '../sets';

/** Sets as readable pills, e.g. "72.5 kg × 10 reps", "1:30", "5.2 km · 25:10". Warm-ups are marked W. */
export function SetPills({ sets, type, units }: { sets: AnySet[]; type: ExerciseType; units: Units }) {
  return (
    <ul className="set-pills">
      {sets.map((s, i) => (
        <li key={i} className={'set-pill' + (isWarmup(s) ? ' warm' : '')}>
          {isWarmup(s) && (
            <span className="pill-w" title="Warm-up">
              W
            </span>
          )}
          <SetText set={s} type={type} units={units} />
        </li>
      ))}
    </ul>
  );
}

/** One set with styled numbers and units. */
export function SetText({ set, type, units }: { set: AnySet; type: ExerciseType; units: Units }) {
  const parts = setParts(set, type, units);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="x">{type === 'distance' ? ' · ' : ' × '}</span>}
          <strong>{p.value}</strong>
          {p.unit && p.unit !== 'time' && <span className="unit"> {p.unit}</span>}
        </span>
      ))}
    </>
  );
}
