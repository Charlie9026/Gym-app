import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './env';

/**
 * Animates a number from its previous value to the new one (ease-out, ~650ms).
 * Returns the in-between value to display and a short-lived `pulse` flag.
 * Instant with reduced motion; rAF pauses on its own while the page is hidden.
 */
export function useCountUp(value: number, duration = 650, startFrom?: number) {
  // With startFrom, the first render counts up from that value (e.g. 0).
  const [shown, setShown] = useState(startFrom ?? value);
  const [pulse, setPulse] = useState(false);
  const from = useRef(startFrom ?? value);

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
      if (prefersReducedMotion()) {
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
