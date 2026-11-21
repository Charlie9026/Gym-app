import { expect, test } from '@playwright/test';
import { loadSampleWeek, openApp, pickProgressExercise, tab } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await loadSampleWeek(page);
});

test('set menu: mark warm-up, remove a set and undo, keyboard support', async ({ page }) => {
  await tab(page, 'Workout');
  await page.locator('.template-card', { hasText: 'Leg day' }).getByRole('button', { name: 'Start' }).click();
  const squat = page.locator('.card', { hasText: 'Squat' }).first();
  const badges = squat.locator('.set-badge');
  await expect(badges).toHaveText(['W', 'W', '1', '2', '3', '4']);

  await squat.getByRole('button', { name: 'Squat set 1, options' }).click();
  await expect(squat.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(squat.getByRole('menuitem', { name: 'Remove set' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(squat.locator('.set-menu')).toHaveCount(0);
  await expect(squat.getByRole('button', { name: 'Squat set 1, options' })).toBeFocused();

  await squat.getByRole('button', { name: 'Squat set 1, options' }).click();
  await squat.getByRole('menuitem', { name: /Mark as warm-up/ }).click();
  await expect(badges).toHaveText(['W', 'W', 'W', '1', '2', '3']);

  await squat.getByRole('button', { name: 'Squat set 2, options' }).click();
  await squat.getByRole('menuitem', { name: 'Remove set' }).click();
  await expect(badges).toHaveCount(5);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(badges).toHaveCount(6);
});

test('warm-ups are left out of progress, volume and set counts', async ({ page }) => {
  await tab(page, 'History');
  await expect(page.locator('.workout-card').first().locator('.ex-summary')).toContainText('4 sets + 2 warm-up · 100 kg × 6');
  await tab(page, 'Progress');
  await pickProgressExercise(page, 'Squat Quads');
  await expect(page.locator('.neu-card').first()).toContainText('100'); // heaviest is the working set, not a warm-up
  await expect(page.locator('.neu-card', { hasText: 'Best volume' })).toContainText('2,400');
  await expect(page.locator('.session').first().locator('.set-pill.warm')).toHaveCount(2);
});
