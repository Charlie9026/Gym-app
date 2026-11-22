import { useEffect, useRef } from 'react';
import type { CloudSync } from '../cloud/useCloudSync';
import type { AppData } from '../types';
import type { Update } from '../store';
import { SignInForm } from './SignInForm';
import { BodyWeightField } from './BodyWeightField';

/**
 * First-open screen: sign in or create an account so your workouts are backed
 * up, or carry on without one (everything still works on this device, offline
 * included; you can sign in later from Settings).
 */
export function Welcome({ cloud, data, update, onSkip }: { cloud: CloudSync; data: AppData; update: Update; onSkip: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('.google-btn')?.focus();
  }, []);

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" ref={ref}>
      <div className="welcome-glow" aria-hidden="true" />
      <div className="welcome-inner">
        <div className="welcome-brand">
          <span className="welcome-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
            </svg>
          </span>
          <h1 id="welcome-title">Overload</h1>
          <p className="welcome-tagline">Log every set. Watch your lifts go up.</p>
        </div>

        <div className="card welcome-card">
          <p className="muted small">
            Sign in to back up your workouts and use them on your phone and computer. It’s free.
          </p>
          <SignInForm cloud={cloud} idPrefix="welcome" initialMode="create" />
        </div>

        <div className="card welcome-card">
          <p className="muted small">
            Add your body weight to see roughly how many calories your workouts burn. This is optional, and you can
            change it later in Settings.
          </p>
          <BodyWeightField settings={data.settings} update={update} id="welcome-body-weight" unitPicker />
        </div>

        <button className="btn-ghost welcome-skip" onClick={onSkip}>
          Not now, use on this device only
        </button>
        <p className="muted small welcome-note">You can sign in any time from Settings.</p>
      </div>
    </div>
  );
}
