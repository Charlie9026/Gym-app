import { useState } from 'react';
import type { Exercise } from '../types';
import type { Update } from '../store';
import { REST_OPTIONS, restLabel } from '../sets';
import { ChipGroup } from './ChipGroup';

/**
 * "Rest 1:30" pill on an exercise card. Tapping it slides open the same sliding
 * pills as Settings to choose this exercise's rest; "Default" follows Settings.
 */
export function RestChip({ exercise, defaultSeconds, update }: { exercise: Exercise; defaultSeconds: number; update: Update }) {
  const [open, setOpen] = useState(false);
  const own = exercise.restSeconds;
  const current = own ?? defaultSeconds;

  const set = (v: string) => {
    const next = v === 'default' ? undefined : Number(v);
    update((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        if (e.id !== exercise.id) return e;
        const copy = { ...e };
        if (next === undefined) delete copy.restSeconds;
        else copy.restSeconds = next;
        return copy;
      }),
    }));
  };

  return (
    <div className="rest-chip-wrap">
      <button
        type="button"
        className={'rest-chip' + (open ? ' open' : '') + (own !== undefined ? ' custom' : '')}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2M9.5 2.5h5" />
        </svg>
        Rest {restLabel(current, true)}
        {own === undefined && <span className="rest-chip-note">default</span>}
      </button>
      <div className={'collapse' + (open ? ' open' : '')} inert={!open} aria-hidden={!open}>
        <div className="collapse-inner">
          <div className="rest-chip-panel">
            <ChipGroup
              label={`Rest after ${exercise.name}`}
              kind="radio"
              wrap
              value={own === undefined ? 'default' : String(own)}
              onChange={set}
              options={[
                { value: 'default', label: `Default (${restLabel(defaultSeconds, true)})` },
                ...REST_OPTIONS.filter((s) => s > 0).map((s) => ({ value: String(s), label: restLabel(s, true) })),
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
