import { describe, expect, it } from 'vitest';
import {
  MEASURES,
  fmtTime,
  fromDistDisplay,
  hasValue,
  paceOf,
  parseTime,
  restLabel,
  setCountText,
  setText,
  topSet,
  toDistDisplay,
  typeOf,
  workingSets,
  unitsOf,
  unitsFor,
  paceUnit,
} from './sets';
import type { SetEntry } from './types';

const set = (p: Partial<SetEntry>): SetEntry => ({ weight: 0, reps: 0, done: true, ...p });

describe('time', () => {
  it('formats seconds as m:ss or h:mm:ss', () => {
    expect(fmtTime(0)).toBe('0:00');
    expect(fmtTime(75)).toBe('1:15');
    expect(fmtTime(3725)).toBe('1:02:05');
  });
  it('parses plain seconds, m:ss and h:mm:ss', () => {
    expect(parseTime('90')).toBe(90);
    expect(parseTime('1:30')).toBe(90);
    expect(parseTime('1:02:30')).toBe(3750);
    expect(parseTime('1:')).toBe(60); // partial input while typing
    expect(parseTime('')).toBe(0);
    expect(parseTime('abc')).toBeNull();
    expect(parseTime('1:2:3:4')).toBeNull();
  });
});

describe('exercise types', () => {
  it('defaults to weight × reps', () => {
    expect(typeOf(undefined)).toBe('weight');
    expect(typeOf({ type: 'time' })).toBe('time');
  });
  it('knows when a set has the value its type needs', () => {
    expect(hasValue(set({ reps: 8 }), 'weight')).toBe(true);
    expect(hasValue(set({ weight: 100 }), 'weight')).toBe(false);
    expect(hasValue(set({ seconds: 30 }), 'time')).toBe(true);
    expect(hasValue(set({ reps: 5 }), 'time')).toBe(false);
    expect(hasValue(set({ meters: 5000 }), 'distance')).toBe(true);
    expect(hasValue(set({ seconds: 1500 }), 'distance')).toBe(true);
  });
  it('describes sets in plain text per type and unit', () => {
    expect(setText(set({ weight: 72.5, reps: 8 }), 'weight', { weight: 'kg', distance: 'km' })).toBe('72.5 kg × 8');
    expect(setText(set({ reps: 12 }), 'reps', { weight: 'kg', distance: 'km' })).toBe('12 reps');
    expect(setText(set({ seconds: 90 }), 'time', { weight: 'kg', distance: 'km' })).toBe('1:30');
    expect(setText(set({ meters: 5000, seconds: 1500 }), 'distance', { weight: 'kg', distance: 'km' })).toBe('5 km in 25:00');
    expect(setText(set({ meters: 5000, seconds: 1500 }), 'distance', { weight: 'lb', distance: 'mi' })).toBe('3.11 mi in 25:00');
  });
  it('shows weight and distance in separately chosen units', () => {
    expect(setText(set({ meters: 5000, seconds: 1500 }), 'distance', { weight: 'kg', distance: 'mi' })).toBe('3.11 mi in 25:00');
    expect(setText(set({ weight: 100, reps: 5 }), 'weight', { weight: 'kg', distance: 'mi' })).toBe('100 kg × 5');
  });
  it('picks the distance unit from settings, following the weight unit until one is chosen', () => {
    expect(unitsOf({ unit: 'kg' })).toEqual({ weight: 'kg', distance: 'km' });
    expect(unitsOf({ unit: 'lb' })).toEqual({ weight: 'lb', distance: 'mi' });
    expect(unitsOf({ unit: 'lb', distanceUnit: 'km' })).toEqual({ weight: 'lb', distance: 'km' });
  });
  it('gives each exercise its own distance unit and pace', () => {
    const app = { weight: 'kg', distance: 'km' } as const;
    const row = { id: 'preset-rowing-machine', name: 'Rowing Machine' };
    expect(unitsFor(row, app)).toMatchObject({ distance: 'm', paceEvery: 500 });
    expect(unitsFor({ id: 'preset-swimming', name: 'Swimming' }, app)).toMatchObject({ distance: 'm', paceEvery: 100 });
    expect(unitsFor({ id: 'preset-running', name: 'Running' }, app)).toMatchObject({ distance: 'km', paceEvery: 1 });
    expect(unitsFor({ ...row, distanceUnit: 'km' as const }, app).distance).toBe('km');
    expect(unitsFor({ id: 'c', name: 'Pool', distanceUnit: 'yd' as const }, app)).toMatchObject({ distance: 'yd', paceEvery: 100 });
    // 2000 m in 8:00 is 2:00 per 500 m.
    const u = unitsFor(row, app);
    expect(paceOf(set({ meters: 2000, seconds: 480 }), u)).toBe(120);
    expect(paceUnit(u)).toBe('/500m');
    expect(paceUnit(app)).toBe('/km');
    expect(setText(set({ meters: 2000, seconds: 480 }), 'distance', u)).toBe('2000 m in 8:00');
  });
  it('shows metres and yards as whole numbers', () => {
    expect(toDistDisplay(1999.6, 'm')).toBe(2000);
    expect(toDistDisplay(91.44, 'yd')).toBe(100);
    expect(fromDistDisplay(100, 'yd')).toBeCloseTo(91.44);
  });
  it('converts distances between km/mi and metres', () => {
    expect(toDistDisplay(1609.344, 'mi')).toBe(1);
    expect(fromDistDisplay(5, 'km')).toBe(5000);
    expect(paceOf(set({ meters: 5000, seconds: 1500 }), { distance: 'km' })).toBe(300); // 5:00 per km
  });
});

