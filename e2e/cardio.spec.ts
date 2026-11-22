import { expect, test, type Page } from '@playwright/test';
import { openApp, skipRest, stored, tab } from './helpers.ts';

async function startWith(page: Page, name: string) {
  await tab(page, 'Workout');
  await page.locator('.start-empty').click();
  await page.getByRole('button', { name: /Add exercise/ }).click();
  await page.getByPlaceholder('Search or create…').fill(name);
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  return page.locator('.card', { hasText: name });
}

async function finish(page: Page) {
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Not now' }).click();
}

test('rowing is in metres with pace per 500 m', async ({ page }) => {
  await openApp(page);
  const row = await startWith(page, 'Rowing Machine');
  await expect(row.getByRole('button', { name: 'How Rowing Machine is logged: distance in m' })).toBeVisible();
  await expect(row.locator('.st-head')).toHaveText(/SET\s*PREVIOUS\s*M\s*TIME/i);
  await row.getByLabel('Rowing Machine set 1 distance').fill('2000');
  await row.getByLabel('Rowing Machine set 1 time').fill('8:00');
  await row.getByRole('button', { name: 'Mark Rowing Machine set 1 done' }).click();
  await skipRest(page);
  await finish(page);
  await expect(page.locator('.ex-summary').first()).toContainText('2000 m in 8:00');
  expect((await stored(page)).workouts[0].exercises[0].sets[0].meters).toBe(2000);
  await tab(page, 'Progress');
  await expect(page.locator('.neu-card', { hasText: 'Best pace' })).toContainText('2:00');
  await expect(page.locator('.neu-card', { hasText: 'Best pace' })).toContainText('/500m');
});

test('an exercise can switch its distance unit, and history converts', async ({ page }) => {
  const d0 = new Date(Date.now() - 86400000).toISOString();
  await openApp(page, {
    data: {
      version: 1, templates: [], activeWorkout: null, settings: { unit: 'kg', theme: 'D1' },
      exercises: [{ id: 'preset-running', name: 'Running', muscle: 'Cardio', type: 'distance' }],
      workouts: [{ id: 'r', date: d0, name: 'Run', notes: '', exercises: [{ exerciseId: 'preset-running', sets: [{ weight: 0, reps: 0, meters: 5000, seconds: 1500, done: true }] }] }],
    },
  });
  const run = await startWith(page, 'Running');
  await run.getByRole('button', { name: 'How Running is logged: distance in km' }).click();
  await run.getByRole('radiogroup', { name: 'How Running is logged' }).getByRole('radio', { name: 'm', exact: true }).click();
  await expect(run.locator('.st-head')).toHaveText(/SET\s*PREVIOUS\s*M\s*TIME/i);
  await expect(run.locator('.st-prev').first()).toHaveText('5000 m in 25:00');
  await run.getByRole('radiogroup', { name: 'How Running is logged' }).getByRole('radio', { name: 'yd' }).click();
  await expect(run.locator('.st-prev').first()).toHaveText('5468 yd in 25:00');
  expect((await stored(page)).exercises.find((e: { id: string }) => e.id === 'preset-running').distanceUnit).toBe('yd');
  // Feet isn't offered.
  await expect(run.getByRole('radio', { name: 'ft' })).toHaveCount(0);
});

test('time only hides the distance column', async ({ page }) => {
  await openApp(page);
  const bike = await startWith(page, 'Air Bike');
  await bike.getByRole('button', { name: /How Air Bike is logged/ }).click();
  await bike.getByRole('radio', { name: 'Time only' }).click();
  await expect(bike.getByRole('button', { name: 'How Air Bike is logged: time only' })).toBeVisible();
  await expect(bike.locator('.st-head')).toHaveText(/SET\s*PREVIOUS\s*TIME/i);
  await expect(bike.getByLabel('Air Bike set 1 distance')).toHaveCount(0);
  await bike.getByLabel('Air Bike set 1 time').fill('10:00');
  await bike.getByRole('button', { name: 'Mark Air Bike set 1 done' }).click();
  await skipRest(page);
  await finish(page);
  await expect(page.locator('.ex-summary').first()).toContainText('10:00');
  await tab(page, 'Progress');
  // Time comes first in the chart and stat cards for a time-only exercise.
  await expect(page.getByRole('group', { name: 'Chart measure' }).getByRole('button').first()).toHaveText('Time');
  await expect(page.locator('.neu-card').first()).toContainText('Longest set');
});
