import { expect, type Page } from '@playwright/test';

export const STORAGE_KEY = 'gym-app-data-v1';

/** Open the app with a fresh (or given) data set. Seeding happens only once per test. */
export async function openApp(
  page: Page,
  opts: { theme?: string; data?: Record<string, unknown>; settings?: Record<string, unknown>; welcome?: boolean } = {},
) {
  const seed = opts.data ?? {
    version: 1,
    exercises: [],
    workouts: [],
    templates: [],
    activeWorkout: null,
    settings: { unit: 'kg', theme: opts.theme ?? 'D1', ...(opts.settings ?? {}) },
  };
  await page.addInitScript(
    ([key, value, skipWelcome]) => {
      if (!sessionStorage.getItem('e2e-seeded')) {
        sessionStorage.setItem('e2e-seeded', '1');
        localStorage.setItem(key, value);
        // Most tests start past the first-open welcome screen; welcome tests opt in.
        if (skipWelcome) localStorage.setItem('gym-app-welcome-v1', 'done');
      }
    },
    [STORAGE_KEY, JSON.stringify(seed), !opts.welcome] as const,
  );
  await page.goto('/');
  await expect(page.locator('.tabbar')).toBeVisible();
}

export async function tab(page: Page, name: 'Workout' | 'History' | 'Progress' | 'Exercises' | 'Settings') {
  await page.locator('.tabbar button', { hasText: name }).click();
}

export async function loadSampleWeek(page: Page) {
  await tab(page, 'Settings');
  await page.getByRole('button', { name: 'Load sample week' }).click();
  await expect(page.getByRole('button', { name: 'Remove sample week' })).toBeVisible();
}

export async function stored(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
}

/** Answer the in-app dialog if one is open. */
export async function answerDialog(page: Page, button: string) {
  const d = page.getByRole('alertdialog');
  await expect(d).toBeVisible();
  await d.getByRole('button', { name: button, exact: true }).click();
}

/** Skip the rest timer if it's showing. */
export async function skipRest(page: Page) {
  const skip = page.getByRole('button', { name: 'Skip', exact: true });
  if (await skip.isVisible()) await skip.click();
}

/** Open a Progress exercise via the Morph Select. */
export async function pickProgressExercise(page: Page, optionName: string) {
  await page.locator('.ms-btn').click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}