describe('warm-ups', () => {
  const sets = [set({ weight: 60, reps: 8, kind: 'warmup' }), set({ weight: 100, reps: 6 }), set({ weight: 100, reps: 5 })];
  it('are left out of working sets and counted separately', () => {
    expect(workingSets(sets)).toHaveLength(2);
    expect(setCountText(sets)).toBe('2 sets + 1 warm-up');
    expect(setCountText([set({ reps: 5 })])).toBe('1 set');
  });
  it('never become the top set while working sets exist', () => {
    const heavyWarmup = [set({ weight: 200, reps: 10, kind: 'warmup' }), set({ weight: 100, reps: 6 })];
    expect(topSet(heavyWarmup, 'weight').weight).toBe(100);
  });
  it('are excluded from progress measures', () => {
    const volume = MEASURES.weight.find((m) => m.id === 'volume')!;
    expect(volume.value(sets, { weight: 'kg', distance: 'km' })).toBe(100 * 6 + 100 * 5);
  });
});

describe('top set and measures', () => {
  it('picks the best set by type; ties go to the earliest', () => {
    const a = set({ weight: 100, reps: 6 });
    const b = set({ weight: 100, reps: 6 });
    expect(topSet([a, b], 'weight')).toBe(a);
    expect(topSet([set({ seconds: 45 }), set({ seconds: 60 })], 'time').seconds).toBe(60);
    expect(topSet([set({ reps: 8 }), set({ reps: 12 })], 'reps').reps).toBe(12);
  });
  it('treats pace as lower-is-better and in display units', () => {
    const pace = MEASURES.distance.find((m) => m.id === 'pace')!;
    expect(pace.lowerIsBetter).toBe(true);
    expect(pace.value([set({ meters: 10000, seconds: 3000 })], { weight: 'kg', distance: 'km' })).toBe(300);
  });
});

describe('rest labels', () => {
  it('reads naturally', () => {
    expect(restLabel(0)).toBe('Off');
    expect(restLabel(30)).toBe('30s');
    expect(restLabel(90)).toBe('1 min 30s');
    expect(restLabel(90, true)).toBe('1:30');
    expect(restLabel(180)).toBe('3 min');
  });
});
