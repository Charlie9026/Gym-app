import { expect, test } from '@playwright/test';
import { answerDialog, loadSampleWeek, openApp, stored, tab } from './helpers.ts';

test('default rest time and turning the timer off', async ({ page }) => {
  await openApp(page);
  await loadSampleWeek(page);
  const card = page.locator('.card', { hasText: 'Rest timer' });
  await card.locator('.chip', { hasText: '2 min' }).click();
  expect((await stored(page)).settings.restSeconds).toBe(120);
  await tab(page, 'Workout');
  await page.locator('.template-card').first().getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Mark Bench Press set warm-up 1 done' }).click();
  await expect(page.locator('.rest-text strong')).toHaveText(/^(2:00|1:59)$/);
  await page.getByRole('button', { name: 'Skip', exact: true }).click();

  await tab(page, 'Settings');
  await card.locator('.chip', { hasText: 'Off' }).click();
  await tab(page, 'Workout');
  await page.getByRole('button', { name: 'Mark Bench Press set warm-up 2 done' }).click();
  await expect(page.locator('.rest-bar')).toHaveCount(0);
});

test('switching to pounds converts weights', async ({ page }) => {
  await openApp(page);
  await loadSampleWeek(page);
  await page.locator('.chips.seg .chip', { hasText: 'lb' }).click();
  await tab(page, 'History');
  await expect(page.locator('.ex-summary').first()).toContainText('220.5 lb × 6');
});

test('paste a backup to restore data', async ({ page }) => {
  await openApp(page);
  await loadSampleWeek(page);
  const backup = await page.evaluate(() => localStorage.getItem('gym-app-data-v1'));
  await page.getByRole('button', { name: 'Remove sample week' }).click();
  await answerDialog(page, 'Remove');
  expect((await stored(page)).workouts).toHaveLength(0);

  await page.getByRole('button', { name: 'Paste backup' }).click();
  const restore = page.getByRole('button', { name: 'Restore from pasted backup' });
  await expect(restore).toBeDisabled();
  await page.locator('#paste-backup').fill('not a backup');
  await restore.click();
  await expect(page.locator('.toast')).toContainText('doesn’t look like an Overload backup');
  await page.locator('#paste-backup').fill(backup!);
  await restore.click();
  await expect(page.getByRole('alertdialog')).toContainText('The backup has 6 workouts');
  await answerDialog(page, 'Replace');
  expect((await stored(page)).workouts).toHaveLength(6);
});
