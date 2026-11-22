import { expect, test } from '@playwright/test';
import { loadSampleWeek, openApp, pickProgressExercise, skipRest, tab } from './helpers.ts';

test('timed exercise: time column, m:ss entry and a PR', async ({ page }) => {
  await openApp(page);
  await loadSampleWeek(page);
  await tab(page, 'Workout');
  await page.locator('.template-card', { hasText: 'Leg day' }).getByRole('button', { name: 'Start' }).click();
  const plank = page.locator('.card', { hasText: 'Plank' });
  await expect(plank.locator('.st-head')).toHaveText(/SET\s*PREVIOUS\s*TIME/i);
  await expect(plank.getByLabel('Plank set 1 time')).toHaveAttribute('placeholder', '1:00');
  await plank.getByLabel('Plank set 2 time').fill('1:15');
  await plank.getByLabel('Plank set 2 time').blur();
  await expect(plank.getByLabel('Plank set 2 time')).toHaveValue('1:15');
  await plank.getByRole('button', { name: 'Mark Plank set 2 done' }).click();
  await skipRest(page);
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Keep as is' }).click();
  await expect(page.locator('.banner')).toContainText('Plank: longest 1:15');
});

test('distance exercise: create, log a run, see distance and pace', async ({ page }) => {
  await openApp(page);
  await tab(page, 'Exercises');
  await page.getByRole('button', { name: 'New' }).click();
  await page.locator('#new-exercise-name').fill('Hill Run');
  await page.locator('.add-card .chip', { hasText: 'Cardio' }).click();
  await expect(page.locator('.add-card [aria-checked="true"]')).toHaveText(['Cardio', 'Distance']);
  await page.getByRole('button', { name: 'Add exercise' }).click();

  await tab(page, 'Workout');
  await page.locator('.start-empty').click();
  await page.getByRole('button', { name: /Add exercise/ }).click();
  await page.getByPlaceholder('Search or create…').fill('Hill Run');
  await page.getByRole('button', { name: /^Hill Run/ }).click();
  const run = page.locator('.card', { hasText: 'Hill Run' });
  await run.getByRole('button', { name: 'Mark Hill Run set 1 done' }).click();
  await expect(page.locator('.toast')).toHaveText('Enter a distance or time for this set first.');
  await run.getByLabel('Hill Run set 1 distance').fill('5');
  await run.getByLabel('Hill Run set 1 time').fill('25:00');
  await run.getByRole('button', { name: 'Mark Hill Run set 1 done' }).click();
  await skipRest(page);
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Not now' }).click();

  await tab(page, 'Progress');
  await expect(page.locator('.neu-card', { hasText: 'Best pace' })).toContainText('5:00');
  await expect(page.locator('.set-pill').first()).toHaveText('5 km · 25:00');
});

test('pounds mode shows miles and pace per mile', async ({ page }) => {
  const d0 = new Date(Date.now() - 86400000).toISOString();
  await openApp(page, {
    data: {
      version: 1,
      templates: [],
      activeWorkout: null,
      settings: { unit: 'lb', theme: 'L5' },
      exercises: [{ id: 'preset-running', name: 'Running', muscle: 'Cardio' }],
      workouts: [{ id: 'r', date: d0, name: 'Run', notes: '', exercises: [{ exerciseId: 'preset-running', sets: [{ weight: 0, reps: 0, meters: 5000, seconds: 1500, done: true }] }] }],
    },
  });
  await tab(page, 'History');
  await expect(page.locator('.ex-summary').first()).toContainText('3.11 mi in 25:00');
  await tab(page, 'Progress');
  await pickProgressExercise(page, 'Running Cardio');
  await expect(page.locator('.neu-card', { hasText: 'Best pace' })).toContainText('8:02');
});

test('cardio presets: pick from the Cardio group and log a swim and a stair climb', async ({ page }) => {
  // An existing user who already made their own "Swimming" shouldn't get a second one.
  await openApp(page, {
    data: {
      version: 1, templates: [], workouts: [], activeWorkout: null, settings: { unit: 'kg', theme: 'D1' },
      exercises: [{ id: 'preset-running', name: 'Running', muscle: 'Cardio', type: 'distance' }, { id: 'custom-swim', name: 'Swimming', muscle: 'Cardio', type: 'distance', custom: true }],
    },
  });
  await tab(page, 'Workout');
  await page.locator('.start-empty').click();
  await page.getByRole('button', { name: /Add exercise/ }).click();
  await page.locator('.modal .chip', { hasText: 'Cardio' }).click();
  await expect(page.locator('.modal .pick-item')).toHaveText([
    'Air BikeCardio', 'CyclingCardio', 'EllipticalCardio', 'Exercise BikeCardio', 'Incline WalkCardio', 'Jump RopeCardio',
    'Rowing MachineCardio', 'RunningCardio', 'Ski ErgCardio', 'Stair ClimberCardio', 'SwimmingCardio', 'WalkingCardio',
  ]);
  await page.getByRole('button', { name: /^Swimming/ }).click();

  const swim = page.locator('.card', { hasText: 'Swimming' });
  await swim.getByLabel('Swimming set 1 distance').fill('1.5');
  await swim.getByLabel('Swimming set 1 time').fill('30:00');
  await swim.getByRole('button', { name: 'Mark Swimming set 1 done' }).click();
  await skipRest(page);

  await page.getByRole('button', { name: /Add exercise/ }).click();
  await page.getByPlaceholder('Search or create…').fill('stair');
  await page.getByRole('button', { name: /^Stair Climber/ }).click();
  const stairs = page.locator('.card', { hasText: 'Stair Climber' });
  await expect(stairs.locator('.st-head')).toHaveText(/SET\s*PREVIOUS\s*TIME/i);
  await stairs.getByLabel('Stair Climber set 1 time').fill('12:00');
  await stairs.getByRole('button', { name: 'Mark Stair Climber set 1 done' }).click();
  await skipRest(page);

  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Not now' }).click();
  await tab(page, 'History');
  await expect(page.locator('.ex-summary').first()).toContainText('1.5 km in 30:00');
  await expect(page.locator('.ex-summary').first()).toContainText('12:00');
});
