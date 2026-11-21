import { useLayoutEffect, useRef } from 'react';
import { useSlidingHighlight } from '../slidingHighlight';

/**
 * A row of pill buttons with an accent highlight that slides (with the same
 * spring as the tab bar and Morph Select) from the old choice to the new one.
 * Works for single rows, sideways-scrolling rows and wrapped rows.
 */
export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** Wrap onto several lines instead of scrolling sideways. */
  wrap?: boolean;
  /** "tabs" for filters/views, "radio" for picking a value in a form. */
  kind?: 'tabs' | 'radio';
  /** "segmented" draws the options as one compact switch (e.g. kg/lb). */
  variant?: 'chips' | 'segmented';
}

export function ChipGroup<T extends string>({ options, value, onChange, label, wrap, kind = 'tabs', variant = 'chips' }: Props<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  useSlidingHighlight(groupRef, pillRef, { active: '.chip.active', axis: 'xy' }, [value, options.length, wrap]);

  // In a sideways-scrolling row, keep the chosen chip in view.
  useLayoutEffect(() => {
    const g = groupRef.current;
    const chip = g?.querySelector<HTMLElement>('.chip.active');
    if (!g || !chip || wrap) return;
    const left = chip.offsetLeft - 16;
    const right = chip.offsetLeft + chip.offsetWidth + 16 - g.clientWidth;
    if (g.scrollLeft > left) g.scrollTo({ left, behavior: 'smooth' });
    else if (g.scrollLeft < right) g.scrollTo({ left: right, behavior: 'smooth' });
  }, [value, wrap]);

  const radio = kind === 'radio';
  return (
    <div
      ref={groupRef}
      className={'chips' + (wrap ? ' wrap' : '') + (variant === 'segmented' ? ' seg' : '')}
      role={radio ? 'radiogroup' : 'group'}
      aria-label={label}
    >
      <span className="chip-pill" ref={pillRef} aria-hidden="true" />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            className={'chip' + (on ? ' active' : '')}
            role={radio ? 'radio' : undefined}
            aria-checked={radio ? on : undefined}
            aria-pressed={radio ? undefined : on}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
