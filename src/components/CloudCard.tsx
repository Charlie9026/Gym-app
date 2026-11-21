import { useState } from 'react';
import { notify } from '../dialog';
import type { CloudSync } from '../cloud/useCloudSync';
import { explainAuthError } from '../cloud/messages';
import { SignInForm } from './SignInForm';

const STATUS_TEXT: Record<string, string> = {
  connecting: 'Connecting…',
  syncing: 'Saving your latest changes.',
  synced: 'Everything is backed up.',
  offline: 'You’re offline. Changes will sync when you’re back online.',
  error: 'Couldn’t reach the cloud. It will keep trying.',
};

export function CloudCard({ cloud }: { cloud: CloudSync }) {
  const [busy, setBusy] = useState(false);

  if (!cloud.available) return null;

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
      <SignInForm cloud={cloud} idPrefix="cloud" />
    </div>
  );
}
