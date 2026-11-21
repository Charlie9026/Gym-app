import { useState } from 'react';
import { notify } from '../dialog';
import { explainAuthError } from '../cloud/messages';
import type { CloudSync } from '../cloud/useCloudSync';
import { ChipGroup } from './ChipGroup';

type Mode = 'signin' | 'create';

/**
 * Google button + email/password form with a sliding Sign in / Create account
 * switch. Used on the welcome screen and in Settings → Cloud backup.
 */
export function SignInForm({ cloud, idPrefix, initialMode = 'signin' }: { cloud: CloudSync; idPrefix: string; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true);
    try {
      await fn();
      if (done) notify(done);
    } catch (e) {
      const msg = explainAuthError(e);
      if (msg) notify(msg);
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    mode === 'create'
      ? run(() => cloud.createAccount(email.trim(), password), 'Account created. Your data is backing up.')
      : run(() => cloud.signInWithEmail(email.trim(), password));

  return (
    <div className="signin">
      <button className="btn-primary google-btn" disabled={busy} onClick={() => run(() => cloud.signInWithGoogle())}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1a5.94 5.94 0 0 1 0-11.88c1.84 0 3.07.78 3.78 1.46l2.58-2.49A9.4 9.4 0 0 0 12 2.6a9.4 9.4 0 1 0 0 18.8c5.43 0 9.03-3.82 9.03-9.2 0-.62-.07-1.09-.15-1.56z" />
        </svg>
        Continue with Google
      </button>
      <div className="or-row" aria-hidden="true">
        <span>or use email</span>
      </div>
      <ChipGroup
        label="Sign in or create an account"
        kind="tabs"
        variant="segmented"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'signin', label: 'Sign in' },
          { value: 'create', label: 'Create account' },
        ]}
      />
      <form
        className="cloud-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          id={`${idPrefix}-email`}
          className="text-input"
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
        />
        <input
          id={`${idPrefix}-password`}
          className="text-input"
          type="password"
          autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
          placeholder={mode === 'create' ? 'Choose a password (6+ characters)' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Password"
        />
        <button type="submit" className="btn-secondary" disabled={busy || !email || !password}>
          {busy ? 'One moment…' : mode === 'create' ? 'Create account' : 'Sign in'}
        </button>
        {mode === 'signin' && (
          <button
            type="button"
            className="btn-ghost small-btn forgot"
            disabled={busy}
            onClick={() =>
              email.trim()
                ? run(() => cloud.resetPassword(email.trim()), 'Check your email for a link to reset your password.')
                : notify('Type your email first, then tap Forgot password.')
            }
          >
            Forgot password?
          </button>
        )}
      </form>
    </div>
  );
}
