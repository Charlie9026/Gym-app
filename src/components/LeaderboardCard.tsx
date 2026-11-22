import { useState } from 'react';
import type { AppData } from '../types';
import type { Update } from '../store';
import type { CloudSync } from '../cloud/useCloudSync';
import { checkName } from '../leaderboard';
import { notify } from '../dialog';
import { ChipGroup } from './ChipGroup';

/** Settings: your leaderboard nickname and weekly goal, or leave the leaderboards. */
export function LeaderboardCard({ data, update, cloud }: { data: AppData; update: Update; cloud: CloudSync }) {
  const lb = data.settings.leaderboard;
  const [name, setName] = useState(lb?.name ?? '');
  if (!cloud.available) return null;

  if (!lb?.joined) {
    return (
      <div className="card">
        <h3>Leaderboards</h3>
        <p className="muted small">
          {cloud.user
            ? 'Compete with friends on points for showing up, and on strength for your size. Join from Progress, then Leaderboards.'
            : 'Sign in above, then join from Progress, then Leaderboards, to compete with friends.'}
        </p>
      </div>
    );
  }

  const saveName = () => {
    const c = checkName(name);
    if (!c.ok) {
      notify(c.reason);
      return setName(lb.name);
    }
    if (c.name !== lb.name) {
      update((d) => ({ ...d, settings: { ...d.settings, leaderboard: { ...lb, name: c.name } } }));
      notify('Nickname saved');
    }
    setName(c.name);
  };

  const leave = async () => {
    const uid = cloud.user?.uid;
    try {
      if (uid) await (await cloud.getCloud()).removeEntry(uid, lb.code);
    } catch {
      return notify('Couldn’t leave just now. Check your connection and try again.');
    }
    update((d) => ({ ...d, settings: { ...d.settings, leaderboard: { ...lb, joined: false } } }));
    notify('You’ve left the leaderboards', {
      // Rejoining puts your entry and friend code back.
      undo: () => update((d) => ({ ...d, settings: { ...d.settings, leaderboard: { ...lb, joined: true } } })),
    });
  };

  return (
    <div className="card lb-settings">
      <div className="card-head">
        <h3>Leaderboards</h3>
        <span className="muted small">Code {lb.code}</span>
      </div>
      <label className="eyebrow" htmlFor="lb-settings-name">Nickname</label>
      <input
        id="lb-settings-name"
        className="text-input"
        maxLength={20}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveName}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className="eyebrow">Weekly goal (days)</span>
      <ChipGroup
        label="Workout days a week to aim for"
        kind="radio"
        variant="segmented"
        value={String(lb.goal)}
        onChange={(g) => update((d) => ({ ...d, settings: { ...d.settings, leaderboard: { ...lb, goal: Number(g) } } }))}
        options={[2, 3, 4, 5, 6].map((g) => ({ value: String(g), label: String(g) }))}
      />
      <p className="muted small">Reaching your goal earns 25 points and builds your streak.</p>
      <button className="btn-danger" onClick={leave}>Leave leaderboards</button>
    </div>
  );
}
