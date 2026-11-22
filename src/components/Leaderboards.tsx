import { useEffect, useMemo, useState } from 'react';
import type { AppData, LeaderboardSettings } from '../types';
import type { Update } from '../store';
import type { CloudSync } from '../cloud/useCloudSync';
import type { BoardEntry } from '../cloud/firebase';
import {
  MAX_WEEK_POINTS,
  STRENGTH_LIFTS,
  TIERS,
  checkName,
  cleanCode,
  consistency,
  newFriendCode,
  publicEntry,
  strength as strengthOf,
  tierFor,
  type PublicEntry,
} from '../leaderboard';
import { useExerciseMap, useToday } from '../hooks';
import { notify } from '../dialog';
import { ChipGroup } from './ChipGroup';
import { isEmbedded } from '../env';

type Board = 'consistency' | 'strength';
type Scope = 'friends' | 'global';

const GOALS = [2, 3, 4, 5, 6];
const tierOf = (id: string) => TIERS.find((t) => t.id === id) ?? TIERS[0];

/**
 * Leaderboards: consistency (points for showing up, reset each Monday, with
 * ranks from Bronze to Diamond) and strength (squat + bench + deadlift as a
 * multiple of body weight), each for friends or everyone.
 */
export function Leaderboards({ data, update, cloud, onOpenSettings }: { data: AppData; update: Update; cloud: CloudSync; onOpenSettings: () => void }) {
  const lb = data.settings.leaderboard;

  if (!cloud.available) {
    return (
      <div className="card center lb-intro">
        <span className="lb-intro-icon" aria-hidden="true">🏆</span>
        <strong>Leaderboards need an account</strong>
        <p className="muted small">
          {isEmbedded
            ? 'This copy of the app can’t sign in. Open Overload in your browser to join the leaderboards.'
            : 'Cloud accounts aren’t set up for this copy of the app.'}
        </p>
      </div>
    );
  }
  if (!cloud.user) {
    return (
      <div className="card center lb-intro">
        <span className="lb-intro-icon" aria-hidden="true">🏆</span>
        <strong>Compete with friends</strong>
        <p className="muted small">
          Earn points for showing up, climb from Bronze to Diamond, and see how your strength compares for your body
          weight. Sign in (it’s free) to join.
        </p>
        <button className="btn-primary" onClick={onOpenSettings}>Sign in from Settings</button>
      </div>
    );
  }
  if (!lb?.joined) return <JoinCard data={data} update={update} cloud={cloud} />;
  return <Boards data={data} update={update} cloud={cloud} lb={lb} onOpenSettings={onOpenSettings} />;
}

