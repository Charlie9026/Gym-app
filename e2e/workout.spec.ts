import { expect, test } from '@playwright/test';
import { answerDialog, loadSampleWeek, openApp, skipRest, stored, tab } from './helpers.ts';

test('log an empty workout and save it to My workouts', async ({ page }) => {
  await openApp(page);
  await page.locator('.start-empty').click();
  await page.getByRole('button', { name: /Add exercise/ }).click();
  await page.getByPlaceholder('Search or create…').fill('bench press');
  await page.getByRole('button', { name: /^Bench Press/ }).click();
  await page.getByLabel('Bench Press set 1 weight').fill('60');
  await page.getByLabel('Bench Press set 1 reps').fill('8');
  await page.getByRole('button', { name: 'Mark Bench Press set 1 done' }).click();
  await skipRest(page);
  await page.getByRole('button', { name: 'Finish workout' }).click();

  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Save this to My workouts?');
  await dialog.locator('input').fill('Chest day');
  await dialog.getByRole('button', { name: 'Save workout' }).click();

  await tab(page, 'Workout');
  await expect(page.locator('.template-card')).toContainText('Chest day');
  const data = await stored(page);
  expect(data.workouts).toHaveLength(1);
  expect(data.workouts[0].exercises[0].sets[0]).toMatchObject({ weight: 60, reps: 8, done: true });
});

test('a saved workout starts empty with faded hints; ticking accepts the hint', async ({ page }) => {
  await openApp(page);
  await loadSampleWeek(page);
  await tab(page, 'Workout');
  await page.locator('.template-card', { hasText: 'Chest and arms day' }).getByRole('button', { name: 'Start' }).click();

  const w1 = page.getByLabel('Bench Press set 1 weight');
  await expect(w1).toHaveValue('');
  await expect(w1).toHaveAttribute('placeholder', '72.5');
  await w1.fill('75');
  await page.getByRole('button', { name: 'Mark Bench Press set 1 done' }).click();
  await skipRest(page);
  await page.getByRole('button', { name: 'Mark Bench Press set 2 done' }).click();
  await skipRest(page);
  await expect(page.getByLabel('Bench Press set 1 reps')).toHaveValue('8');
  await expect(page.getByLabel('Bench Press set 2 weight')).toHaveValue('72.5');

  await page.getByRole('button', { name: 'Finish workout' }).click();
  await answerDialog(page, 'Keep as is');
  await tab(page, 'History');
  await page.locator('.workout-head').first().click();
  await expect(page.locator('.detail-ex').first()).toContainText('75 kg × 8 reps');
});

test('the rest timer keeps running across tabs and uses per-exercise rest', async ({ page }) => {
  await openApp(page);
  await loadSampleWeek(page);
  await tab(page, 'Workout');
  await page.locator('.template-card', { hasText: 'Leg day' }).getByRole('button', { name: 'Start' }).click();

  const squat = page.locator('.card', { hasText: 'Squat' }).first();
  await squat.locator('.rest-chip').click();
  await squat.locator('.rest-chip-panel .chip', { hasText: '3 min' }).click();
  await expect(squat.locator('.rest-chip')).toContainText('Rest 3 min');

  await page.getByRole('button', { name: 'Mark Squat set 1 done' }).click();
  await expect(page.locator('.rest-text strong')).toHaveText(/^(3:00|2:59)$/);
  await tab(page, 'History');
  await tab(page, 'Workout');
  await expect(page.locator('.rest-bar')).toBeVisible();
  await page.getByRole('button', { name: '+30s' }).click();
  await expect(page.locator('.rest-text strong')).toHaveText(/^3:[23]\d$/);
  await skipRest(page);

  await page.getByRole('button', { name: 'Mark Plank set 1 done' }).click();
  await expect(page.locator('.rest-text strong')).toHaveText(/^(1:30|1:29)$/); // default
});

test('discarding a workout can be undone', async ({ page }) => {
  await openApp(page);
  await page.locator('.start-empty').click();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.locator('.start-empty')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
});
