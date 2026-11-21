import { expect, test } from '@playwright/test';
import { openApp, pickProgressExercise, tab } from './helpers.ts';

// 15 bench sessions over ~5 months: new bests at 62.5, 65, 67.5, 70, 72.5 and 75 kg (6 PRs).
const day = 86400000;
const W = [60, 62.5, 62.5, 65, 62.5, 65, 67.5, 67.5, 70, 67.5, 70, 72.5, 72.5, 75, 72.5];
function seed() {
  const now = Date.now();
  const workouts = W.map((w, i) => {
    const date = new Date(now - (W.length - 1 - i) * 10 * day - 3600000).toISOString();
    return { id: 'w' + i, date, name: 'Push', notes: '', exercises: [{ exerciseId: 'preset-bench-press', sets: [{ weight: 40, reps: 10, done: true, kind: 'warmup' }, { weight: w, reps: 8, done: true }, { weight: w, reps: 8, done: true }] }] };
  });
  [150, 120, 90, 65].forEach((ago, i) =>
    workouts.push({ id: 's' + i, date: new Date(now - ago * day).toISOString(), name: 'Legs', notes: '', exercises: [{ exerciseId: 'preset-squat', sets: [{ weight: 90 + i * 5, reps: 5, done: true }] }] } as never),
  );
  workouts.sort((a, b) => a.date.localeCompare(b.date));
  return { version: 1, exercises: [], workouts, templates: [], activeWorkout: null, settings: { unit: 'kg', theme: 'D1' } };
}

test('date range filters the chart; PR rings mark new bests', async ({ page }) => {
  await openApp(page, { data: seed() });
  await tab(page, 'Progress');
  await pickProgressExercise(page, 'Bench Press Chest');
  const dots = page.locator('.chart-draw .dot');
  const rings = page.locator('.chart-draw .pr-ring');
  await expect(dots).toHaveCount(15);
  await expect(rings).toHaveCount(6);
  await expect(page.locator('.trend')).toContainText('since first session');
  await expect(page.locator('.pr-chip')).toHaveCount(6);

  await page.locator('.chips.seg .chip', { hasText: '3M' }).click();
  await expect(dots).toHaveCount(10);
  await expect(rings).toHaveCount(4);
  await expect(page.locator('.trend')).toContainText('in the last 3 months');

  await page.locator('.chips.seg .chip', { hasText: '1M' }).click();
  await expect(dots).toHaveCount(4);
  await expect(page.locator('.trend')).toHaveText('No change in the last month');

  // switching measure keeps the range
  await page.locator('.chart-controls .chip', { hasText: 'Volume' }).click();
  await expect(page.locator('.chips.seg [aria-checked="true"]')).toHaveText('1M');
});

test('an exercise with nothing in range shows a helpful message', async ({ page }) => {
  await openApp(page, { data: seed() });
  await tab(page, 'Progress');
  await pickProgressExercise(page, 'Squat Quads');
  await page.locator('.chips.seg .chip', { hasText: '1M' }).click();
  await expect(page.locator('.chart-empty')).toContainText('No sessions in the last month');
  await expect(page.locator('.neu-card')).toHaveCount(4);
});

test('stat cards count to new values when switching exercise', async ({ page }) => {
  await openApp(page, { data: seed() });
  await tab(page, 'Progress');
  await pickProgressExercise(page, 'Squat Quads');
  await expect(page.locator('.neu-card').first().locator('[aria-hidden]').last()).toHaveText('105');
  await pickProgressExercise(page, 'Bench Press Chest');
  await expect(page.locator('.neu-card').first().locator('[aria-hidden]').last()).toHaveText('75');
});