function JoinCard({ data, update, cloud }: { data: AppData; update: Update; cloud: CloudSync }) {
  const lb = data.settings.leaderboard;
  const [name, setName] = useState(lb?.name ?? '');
  const [goal, setGoal] = useState(String(lb?.goal ?? 3));
  const [busy, setBusy] = useState(false);
  const check = checkName(name);

  const join = async () => {
    if (!check.ok) return notify(check.reason);
    const uid = cloud.user?.uid;
    if (!uid) return;
    setBusy(true);
    try {
      const c = await cloud.getCloud();
      // Keep your old code if you had one; otherwise find a free one.
      let code = lb?.code;
      for (let i = 0; !code || !(await c.claimCode(uid, code)); i++) {
        if (i > 5) throw new Error('no free code');
        code = newFriendCode();
      }
      const next: LeaderboardSettings = { joined: true, name: check.name, goal: Number(goal), code, friends: lb?.friends ?? [] };
      update((d) => ({ ...d, settings: { ...d.settings, leaderboard: next } }));
      notify('You’re on the leaderboards. Good luck!');
    } catch {
      notify('Couldn’t join just now. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card lb-join">
      <div className="lb-intro-head">
        <span className="lb-intro-icon" aria-hidden="true">🏆</span>
        <div>
          <h3>Join the leaderboards</h3>
          <p className="muted small">Points for showing up, ranks from Bronze to Diamond, and strength for your size.</p>
        </div>
      </div>
      <label className="eyebrow" htmlFor="lb-name">Nickname</label>
      <input
        id="lb-name"
        className="text-input"
        placeholder="e.g. Iron Sam"
        maxLength={20}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {name.trim() && !check.ok && <p className="lb-error small">{check.reason}</p>}
      <span className="eyebrow">Weekly goal (days)</span>
      <ChipGroup label="Workout days a week to aim for" kind="radio" variant="segmented" value={goal} onChange={setGoal} options={GOALS.map((g) => ({ value: String(g), label: String(g) }))} />
      <ul className="lb-shared muted small">
        <li>Others see your nickname, points, rank, streak and strength as a multiple of body weight.</li>
        <li>Your workouts, weights, body weight and email stay private.</li>
        <li>You can leave any time in Settings.</li>
      </ul>
      <button className="btn-primary" onClick={join} disabled={busy || !check.ok}>
        {busy ? 'Joining…' : 'Join leaderboards'}
      </button>
    </div>
  );
}

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; entries: BoardEntry[] };

function Boards({ data, update, cloud, lb, onOpenSettings }: { data: AppData; update: Update; cloud: CloudSync; lb: LeaderboardSettings; onOpenSettings: () => void }) {
  const [board, setBoard] = useState<Board>('consistency');
  const [scope, setScope] = useState<Scope>('friends');
  const [reload, setReload] = useState(0);
  const exById = useExerciseMap(data.exercises);
  const today = useToday();
  const uid = cloud.user?.uid ?? '';
  const bodyKg = data.settings.bodyWeightKg;

  const mine = useMemo(() => consistency(data.workouts, exById, lb.goal, today), [data.workouts, exById, lb.goal, today]);
  const myStrength = useMemo(() => strengthOf(data.workouts, bodyKg, today), [data.workouts, bodyKg, today]);
  const me: BoardEntry = useMemo(
    () => ({ ...publicEntry(data.workouts, exById, { name: lb.name, code: lb.code ?? '', goal: lb.goal, bodyKg }, today), uid }),
    [data.workouts, exById, lb, bodyKg, today, uid],
  );

  const friendsKey = lb.friends.join(',');
  const getCloud = cloud.getCloud; // the same function on every render
  // What's on screen; it's "loading" until a fetch for exactly this board has come back.
  const key = `${scope}|${board}|${friendsKey}|${me.weekId}|${reload}`;
  const [result, setResult] = useState<{ key: string; entries?: BoardEntry[] } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const c = await getCloud();
      const friends = friendsKey ? friendsKey.split(',') : [];
      const entries =
        scope === 'friends' ? await c.entries(friends) : board === 'consistency' ? await c.weekEntries(me.weekId) : await c.strengthEntries();
      if (live) setResult({ key, entries });
    })().catch(() => live && setResult({ key }));
    return () => {
      live = false;
    };
  }, [getCloud, key, scope, board, friendsKey, me.weekId]);
  const load: Load = useMemo(
    () => (result?.key !== key ? { status: 'loading' } : result.entries ? { status: 'ready', entries: result.entries } : { status: 'error' }),
    [result, key],
  );

  // Your own row always shows your latest numbers (even before they've uploaded).
  const rows = useMemo(() => {
    if (load.status !== 'ready') return [];
    const list = [...load.entries.filter((e) => e.uid !== uid), me];
    if (board === 'consistency') {
      return list
        .map((e) => ({ ...e, points: e.weekId === me.weekId ? e.points : 0 })) // last week's points don't count this week
        .sort((a, b) => b.points - a.points || b.last4 - a.last4);
    }
    return list.filter((e) => e.strength != null).sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0));
  }, [load, me, uid, board]);

  const removeFriend = (fid: string, name: string) => {
    const before = lb.friends;
    update((d) => ({ ...d, settings: { ...d.settings, leaderboard: { ...lb, friends: before.filter((f) => f !== fid) } } }));
    notify(`${name} removed from your friends`, {
      undo: () => update((d) => ({ ...d, settings: { ...d.settings, leaderboard: { ...lb, friends: before } } })),
    });
  };

  return (
    <div className="lb">
      <div className="lb-controls">
        <ChipGroup label="Leaderboard" variant="segmented" kind="radio" value={board} onChange={setBoard} options={[{ value: 'consistency', label: 'Consistency' }, { value: 'strength', label: 'Strength' }]} />
        <ChipGroup label="Who to compare with" variant="segmented" kind="radio" value={scope} onChange={setScope} options={[{ value: 'friends', label: 'Friends' }, { value: 'global', label: 'Global' }]} />
      </div>

      {board === 'consistency' ? <MyRank c={mine} /> : <MyStrength s={myStrength} onOpenSettings={onOpenSettings} />}

      <section className="card lb-list-card" aria-label={`${scope === 'friends' ? 'Friends' : 'Global'} ${board} leaderboard`}>
        <div className="card-head">
          <h3>{scope === 'friends' ? 'Friends' : board === 'consistency' ? 'Everyone this week' : 'Strongest for their size'}</h3>
          <button className="btn-ghost small-btn" onClick={() => setReload((n) => n + 1)}>Refresh</button>
        </div>
        {load.status === 'loading' && <p className="muted small lb-status">Loading…</p>}
        {load.status === 'error' && <p className="muted small lb-status">Couldn’t load the leaderboard. Check your connection and tap Refresh.</p>}
        {load.status === 'ready' && (
          <>
            <ol className="lb-list">
              {rows.slice(0, 50).map((e, i) => (
                <Row key={e.uid} e={e} pos={i + 1} board={board} you={e.uid === uid} onRemove={scope === 'friends' && e.uid !== uid ? () => removeFriend(e.uid, e.name) : undefined} />
              ))}
            </ol>
            {rows.findIndex((e) => e.uid === uid) >= 50 && (
              <ol className="lb-list lb-you-below" start={rows.findIndex((e) => e.uid === uid) + 1}>
                <Row e={me} pos={rows.findIndex((e) => e.uid === uid) + 1} board={board} you />
              </ol>
            )}
            {board === 'strength' && me.strength == null && <p className="muted small lb-status">You’re not on this board yet: add your body weight in Settings.</p>}
            {scope === 'friends' && lb.friends.length === 0 && <p className="muted small lb-status">No friends yet. Share your code below, or add theirs.</p>}
            {scope === 'friends' && board === 'strength' && lb.friends.length > 0 && rows.length < lb.friends.length + 1 && (
              <p className="muted small lb-status">Friends without a body weight added aren’t on the strength board.</p>
            )}
          </>
        )}
      </section>

      {scope === 'friends' && <FriendsCard lb={lb} update={update} cloud={cloud} />}

      <p className="muted small lb-foot">
        {board === 'consistency'
          ? `10 points a training day, +5 for a full session (10+ sets or 20+ min cardio), +25 for reaching your weekly goal, and up to +50% for a streak. Resets every Monday; most a week can score is ${MAX_WEEK_POINTS}.`
          : 'Your best squat, bench press and deadlift (estimated one-rep max) from the last 90 days, added up and divided by your body weight. Only these ratios are shared.'}
      </p>
    </div>
  );
}

