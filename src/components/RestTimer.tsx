import { useEffect, useState } from 'react';

/** Rest countdown bar with a ring that drains as the rest runs out. */
const RING_R = 17;
const RING_C = 2 * Math.PI * RING_R;

export function RestTimer({ end, total, onAdd, onDone }: { end: number; total: number; onAdd: () => void; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const msLeft = Math.max(0, end - now);
  const left = Math.ceil(msLeft / 1000);
  const over = left === 0;
  // Fraction of the rest still to go; the ring drains as this falls.
  const frac = Math.min(1, msLeft / total);
  useEffect(() => {
    if (over) {
      navigator.vibrate?.([200, 100, 200]);
      const t = setTimeout(onDone, 3000);
      return () => clearTimeout(t);
    }
  }, [over, onDone]);
  const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <div className={'rest-bar' + (over ? ' over' : '')} role="status" aria-label={over ? 'Rest over' : `Rest, ${time} left`}>
      <div className="rest-main">
        <span className="rest-ring" aria-hidden="true">
          <svg viewBox="0 0 40 40">
            <circle className="ring-track" cx="20" cy="20" r={RING_R} />
            <circle
              className="ring-fill"
              cx="20"
              cy="20"
              r={RING_R}
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - frac)}
            />
          </svg>
          {over ? (
            <svg className="ring-done" viewBox="0 0 24 24">
              <path className="tick" d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
            </svg>
          ) : null}
        </span>
        <span className="rest-text">
          <strong>{over ? 'Rest over' : time}</strong>
          <span className="small">{over ? 'Time for your next set' : 'Resting'}</span>
        </span>
      </div>
      <div className="row-actions">
        {!over && <button className="btn-ghost" onClick={onAdd}>+30s</button>}
        <button className="btn-ghost" onClick={onDone}>{over ? 'Done' : 'Skip'}</button>
      </div>
    </div>
  );
}
