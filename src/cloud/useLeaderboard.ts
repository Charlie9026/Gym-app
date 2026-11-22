/**
 * Keeps your public leaderboard entry up to date while you're signed in and have
 * joined: worked out from your workouts on this device, uploaded a moment after
 * anything changes (and when a new week starts). Also makes sure your friend
 * code points at you.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { AppData } from '../types';
import type { CloudSync } from './useCloudSync';
import { publicEntry } from '../leaderboard';
import { useExerciseMap, useToday } from '../hooks';

export function useLeaderboardPublisher(data: AppData, cloud: CloudSync) {
  const lb = data.settings.leaderboard;
  const exById = useExerciseMap(data.exercises);
  const today = useToday(); // recompute when the day (and so maybe the week) changes
  const uid = cloud.user?.uid;
  const active = !!uid && !!lb?.joined && !!lb.code;

  const bodyKg = data.settings.bodyWeightKg;
  const entry = useMemo(
    () => (active && lb?.code ? publicEntry(data.workouts, exById, { name: lb.name, code: lb.code, goal: lb.goal, bodyKg }, today) : null),
    [active, lb, data.workouts, exById, bodyKg, today],
  );

  // The cloud object is new on every render; keep the loader in a ref so the timer isn't reset each time.
  const getCloud = useRef(cloud.getCloud);
  useEffect(() => {
    getCloud.current = cloud.getCloud;
  });
  const sent = useRef<string | null>(null);
  const claimed = useRef<string | null>(null);
  useEffect(() => {
    if (!entry || !uid) return;
    const json = JSON.stringify(entry);
    if (json === sent.current) return;
    const t = window.setTimeout(async () => {
      try {
        const c = await getCloud.current();
        if (claimed.current !== `${uid}:${entry.code}`) {
          await c.claimCode(uid, entry.code);
          claimed.current = `${uid}:${entry.code}`;
        }
        await c.publishEntry(uid, entry);
        sent.current = json;
      } catch {
        /* offline or not allowed: tries again with the next change */
      }
    }, sent.current === null ? 0 : 1500); // straight away after joining, then batched
    return () => clearTimeout(t);
  }, [entry, uid]);

  // After leaving (or signing out), the next join publishes afresh.
  useEffect(() => {
    if (!active) sent.current = null;
  }, [active]);
}
