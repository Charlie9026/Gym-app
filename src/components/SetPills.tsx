import type { TemplateSet, Unit } from '../types';
import { e1rm, toDisplay } from '../utils';

/** Sets as readable pills, e.g. "72.5 kg × 10". The best set (by est. 1RM) is highlighted. */
export function SetPills({ sets, unit, highlightBest = true }: { sets: TemplateSet[]; unit: Unit; highlightBest?: boolean }) {
  // Highlight the best set only when one set actually stands out.
  const top = sets.length > 1 ? Math.max(...sets.map(e1rm)) : 0;
  const tops = sets.filter((s) => e1rm(s) === top);
  const best = highlightBest && tops.length === 1 && sets.length > 1 ? tops[0] : null;
  return (
    <ul className="set-pills">
      {sets.map((s, i) => (
        <li key={i} className={'set-pill' + (s === best ? ' best' : '')}>
          {s.weight > 0 && (
            <>
              <strong>{toDisplay(s.weight, unit).toLocaleString()}</strong>
              <span className="unit"> {unit}</span>
              <span className="x"> × </span>
            </>
          )}
          <strong>{s.reps}</strong>
          <span className="unit"> rep{s.reps === 1 ? '' : 's'}</span>
        </li>
      ))}
    </ul>
  );
}
