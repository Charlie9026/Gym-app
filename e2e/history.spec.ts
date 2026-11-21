import { expect, test } from '@playwright/test';
import { answerDialog, loadSampleWeek, openApp, stored, tab } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await loadSampleWeek(page);
  await tab(page, 'History');
});

test('edit a past workout: weights, warm-up and date', async ({ page }) => {
  const first = page.locator('.workout-card').first();
  await first.locator('.workout-head').click();
  await first.getByRole('button', { name: 'Edit', exact: true }).click();
  const squat = page.locator('.card', { hasText: 'Squat' }).first();
  await squat.getByLabel('Squat set 1 weight').fill('102.5');

  // Back with unsaved changes asks first
  await page.getByRole('button', { name: /Back/ }).click();
  await answerDialog(page, 'Cancel');

  const d = new Date();
  d.setDate(d.getDate() - 10);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await page.locator('#past-workout-date').fill(iso);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.toast')).toHaveText('Changes saved');

  const data = await stored(page);
  const edited = data.workouts.find((w: { date: string }) => new Date(w.date).getDate() === d.getDate() && new Date(w.date).getMonth() === d.getMonth());
  expect(edited.exercises.find((e: { exerciseId: string }) => e.exerciseId === 'preset-squat').sets[2].weight).toBe(102.5);
  expect(data.workouts.map((w: { date: string }) => w.date)).toEqual([...data.workouts.map((w: { date: string }) => w.date)].sort());
  await expect(page.locator('.week-group h2')).toContainText(['This week', 'Last week']);
});

test('delete a workout and undo', async ({ page }) => {
  const first = page.locator('.workout-card').first();
  await first.locator('.workout-head').click();
  await first.getByRole('button', { name: /^Delete / }).click();
  await expect(page.locator('.workout-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.workout-card')).toHaveCount(6);
});

test('weekly totals count up when the tab opens', async ({ page }) => {
  await tab(page, 'Workout');
  await tab(page, 'History');
  const lifted = page.locator('.summary-chips .chip-stat').nth(1).locator('[aria-hidden]');
  await expect(lifted).toHaveText(/52,270\.5/);
});
