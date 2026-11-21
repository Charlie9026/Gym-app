import type { TemplateSet, Unit } from '../types';
import { e1rm, toDisplay } from '../utils';

/** Sets as readable pills, e.g. "72.5 kg × 10 reps". */
export function SetPills({ sets, unit }: { sets: TemplateSet[]; unit: Unit }) {
  return (
    <ul className="set-pills">
      {sets.map((s, i) => (
        <li key={i} className="set-pill">
          <SetText set={s} unit={unit} />
        </li>
      ))}
    </ul>
  );
}

/** One set as "72.5 kg × 10 reps" (or "12 reps" when there's no weight). */
export function SetText({ set, unit }: { set: TemplateSet; unit: Unit }) {
  return (
    <>
      {set.weight > 0 && (
        <>
          <strong>{toDisplay(set.weight, unit).toLocaleString()}</strong>
          <span className="unit"> {unit}</span>
          <span className="x"> × </span>
        </>
      )}
      <strong>{set.reps}</strong>
      <span className="unit"> rep{set.reps === 1 ? '' : 's'}</span>
    </>
  );
}

/** The session's strongest set by estimated 1RM; ties go to the earliest. */
export function topSet<T extends TemplateSet>(sets: T[]): T {
  return sets.reduce((a, b) => (e1rm(b) > e1rm(a) ? b : a));
}
