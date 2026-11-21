import { useEffect, useMemo, useState } from 'react';
import type { Exercise } from './types';

/** Exercises looked up by id (memoised on the list). */
export function useExerciseMap(exercises: Exercise[]): Map<string, Exercise> {
  return useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
}

/** Today's date, refreshed at midnight so a screen left open overnight stays right. */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 1);
    const t = setTimeout(() => setToday(new Date()), next.getTime() - today.getTime());
    return () => clearTimeout(t);
  }, [today]);
  return today;
}
