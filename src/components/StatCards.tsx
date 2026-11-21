import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Neumorphic stat cards, adapted from the Forever AI "Stat Cards" component.
 * Soft raised cards whose shadows come from the active theme. When a value
 * changes, the number counts to its new value and the card pulses its shadow.
 */
export interface StatItem {
  label: string;
  value: number;
  unit?: string;
  sub: string;
  icon: ReactNode;
}

const reduceMotion = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

function StatCard({ item }: { item: StatItem }) {
  const [shown, setShown] = useState(item.value);
  const [pulse, setPulse] = useState(false);
  const from = useRef(item.value);

  useEffect(() => {
    const start = from.current;
    const end = item.value;
    from.current = end;
    if (start === end) return;
    let raf = 0;
    let pulseTimer = 0;
    // Pulse the shadow as the value updates (as in the original component).
    raf = requestAnimationFrame(() => {
      setPulse(true);
      pulseTimer = window.setTimeout(() => setPulse(false), 300);
      if (reduceMotion()) {
        setShown(end);
        return;
      }
      // Count to the new value; rAF stops on its own while the page is hidden.
      const t0 = performance.now();
      const dur = 650;
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
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
  }, [item.value]);

  const decimals = Number.isInteger(item.value) ? 0 : 1;
  const display = fmt(Number(shown.toFixed(decimals)));

  return (
    <div className={'neu-card' + (pulse ? ' neu-pulse' : '')}>
      <span className="neu-icon" aria-hidden="true">{item.icon}</span>
      <span className="neu-val">
        <span aria-hidden="true">{display}</span>
        {item.unit && <span className="neu-unit" aria-hidden="true"> {item.unit}</span>}
        <span className="ms-sr">
          {fmt(item.value)} {item.unit ?? ''}
        </span>
      </span>
      <span className="neu-lbl">{item.label}</span>
      <span className="neu-sub">{item.sub}</span>
    </div>
  );
}

export function StatCards({ items }: { items: StatItem[] }) {
  return (
    <div className="neu-grid">
      {items.map((it) => (
        <StatCard key={it.label} item={it} />
      ))}
    </div>
  );
}
