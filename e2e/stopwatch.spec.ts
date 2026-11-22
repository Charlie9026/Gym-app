import { expect, test } from '@playwright/test';
import { openApp, stored, tab } from './helpers.ts';

async function startAirBike(page: import('@playwright/test').Page) {
  await tab(page, 'Workout');
  await page.locator('.start-empty').click();
  await page.getByRole('button', { name: /Add exercise/ }).click();
  await page.getByPlaceholder('Search or create…').fill('Air Bike');
  await page.getByRole('button', { name: /^Air Bike/ }).click();
  return page.locator('.card', { hasText: 'Air Bike' });
}

test('stopwatch times a set: stop fills in the time, ticks it and starts rest', async ({ page }) => {
  await page.clock.install();
  await openApp(page);
  const bike = await startAirBike(page);
  await bike.getByRole('button', { name: 'Start stopwatch' }).click();
  const bar = page.locator('.stopwatch-bar');
  await expect(bar).toContainText('0:00');
  await expect(bar).toContainText('Air Bike · set 1');
  await expect(bike.locator('.st-row.timing')).toHaveCount(1);
  await expect(bike.getByRole('button', { name: 'Start stopwatch' })).toHaveCount(0); // one at a time

  await page.clock.fastForward('12:34');
  await expect(bar).toContainText('12:34');
  await bar.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(bar).toHaveCount(0);
  await expect(bike.getByLabel('Air Bike set 1 time')).toHaveValue('12:34');
  await expect(bike.getByRole('button', { name: 'Mark Air Bike set 1 not done' })).toBeVisible();
  await expect(page.locator('.rest-bar')).toContainText('Resting');

  // Starting again times the next set, adding one if they're all done; the rest timer gives way.
  await bike.getByRole('button', { name: 'Start stopwatch' }).click();
  await expect(page.locator('.rest-bar:not(.stopwatch-bar)')).toHaveCount(0);
  await expect(bar).toContainText('Air Bike · set 2');
  await expect(bike.getByLabel('Air Bike set 2 time')).toBeVisible();
});

test('the stopwatch keeps counting when the app is closed and reopened', async ({ page }) => {
  await page.clock.install();
  await openApp(page);
  const bike = await startAirBike(page);
  await bike.getByRole('button', { name: 'Start stopwatch' }).click();
  await page.clock.fastForward('03:00');
  await page.reload();
  await page.clock.fastForward('02:00');
  await expect(page.locator('.stopwatch-bar')).toContainText('5:00');
  await page.locator('.stopwatch-bar').getByRole('button', { name: 'Cancel stopwatch' }).click();
  await expect(page.locator('.stopwatch-bar')).toHaveCount(0);
  expect((await stored(page)).activeWorkout.exercises[0].sets[0]).toMatchObject({ done: false });
});

test('finishing with the stopwatch running keeps its time', async ({ page }) => {
  await page.clock.install();
  await openApp(page);
  const bike = await startAirBike(page);
  await bike.getByRole('button', { name: 'Start stopwatch' }).click();
  await page.clock.fastForward('08:00');
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Not now' }).click();
  await expect(page.locator('.stopwatch-bar')).toHaveCount(0);
  const w = (await stored(page)).workouts[0];
  expect(w.stopwatch).toBeUndefined();
  expect(w.exercises[0].sets[0]).toMatchObject({ seconds: 480, done: true });
});

test('a notification says when the stopwatch started if you switch away', async ({ page }) => {
  // Pretend notifications are allowed and record them (no real system notifications in tests).
  await page.addInitScript(() => {
    const shown: { title: string; body?: string; tag?: string }[] = [];
    class FakeNotification {
      static permission = 'granted';
      static requestPermission = async () => 'granted';
      constructor(title: string, opts: NotificationOptions = {}) {
        shown.push({ title, body: opts.body, tag: opts.tag });
      }
    }
    Object.assign(window, { Notification: FakeNotification, __shown: shown });
  });
  await openApp(page);
  await tab(page, 'Settings');
  await page.getByRole('switch', { name: 'Notify while the stopwatch runs' }).click();
  expect((await stored(page)).settings.stopwatchNotify).toBe(true);

  const bike = await startAirBike(page);
  await bike.getByRole('button', { name: 'Start stopwatch' }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __shown: { title: string; body?: string }[] }).__shown))
    .toEqual([expect.objectContaining({ title: 'Air Bike stopwatch running', body: expect.stringMatching(/^Started at .+ so far\)\. Tap to come back\.$/) })]);
});
