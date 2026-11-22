import { useState } from 'react';
import { NumberInput } from './NumberInput';

/**
 * "≈ 230 kcal" pill on a cardio exercise. Tapping it opens a field to type in
 * the number from your machine or watch, which replaces the estimate.
 */
export function CaloriesChip({
  name,
  value,
  estimate,
  onChange,
}: {
  name: string;
  /** Typed-in calories, if any. */
  value?: number;
  /** Estimate from done sets; null without a body weight. */
  estimate: number | null;
  onChange: (kcal: number | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const own = value && value > 0 ? value : undefined;
  const label = own ? `${own.toLocaleString()} kcal` : estimate ? `≈ ${estimate.toLocaleString()} kcal` : 'Calories';

  return (
    <div className="rest-chip-wrap">
      <button
        type="button"
        className={'rest-chip' + (open ? ' open' : '') + (own ? ' custom' : '')}
        aria-expanded={open}
        aria-label={`Calories for ${name}: ${label}`}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3c.5 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.2 1.2-3.8 2.3-5 .3 1.6 1.2 2.6 2.2 3C11 9 11 6 12 3z" />
        </svg>
        {label}
        {own && <span className="rest-chip-note">yours</span>}
      </button>
      <div className={'collapse' + (open ? ' open' : '')} inert={!open} aria-hidden={!open}>
        <div className="collapse-inner">
          <div className="rest-chip-panel kcal-panel">
            <label className="muted small" htmlFor={`kcal-${name}`}>
              From your machine or watch
            </label>
            <span className="kcal-input">
              <NumberInput
                id={`kcal-${name}`}
                ariaLabel={`${name} calories`}
                decimals={false}
                value={own ?? 0}
                placeholder={estimate ? String(estimate) : '0'}
                onChange={(n) => onChange(n > 0 ? n : undefined)}
              />
              <span className="muted small">kcal</span>
            </span>
            {own && estimate !== null && (
              <button type="button" className="btn-ghost small-btn" onClick={() => onChange(undefined)}>
                Use estimate
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
