import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

/**
 * Morph Select, adapted from the Forever AI "Morph Select" component:
 * the list grows out of the button's edge on a spring, and a badge on the
 * button reflects the current choice. Styled with the app's theme tokens.
 */
export interface MorphOption {
  value: string;
  label: string;
  /** Short text shown in the badge (e.g. a muscle code). */
  badge?: string;
  /** Secondary text on the right of the option. */
  hint?: string;
}

interface Props {
  label: string;
  options: MorphOption[];
  value: string;
  onChange: (value: string) => void;
  /** Hide the visible label (it stays available to screen readers). */
  hideLabel?: boolean;
}

export function MorphSelect({ label, options, value, onChange, hideLabel }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const selIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const [act, setAct] = useState(selIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options[selIndex];

  const show = (o: boolean, focus: boolean) => {
    setOpen(o);
    if (o) {
      setAct(selIndex);
      if (focus) requestAnimationFrame(() => listRef.current?.focus());
    } else if (focus) {
      btnRef.current?.focus();
    }
  };

  const pick = (i: number, focus: boolean) => {
    onChange(options[i].value);
    setAct(i);
    show(false, focus);
  };

  // Close when tapping anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Keep the highlighted option in view in long lists.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${id}-o${act}`)?.scrollIntoView({ block: 'nearest' });
  }, [act, open, id]);

  const onListKey = (e: KeyboardEvent) => {
    const n = options.length;
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      setAct((a) => (a + (k === 'ArrowDown' ? 1 : -1) + n) % n);
    } else if (k === 'Home' || k === 'End') {
      e.preventDefault();
      setAct(k === 'Home' ? 0 : n - 1);
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      pick(act, true);
    } else if (k === 'Escape') {
      e.preventDefault();
      show(false, true);
    } else if (k === 'Tab') {
      setOpen(false);
    } else if (k.length === 1) {
      // Type to jump: next option starting with that letter, wrapping around.
      const ch = k.toLowerCase();
      for (let s = 1; s <= n; s++) {
        const j = (act + s) % n;
        if (options[j].label.toLowerCase().startsWith(ch)) {
          setAct(j);
          break;
        }
      }
    }
  };

  return (
    <div className="ms" ref={rootRef} data-open={open}>
      <span className={hideLabel ? 'ms-sr' : 'ms-label'} id={`${id}-l`}>
        {label}
      </span>
      <button
        ref={btnRef}
        type="button"
        className="ms-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-l ${id}-v`}
        onClick={() => show(!open, true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            show(true, true);
          } else if (e.key === 'Escape' && open) {
            e.preventDefault();
            show(false, false);
          }
        }}
      >
        {selected?.badge !== undefined && (
          <span className="ms-badge" key={selected.value} aria-hidden="true">
            {selected.badge}
          </span>
        )}
        <span className="ms-v" id={`${id}-v`}>
          {selected?.label}
        </span>
        <span className="ms-ch" aria-hidden="true" />
      </button>
      <ul
        ref={listRef}
        className="ms-list"
        role="listbox"
        tabIndex={-1}
        aria-labelledby={`${id}-l`}
        aria-activedescendant={open ? `${id}-o${act}` : undefined}
        onKeyDown={onListKey}
      >
        {options.map((o, i) => (
          <li
            key={o.value}
            id={`${id}-o${i}`}
            role="option"
            aria-selected={i === selIndex}
            className={'ms-opt' + (i === act ? ' ms-act' : '')}
            onPointerEnter={() => setAct(i)}
            onClick={() => pick(i, true)}
          >
            {o.badge !== undefined && (
              <span className="ms-badge small" aria-hidden="true">
                {o.badge}
              </span>
            )}
            <span className="ms-ot">{o.label}</span>
            {o.hint && <span className="ms-hint">{o.hint}</span>}
            <span className="ms-tick" aria-hidden="true" />
          </li>
        ))}
      </ul>
    </div>
  );
}
