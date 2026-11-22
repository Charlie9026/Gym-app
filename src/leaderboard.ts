/**
 * Leaderboard scores, worked out from your own workouts on your device.
 *
 * Consistency (resets each Monday): 10 points for each day you train (once a
 * day), +5 when that day was a full session (10+ working sets or 20+ minutes of
 * cardio), +25 for reaching your weekly goal, and +5% for each week in a row you
 * reached it before (up to +50%). Your rank comes from your last 4 weeks.
 *
 * Strength: each lift's best estimated one-rep max in the last 90 days, as a
 * multiple of body weight compared to a typical standard for that exercise
 * (100 = a solid intermediate lifter), with your best 3 averaged. Only the
 * scores are shared, never your body weight or the weights you lift.
 */
import type { Exercise, Workout } from './types';
import { e1rm, completedSets } from './utils';
import { typeOf } from './sets';

// ---------- weeks ----------
/** Monday 00:00 (local time) of the week a date falls in. */
export function weekStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
}

/** ISO week id, e.g. "2026-W47" (weeks start on Monday). */
export function weekId(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); // the Thursday of this week decides the year
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// ---------- consistency ----------
export const POINTS = { day: 10, fullDay: 5, goal: 25, streakStep: 0.05, streakMax: 0.5 } as const;
/** Most points a week can score (7 full days, goal reached, full streak bonus). Checked by the database too. */
export const MAX_WEEK_POINTS = Math.round((7 * (POINTS.day + POINTS.fullDay) + POINTS.goal) * (1 + POINTS.streakMax));

export const TIERS = [
  { id: 'bronze', name: 'Bronze', icon: '🥉', from: 0 },
  { id: 'silver', name: 'Silver', icon: '🥈', from: 80 },
  { id: 'gold', name: 'Gold', icon: '🥇', from: 180 },
  { id: 'platinum', name: 'Platinum', icon: '💎', from: 300 },
  { id: 'diamond', name: 'Diamond', icon: '👑', from: 450 },
] as const;
export type TierId = (typeof TIERS)[number]['id'];

export function tierFor(last4: number) {
  let i = 0;
  while (i + 1 < TIERS.length && last4 >= TIERS[i + 1].from) i++;
  return { tier: TIERS[i], next: TIERS[i + 1] ?? null };
}

interface WeekTally {
  days: number;
  fullDays: number;
}

/** Days trained and full days, for each week id. */
function tallyWeeks(workouts: Workout[], exById: Map<string, Exercise>): Map<string, WeekTally> {
  const byDay = new Map<string, { week: string; sets: number; cardioSec: number }>();
  for (const w of workouts) {
    const d = new Date(w.date);
    const key = dayKey(d);
    const day = byDay.get(key) ?? { week: weekId(d), sets: 0, cardioSec: 0 };
    for (const ex of w.exercises) {
      const t = typeOf(exById.get(ex.exerciseId));
      for (const s of completedSets(ex.sets)) {
        if (s.kind === 'warmup') continue;
        if (t === 'distance' || t === 'time' || t === 'steps') day.cardioSec += s.seconds ?? 0;
        else day.sets++;
      }
    }
    byDay.set(key, day);
  }
  const weeks = new Map<string, WeekTally>();
  for (const day of byDay.values()) {
    const t = weeks.get(day.week) ?? { days: 0, fullDays: 0 };
    t.days++;
    if (day.sets >= 10 || day.cardioSec >= 20 * 60) t.fullDays++;
    weeks.set(day.week, t);
  }
  return weeks;
}

export interface Consistency {
  weekId: string;
  /** This week's points. */
  points: number;
  /** Points over this week and the 3 before (decides the rank). */
  last4: number;
  /** Weeks in a row the goal was reached (this week counts once reached). */
  streak: number;
  /** Days trained this week, and the goal. */
  daysThisWeek: number;
  goal: number;
  tier: TierId;
}

