import { useState } from 'react';
import type { DistUnit, Exercise, Units } from '../types';
import type { Update } from '../store';
import { DIST_UNITS, distUnitFor } from '../sets';
import { ChipGroup } from './ChipGroup';

type Choice = DistUnit | 'time';

/**
 * "Distance · m" pill on a distance exercise. Tapping it slides open the units
 * this exercise can be logged in (rowing machines show metres, treadmills km or
 * miles…), or "Time only" to hide the distance column. Saved on the exercise.
 */
export function DistanceChip({ exercise, units, update }: { exercise: Exercise; units: Units; update: Update }) {
  const [open, setOpen] = useState(false);
  const current: Choice = exercise.timeOnly ? 'time' : distUnitFor(exercise, units);

  const set = (v: Choice) =>
    update((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        if (e.id !== exercise.id) return e;
        const copy = { ...e };
        if (v === 'time') copy.timeOnly = true;
        else {
          delete copy.timeOnly;
          copy.distanceUnit = v;
        }
        return copy;
      }),
    }));

  return (
    <div className="rest-chip-wrap">
      <button
        type="button"
        className={'rest-chip' + (open ? ' open' : '')}
        aria-expanded={open}
        aria-label={`How ${exercise.name} is logged: ${current === 'time' ? 'time only' : `distance in ${current}`}`}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 18c3 0 3-12 8-12s5 12 8 12" />
        </svg>
        {current === 'time' ? 'Time only' : `Distance · ${current}`}
      </button>
      <div className={'collapse' + (open ? ' open' : '')} inert={!open} aria-hidden={!open}>
        <div className="collapse-inner">
          <div className="rest-chip-panel">
            <ChipGroup
              label={`How ${exercise.name} is logged`}
              kind="radio"
              wrap
              value={current}
              onChange={set}
              options={[
                ...DIST_UNITS.map((u) => ({ value: u as Choice, label: u })),
                { value: 'time' as Choice, label: 'Time only' },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
