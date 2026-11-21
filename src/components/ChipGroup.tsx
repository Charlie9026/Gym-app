import { useLayoutEffect, useRef } from 'react';

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
}

function placePill(group: HTMLElement | null, pill: HTMLElement | null, animate: boolean) {
  const chip = group?.querySelector<HTMLElement>('.chip.active');
  if (!group || !pill || !chip) return;
  pill.classList.toggle('no-anim', !animate);
  pill.style.width = `${chip.offsetWidth}px`;
  pill.style.height = `${chip.offsetHeight}px`;
  pill.style.transform = `translate(${chip.offsetLeft}px, ${chip.offsetTop}px)`;
  if (!animate) {
    void pill.offsetWidth; // commit the jump before transitions come back
    pill.classList.remove('no-anim');
  }
  pill.classList.add('ready');
}

export function ChipGroup<T extends string>({ options, value, onChange, label, wrap, kind = 'tabs' }: Props<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  // Slide to the active chip whenever the choice changes (jump the first time),
  // and keep it in view in a sideways-scrolling row.
  useLayoutEffect(() => {
    placePill(groupRef.current, pillRef.current, !!pillRef.current?.classList.contains('ready'));
    const chip = groupRef.current?.querySelector<HTMLElement>('.chip.active');
    const g = groupRef.current;
    if (chip && g && !wrap) {
      const left = chip.offsetLeft - 16;
      const right = chip.offsetLeft + chip.offsetWidth + 16 - g.clientWidth;
      if (g.scrollLeft > left) g.scrollTo({ left, behavior: 'smooth' });
      else if (g.scrollLeft < right) g.scrollTo({ left: right, behavior: 'smooth' });
    }
  }, [value, options.length, wrap]);

  // Re-align without animating if the row changes size (rotation, new chips wrapping).
  // ResizeObserver fires once on observe, so skip that first call.
  useLayoutEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      placePill(g, pillRef.current, false);
    });
    ro.observe(g);
    return () => ro.disconnect();
  }, []);

  const radio = kind === 'radio';
  return (
    <div
      ref={groupRef}
      className={'chips' + (wrap ? ' wrap' : '')}
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
