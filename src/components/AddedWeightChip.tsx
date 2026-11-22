import type { Exercise } from '../types';
import type { Update } from '../store';

/**
 * "+ Add weight" pill on a bodyweight exercise (dips, pull-ups…). Turning it on
 * shows a column for added weight (a belt, vest or dumbbell); it's remembered
 * for the exercise. Turning it off just hides the column: logged weights stay.
 */
export function AddedWeightChip({ exercise, update }: { exercise: Exercise; update: Update }) {
  const on = !!exercise.addedWeight;
  const toggle = () =>
    update((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        if (e.id !== exercise.id) return e;
        const copy = { ...e };
        if (on) delete copy.addedWeight;
        else copy.addedWeight = true;
        return copy;
      }),
    }));
  return (
    <div className="rest-chip-wrap">
      <button type="button" className={'rest-chip' + (on ? ' custom' : '')} aria-pressed={on} onClick={toggle}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {on ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M12 5v14M5 12h14" />}
        </svg>
        {on ? 'Added weight' : 'Add weight'}
      </button>
    </div>
  );
}
