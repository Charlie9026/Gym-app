import { useState } from 'react';
import { fmtTime, parseTime } from '../sets';

interface Props {
  /** Seconds. */
  value: number;
  onChange: (seconds: number) => void;
  placeholder?: string;
  ariaLabel: string;
}

/**
 * Time entry that accepts "90", "1:30" or "1:02:30". Partial input like "1:"
 * is allowed while typing; it tidies to m:ss when you leave the field.
 */
export function DurationInput({ value, onChange, placeholder, ariaLabel }: Props) {
  const [text, setText] = useState(value ? fmtTime(value) : '');
  const [lastValue, setLastValue] = useState(value);

  // Resync when the value changes from outside (e.g. ticking fills in the hint).
  if (value !== lastValue) {
    setLastValue(value);
    if ((parseTime(text) ?? -1) !== value) setText(value ? fmtTime(value) : '');
  }

  return (
    <input
      className="num-input"
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value.replace(/[.,]/g, ':');
        if (!/^[\d:]*$/.test(t) || (t.match(/:/g)?.length ?? 0) > 2) return;
        setText(t);
        const secs = parseTime(t);
        if (secs !== null) onChange(secs);
      }}
      onBlur={() => setText(value ? fmtTime(value) : '')}
    />
  );
}
