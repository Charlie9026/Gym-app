import { expect, test } from '@playwright/test';
import { openApp, skipRest, stored, tab } from './helpers.ts';

const base = (settings: Record<string, unknown>, workouts: unknown[] = []) => ({
  version: 1, templates: [], activeWorkout: null, exercises: [], workouts,
  settings: { unit: 'kg', theme: 'D1', ...settings },
});

async function logRun(page: import('@playwright/test').Page) {
  await tab(page, 'Workout');
  await page.locator('.start-empty').click();
  await page.getByRole('button', { name: /Add exercise/ }).click();
  await page.getByPlaceholder('Search or create…').fill('Running');
  await page.getByRole('button', { name: /^Running/ }).click();
  const run = page.locator('.card', { hasText: 'Running' });
  await run.getByLabel('Running set 1 distance').fill('5');
  await run.getByLabel('Running set 1 time').fill('25:00');
  await run.getByRole('button', { name: 'Mark Running set 1 done' }).click();
  await skipRest(page);
  return run;
}

async function finish(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Not now' }).click();
}

// 5 km in 25:00 at 70 kg: (3.5 + 0.2 × 200 m/min) / 3.5 MET × 70 kg × 25/60 h ≈ 363 kcal.
test('estimated calories show when you finish, in History, this week and Progress', async ({ page }) => {
  await openApp(page, { data: base({ bodyWeightKg: 70 }) });
  const run = await logRun(page);
  await expect(run.getByRole('button', { name: /Calories for Running: ≈ 363 kcal/ })).toBeVisible();
  await finish(page);

  await expect(page.locator('.banner')).toContainText('About 363 kcal burned');
  await expect(page.locator('.workout-card .meta').first()).toContainText('363 kcal');
  await expect(page.locator('.chip-stat', { hasText: 'burned' })).toContainText('363 kcal');

  await tab(page, 'Workout');
  await expect(page.locator('.week-stats')).toContainText('363');
  await expect(page.locator('.week-stats')).toContainText('kcal');

  await tab(page, 'Progress');
  await expect(page.locator('.kcal-card')).toContainText('363 kcal this week');
  await page.getByRole('group', { name: 'Chart measure' }).getByRole('button', { name: 'Calories' }).click();
  await expect(page.locator('.session-metric').first()).toContainText('363');
});

test('calories typed in from a machine replace the estimate, even without a body weight', async ({ page }) => {
  await openApp(page, { data: base({}) });
  await tab(page, 'Workout');
  await expect(page.locator('.week-hint')).toHaveText('Add your body weight in Settings to see calories burned.');
  const run = await logRun(page);
  await run.getByRole('button', { name: 'Calories for Running: Calories' }).click();
  await run.getByLabel('Running calories').fill('410');
  await expect(run.getByRole('button', { name: /Calories for Running: 410 kcal/ })).toBeVisible();
  await finish(page);
  await expect(page.locator('.banner')).toContainText('410 kcal burned');
  await expect(page.locator('.banner')).not.toContainText('About');
  expect((await stored(page)).workouts[0].exercises[0].calories).toBe(410);

  // Editing the workout later keeps the number and lets you change it.
  await page.locator('.workout-card .workout-head').first().click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: /Calories for Running: 410 kcal/ }).click();
  await page.getByLabel('Running calories').fill('395');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.workout-card .meta').first()).toContainText('395 kcal');
});

test('calories can be switched off in Settings', async ({ page }) => {
  const d0 = new Date(Date.now() - 3600000).toISOString();
  const workouts = [{ id: 'r', date: d0, finishedAt: new Date(Date.now() - 2000000).toISOString(), name: 'Run', notes: '', exercises: [
    { exerciseId: 'preset-running', sets: [{ weight: 0, reps: 0, meters: 5000, seconds: 1500, done: true }] },
  ] }];
  await openApp(page, { data: base({ bodyWeightKg: 70 }, workouts) });
  await tab(page, 'History');
  await expect(page.locator('.workout-card .meta').first()).toContainText('kcal');

  await tab(page, 'Settings');
  await page.getByRole('switch', { name: 'Show calories burned' }).click();
  expect((await stored(page)).settings.showCalories).toBe(false);
  // The body weight field folds away (and can't be focused).
  await expect(page.locator('.collapse', { has: page.locator('.calories-settings') })).toHaveAttribute('aria-hidden', 'true');

  await tab(page, 'History');
  await expect(page.locator('.workout-card .meta').first()).not.toContainText('kcal');
  await expect(page.locator('.chip-stat', { hasText: 'burned' })).toHaveCount(0);
  await tab(page, 'Workout');
  await expect(page.locator('.week-stats')).not.toContainText('kcal');
  await tab(page, 'Progress');
  await expect(page.locator('.kcal-card')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Chart measure' }).getByRole('button', { name: 'Calories' })).toHaveCount(0);
});

test('body weight follows the weight unit', async ({ page }) => {
  await openApp(page, { data: base({ bodyWeightKg: 80 }) });
  await tab(page, 'Settings');
  await expect(page.getByLabel('Body weight in kg')).toHaveValue('80');
  await page.getByRole('radiogroup', { name: 'Weight unit' }).getByRole('radio', { name: 'lb' }).click();
  await expect(page.getByLabel('Body weight in lb')).toHaveValue('176.4');
  await page.getByLabel('Body weight in lb').fill('');
  expect((await stored(page)).settings.bodyWeightKg).toBeUndefined();
});
