import { useMemo } from 'react';
import type { Exercise, MuscleGroup } from '../types';
import type { AnySet } from '../sets';
import { loadLabel, muscleLoad } from '../muscles';

/**
 * Front and back body diagram: grey figures with the muscles a workout trains
 * filled in the theme's accent colour (stronger for muscles with more sets).
 * The left half of each figure is drawn and mirrored for the right.
 */
export type MuscleLoad = Partial<Record<MuscleGroup, number>>;

interface Region {
  d: string;
  muscle?: MuscleGroup;
}

// viewBox 0 0 100 200, figure centred on x = 50. Left half only (mirrored for the right).
const FOREARM = 'M22.6 70.8c-2.2 6.7-3.6 14.2-3.8 21.7l5 .5c2.2-7.5 4.6-15 6-22.2-2.2 1.6-5.2 1.6-7.2 0z';
const HAND = 'M18.6 94.4l5.4.4.6 5.2c-.6 3.4-2.4 5-4 5-1.8 0-3-2-3-5z';
const FOOT = 'M37.4 187.6h6.4l1.6 6.4-.8 1.4h-9l-.4-1.6z';

const FRONT: Region[] = [
  { d: 'M45.5 19.5H50V29h-8c2-3 3-6 3.5-9.5z' }, // neck
  { muscle: 'Shoulders', d: 'M41 29c-8-.5-13.5 3-15 10.5-.7 4 .3 8 2.5 10 2-6.5 5.5-12 11.5-15z' },
  { muscle: 'Chest', d: 'M50 31l-8.5-.5c-6 3-10 8-11 15 2.5 5.5 9.5 9 19.5 7.5z' },
  { muscle: 'Biceps', d: 'M28 50.5c-3.5 4-5.5 10.5-5.4 17.5 1.8 2.4 5 2.6 7 .6 1.4-6.6 1.8-12.6.8-17.1z' },
  { d: FOREARM },
  { d: HAND },
  { muscle: 'Core', d: 'M50 55l-7 .4c-.4 8.6-.4 18.6.4 28.6 1.6 5.5 4 9.4 6.6 11z' }, // abs
  { muscle: 'Core', d: 'M41.6 55.6c-3.2 2.9-4.8 8.4-4.4 14.9.4 6.5 2.2 12.5 4.8 17-.8-10.5-1-21.5-.4-31.9z' }, // obliques
  { d: 'M42.6 88.5c1.8 5 4.4 8.5 7.4 10v5.5l-11-1.5c-.6-5.5.6-10 3.6-14z' }, // hip
  { muscle: 'Quads', d: 'M49 104.5l-10.4-1.5c-4 9-5 22-3.2 35 2.2 5.6 8.6 6.6 12 2.6 2-11.6 2.4-23.6 1.6-36.1z' },
  { d: 'M41.6 142.6c2.8 0 5 2 5 4.4s-2.2 4.4-5 4.4-5-2-5-4.4 2.2-4.4 5-4.4z' }, // knee
  { muscle: 'Calves', d: 'M36.8 152.5c-2.2 8.5-2 19.5.4 33.5h6.4c2-12 3-23 2.2-33.2-2.8 1.6-6.2 1.4-9 -.3z' },
  { d: FOOT },
];

const BACK: Region[] = [
  { d: 'M45.5 19.5H50V25h-5z' }, // neck
  { muscle: 'Back', d: 'M50 22c-2.4 4-7.4 6.6-14.2 8 6.6 3.5 11.2 8.6 14.2 14z' }, // traps
  { muscle: 'Shoulders', d: 'M35 30.6c-5 .6-8 4-8.8 9.8-.4 3.6.4 7 2.4 9 2-6.4 4.8-11 9.8-14.2z' }, // rear delt
  { muscle: 'Back', d: 'M50 46c-3.4-4.4-7.4-7.8-11.6-9.6-2.8 5.2-3.8 12.6-2.2 20.6 2.6 9 7.8 16 13.8 20z' }, // lats
  { muscle: 'Back', d: 'M50 78.6c-3.4-1.6-6.6-4-9.2-7-.4 7 .8 14.4 3.6 20H50z' }, // lower back
  { muscle: 'Triceps', d: 'M28.4 50.4c-3.6 4-5.6 10.6-5.6 17.6 1.8 2.4 5.2 2.6 7.2.6 1.2-6.4 1.4-12.4.2-17z' },
  { d: FOREARM },
  { d: HAND },
  { muscle: 'Glutes', d: 'M50 92.6h-7.4c-5 2.4-7 9-5.4 16.2 3.4 4.8 9.4 5.6 12.8 2.8z' },
  { muscle: 'Hamstrings', d: 'M49 113.6l-11.2-2c-3.2 9.4-3.4 21.4-1.4 32 3 3.8 8.2 3.8 10.8.4 1.6-10 2.2-20 1.8-30.4z' },
  { d: 'M41.8 145.6c2.6 0 4.6 1.6 4.6 3.6s-2 3.6-4.6 3.6-4.6-1.6-4.6-3.6 2-3.6 4.6-3.6z' }, // back of knee
  { muscle: 'Calves', d: 'M37 153.6c-3.2 7-3.4 15.4-.4 23 3.2 3.2 7.8 3 9.4-.6 1.4-7.4 1.2-15.2-.4-22.6-2.8 1.4-5.8 1.4-8.6.2z' },
  { d: 'M37.4 178.4c2.6 2 6.2 2 8.6 0l-2 7.6h-5.8z' }, // lower leg
  { d: FOOT },
];

/** How strongly to fill a muscle (0 = grey). */
const level = (load: MuscleLoad, m?: MuscleGroup) => (m ? Math.max(0, Math.min(1, load[m] ?? 0)) : 0);

function Figure({ regions, load, side }: { regions: Region[]; load: MuscleLoad; side: string }) {
  const parts = regions.map((r, i) => {
    const l = level(load, r.muscle);
    return (
      <path
        key={i}
        d={r.d}
        className={r.muscle ? 'bm-muscle' + (l > 0 ? ' on' : '') : 'bm-skin'}
        style={l > 0 ? { fillOpacity: 0.35 + 0.65 * l } : undefined}
      />
    );
  });
  return (
    <svg viewBox="0 0 100 200" className="bm-figure" aria-hidden="true" data-side={side}>
      <ellipse className="bm-skin" cx="50" cy="11" rx="7.5" ry="9.5" />
      <g>{parts}</g>
      <g transform="translate(100 0) scale(-1 1)">{parts}</g>
    </svg>
  );
}

/** Both views side by side. `label` describes it for screen readers. */
export function BodyMap({ load, label, size = 'small' }: { load: MuscleLoad; label: string; size?: 'small' | 'large' }) {
  return (
    <div className={`body-map ${size}`} role="img" aria-label={label}>
      <Figure regions={FRONT} load={load} side="front" />
      <Figure regions={BACK} load={load} side="back" />
    </div>
  );
}

/** The diagram for a list of exercises (a saved workout, a plan's workout, a logged workout). */
export function WorkoutBody({
  exercises,
  exById,
  size,
}: {
  exercises: { exerciseId: string; sets: AnySet[] }[];
  exById: Map<string, Exercise>;
  size?: 'small' | 'large';
}) {
  const load = useMemo(() => muscleLoad(exercises, exById), [exercises, exById]);
  return <BodyMap load={load} label={loadLabel(load)} size={size} />;
}
