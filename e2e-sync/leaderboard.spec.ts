import { expect, test, type Browser, type Page } from '@playwright/test';
import { loadSampleWeek, openApp, tab } from '../e2e/helpers.ts';

const PROJECT = 'demo-gym-log';
const PASSWORD = 'squat-day-123';
let n = 0;
const newEmail = () => `lb${Date.now()}${n++}@example.com`;
/** A friend code no earlier run has used. */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const freshCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

async function signedInDevice(browser: Browser, opts: { sample?: boolean; bodyWeightKg?: number } = {}) {
  const page = await (await browser.newContext()).newPage();
  await openApp(page, opts.bodyWeightKg ? { settings: { bodyWeightKg: opts.bodyWeightKg } } : {});
  if (opts.sample) await loadSampleWeek(page);
  await tab(page, 'Settings');
  await page.locator('.cloud-card').getByRole('button', { name: 'Create account' }).click();
  await page.locator('#cloud-email').fill(newEmail());
  await page.locator('#cloud-password').fill(PASSWORD);
  await page.locator('.cloud-card form button[type=submit]').click();
  await expect(page.locator('.cloud-status')).toHaveText('Backed up', { timeout: 20_000 });
  return page;
}

async function join(page: Page, name: string) {
  await tab(page, 'Progress');
  await page.getByRole('radio', { name: 'Leaderboards' }).or(page.getByRole('tab', { name: 'Leaderboards' })).or(page.locator('.chip', { hasText: 'Leaderboards' })).first().click();
  await page.locator('#lb-name').fill(name);
  await page.getByRole('button', { name: 'Join leaderboards' }).click();
  await expect(page.locator('.lb-me')).toBeVisible({ timeout: 15_000 });
  return (await page.locator('.lb-code').innerText()).trim();
}

