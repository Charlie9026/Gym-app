import { expect, test, type Page } from '@playwright/test';
import { loadSampleWeek, openApp, tab } from './helpers.ts';

/**
 * iPhones zoom the page in when a text field with text under 16px is focused,
 * which leaves buttons off screen. Every field on every screen must be 16px+.
 */
async function smallFields(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('input, select, textarea')]
      .filter((el) => (el as HTMLInputElement).type !== 'file' && (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ el: el.outerHTML.slice(0, 80), size: parseFloat(getComputedStyle(el).fontSize) }))
      .filter((f) => f.size < 16),
  );
}

test('no text field is small enough to make iPhones zoom in', async ({ page }) => {
  const seen = new Set<string>();
  const check = async (where: string) => {
    const count = await page.locator('input:visible, select:visible, textarea:visible').count();
    if (count) seen.add(where);
    expect(await smallFields(page), where).toEqual([]);
  };

  await openApp(page, { welcome: true });
  await check('welcome');
  await page.getByRole('button', { name: /Not now/ }).click();
  await loadSampleWeek(page);

  for (const name of ['History', 'Progress', 'Exercises', 'Settings'] as const) {
    await tab(page, name);
    await check(name);
  }

  await tab(page, 'Workout');
  await page.locator('.template-card', { hasText: 'Chest and arms day' }).getByRole('button', { name: 'Start' }).click();
  await check('active workout');
  await page.getByRole('button', { name: /Add exercise/ }).click();
  await check('exercise picker');

  expect([...seen]).toEqual(expect.arrayContaining(['welcome', 'Exercises', 'active workout', 'exercise picker']));
});

test('zooming is switched off', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content', /user-scalable=no/);
  await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content', /maximum-scale=1/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe('pan-x pan-y');
  // A two-finger move is cancelled; a one-finger move (scrolling) is not.
  const cancelled = await page.evaluate(() => {
    const move = (n: number) => {
      const t = Array.from({ length: n }, (_, i) => new Touch({ identifier: i, target: document.body, clientX: 10 * i, clientY: 10 }));
      const e = new TouchEvent('touchmove', { touches: t, cancelable: true, bubbles: true });
      document.body.dispatchEvent(e);
      return e.defaultPrevented;
    };
    return [move(1), move(2)];
  });
  expect(cancelled).toEqual([false, true]);
});
