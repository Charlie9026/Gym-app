import { expect, test, type Page } from '@playwright/test';
import { openApp, stored, tab } from './helpers.ts';

const choose = (page: Page, name: RegExp | string) => page.getByRole('radio', { name }).click();

test('a beginner answers a few questions and gets ready-made workouts', async ({ page }) => {
  await openApp(page);
  await tab(page, 'Workout');
  await page.getByRole('button', { name: 'Build me a plan' }).click();

  await expect(page.getByRole('heading', { name: 'What’s your main goal?' })).toBeVisible();
  await choose(page, /^Build muscle/);
  await expect(page.getByRole('heading', { name: 'How much have you trained before?' })).toBeVisible();
  // Back keeps the answer, and the highlight shows it.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('radio', { name: /^Build muscle/ })).toHaveAttribute('aria-checked', 'true');
  await choose(page, /^Build muscle/);
  await choose(page, /^I’m brand new/);
  await choose(page, /^3 days/);
  await choose(page, /^About 45 minutes/);
  await choose(page, /^A full gym/);
  await expect(page.getByRole('heading', { name: 'Anything to go easy on?' })).toBeVisible();
  await page.getByRole('checkbox', { name: /^Knees/ }).click();
  await page.getByRole('button', { name: 'Show my plan' }).click();

  await expect(page.getByRole('heading', { name: 'Your plan' })).toBeVisible();
  await expect(page.getByText('Train 3 days a week, doing A, B and C in turn, with a rest day between workouts.')).toBeVisible();
  const workouts = page.locator('.plan-workout');
  await expect(workouts.locator('h3')).toHaveText(['Full body A', 'Full body B', 'Full body C']);
  // Knee-heavy and barbell moves are left out for a beginner with sore knees.
  for (const list of await page.locator('.plan-list').allInnerTexts()) expect(list).not.toMatch(/Squat|Lunge|Leg Press/);
  await expect(workouts.first().locator('li')).toHaveCount(5);
  await expect(page.locator('.plan-tips')).toContainText('knees were left out');

  await page.getByRole('button', { name: 'Add 3 workouts to My workouts' }).click();
  await expect(page.locator('.toast')).toContainText('3 workouts added to My workouts');
  await expect(page.locator('.template-card h3')).toHaveText(['Full body A', 'Full body B', 'Full body C']);
  const saved = (await stored(page)).templates;
  expect(saved).toHaveLength(3);
  expect(saved[0].exercises[0].sets[0]).toMatchObject({ weight: 0, kind: 'warmup' });

  // Undo takes them away again.
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.template-card')).toHaveCount(0);
  expect((await stored(page)).templates).toHaveLength(0);
});

test('a plan can be started straight away, and the builder is still there once you have workouts', async ({ page }) => {
  await openApp(page);
  await tab(page, 'Workout');
  await page.getByRole('button', { name: 'Build me a plan' }).click();
  await choose(page, /^Lose fat/);
  await choose(page, /^A bit/);
  await choose(page, /^2 days/);
  await choose(page, /^About 30 minutes/);
  await choose(page, /^No equipment/);
  await page.getByRole('button', { name: 'Nothing to avoid, show my plan' }).click();
  await expect(page.locator('.plan-workout h3')).toHaveText(['Full body A', 'Full body B']);
  await expect(page.locator('.plan-workout').first().locator('li').last()).toContainText(/Jump Rope|Burpee|Walking/); // cardio finish
  await page.getByRole('button', { name: 'Add 2 workouts to My workouts' }).click();

  await page.locator('.template-card', { hasText: 'Full body A' }).getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.title-input')).toHaveValue('Full body A');
  await expect(page.locator('.card', { hasText: 'Bodyweight Squat' })).toBeVisible();

  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('button', { name: 'Build a plan' })).toBeVisible();
  // A second plan doesn't clash with the names already there.
  await page.getByRole('button', { name: 'Build a plan' }).click();
  for (const c of [/^General fitness/, /^A bit/, /^2 days/, /^About 30 minutes/, /^No equipment/]) await choose(page, c);
  await page.getByRole('button', { name: 'Nothing to avoid, show my plan' }).click();
  await page.getByRole('button', { name: 'Add 2 workouts to My workouts' }).click();
  await expect(page.locator('.template-card h3')).toHaveText(['Full body A', 'Full body B', 'Full body A (2)', 'Full body B (2)']);
});
