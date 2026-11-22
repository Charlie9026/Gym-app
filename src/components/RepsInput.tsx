import { useState } from 'react';
import { parseRepTarget, repTarget } from '../sets';
import type { TemplateSet } from '../types';

type Target = Pick<TemplateSet, 'reps' | 'repsTo' | 'repsOpen'>;

interface Props {
  value: Target;
  onChange: (t: Target) => void;
  placeholder?: string;
  ariaLabel: string;
}

const shown = (t: Target) => (t.reps ? repTarget(t) : '');

/**
 * Rep target for a saved workout: "10", a range like "6-8", or "12+" (as many
 * as you can, at least 12). Tidies to "6–8" when you leave the field.
 */
export function RepsInput({ value, onChange, placeholder, ariaLabel }: Props) {
  const [text, setText] = useState(shown(value));
  const [last, setLast] = useState(shown(value));

  // Resync when changed from outside.
  if (shown(value) !== last) {
    setLast(shown(value));
    const parsed = parseRepTarget(text);
    if (!parsed || shown(parsed) !== shown(value)) setText(shown(value));
  }

  return (
    <input
      className="num-input"
      type="text"
      autoComplete="off"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value;
        if (!/^[\d\s+–-]*$/.test(t) || t.length > 8) return;
        setText(t);
        const parsed = parseRepTarget(t);
        if (parsed) onChange({ reps: parsed.reps, repsTo: parsed.repsTo, repsOpen: parsed.repsOpen });
      }}
      onBlur={() => setText(shown(value))}
    />
  );
}