test('two friends join, add each other by code and see each other on both boards', async ({ browser }) => {
  const id = String(Date.now()).slice(-5); // unique names, as the global board keeps earlier runs' entries
  const SAM = `Sam ${id}`;
  const ALEX = `Alex ${id}`;
  const sam = await signedInDevice(browser, { sample: true, bodyWeightKg: 80 });
  const alex = await signedInDevice(browser);
  const samCode = await join(sam, SAM);
  await join(alex, ALEX);
  // Both entries have reached the database (read with the emulator's admin access).
  await expect
    .poll(async () => {
      const r = await alex.request.get(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/leaderboard`, { headers: { Authorization: 'Bearer owner' } });
      const names = ((await r.json()).documents ?? []).map((d: { fields: { name: { stringValue: string } } }) => d.fields.name.stringValue);
      return names.includes(SAM) && names.includes(ALEX);
    }, { timeout: 15_000 })
    .toBe(true);

  // Alex adds Sam by code.
  await alex.getByLabel('Friend’s code').fill(samCode.toLowerCase());
  await alex.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(alex.locator('.toast')).toHaveText('Friend added');
  await expect(alex.locator('.lb-row')).toHaveCount(2, { timeout: 15_000 });
  await expect(alex.locator('.lb-row', { hasText: SAM })).toBeVisible();
  // Sam trained this week (sample week), so is above Alex.
  await expect(alex.locator('.lb-row').first()).toContainText(SAM);
  await expect(alex.locator('.lb-row.you')).toContainText(ALEX);

  // Global consistency shows both.
  await alex.locator('.chip', { hasText: 'Global' }).click();
  await expect(alex.locator('.lb-row', { hasText: SAM })).toBeVisible({ timeout: 15_000 });
  await expect(alex.locator('.lb-row', { hasText: ALEX })).toBeVisible();

  // Strength: Sam has a body weight and the big three in the sample week; Alex has neither.
  await alex.locator('.chip', { hasText: 'Strength' }).click();
  await expect(alex.locator('.lb-row', { hasText: SAM })).toContainText('score', { timeout: 15_000 });
  await expect(alex.getByText('Add your body weight to join')).toBeVisible();
  await expect(alex.locator('.lb-row', { hasText: ALEX })).toHaveCount(0);

  // Sam leaves (with Undo available); Alex no longer sees Sam after refreshing.
  await tab(sam, 'Settings');
  await sam.getByRole('button', { name: 'Leave leaderboards' }).click();
  await expect(sam.locator('.toast')).toContainText('You’ve left the leaderboards');
  await alex.locator('.chip', { hasText: 'Friends' }).click();
  await alex.getByRole('button', { name: 'Refresh' }).click();
  await expect(alex.locator('.lb-row', { hasText: SAM })).toHaveCount(0, { timeout: 15_000 });
});

test('leaderboard rules: only your own entry, within the limits, and only for signed-in people', async ({ request }) => {
  const signUpRest = async (email: string) => {
    const r = await request.post(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
      data: { email, password: PASSWORD, returnSecureToken: true },
    });
    return (await r.json()) as { idToken: string; localId: string };
  };
  const alice = await signUpRest(newEmail());
  const bob = await signUpRest(newEmail());
  const base = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
  const entry = (overrides: Record<string, unknown> = {}) => {
    const fields: Record<string, unknown> = {
      name: { stringValue: 'Alice' }, code: { stringValue: 'ABCDEF' }, weekId: { stringValue: '2026-W47' },
      points: { integerValue: '55' }, last4: { integerValue: '200' }, streak: { integerValue: '2' }, tier: { stringValue: 'gold' },
      strength: { integerValue: '112' },
      lifts: { mapValue: { fields: {
        l1: { mapValue: { fields: { id: { stringValue: 'preset-deadlift' }, score: { integerValue: '125' } } } },
        l2: { mapValue: { fields: { id: { stringValue: 'preset-squat' }, score: { integerValue: '110' } } } },
      } } },
      ...overrides,
    };
    return fields;
  };
  /** Write a leaderboard entry for `uid` as `token` (the server stamps updatedAt). */
  const write = (token: string, uid: string, fields: Record<string, unknown>) =>
    request.post(`${base}:commit`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        writes: [{
          update: { name: `projects/${PROJECT}/databases/(default)/documents/leaderboard/${uid}`, fields },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        }],
      },
    });

  expect((await write(alice.idToken, alice.localId, entry())).status()).toBe(200);
  // Bob can read it (signed in), but can't change it; signed-out requests can't even read.
  expect((await request.get(`${base}/leaderboard/${alice.localId}`, { headers: { Authorization: `Bearer ${bob.idToken}` } })).status()).toBe(200);
  expect((await request.get(`${base}/leaderboard/${alice.localId}`)).status()).toBe(403);
  expect((await write(bob.idToken, alice.localId, entry({ name: { stringValue: 'Hacked' } }))).status()).toBe(403);
  // Points, strength, names and extra fields outside the limits are refused.
  expect((await write(alice.idToken, alice.localId, entry({ points: { integerValue: '196' } }))).status()).toBe(403);
  expect((await write(alice.idToken, alice.localId, entry({ strength: { integerValue: '301' } }))).status()).toBe(403);
  const badLift = (fields: Record<string, unknown>) => ({ lifts: { mapValue: { fields: { l1: { mapValue: { fields } } } } } });
  expect((await write(alice.idToken, alice.localId, entry(badLift({ id: { stringValue: 'preset-squat' }, score: { integerValue: '999' } })))).status()).toBe(403);
  expect((await write(alice.idToken, alice.localId, entry(badLift({ id: { stringValue: '<b>hi</b>' }, score: { integerValue: '50' } })))).status()).toBe(403);
  expect((await write(alice.idToken, alice.localId, entry(badLift({ id: { stringValue: 'preset-squat' }, score: { integerValue: '50' }, kg: { integerValue: '140' } })))).status()).toBe(403);
  expect((await write(alice.idToken, alice.localId, entry({ ratios: { mapValue: { fields: {} } } }))).status()).toBe(403); // the old format isn't accepted
  expect((await write(alice.idToken, alice.localId, entry({ name: { stringValue: 'x' } }))).status()).toBe(403);
  expect((await write(alice.idToken, alice.localId, entry({ bodyWeight: { integerValue: '80' } }))).status()).toBe(403);
  expect((await write(alice.idToken, alice.localId, entry({ tier: { stringValue: 'legend' } }))).status()).toBe(403);

  // Friend codes: claim your own, can't take one that's already someone else's.
  const claim = (token: string, code: string, uid: string) =>
    request.post(`${base}/friendCodes?documentId=${code}`, { headers: { Authorization: `Bearer ${token}` }, data: { fields: { uid: { stringValue: uid } } } });
  const taken = freshCode();
  expect((await claim(alice.idToken, taken, alice.localId)).status()).toBe(200);
  expect((await claim(bob.idToken, taken, bob.localId)).status()).not.toBe(200);
  expect((await claim(bob.idToken, freshCode(), alice.localId)).status()).toBe(403); // can't claim a code for someone else
  expect((await claim(bob.idToken, 'BAD-01', bob.localId)).status()).toBe(403);
});
