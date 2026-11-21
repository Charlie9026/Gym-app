import { useEffect, useRef, useState } from 'react';

const reduceMotion = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Animates a number from its previous value to the new one (ease-out, ~650ms).
 * Returns the in-between value to display and a short-lived `pulse` flag.
 * Instant with reduced motion; rAF pauses on its own while the page is hidden.
 */
export function useCountUp(value: number, duration = 650) {
  const [shown, setShown] = useState(value);
  const [pulse, setPulse] = useState(false);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    const end = value;
    from.current = end;
    if (start === end) return;
    let raf = 0;
    let pulseTimer = 0;
    raf = requestAnimationFrame(() => {
      setPulse(true);
      pulseTimer = window.setTimeout(() => setPulse(false), 300);
      if (reduceMotion()) {
        setShown(end);
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setShown(t < 1 ? start + (end - start) * eased : end);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(pulseTimer);
      setShown(end);
    };
  }, [value, duration]);

  return { shown, pulse };
}

export const fmtNumber = (n: number, decimals = 1) =>
  n.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: 0 });

/** A number that counts to its new value. Screen readers get the final value. */
export function CountUp({ value, decimals = 1 }: { value: number; decimals?: number }) {
  const { shown } = useCountUp(value);
  // Show as many decimals as the final value has, so the count doesn't flicker extra digits.
  const d = Number.isInteger(value) ? 0 : decimals;
  return (
    <>
      <span aria-hidden="true">{fmtNumber(Number(shown.toFixed(d)), d)}</span>
      <span className="ms-sr">{fmtNumber(value, decimals)}</span>
    </>
  );
}

/** The "▲ 9.0% since first session" badge, counting between values. */
export function TrendBadge({ change }: { change: number }) {
  const { shown } = useCountUp(change);
  const down = shown < 0;
  return (
    <span className={'trend' + (down ? ' down' : '')}>
      <span aria-hidden="true">
        {down ? '▼' : '▲'} {Math.abs(shown).toFixed(1)}% since first session
      </span>
      <span className="ms-sr">
        {change < 0 ? 'Down' : 'Up'} {Math.abs(change).toFixed(1)}% since first session
      </span>
    </span>
  );
}
