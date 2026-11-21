import { useCallback, useEffect, useState } from 'react';
import { PRESET_EXERCISES } from './exercises';
import type { AppData, Exercise, MuscleGroup } from './types';
import { systemDefaultThemeId } from './themes';

const KEY = 'gym-app-data-v1';

export function emptyData(): AppData {
  return {
    version: 1,
    exercises: PRESET_EXERCISES,
    workouts: [],
    templates: [],
    activeWorkout: null,
    settings: { unit: 'kg', theme: systemDefaultThemeId(), restSeconds: 90 },
  };
}

export function isAppData(x: unknown): x is AppData {
  const d = x as AppData;
  return (
    !!d &&
    typeof d === 'object' &&
    Array.isArray(d.exercises) &&
    Array.isArray(d.workouts) &&
    !!d.settings
  );
}

/** Best guess for a custom exercise saved under an old combined group. */
function guessMuscle(old: 'Arms' | 'Legs', name: string): MuscleGroup {
  if (old === 'Arms') return /tri|push ?down|skull|dip|extension|kickback|close.?grip/i.test(name) ? 'Triceps' : 'Biceps';
  if (/calf|calves/i.test(name)) return 'Calves';
  if (/glute|hip|thrust|bridge|abduct|kickback/i.test(name)) return 'Glutes';
  if (/hamstring|curl|romanian|rdl|good morning|nordic|stiff/i.test(name)) return 'Hamstrings';
  return 'Quads';
}

/** Bring older saved data up to date. */
export function migrate(d: AppData): AppData {
  // "Arms" and "Legs" were split into specific muscles; new presets get added too.
  const presetById = new Map(PRESET_EXERCISES.map((e) => [e.id, e]));
  const exercises = d.exercises.map((e): Exercise => {
    const old = e.muscle as string;
    // Presets saved before exercise types existed pick up their type.
    const preset = presetById.get(e.id);
    if (preset?.type && !e.type) e = { ...e, type: preset.type };
    if (old !== 'Arms' && old !== 'Legs') return e;
    if (preset) return { ...e, muscle: preset.muscle };
    return { ...e, muscle: guessMuscle(old, e.name) };
  });
  const known = new Set(exercises.map((e) => e.id));
  for (const p of PRESET_EXERCISES) if (!known.has(p.id)) exercises.push(p);
  const workouts = [...d.workouts].sort((a, b) => a.date.localeCompare(b.date));
  return { ...d, exercises, workouts };
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    if (!isAppData(parsed)) return emptyData();
    const base = emptyData();
    return migrate({ ...base, ...parsed, settings: { ...base.settings, ...parsed.settings } });
  } catch {
    return emptyData();
  }
}

export function useAppData() {
  const [data, setData] = useState<AppData>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // storage full or unavailable; nothing sensible to do
    }
  }, [data]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData(fn), []);

  return [data, update] as const;
}

export type Update = ReturnType<typeof useAppData>[1];