function Row({ e, pos, board, you, onRemove }: { e: PublicEntry & { uid: string }; pos: number; board: Board; you: boolean; onRemove?: () => void }) {
  const t = tierOf(e.tier);
  return (
    <li className={'lb-row' + (you ? ' you' : '') + (pos <= 3 ? ` top top-${pos}` : '')}>
      <span className="lb-pos">{pos}</span>
      <span className="lb-tier" title={t.name} aria-label={t.name}>{t.icon}</span>
      <span className="lb-name">
        {e.name}
        {you && <span className="badge">you</span>}
      </span>
      <span className="lb-value">
        {board === 'consistency' ? (
          <>
            <strong>{e.points}</strong> <span className="muted small">pts</span>
          </>
        ) : (
          <>
            <strong>{((e.strength ?? 0) / 100).toFixed(2)}×</strong> <span className="muted small">bw</span>
          </>
        )}
      </span>
      {onRemove && (
        <button className="icon-btn lb-remove" aria-label={`Remove ${e.name} from friends`} onClick={onRemove}>✕</button>
      )}
    </li>
  );
}

function MyRank({ c }: { c: ReturnType<typeof consistency> }) {
  const { tier, next } = tierFor(c.last4);
  const into = next ? (c.last4 - tier.from) / (next.from - tier.from) : 1;
  return (
    <div className="card lb-me">
      <div className="lb-me-top">
        <span className="lb-me-icon" aria-hidden="true">{tier.icon}</span>
        <div className="lb-me-text">
          <span className="eyebrow">Your rank</span>
          <strong className="lb-me-tier">{tier.name}</strong>
          <span className="muted small">{c.last4} points over the last 4 weeks</span>
        </div>
      </div>
      <div className="lb-progress" role="progressbar" aria-label="Progress to the next rank" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(into * 100)}>
        <span style={{ transform: `scaleX(${Math.max(0.02, into)})` }} />
      </div>
      <span className="muted small">{next ? `${next.from - c.last4} points to ${next.name}` : 'Top rank. Keep it up!'}</span>
      <div className="lb-me-stats">
        <div><strong>{c.points}</strong><span className="muted small">points this week</span></div>
        <div>
          <strong>{c.daysThisWeek} {c.daysThisWeek === 1 ? 'day' : 'days'}</strong>
          <span className="muted small">{c.daysThisWeek >= c.goal ? `goal of ${c.goal} reached` : `of ${c.goal} this week`}</span>
        </div>
        <div><strong>{c.streak} {c.streak === 1 ? 'week' : 'weeks'}</strong><span className="muted small">streak</span></div>
      </div>
    </div>
  );
}

