import { expect, test, type Browser, type Page } from '@playwright/test';
import { loadSampleWeek, openApp, stored, tab } from '../e2e/helpers.ts';

const PROJECT = 'demo-gym-log';
let n = 0;
const newEmail = () => `lifter${Date.now()}${n++}@example.com`;
const PASSWORD = 'squat-day-123';

/** A separate browser context = a separate device (own storage). */
async function device(browser: Browser, opts: { sample?: boolean } = {}) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await openApp(page);
  if (opts.sample) await loadSampleWeek(page);
  return { ctx, page };
}

async function signUp(page: Page, email: string) {
  await tab(page, 'Settings');
  await page.locator('.cloud-card').getByRole('button', { name: 'Create account' }).click(); // switch the form to Create account
  await page.locator('#cloud-email').fill(email);
  await page.locator('#cloud-password').fill(PASSWORD);
  await page.locator('.cloud-card form button[type=submit]').click();
  await expect(page.locator('.cloud-status')).toHaveText('Backed up', { timeout: 20_000 });
}

async function signIn(page: Page, email: string) {
  await tab(page, 'Settings');
  await page.locator('#cloud-email').fill(email);
  await page.locator('#cloud-password').fill(PASSWORD);
  await page.locator('.cloud-card form button[type=submit]').click();
  await expect(page.locator('.cloud-status')).toHaveText('Backed up', { timeout: 20_000 });
}

const workoutCount = async (page: Page) => (await stored(page)).workouts.length as number;

test('creating an account backs up this device, and a second device gets it all', async ({ browser }) => {
  const email = newEmail();
  const a = await device(browser, { sample: true });
  await signUp(a.page, email);

  const b = await device(browser);
  expect(await workoutCount(b.page)).toBe(0);
  await signIn(b.page, email);
  await expect.poll(() => workoutCount(b.page)).toBe(6);
  const bData = await stored(b.page);
  expect(bData.templates.map((t: { name: string }) => t.name)).toContain('Leg day');
  await tab(b.page, 'History');
  await expect(b.page.locator('.workout-card')).toHaveCount(6);
});

test('changes reach the other device live, in both directions', async ({ browser }) => {
  const email = newEmail();
  const a = await device(browser, { sample: true });
  await signUp(a.page, email);
  const b = await device(browser);
  await signIn(b.page, email);
  await expect.poll(() => workoutCount(b.page)).toBe(6);

  // Device A deletes a workout → it disappears on B without a reload.
  await tab(a.page, 'History');
  const first = a.page.locator('.workout-card').first();
  await first.locator('.workout-head').click();
  await first.getByRole('button', { name: /^Delete / }).click();
  await expect.poll(() => workoutCount(b.page), { timeout: 15_000 }).toBe(5);

  // Device B changes a setting → A picks it up.
  await tab(b.page, 'Settings');
  await b.page.locator('.chips.seg .chip', { hasText: 'lb' }).click();
  await expect.poll(async () => (await stored(a.page)).settings.unit, { timeout: 15_000 }).toBe('lb');
});

test('a workout logged offline is uploaded when the phone is back online', async ({ browser }) => {
  const email = newEmail();
  const a = await device(browser);
  await signUp(a.page, email);
  const b = await device(browser);
  await signIn(b.page, email);

  await a.ctx.setOffline(true);
  await tab(a.page, 'Workout');
  await a.page.locator('.start-empty').click();
  await a.page.getByRole('button', { name: /Add exercise/ }).click();
  await a.page.getByPlaceholder('Search or create…').fill('Plank');
  await a.page.getByRole('button', { name: /^Plank/ }).click();
  await a.page.getByLabel('Plank set 1 time').fill('1:00');
  await a.page.getByRole('button', { name: 'Mark Plank set 1 done' }).click();
  await a.page.getByRole('button', { name: 'Skip', exact: true }).click();
  await a.page.getByRole('button', { name: 'Finish workout' }).click();
  await a.page.getByRole('alertdialog').getByRole('button', { name: 'Not now' }).click();
  expect(await workoutCount(a.page)).toBe(1);
  await b.page.waitForTimeout(2000);
  expect(await workoutCount(b.page)).toBe(0); // nothing can arrive while A is offline

  await a.ctx.setOffline(false);
  await expect.poll(() => workoutCount(b.page), { timeout: 20_000 }).toBe(1);
});

