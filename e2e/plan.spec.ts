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
  // Rep ranges for the goal, with the warm-up first on lifts with weights.
  await expect(workouts.first().locator('li').first()).toContainText('Warm-up, then 2 × 8–12 reps');
  await expect(workouts.first().locator('.eyebrow')).toHaveText('Workout 1 of 3');
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

test('rep ranges show while training, can be edited, and stay when weights carry forward', async ({ page }) => {
  await openApp(page);
  await tab(page, 'Workout');
  await page.getByRole('button', { name: 'Build me a plan' }).click();
  for (const c of [/^Get stronger/, /^A bit/, /^2 days/, /^About 30 minutes/, /^A full gym/]) await choose(page, c);
  await page.getByRole('button', { name: 'Nothing to avoid, show my plan' }).click();
  await page.getByRole('button', { name: 'Add 2 workouts to My workouts' }).click();

  // Editing a saved workout: reps can be typed as a range.
  await page.getByRole('button', { name: 'Edit Full body A' }).click();
  const first = page.locator('.card').first();
  const name = (await first.locator('h3').innerText()).trim();
  await expect(first.getByLabel(`${name} set 2 reps`)).toHaveValue('6–8');
  await first.getByLabel(`${name} set 2 reps`).fill('5-7');
  await first.getByLabel(`${name} set 2 reps`).blur();
  await expect(first.getByLabel(`${name} set 2 reps`)).toHaveValue('5–7');
  await page.getByRole('button', { name: 'Save' }).click();
  expect((await stored(page)).templates[0].exercises[0].sets[2]).toMatchObject({ reps: 5, repsTo: 7 }); // sets[0] is the warm-up

  // Training it: the range is a reminder and the faded hint.
  await page.locator('.template-card', { hasText: 'Full body A' }).getByRole('button', { name: 'Start' }).click();
  const card = page.locator('.card', { hasText: name }).first();
  await expect(card.locator('.target-chip')).toHaveText('Aim for 6–8 reps'); // from the first working set
  await expect(card.getByLabel(`${name} set 3 reps`)).toHaveAttribute('placeholder', '6–8');
  await card.getByLabel(`${name} set 2 weight`).fill('100');
  await card.getByLabel(`${name} set 2 reps`).fill('7');
  await card.getByRole('button', { name: `Mark ${name} set 2 done` }).click();
  const skip = page.getByRole('button', { name: 'Skip', exact: true });
  if (await skip.isVisible()) await skip.click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  // Only one set was done, so it asks; updating carries the weight forward but keeps the range.
  await page.getByRole('alertdialog').getByRole('button', { name: 'Update' }).click();
  const saved = (await stored(page)).templates[0].exercises[0].sets;
  expect(saved).toEqual([{ weight: 100, reps: 6, repsTo: 8 }]); // today's one set was the first working set's 6–8 slot
});
