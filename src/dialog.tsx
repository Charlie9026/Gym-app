import { useEffect, useState } from 'react';

/**
 * In-app replacements for window.confirm/alert, which are blocked in some
 * embedded browsers and look out of place on a phone.
 */
interface Ask {
  message: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  /** When set, the dialog shows a text field with this starting value. */
  input?: string;
  placeholder?: string;
  resolve: (result: string | null) => void;
}

interface AskOpts {
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  detail?: string;
}

let showAsk: ((a: Ask) => void) | null = null;
let showToast: ((msg: string) => void) | null = null;

export function ask(message: string, opts: AskOpts = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!showAsk) return resolve(false);
    showAsk({
      message,
      detail: opts.detail,
      confirmLabel: opts.confirmLabel ?? 'OK',
      cancelLabel: opts.cancelLabel ?? 'Cancel',
      danger: opts.danger ?? true,
      resolve: (r) => resolve(r !== null),
    });
  });
}

/** Ask for a line of text. Resolves to the trimmed text, or null if cancelled. */
export function askText(
  message: string,
  initial: string,
  opts: AskOpts & { placeholder?: string } = {},
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!showAsk) return resolve(null);
    showAsk({
      message,
      detail: opts.detail,
      confirmLabel: opts.confirmLabel ?? 'Save',
      cancelLabel: opts.cancelLabel ?? 'Cancel',
      danger: false,
      input: initial,
      placeholder: opts.placeholder,
      resolve,
    });
  });
}

export function notify(message: string) {
  showToast?.(message);
}

export function DialogHost() {
  const [pending, setPending] = useState<Ask | null>(null);
  const [text, setText] = useState('');
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);

  useEffect(() => {
    showAsk = (a) => {
      setText(a.input ?? '');
      setPending(a);
    };
    showToast = (msg) => setToast({ msg, key: Date.now() });
    return () => {
      showAsk = null;
      showToast = null;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const close = (ok: boolean) => {
    if (!pending) return;
    if (ok && pending.input !== undefined) {
      if (!text.trim()) return;
      pending.resolve(text.trim());
    } else {
      pending.resolve(ok ? '' : null);
    }
    setPending(null);
  };

  return (
    <>
      {pending && (
        <div className="modal-backdrop center-modal" onClick={() => close(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <p>{pending.message}</p>
            {pending.detail && <p className="muted small dialog-detail">{pending.detail}</p>}
            {pending.input !== undefined && (
              <input
                id="dialog-input"
                className="text-input"
                value={text}
                placeholder={pending.placeholder}
                autoFocus
                onFocus={(e) => e.target.select()}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && close(true)}
              />
            )}
            <div className="finish-row">
              <button className="btn-secondary" onClick={() => close(false)} autoFocus={pending.input === undefined}>
                {pending.cancelLabel}
              </button>
              <button
                className={pending.danger ? 'btn-danger solid' : 'btn-primary'}
                onClick={() => close(true)}
                disabled={pending.input !== undefined && !text.trim()}
              >
                {pending.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status" key={toast.key}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
