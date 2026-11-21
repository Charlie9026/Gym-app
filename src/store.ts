import { useCallback, useEffect, useState } from 'react';
import { PRESET_EXERCISES } from './exercises';
import type { AppData } from './types';
import { systemDefaultThemeId } from './themes';

const KEY = 'gym-app-data-v1';

export function emptyData(): AppData {
  return {
    version: 1,
    exercises: PRESET_EXERCISES,
    workouts: [],
    templates: [],
    activeWorkout: null,
    settings: { unit: 'kg', theme: systemDefaultThemeId() },
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

/** Bring older saved data up to date. */
export function migrate(d: AppData): AppData {
  // "Arms" was split into Biceps and Triceps; new presets get added too.
  const presetById = new Map(PRESET_EXERCISES.map((e) => [e.id, e]));
  const exercises = d.exercises.map((e) => {
    if ((e.muscle as string) !== 'Arms') return e;
    const preset = presetById.get(e.id);
    if (preset) return { ...e, muscle: preset.muscle };
    const tri = /tri|push ?down|skull|dip|extension|kickback|close.?grip/i.test(e.name);
    return { ...e, muscle: tri ? ('Triceps' as const) : ('Biceps' as const) };
  });
  const known = new Set(exercises.map((e) => e.id));
  for (const p of PRESET_EXERCISES) if (!known.has(p.id)) exercises.push(p);
  return { ...d, exercises };
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