function MyStrength({ s, onOpenSettings }: { s: ReturnType<typeof strengthOf>; onOpenSettings: () => void }) {
  if (!s) {
    return (
      <div className="card lb-me">
        <strong>Add your body weight to join</strong>
        <p className="muted small">The strength board compares lifts to body weight, so a lighter lifter can top it. Your body weight stays private.</p>
        <button className="btn-secondary" onClick={onOpenSettings}>Add it in Settings</button>
      </div>
    );
  }
  return (
    <div className="card lb-me">
      <div className="lb-me-top">
        <span className="lb-me-icon" aria-hidden="true">💪</span>
        <div className="lb-me-text">
          <span className="eyebrow">Your strength</span>
          <strong className="lb-me-tier">{(s.score / 100).toFixed(2)}× body weight</strong>
          <span className="muted small">Squat, bench press and deadlift added up</span>
        </div>
      </div>
      <div className="lb-lifts">
        {STRENGTH_LIFTS.map((l) => (
          <div key={l.key}>
            <strong>{s.ratios[l.key] ? `${s.ratios[l.key].toFixed(2)}×` : '—'}</strong>
            <span className="muted small">{l.name}</span>
          </div>
        ))}
      </div>
      {s.score === 0 && <p className="muted small">Log a squat, bench press or deadlift (12 reps or fewer) to get a score.</p>}
    </div>
  );
}

function FriendsCard({ lb, update, cloud }: { lb: LeaderboardSettings; update: Update; cloud: CloudSync }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const c = cleanCode(code);
    if (!c) return notify('Friend codes are 6 letters and numbers, like K7M2QX.');
    if (c === lb.code) return notify('That’s your own code. Share it with a friend so they can add you.');
    setBusy(true);
    try {
      const fid = await (await cloud.getCloud()).findCode(c);
      if (!fid) return notify('No one has that code. Check it and try again.');
      if (lb.friends.includes(fid)) return notify('They’re already in your friends.');
      if (lb.friends.length >= 60) return notify('You can have up to 60 friends.');
      update((d) => ({ ...d, settings: { ...d.settings, leaderboard: { ...lb, friends: [...lb.friends, fid] } } }));
      setCode('');
      notify('Friend added');
    } catch {
      notify('Couldn’t add them just now. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const text = `Add me on Overload: my friend code is ${lb.code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(lb.code ?? '');
        notify('Code copied');
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="card lb-friends">
      <div className="lb-code-row">
        <div>
          <span className="eyebrow">Your friend code</span>
          <strong className="lb-code">{lb.code}</strong>
        </div>
        <button className="btn-secondary compact" onClick={share}>Share</button>
      </div>
      <div className="lb-add">
        <input
          className="text-input"
          aria-label="Friend’s code"
          placeholder="Friend’s code"
          autoCapitalize="characters"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn-primary" onClick={add} disabled={busy || !code.trim()}>Add</button>
      </div>
    </div>
  );
}
