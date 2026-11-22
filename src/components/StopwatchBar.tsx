import { useEffect, useState } from 'react';
import { fmtTime } from '../sets';
import { closeNotices, showNotice } from '../restAlert';
import { stopwatchSeconds } from '../stopwatch';

const RING_R = 17;
const RING_C = 2 * Math.PI * RING_R;
const TAG = 'overload-stopwatch';

/**
 * Stopwatch bar, styled like the rest bar: counts up from when it started, with a
 * ring that goes round once a minute. Stop puts the time into the set.
 * When the app goes into the background it can post a notification saying when
 * it started (a website can't keep a live timer in a notification).
 */
export function StopwatchBar({
  startedAt,
  label,
  notify,
  stacked,
  onStop,
  onCancel,
}: {
  startedAt: number;
  /** e.g. "Air Bike · set 2" */
  label: string;
  notify: boolean;
  /** Sits above the rest bar when both are showing. */
  stacked: boolean;
  onStop: () => void;
  onCancel: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Background notification: shown when you switch away, cleared when you come back or stop.
  useEffect(() => {
    if (!notify) return;
    const started = new Date(startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const onVisibility = () => {
      if (document.hidden) {
        void showNotice(`${label.split(' · ')[0]} stopwatch running`, {
          body: `Started at ${started} (${fmtTime(stopwatchSeconds(startedAt))} so far). Tap to come back.`,
          tag: TAG,
          timestamp: startedAt,
          silent: true,
        });
      } else void closeNotices(TAG);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void closeNotices(TAG);
    };
  }, [notify, startedAt, label]);

  const secs = stopwatchSeconds(startedAt, now);
  const frac = ((now - startedAt) % 60000) / 60000;
  const time = fmtTime(secs);
  return (
    <div className={'rest-bar stopwatch-bar' + (stacked ? ' stacked' : '')} role="timer" aria-label={`Stopwatch, ${time}`}>
      <div className="rest-main">
        <span className="rest-ring" aria-hidden="true">
          <svg viewBox="0 0 40 40">
            <circle className="ring-track" cx="20" cy="20" r={RING_R} />
            <circle className="ring-fill" cx="20" cy="20" r={RING_R} strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - frac)} />
          </svg>
        </span>
        <span className="rest-text">
          <strong>{time}</strong>
          <span className="small">{label}</span>
        </span>
      </div>
      <div className="row-actions">
        <button className="icon-btn" onClick={onCancel} aria-label="Cancel stopwatch" title="Cancel">✕</button>
        <button className="btn-primary compact" onClick={onStop}>Stop</button>
      </div>
    </div>
  );
}