export function consistency(workouts: Workout[], exById: Map<string, Exercise>, goal: number, now = new Date()): Consistency {
  const weeks = tallyWeeks(workouts, exById);
  const ids = (n: number) => Array.from({ length: n }, (_, i) => weekId(new Date(weekStart(now).getTime() - i * 7 * 86400000 + 3 * 86400000)));
  const recent = ids(60); // this week first, then back in time
  const hit = (id: string) => (weeks.get(id)?.days ?? 0) >= goal;
  /** Weeks in a row the goal was reached, before the week at `index`. */
  const streakBefore = (index: number) => {
    let n = 0;
    while (index + 1 + n < recent.length && hit(recent[index + 1 + n])) n++;
    return n;
  };
  const pointsFor = (index: number) => {
    const t = weeks.get(recent[index]);
    if (!t) return 0;
    const base = t.days * POINTS.day + t.fullDays * POINTS.fullDay + (t.days >= goal ? POINTS.goal : 0);
    const bonus = t.days >= goal ? Math.min(POINTS.streakMax, POINTS.streakStep * streakBefore(index)) : 0;
    return Math.round(base * (1 + bonus));
  };
  const points = pointsFor(0);
  const last4 = [0, 1, 2, 3].reduce((n, i) => n + pointsFor(i), 0);
  const streak = hit(recent[0]) ? 1 + streakBefore(0) : streakBefore(0);
  return {
    weekId: recent[0],
    points,
    last4,
    streak,
    daysThisWeek: weeks.get(recent[0])?.days ?? 0,
    goal,
    tier: tierFor(last4).tier.id,
  };
}

// ---------- strength ----------
/**
 * A typical one-rep max for a solid intermediate lifter, as a multiple of body
 * weight, for each exercise that counts. Comparing each lift to its own standard
 * keeps it fair: a big leg press number isn't worth more than a deadlift.
 * Only big multi-joint lifts count: standards for small single-muscle moves
 * (curls, flyes, raises, leg curls) vary too much to compare fairly.
 * Dumbbell lifts are for one dumbbell, as people log them. Pull-ups, chin-ups
 * and dips count your body weight plus any added weight.
 */
export const STRENGTH_STANDARDS: Record<string, number> = {
  // Squats and lunges
  'preset-squat': 1.25, 'preset-front-squat': 1.0, 'preset-hack-squat': 1.5, 'preset-leg-press': 2.5,
  'preset-goblet-squat': 0.5, 'preset-bulgarian-split-squat': 0.4, 'preset-lunge': 0.4,
  // Hinges
  'preset-deadlift': 1.5, 'preset-romanian-deadlift': 1.1, 'preset-dumbbell-romanian-deadlift': 0.45, 'preset-hip-thrust': 1.5,
  // Presses
  'preset-bench-press': 1.0, 'preset-incline-bench-press': 0.85, 'preset-close-grip-bench-press': 0.85,
  'preset-dumbbell-bench-press': 0.4, 'preset-incline-dumbbell-press': 0.35,
  'preset-overhead-press': 0.65, 'preset-dumbbell-shoulder-press': 0.3,
  // Pulls
  'preset-barbell-row': 0.9, 'preset-dumbbell-row': 0.45, 'preset-lat-pulldown': 0.85, 'preset-seated-cable-row': 0.85,
  // Bodyweight moves: body weight plus added weight.
  'preset-pull-up': 1.4, 'preset-chin-up': 1.45, 'preset-dips': 1.5,
};
const BODYWEIGHT_LIFTS = new Set(['preset-pull-up', 'preset-chin-up', 'preset-dips']);

/** How many of your best lifts are averaged. */
export const LIFTS_COUNTED = 3;
/** Highest score a single lift (and so the average) can have. Checked by the database too. */
export const MAX_STRENGTH = 300;
const DAYS_COUNTED = 90;

export interface LiftScore {
  /** Exercise id. */
  id: string;
  /** 100 = the intermediate standard for this exercise. */
  score: number;
  /** One-rep max as a multiple of body weight (2 decimals), for your own view. */
  ratio: number;
}

export interface Strength {
  /** Average of your best 3 lift scores (missing ones count as 0). */
  score: number;
  /** Your best lifts, best first (up to 3). */
  top: LiftScore[];
}

