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

test('backup, sample data and reset only show for the owner', async ({ page }) => {
  await openApp(page, { owner: false });
  await tab(page, 'Settings');
  await expect(page.locator('.cloud-card')).toBeVisible();
  for (const title of ['Backup', 'Sample data', 'Danger zone']) await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
});

test('the owner sees backup, sample data and reset', async ({ page }) => {
  await openApp(page);
  await tab(page, 'Settings');
  for (const title of ['Backup', 'Sample data', 'Danger zone']) await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('distance and weight units are chosen separately', async ({ page }) => {
  const d0 = new Date(Date.now() - 86400000).toISOString();
  await openApp(page, {
    data: {
      version: 1, templates: [], activeWorkout: null, settings: { unit: 'kg', theme: 'D1' },
      exercises: [{ id: 'preset-running', name: 'Running', muscle: 'Cardio', type: 'distance' }, { id: 'preset-bench-press', name: 'Bench Press', muscle: 'Chest' }],
      workouts: [{ id: 'w', date: d0, name: 'Mixed', notes: '', exercises: [
        { exerciseId: 'preset-running', sets: [{ weight: 0, reps: 0, meters: 5000, seconds: 1500, done: true }] },
        { exerciseId: 'preset-bench-press', sets: [{ weight: 100, reps: 5, done: true }] },
      ] }],
    },
  });
  const summary = page.locator('.ex-summary').first();
  const pick = (group: string, value: string) => page.getByRole('radiogroup', { name: group }).getByRole('radio', { name: value }).click();

  // Switching weight to pounds leaves distance in km.
  await tab(page, 'Settings');
  await pick('Weight unit', 'lb');
  await tab(page, 'History');
  await expect(summary).toContainText('5 km in 25:00');
  await expect(summary).toContainText('220.5 lb × 5');

  // Miles with kilograms.
  await tab(page, 'Settings');
  await pick('Distance unit', 'mi');
  await pick('Weight unit', 'kg');
  await expect(page.getByRole('radiogroup', { name: 'Distance unit' }).getByRole('radio', { name: 'mi' })).toHaveAttribute('aria-checked', 'true');
  await tab(page, 'History');
  await expect(summary).toContainText('3.11 mi in 25:00');
  await expect(summary).toContainText('100 kg × 5');
  expect((await stored(page)).settings).toMatchObject({ unit: 'kg', distanceUnit: 'mi' });

  // The workout logger uses it too.
  await tab(page, 'Workout');
  await page.locator('.start-empty').click();
  await page.getByRole('button', { name: /Add exercise/ }).click();
  await page.getByPlaceholder('Search or create…').fill('Running');
  await page.getByRole('button', { name: /^Running/ }).click();
  await expect(page.locator('.card', { hasText: 'Running' }).locator('.st-head')).toHaveText(/SET\s*PREVIOUS\s*MI\s*TIME/i);
  await expect(page.locator('.card', { hasText: 'Running' }).locator('.st-prev').first()).toHaveText('3.11 mi in 25:00');
});
