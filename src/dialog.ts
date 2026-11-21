/**
 * In-app replacements for window.confirm/alert, which are blocked in some
 * embedded browsers and look out of place on a phone.
 */
export interface Ask {
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

type ShowAsk = (a: Ask) => void;
type ShowToast = (msg: string, undo?: () => void) => void;
let showAsk: ShowAsk | null = null;
let showToast: ShowToast | null = null;

/** Called by <DialogHost> when it mounts; returns a function to unregister. */
export function registerDialogHost(ask: ShowAsk, toast: ShowToast): () => void {
  showAsk = ask;
  showToast = toast;
  return () => {
    showAsk = null;
    showToast = null;
  };
}

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

/**
 * Show a short message. Pass `undo` to add an Undo button (the toast then stays
 * up a little longer); use this instead of "Are you sure?" for single deletes.
 */
export function notify(message: string, opts: { undo?: () => void } = {}) {
  showToast?.(message, opts.undo);
}
