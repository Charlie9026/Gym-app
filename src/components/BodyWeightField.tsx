import type { Settings, Unit } from '../types';
import type { Update } from '../store';
import { fromDisplay, toDisplay } from '../utils';
import { NumberInput } from './NumberInput';
import { ChipGroup } from './ChipGroup';

/**
 * Body weight in the chosen weight unit (stored in kg), used to estimate calories.
 * With `unitPicker` the kg/lb switch sits beside it (the welcome screen has no Units card).
 */
export function BodyWeightField({ settings, update, id, unitPicker }: { settings: Settings; update: Update; id: string; unitPicker?: boolean }) {
  const unit = settings.unit;
  const shown = settings.bodyWeightKg ? Math.round(toDisplay(settings.bodyWeightKg, unit) * 10) / 10 : 0;
  return (
    <div className={'body-weight' + (unitPicker ? ' stacked' : '')}>
      <label htmlFor={id}>Body weight</label>
      <span className="body-weight-input">
        <NumberInput
          id={id}
          ariaLabel={`Body weight in ${unit}`}
          value={shown}
          placeholder={unit === 'kg' ? '70' : '155'}
          onChange={(v) =>
            update((d) => {
              const next = { ...d.settings };
              if (v > 0) next.bodyWeightKg = Math.round(fromDisplay(v, d.settings.unit) * 100) / 100;
              else delete next.bodyWeightKg;
              return { ...d, settings: next };
            })
          }
        />
        {unitPicker ? (
          <ChipGroup
            label="Weight unit"
            kind="radio"
            variant="segmented"
            value={unit}
            onChange={(u) => update((d) => ({ ...d, settings: { ...d.settings, unit: u } }))}
            options={(['kg', 'lb'] as Unit[]).map((u) => ({ value: u, label: u }))}
          />
        ) : (
          <span className="muted">{unit}</span>
        )}
      </span>
    </div>
  );
}
