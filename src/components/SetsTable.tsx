import { useEffect, useRef, useState } from 'react';
import type { ExerciseType, SetEntry, Units } from '../types';
import { fmtTime, fromDistDisplay, isWarmup, setText, toDistDisplay, type AnySet } from '../sets';
import { fromDisplay, toDisplay } from '../utils';
import { DurationInput } from './DurationInput';
import { NumberInput } from './NumberInput';

/**
 * The rows of sets for one exercise, laid out for its type. Used by the active
 * workout ("log": previous column, faded hints, tick) and by the editors for
 * saved and past workouts ("edit"). Each set's badge opens a small menu to
 * switch warm-up/working or remove the set.
 */
interface Props {
  type: ExerciseType;
  units: Units;
  /** Distance exercise logged by time only: the distance column is hidden. */
  timeOnly?: boolean;
  exerciseName: string;
  sets: AnySet[];
  mode: 'log' | 'edit';
  /** Log mode: last session's sets for the Previous column. */
  prev?: AnySet[];
  /** Faded placeholder values for a set. */
  hintFor?: (i: number) => AnySet | undefined;
  onChange: (i: number, patch: Partial<SetEntry>) => void;
  onToggleDone?: (i: number) => void;
  onToggleWarmup: (i: number) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
  /** Log mode: the set the stopwatch is timing. */
  timingIndex?: number;
}

export function SetsTable(props: Props) {
  const { type, units, timeOnly, timingIndex, sets, mode, prev = [], hintFor, onChange, onToggleDone, exerciseName } = props;
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const log = mode === 'log';
  const unit = units.weight;
  const dist = units.distance;

  // Working sets are numbered 1, 2, 3…; warm-ups show "W".
  const labels = sets.map((s, i) => (isWarmup(s) ? 'W' : String(sets.slice(0, i + 1).filter((x) => !isWarmup(x)).length)));

  // A time-only distance exercise is laid out like a timed one.
  const layout = type === 'distance' && timeOnly ? 'time' : type;
  const fieldHeads =
    layout === 'weight' ? [unit, 'Reps'] : layout === 'reps' ? ['Reps'] : layout === 'time' ? ['Time'] : layout === 'steps' ? ['Steps', 'Time'] : [dist, 'Time'];

  return (
    <div className={`sets t-${layout} m-${mode}`}>
      <div className="st-row st-head" aria-hidden="true">
        <span>Set</span>
        {log && <span>Previous</span>}
        {fieldHeads.map((h) => (
          <span key={h}>{h}</span>
        ))}
        {log && <span>✓</span>}
      </div>

      {sets.map((s, i) => {
        const hint = hintFor?.(i);
        const done = 'done' in s && s.done;
        // Screen-reader names stay unique: "set 2", "set warm-up 1".
        const warmNo = sets.slice(0, i + 1).filter(isWarmup).length;
        const name = `${exerciseName} set ${labels[i] === 'W' ? `warm-up ${warmNo}` : labels[i]}`;
        return (
          <div className={'st-row' + (done ? ' done' : '') + (isWarmup(s) ? ' warm' : '') + (i === timingIndex ? ' timing' : '')} key={i}>
            <SetBadge
              label={labels[i]}
              warm={isWarmup(s)}
              name={name}
              open={menuFor === i}
              onOpen={(o) => setMenuFor(o ? i : null)}
              onToggleWarmup={() => props.onToggleWarmup(i)}
              onRemove={() => props.onRemove(i)}
            />
            {log && <span className="st-prev muted small">{prev[i] ? setText(prev[i], type, units) : '—'}</span>}

            {type === 'weight' && (
              <NumberInput
                ariaLabel={`${name} weight`}
                value={toDisplay(s.weight, unit)}
                onChange={(v) => onChange(i, { weight: fromDisplay(v, unit) })}
                placeholder={hint?.weight ? String(toDisplay(hint.weight, unit)) : '0'}
              />
            )}
            {(type === 'weight' || type === 'reps') && (
              <NumberInput
                ariaLabel={`${name} reps`}
                value={s.reps}
                decimals={false}
                onChange={(v) => onChange(i, { reps: v })}
                placeholder={hint?.reps ? String(hint.reps) : '0'}
              />
            )}
            {layout === 'distance' && (
              <NumberInput
                ariaLabel={`${name} distance`}
                value={toDistDisplay(s.meters ?? 0, dist)}
                onChange={(v) => onChange(i, { meters: fromDistDisplay(v, dist) })}
                placeholder={hint?.meters ? String(toDistDisplay(hint.meters, dist)) : '0'}
              />
            )}
            {type === 'steps' && (
              <NumberInput
                ariaLabel={`${name} steps`}
                value={s.reps}
                decimals={false}
                onChange={(v) => onChange(i, { reps: v })}
                placeholder={hint?.reps ? String(hint.reps) : '0'}
              />
            )}
            {(type === 'time' || type === 'distance' || type === 'steps') && (
              <DurationInput
                ariaLabel={`${name} time`}
                value={s.seconds ?? 0}
                onChange={(v) => onChange(i, { seconds: v })}
                placeholder={hint?.seconds ? fmtTime(hint.seconds) : '0:00'}
              />
            )}

            {log && (
              <button
                className={'check' + (done ? ' on' : '')}
                aria-label={done ? `Mark ${name} not done` : `Mark ${name} done`}
                aria-pressed={done}
                onClick={() => onToggleDone?.(i)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path className="tick" d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
                </svg>
              </button>
            )}
          </div>
        );
      })}

      <button className="btn-ghost full" onClick={props.onAdd}>
        + Add set
      </button>
    </div>
  );
}

/** Set number badge; opens a menu that grows out of it (same spring as Morph Select). */
function SetBadge({
  label,
  warm,
  name,
  open,
  onOpen,
  onToggleWarmup,
  onRemove,
}: {
  label: string;
  warm: boolean;
  name: string;
  open: boolean;
  onOpen: (open: boolean) => void;
  onToggleWarmup: () => void;
  onRemove: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Latest callback in a ref, so the effect below only runs when the menu opens/closes
  // (re-running it on every render would keep yanking focus back to the first item).
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  });

  useEffect(() => {
    if (!open) return;
    wrapRef.current?.querySelector<HTMLButtonElement>('.set-menu button')?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onOpenRef.current(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const close = (focusBadge: boolean) => {
    onOpen(false);
    if (focusBadge) btnRef.current?.focus();
  };

  return (
    <div
      className="set-badge-wrap"
      ref={wrapRef}
      onKeyDown={(e) => {
        if (!open) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          close(true);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const items = [...(wrapRef.current?.querySelectorAll<HTMLButtonElement>('.set-menu button') ?? [])];
          const at = items.indexOf(document.activeElement as HTMLButtonElement);
          items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
        }
      }}
    >
      <button
        ref={btnRef}
        type="button"
        className={'set-badge' + (warm ? ' warm' : '') + (open ? ' open' : '')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name}, options`}
        onClick={() => onOpen(!open)}
      >
        {label}
        <span className="set-badge-dots" aria-hidden="true" />
      </button>
      {open && (
        <div className="set-menu" role="menu" aria-label={`${name} options`}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onToggleWarmup();
              close(true);
            }}
          >
            <span className="sm-icon" aria-hidden="true">W</span>
            {warm ? 'Make a working set' : 'Mark as warm-up'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              onRemove();
              close(false);
            }}
          >
            <span className="sm-icon" aria-hidden="true">✕</span>
            Remove set
          </button>
        </div>
      )}
    </div>
  );
}
