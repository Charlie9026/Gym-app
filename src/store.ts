import { useCallback, useEffect, useState } from 'react';
import { PRESET_EXERCISES } from './exercises';
import type { AppData } from './types';

const KEY = 'gym-app-data-v1';

export function emptyData(): AppData {
  return {
    version: 1,
    exercises: PRESET_EXERCISES,
    workouts: [],
    activeWorkout: null,
    settings: { unit: 'kg' },
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

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    if (!isAppData(parsed)) return emptyData();
    return { ...emptyData(), ...parsed };
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
