import { fmtNumber, useCountUp } from '../useCountUp';

/** A number that counts to its new value. Screen readers get the final value. */
export function CountUp({
  value,
  decimals = 1,
  from,
  format,
}: {
  value: number;
  decimals?: number;
  from?: number;
  /** Custom display, e.g. fmtTime for durations. */
  format?: (n: number) => string;
}) {
  const { shown } = useCountUp(value, from === undefined ? 650 : 900, from);
  // Show as many decimals as the final value has, so the count doesn't flicker extra digits.
  const d = Number.isInteger(value) ? 0 : decimals;
  const show = (n: number) => (format ? format(n) : fmtNumber(Number(n.toFixed(d)), d));
  return (
    <>
      <span aria-hidden="true">{show(shown)}</span>
      <span className="ms-sr">{format ? format(value) : fmtNumber(value, decimals)}</span>
    </>
  );
}

/** The "▲ 9.0% since first session" badge, counting between values. */
export function TrendBadge({ change, label = 'since first session' }: { change: number; label?: string }) {
  const { shown } = useCountUp(change);
  // Under 0.05% rounds to 0.0%: show it as no change rather than a green "up".
  if (Math.abs(change) < 0.05) return <span className="trend flat">No change {label}</span>;
  const down = shown < 0;
  return (
    <span className={'trend' + (down ? ' down' : '')}>
      <span aria-hidden="true">
        {down ? '▼' : '▲'} {Math.abs(shown).toFixed(1)}% {label}
      </span>
      <span className="ms-sr">
        {change < 0 ? 'Worse by' : 'Up'} {Math.abs(change).toFixed(1)}% {label}
      </span>
    </span>
  );
}