test('signing out keeps your data on the device; signing back in carries on', async ({ browser }) => {
  const email = newEmail();
  const a = await device(browser, { sample: true });
  await signUp(a.page, email);
  await a.page.getByRole('button', { name: 'Sign out' }).click();
  await expect(a.page.locator('#cloud-email')).toBeVisible();
  expect(await workoutCount(a.page)).toBe(6);
  await signIn(a.page, email);
  expect(await workoutCount(a.page)).toBe(6); // no duplicates after merging
});

test('a wrong password gets a clear message', async ({ browser }) => {
  const email = newEmail();
  const a = await device(browser);
  await signUp(a.page, email);
  await a.page.getByRole('button', { name: 'Sign out' }).click();
  await a.page.locator('#cloud-email').fill(email);
  await a.page.locator('#cloud-password').fill('wrong-password');
  await a.page.locator('.cloud-card form button[type=submit]').click();
  await expect(a.page.locator('.toast')).toContainText('don’t match an account');
});

test('security rules: nobody can read or change someone else’s records', async ({ request }) => {
  // Two accounts made directly with the Auth emulator's REST API.
  const signUpRest = async (email: string) => {
    const r = await request.post(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
      data: { email, password: PASSWORD, returnSecureToken: true },
    });
    return (await r.json()) as { idToken: string; localId: string };
  };
  const alice = await signUpRest(newEmail());
  const bob = await signUpRest(newEmail());
  const docUrl = (uid: string, key: string) => `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}/records/${key}`;
  const body = { fields: { json: { stringValue: '{"x":1}' }, updatedAt: { integerValue: '1' } } };

  // Alice can write and read her own record.
  expect((await request.patch(docUrl(alice.localId, 'settings'), { data: body, headers: { Authorization: `Bearer ${alice.idToken}` } })).status()).toBe(200);
  expect((await request.get(docUrl(alice.localId, 'settings'), { headers: { Authorization: `Bearer ${alice.idToken}` } })).status()).toBe(200);
  // Bob can't read or overwrite Alice's record; signed-out requests are refused too.
  expect((await request.get(docUrl(alice.localId, 'settings'), { headers: { Authorization: `Bearer ${bob.idToken}` } })).status()).toBe(403);
  expect((await request.patch(docUrl(alice.localId, 'settings'), { data: body, headers: { Authorization: `Bearer ${bob.idToken}` } })).status()).toBe(403);
  expect((await request.get(docUrl(alice.localId, 'settings'))).status()).toBe(403);
  // Unexpected fields are rejected even on your own records.
  const extra = { fields: { ...body.fields, admin: { booleanValue: true } } };
  expect((await request.patch(docUrl(alice.localId, 'x'), { data: extra, headers: { Authorization: `Bearer ${alice.idToken}` } })).status()).toBe(403);
});

test('first open: creating an account on the welcome screen backs up and closes it', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await openApp(page, { welcome: true });
  const welcome = page.getByRole('dialog', { name: 'Overload' });
  await welcome.locator('#welcome-email').fill(newEmail());
  await welcome.locator('#welcome-password').fill(PASSWORD);
  await welcome.locator('form button[type=submit]').click();
  await expect(welcome).toHaveCount(0, { timeout: 20_000 });
  await tab(page, 'Settings');
  await expect(page.locator('.cloud-status')).toHaveText('Backed up', { timeout: 20_000 });
  // Signing out later doesn't bring the welcome screen back.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.reload();
  await expect(page.locator('.tabbar')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Overload' })).toHaveCount(0);
});
