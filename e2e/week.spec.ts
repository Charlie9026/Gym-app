import { expect, test } from '@playwright/test';
import { openApp, tab } from './helpers.ts';

test('tapping a day on This week shows that day’s stats, and tapping again goes back', async ({ page }) => {
  const now = new Date();
  const todayIdx = (now.getDay() + 6) % 7; // Monday = 0
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0).getTime();
  const workout = (id: string, name: string, minutes: number, exercises: unknown[]) => ({
    id, name, notes: '', date: new Date(start).toISOString(), finishedAt: new Date(start + minutes * 60000).toISOString(), exercises,
  });
  await openApp(page, {
    data: {
      version: 1, templates: [], activeWorkout: null, settings: { unit: 'kg', theme: 'D1', bodyWeightKg: 75 },
      exercises: [],
      workouts: [
        workout('a', 'Push day', 50, [{ exerciseId: 'preset-bench-press', sets: [{ weight: 100, reps: 5, done: true }, { weight: 100, reps: 5, done: true }] }]),
        workout('b', 'Evening run', 25, [{ exerciseId: 'preset-running', sets: [{ weight: 0, reps: 0, meters: 5000, seconds: 1500, done: true }] }]),
      ],
    },
  });
  await tab(page, 'Workout');
  const card = page.locator('.week-card');
  await expect(card.locator('.eyebrow').first()).toHaveText('This week');

  const dayName = (i: number) => new Date(start + (i - todayIdx) * 86400000).toLocaleDateString('en-GB', { weekday: 'long' });
  const today = card.getByRole('button', { name: new RegExp(`^${dayName(todayIdx)}, trained, today`) });
  await today.click();
  await expect(today).toHaveAttribute('aria-pressed', 'true');
  await expect(card.locator('.eyebrow').first()).toContainText(dayName(todayIdx));
  const stats = card.locator('.week-stats');
  await expect(stats).toContainText('2workouts');
  await expect(stats).toContainText('1,000 kg');
  await expect(stats).toContainText('1h 15m');
  await expect(card.locator('.day-list li')).toHaveCount(2);
  await expect(card.locator('.day-list li').first()).toContainText('Push day');
  await expect(card.locator('.day-list li').first()).toContainText('50 min · 1 exercise · 2 sets');
  await expect(card.locator('.week-pill')).toHaveClass(/ready/);

  // Another day: a past one is a rest day, a later one is still to come.
  const other = todayIdx === 0 ? 1 : 0;
  await card.getByRole('button', { name: new RegExp(`^${dayName(other)}`) }).click();
  await expect(card.locator('.day-empty')).toHaveText(other > todayIdx ? 'Still to come. Nothing planned yet.' : 'Rest day. No workouts logged.');
  await expect(stats).toContainText('0workouts');

  // Tapping the chosen day again (or Show week) goes back to the week.
  await card.getByRole('button', { name: new RegExp(`^${dayName(other)}`) }).click();
  await expect(card.locator('.eyebrow').first()).toHaveText('This week');
  await expect(card.locator('.day-detail')).toHaveCount(0);
  await today.click();
  await card.getByRole('button', { name: 'Show week' }).click();
  await expect(card.locator('.eyebrow').first()).toHaveText('This week');
  await expect(card.locator('.week-pill')).toHaveClass(/off/);
});
