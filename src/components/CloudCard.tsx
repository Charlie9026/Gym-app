import { useState } from 'react';
import { notify } from '../dialog';
import type { CloudSync } from '../cloud/useCloudSync';

/** Plain-language messages for Firebase sign-in errors. */
function explain(e: unknown): string | null {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null; // you closed it; nothing to say
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'That email and password don’t match an account. Check them, or create an account.';
    case 'auth/email-already-in-use':
      return 'There’s already an account with that email. Sign in instead.';
    case 'auth/invalid-email':
      return 'That email address doesn’t look right.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'Choose a password with at least 6 characters.';
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'You’re offline. Connect to the internet to sign in.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups, or sign in with email instead.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method isn’t switched on in Firebase yet (Authentication → Sign-in method).';
    case 'auth/unauthorized-domain':
      return 'This site isn’t allowed to sign in yet. Add its address in Firebase (Authentication → Settings → Authorized domains).';
    default:
      return 'Something went wrong signing in. Try again, or use the other sign-in option.';
  }
}

const STATUS_TEXT: Record<string, string> = {
  connecting: 'Connecting…',
  syncing: 'Saving your latest changes.',
  synced: 'Everything is backed up.',
  offline: 'You’re offline. Changes will sync when you’re back online.',
  error: 'Couldn’t reach the cloud. It will keep trying.',
};

export function CloudCard({ cloud }: { cloud: CloudSync }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (!cloud.available) return null;

  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true);
    try {
      await fn();
      if (done) notify(done);
    } catch (e) {
      const msg = explain(e);
      if (msg) notify(msg);
    } finally {
      setBusy(false);
    }
  };

  if (cloud.user) {
    const who = cloud.user.name || cloud.user.email || 'Your account';
    return (
      <div className="card cloud-card">
        <div className="card-head">
          <h3>Cloud backup</h3>
          <span className={`cloud-status s-${cloud.status}`} role="status">
            <span className="cloud-dot" aria-hidden="true" />
            {cloud.status === 'synced' ? 'Backed up' : cloud.status === 'syncing' ? 'Saving…' : cloud.status === 'offline' ? 'Offline' : cloud.status === 'error' ? 'Problem' : 'Connecting…'}
          </span>
        </div>
        <div className="cloud-account">
          <span className="cloud-avatar" aria-hidden="true">{who.slice(0, 1).toUpperCase()}</span>
          <span className="cloud-who">
            <strong>{who}</strong>
            {cloud.user.name && cloud.user.email && <span className="muted small">{cloud.user.email}</span>}
          </span>
        </div>
        <p className="muted small">
          {STATUS_TEXT[cloud.status] ?? ''} Your workouts, saved workouts, exercises and settings sync to every device where you sign in.
        </p>
        <button className="btn-secondary" disabled={busy} onClick={() => run(() => cloud.signOut(), 'Signed out. Your data stays on this device.')}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="card cloud-card">
      <div className="card-head">
        <h3>Cloud backup</h3>
        {cloud.status === 'connecting' && <span className="muted small">Connecting…</span>}
      </div>
      <p className="muted small">
        Sign in to back up your workouts and use them on your phone and computer. Free. What’s on this device is kept
        and added to your account.
      </p>
      <button className="btn-primary google-btn" disabled={busy} onClick={() => run(() => cloud.signInWithGoogle())}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1a5.94 5.94 0 0 1 0-11.88c1.84 0 3.07.78 3.78 1.46l2.58-2.49A9.4 9.4 0 0 0 12 2.6a9.4 9.4 0 1 0 0 18.8c5.43 0 9.03-3.82 9.03-9.2 0-.62-.07-1.09-.15-1.56z" />
        </svg>
        Continue with Google
      </button>
      <div className="or-row" aria-hidden="true"><span>or use email</span></div>
      <form
        className="cloud-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => cloud.signInWithEmail(email.trim(), password));
        }}
      >
        <input id="cloud-email" className="text-input" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
        <input id="cloud-password" className="text-input" type="password" autoComplete="current-password" placeholder="Password (6+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" />
        <div className="finish-row">
          <button type="submit" className="btn-secondary" disabled={busy || !email || !password}>Sign in</button>
          <button type="button" className="btn-secondary" disabled={busy || !email || !password} onClick={() => run(() => cloud.createAccount(email.trim(), password), 'Account created. Your data is backing up.')}>
            Create account
          </button>
        </div>
        <button
          type="button"
          className="btn-ghost small-btn forgot"
          disabled={busy}
          onClick={() => (email.trim() ? run(() => cloud.resetPassword(email.trim()), 'Check your email for a link to reset your password.') : notify('Type your email first, then tap Forgot password.'))}
        >
          Forgot password?
        </button>
      </form>
    </div>
  );
}
