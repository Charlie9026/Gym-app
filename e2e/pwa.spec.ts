import { expect, test } from '@playwright/test';
import { loadSampleWeek, openApp, tab } from './helpers.ts';

test.use({ serviceWorkers: 'allow' });

test('installable: manifest and icons are served', async ({ page, request }) => {
  await openApp(page);
  const manifestHref = await page.locator('link[rel=manifest]').getAttribute('href');
  const manifest = await (await request.get(manifestHref!)).json();
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status(), icon.src).toBe(200);
  const apple = await page.locator('link[rel=apple-touch-icon]').getAttribute('href');
  expect((await request.get(apple!)).status()).toBe(200);
});

test('works offline after the first visit', async ({ page, context }) => {
  await openApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await loadSampleWeek(page);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.tabbar')).toBeVisible();
  await tab(page, 'Workout');
  await expect(page.locator('.template-card')).toHaveCount(3);
  await page.locator('.template-card').first().getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Mark Bench Press set warm-up 1 done' }).click();
  await expect(page.locator('.rest-bar')).toBeVisible();
  await context.setOffline(false);
});

test('keeps the screen awake during a workout', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __wake: { requests: number; releases: number } };
    w.__wake = { requests: 0, releases: 0 };
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: async () => (w.__wake.requests++, { release: async () => void w.__wake.releases++ }) },
    });
  });
  await openApp(page);
  const wake = () => page.evaluate(() => (window as unknown as { __wake: { requests: number; releases: number } }).__wake);
  await page.locator('.start-empty').click();
  await expect.poll(async () => (await wake()).requests).toBe(1);
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect.poll(async () => (await wake()).releases).toBe(1);
});
