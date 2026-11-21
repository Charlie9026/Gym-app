import type { ReactNode } from 'react';
import { CountUp, useCountUp } from './CountUp';

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

function StatCard({ item }: { item: StatItem }) {
  const { pulse } = useCountUp(item.value);
  return (
    <div className={'neu-card' + (pulse ? ' neu-pulse' : '')}>
      <span className="neu-icon" aria-hidden="true">{item.icon}</span>
      <span className="neu-val">
        <CountUp value={item.value} />
        {item.unit && <span className="neu-unit"> {item.unit}</span>}
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
