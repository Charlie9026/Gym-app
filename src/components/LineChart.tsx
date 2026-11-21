import { useEffect, useState, type CSSProperties } from 'react';
import { fmtShortDate } from '../utils';

export interface Point {
  date: string;
  value: number;
}

interface Props {
  points: Point[];
  format: (v: number) => string;
  label: string;
  /** Changing this replays the draw-on animation (e.g. exercise + measure). */
  animKey?: string;
  /** Which points are personal bests; they get a ring marker. */
  prs?: boolean[];
}

const reduceMotion = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const W = 360;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Single-series line chart with a hover/tap tooltip. */
export function LineChart({ points, format, label, animKey = '', prs = [] }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  // The previous chart's shapes, faded out while the new line draws on.
  const [ghost, setGhost] = useState<{ id: string; path: string; area: string } | null>(null);
  const [shown, setShown] = useState<{ key: string; path: string; area: string } | null>(null);
  useEffect(() => {
    if (!ghost) return;
    const t = setTimeout(() => setGhost(null), 260);
    return () => clearTimeout(t);
  }, [ghost]);

  if (points.length === 0) return null;
  const ticks = niceTicks(Math.min(...points.map((p) => p.value)), Math.max(...points.map((p) => p.value)));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const times = points.map((p) => Date.parse(p.date));
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (t: number) => PAD.left + (tMax === tMin ? innerW / 2 : ((t - tMin) / (tMax - tMin)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const coords = points.map((p, i) => ({ cx: x(times[i]), cy: y(p.value) }));
  const path = coords.map((c, i) => `${i ? 'L' : 'M'}${c.cx},${c.cy}`).join(' ');
  const baseY = PAD.top + innerH;
  const area =
    coords.length > 1
      ? `${path} L${coords[coords.length - 1].cx},${baseY} L${coords[0].cx},${baseY} Z`
      : '';

  if (!shown || shown.key !== animKey || shown.path !== path) {
    if (shown && shown.key !== animKey && !reduceMotion()) {
      setGhost({ id: `${shown.key}>${animKey}`, path: shown.path, area: shown.area });
    }
    setShown({ key: animKey, path, area });
  }

  const pickNearest = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    coords.forEach((c, i) => {
      if (Math.abs(c.cx - px) < Math.abs(coords[best].cx - px)) best = i;
    });
    setHover(best);
  };

  const h = hover !== null ? coords[hover] : null;
  const xLabels = points.length === 1 ? [0] : [0, points.length - 1];

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart"
        role="img"
        aria-label={label}
        onPointerMove={(e) => pickNearest(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => pickNearest(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t + animKey} className="chart-fade">
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="axis-label" x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {format(t)}
            </text>
          </g>
        ))}
        {xLabels.map((i) => (
          <text
            key={i}
            className="axis-label"
            x={coords[i].cx}
            y={H - 8}
            textAnchor={points.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'}
          >
            {fmtShortDate(points[i].date)}
          </text>
        ))}
        <defs>
          <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="area-top" />
            <stop offset="1" className="area-bottom" />
          </linearGradient>
        </defs>
        {ghost && (
          <g className="chart-ghost" key={ghost.id} aria-hidden="true">
            {ghost.area && <path d={ghost.area} fill="url(#chart-area)" />}
            <path className="line" d={ghost.path} />
          </g>
        )}
        {h && <line className="crosshair" x1={h.cx} x2={h.cx} y1={PAD.top} y2={PAD.top + innerH} />}
        {/* Remounted per animKey so the draw-on animation replays. */}
        <g className="chart-draw" key={animKey}>
          {area && <path className="area" d={area} fill="url(#chart-area)" />}
          <path className="line" d={path} pathLength={1} />
          {coords.map((c, i) => {
            const last = i === coords.length - 1;
            const frac = coords.length > 1 ? i / (coords.length - 1) : 1;
            // Each dot appears as the line reaches it; the latest one pops in last.
            const style = { '--d': `${last ? 680 : Math.round(60 + frac * 600)}ms` } as CSSProperties;
            return (
              <g key={i}>
                {prs[i] && (
                  <circle className="pr-ring" style={{ '--d': `${Math.round(120 + frac * 600)}ms` } as CSSProperties} cx={c.cx} cy={c.cy} r={9.5} />
                )}
                <circle className={'dot' + (last ? ' last' : '')} style={style} cx={c.cx} cy={c.cy} r={hover === i || last ? 6 : 3.5} />
              </g>
            );
          })}
        </g>
      </svg>
      {h && hover !== null && (
        <div
          className="tooltip"
          style={{
            left: `${(h.cx / W) * 100}%`,
            top: `${(h.cy / H) * 100}%`,
            transform: `translate(${h.cx > W * 0.7 ? '-105%' : '5%'}, -120%)`,
          }}
        >
          <div className="muted small">{fmtShortDate(points[hover].date)}</div>
          <strong>{format(points[hover].value)}</strong>
          {prs[hover] && <div className="tt-pr">New best</div>}
        </div>
      )}
    </div>
  );
}
