import { expect, test, type Page } from '@playwright/test';
import { loadSampleWeek, openApp, tab } from './helpers.ts';

/** Distinct positions a highlight passes through in ~650ms after clicking a target. */
async function slidePositions(page: Page, pill: string, target: string) {
  return page.evaluate(
    async ([pillSel, targetSel]) => {
      const pillEl = document.querySelector(pillSel)!;
      (document.querySelector(targetSel) as HTMLElement).click();
      const xs = new Set<number>();
      const t0 = performance.now();
      await new Promise<void>((done) => {
        const f = () => {
          xs.add(Math.round(pillEl.getBoundingClientRect().left));
          if (performance.now() - t0 < 650) requestAnimationFrame(f);
          else done();
        };
        requestAnimationFrame(f);
      });
      return xs.size;
    },
    [pill, target] as const,
  );
}

test('the tab bar highlight slides rather than jumps', async ({ page }) => {
  await openApp(page);
  await page.waitForTimeout(300);
  const n = await slidePositions(page, '.tabbar-blob', '.tabbar button:nth-child(5)');
  expect(n).toBeGreaterThan(8);
});

test('pill highlights slide and every button springs', async ({ page }) => {
  await openApp(page);
  await tab(page, 'Exercises');
  await page.waitForTimeout(300);
  expect(await slidePositions(page, 'main .screen > .chips .chip-pill', 'main .screen > .chips .chip:nth-of-type(2)')).toBeGreaterThan(8);
  const chip = page.locator('main .screen > .chips .chip').first();
  await chip.click();
  await expect(chip).toHaveAttribute('data-boing', '');
});

test('nothing is wider than a 320px phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openApp(page);
  await loadSampleWeek(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  for (const name of ['Workout', 'History', 'Progress', 'Exercises', 'Settings'] as const) {
    await tab(page, name);
    expect(await overflow(), name).toBeLessThanOrEqual(0);
  }
  await tab(page, 'Workout');
  await page.locator('.template-card', { hasText: 'Leg day' }).getByRole('button', { name: 'Start' }).click();
  await page.locator('.card', { hasText: 'Squat' }).first().locator('.rest-chip').click();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test('choosing a theme recolours the app and is remembered', async ({ page }) => {
  await openApp(page);
  await tab(page, 'Settings');
  await page.getByRole('radio', { name: 'Ember', exact: true }).click();
  const accent = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  await expect.poll(accent).toBe('#E8650A');
  await page.reload();
  await expect.poll(accent).toBe('#E8650A');
});
