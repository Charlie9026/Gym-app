import { useState } from 'react';
import { fmtShortDate } from '../utils';

export interface Point {
  date: string;
  value: number;
}

interface Props {
  points: Point[];
  format: (v: number) => string;
  label: string;
}

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
export function LineChart({ points, format, label }: Props) {
  const [hover, setHover] = useState<number | null>(null);
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
          <g key={t}>
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
        {area && <path d={area} fill="url(#chart-area)" />}
        {h && <line className="crosshair" x1={h.cx} x2={h.cx} y1={PAD.top} y2={PAD.top + innerH} />}
        <path className="line" d={path} />
        {coords.map((c, i) => (
          <circle key={i} className="dot" cx={c.cx} cy={c.cy} r={hover === i || i === coords.length - 1 ? 6 : 3.5} />
        ))}
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
        </div>
      )}
    </div>
  );
}
