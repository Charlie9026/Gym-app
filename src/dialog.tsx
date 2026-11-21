import { useEffect, useState } from 'react';

/**
 * In-app replacements for window.confirm/alert, which are blocked in some
 * embedded browsers and look out of place on a phone.
 */
interface Ask {
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

let showAsk: ((a: Ask) => void) | null = null;
let showToast: ((msg: string) => void) | null = null;

export function ask(message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!showAsk) return resolve(false);
    showAsk({ message, confirmLabel: opts.confirmLabel ?? 'OK', danger: opts.danger ?? true, resolve });
  });
}

export function notify(message: string) {
  showToast?.(message);
}

export function DialogHost() {
  const [pending, setPending] = useState<Ask | null>(null);
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);

  useEffect(() => {
    showAsk = setPending;
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
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <>
      {pending && (
        <div className="modal-backdrop center-modal" onClick={() => close(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <p>{pending.message}</p>
            <div className="finish-row">
              <button className="btn-secondary" onClick={() => close(false)} autoFocus>
                Cancel
              </button>
              <button className={pending.danger ? 'btn-danger solid' : 'btn-primary'} onClick={() => close(true)}>
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
