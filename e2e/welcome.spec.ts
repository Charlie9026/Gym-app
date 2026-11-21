import { expect, test } from '@playwright/test';
import { openApp, tab } from './helpers.ts';

test('first open asks you to sign in or create an account', async ({ page }) => {
  await openApp(page, { welcome: true });
  const welcome = page.getByRole('dialog', { name: 'Overload' });
  await expect(welcome).toBeVisible();
  await expect(welcome.getByRole('button', { name: 'Continue with Google' })).toBeFocused();
  // Starts on Create account; the switch slides to Sign in and the form follows.
  await expect(welcome.locator('form button[type=submit]')).toHaveText('Create account');
  await welcome.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await expect(welcome.locator('form button[type=submit]')).toHaveText('Sign in');
  await expect(welcome.getByRole('button', { name: 'Forgot password?' })).toBeVisible();
  await expect(welcome.locator('form button[type=submit]')).toBeDisabled();
});

test('"Not now" opens the app and the welcome screen doesn\u2019t come back', async ({ page }) => {
  await openApp(page, { welcome: true });
  await page.getByRole('button', { name: 'Not now, use on this device only' }).click();
  await expect(page.getByRole('dialog', { name: 'Overload' })).toHaveCount(0);
  await expect(page.locator('.start-empty')).toBeVisible();
  await page.reload();
  await expect(page.locator('.tabbar')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Overload' })).toHaveCount(0);
  // Signing in is still available later from Settings.
  await tab(page, 'Settings');
  await expect(page.locator('.cloud-card')).toContainText('Continue with Google');
});

test('fits a 320px phone without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openApp(page, { welcome: true });
  await expect(page.getByRole('dialog', { name: 'Overload' })).toBeVisible();
  const overflow = await page.evaluate(() => {
    const w = document.querySelector('.welcome') as HTMLElement;
    return w.scrollWidth - w.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});
