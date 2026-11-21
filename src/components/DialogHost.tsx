import { useEffect, useState } from 'react';
import { registerDialogHost, type Ask } from '../dialog';

/** Renders the in-app confirm/text dialogs and toasts requested via src/dialog.ts. */
export function DialogHost() {
  const [pending, setPending] = useState<Ask | null>(null);
  const [text, setText] = useState('');
  const [toast, setToast] = useState<{ msg: string; key: number; undo?: () => void } | null>(null);

  useEffect(
    () =>
      registerDialogHost(
        (a) => {
          setText(a.input ?? '');
          setPending(a);
        },
        (msg, undo) => setToast({ msg, undo, key: Date.now() }),
      ),
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo ? 5000 : 3000);
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
        <div className={'toast' + (toast.undo ? ' has-undo' : '')} role="status" key={toast.key}>
          <span>{toast.msg}</span>
          {toast.undo && (
            <button
              type="button"
              className="toast-undo"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </>
  );
}
