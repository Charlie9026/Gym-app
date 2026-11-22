import { useState } from 'react';

interface Props {
  value: number;
  onChange: (n: number) => void;
  decimals?: boolean;
  placeholder?: string;
  ariaLabel: string;
  id?: string;
}

/** Text-based numeric input that tolerates partial input like "62." while typing. */
export function NumberInput({ value, onChange, decimals = true, placeholder, ariaLabel, id }: Props) {
  const [text, setText] = useState(value ? String(value) : '');
  const [lastValue, setLastValue] = useState(value);

  // Resync the text when the value is changed from outside (e.g. unit switch).
  if (value !== lastValue) {
    setLastValue(value);
    const parsed = parseFloat(text.replace(',', '.'));
    if ((isNaN(parsed) ? 0 : parsed) !== value) setText(value ? String(value) : '');
  }

  return (
    <input
      id={id}
      className="num-input"
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const re = decimals ? /^\d*[.,]?\d*$/ : /^\d*$/;
        const t = e.target.value;
        if (!re.test(t)) return;
        setText(t);
        const n = parseFloat(t.replace(',', '.'));
        onChange(isNaN(n) ? 0 : n);
      }}
    />
  );
}