/**
 * Strength from the last 90 days, or null without a body weight. Each exercise's
 * best estimated one-rep max (sets of 12 reps or fewer; warm-ups left out) is
 * compared to body weight and to the exercise's standard, then the best 3 are averaged.
 */
export function strength(workouts: Workout[], bodyKg: number | undefined, now = new Date()): Strength | null {
  if (!bodyKg || bodyKg < 30) return null;
  const since = now.getTime() - DAYS_COUNTED * 86400000;
  const best = new Map<string, number>();
  for (const w of workouts) {
    if (Date.parse(w.date) < since) continue;
    for (const ex of w.exercises) {
      if (!STRENGTH_STANDARDS[ex.exerciseId]) continue;
      const withBody = BODYWEIGHT_LIFTS.has(ex.exerciseId);
      for (const s of completedSets(ex.sets)) {
        if (s.kind === 'warmup' || s.reps > 12) continue;
        const max = e1rm({ weight: withBody ? bodyKg + s.weight : s.weight, reps: s.reps });
        if (max > (best.get(ex.exerciseId) ?? 0)) best.set(ex.exerciseId, max);
      }
    }
  }
  const top = [...best.entries()]
    .map(([id, kg]) => {
      const ratio = kg / bodyKg;
      return { id, ratio: Math.round(ratio * 100) / 100, score: Math.min(MAX_STRENGTH, Math.round((ratio / STRENGTH_STANDARDS[id]) * 100)) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, LIFTS_COUNTED);
  const score = Math.round(top.reduce((n, l) => n + l.score, 0) / LIFTS_COUNTED);
  return { score, top };
}

// ---------- names and friend codes ----------
const RUDE = /(fuck|shit|cunt|bitch|nigg|fag|dick|cock|pussy|wank|twat|slut|whore|rape|nazi|hitler)/i;

/** A nickname that's OK to show, or why not. */
export function checkName(raw: string): { ok: true; name: string } | { ok: false; reason: string } {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 2) return { ok: false, reason: 'Use at least 2 characters.' };
  if (name.length > 20) return { ok: false, reason: 'Use 20 characters or fewer.' };
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(name)) return { ok: false, reason: 'Use letters, numbers, spaces, dots, dashes or underscores.' };
  if (RUDE.test(name.replace(/[^a-z]/gi, ''))) return { ok: false, reason: 'Please pick a friendlier name.' };
  return { ok: true, name };
}

/** Letters that are hard to mix up (no 0/O or 1/I/L). */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export function newFriendCode(random = Math.random): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]).join('');
}

/** Tidy a typed code ("abc 123" → "ABC123"), or null if it can't be one. */
export function cleanCode(raw: string): string | null {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === CODE_LENGTH && [...c].every((ch) => CODE_CHARS.includes(ch)) ? c : null;
}

// ---------- what gets shared ----------
/** Your public leaderboard entry. Nothing else about you is shared. */
export interface PublicEntry {
  name: string;
  code: string;
  weekId: string;
  points: number;
  last4: number;
  streak: number;
  tier: TierId;
  /** null when you haven't added your body weight. */
  strength: number | null;
  /** Your best lifts' scores (exercise id and score), keyed l1–l3; null without a body weight. */
  lifts: Partial<Record<'l1' | 'l2' | 'l3', { id: string; score: number }>> | null;
}

export function publicEntry(
  workouts: Workout[],
  exById: Map<string, Exercise>,
  opts: { name: string; code: string; goal: number; bodyKg?: number },
  now = new Date(),
): PublicEntry {
  const c = consistency(workouts, exById, opts.goal, now);
  const s = strength(workouts, opts.bodyKg, now);
  return {
    name: opts.name,
    code: opts.code,
    weekId: c.weekId,
    points: Math.min(MAX_WEEK_POINTS, c.points),
    last4: Math.min(MAX_WEEK_POINTS * 4, c.last4),
    streak: Math.min(520, c.streak),
    tier: c.tier,
    strength: s ? s.score : null,
    lifts: s ? Object.fromEntries(s.top.map((l, i) => [`l${i + 1}`, { id: l.id, score: l.score }])) : null,
  };
}
