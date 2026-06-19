import { test, expect } from '@playwright/test';

// Boots the real app in a browser and proves every app script loaded and ran
// its top-level code without throwing (something static checks can't verify).
test('app boots and shows the login screen', async ({ page }) => {
  const ownErrors = [];
  page.on('pageerror', (e) => {
    const s = (e && e.stack) || String(e);
    if (/\/js\/(app|auth|cloud-sync|supabase-client|config)\.js/.test(s)) ownErrors.push(s);
  });

  await page.goto('/index.html');

  // The login gate should be visible (no session in a fresh browser).
  await expect(page.locator('#authForm')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#appRoot')).toBeHidden();

  // All our scripts defined their globals => they parsed and executed cleanly.
  const globals = await page.evaluate(() => ({
    bootApp: typeof window.bootApp,
    CloudSync: typeof window.CloudSync,
    toast: typeof window.toast,
    openShareModal: typeof window.openShareModal,
    changeCloudPassword: typeof window.changeCloudPassword
  }));
  expect(globals.bootApp).toBe('function');
  expect(globals.CloudSync).toBe('object');
  expect(globals.toast).toBe('function');
  expect(globals.openShareModal).toBe('function');
  expect(globals.changeCloudPassword).toBe('function');

  expect(ownErrors, 'No runtime errors from app scripts:\n' + ownErrors.join('\n')).toHaveLength(0);
});

test('share viewer page loads and handles a missing token', async ({ page }) => {
  await page.goto('/share.html');
  // With no ?t= token it should render a friendly message, not crash.
  await expect(page.locator('.sv-msg')).toBeVisible({ timeout: 15000 });
});

// The standalone, sellable local-only build: no login, no Supabase, no network
// sync — it must boot straight into the app on its own runtime (local-store.js).
test('local edition boots with no login and no app-script errors', async ({ page }) => {
  const ownErrors = [];
  page.on('pageerror', (e) => {
    const s = (e && e.stack) || String(e);
    if (/\/local-edition\/js\/(app|local-store)\.js/.test(s)) ownErrors.push(s);
  });

  await page.goto('/local-edition/index.html');

  // No auth gate — the app shell is shown immediately.
  await expect(page.locator('#appRoot')).toBeVisible({ timeout: 15000 });
  // Fresh profile => the first-run sample-data prompt appears.
  await expect(page.locator('#localFirstRun')).toBeVisible({ timeout: 15000 });

  const globals = await page.evaluate(() => ({
    bootApp: typeof window.bootApp,
    loadSampleData: typeof window.loadSampleData,
    restoreLocalBackup: typeof window.restoreLocalBackup,
    CloudSync: typeof window.CloudSync
  }));
  expect(globals.bootApp).toBe('function');
  expect(globals.loadSampleData).toBe('function');
  expect(globals.restoreLocalBackup).toBe('function');
  expect(globals.CloudSync).toBe('object');

  expect(ownErrors, 'No runtime errors from local-edition scripts:\n' + ownErrors.join('\n')).toHaveLength(0);
});

// The optional App Passcode must lock the app on launch and round-trip the
// records through at-rest encryption (passcode is the key; wrong code denied).
test('local edition app passcode locks on launch and encrypts at rest', async ({ page }) => {
  const ownErrors = [];
  page.on('pageerror', (e) => {
    const s = (e && e.stack) || String(e);
    if (/\/local-edition\/js\/(app|local-store)\.js/.test(s)) ownErrors.push(s);
  });

  await page.goto('/local-edition/index.html');
  await expect(page.locator('#appRoot')).toBeVisible({ timeout: 15000 });

  // Seed a record, then enable a passcode (which re-saves the state encrypted).
  await page.evaluate(async () => {
    db.firearms.push({ id: 'test-lock-1', make: 'Test', model: 'Locker', serial: 'LOCK-1', type: 'Pistol', status: 'Active', tags: [], images: [] });
    await saveData();
    document.getElementById('passNew').value = 'secret123';
    document.getElementById('passConfirm').value = 'secret123';
    await window.enableLocalPasscode();
  });

  // After reload the lock screen must gate access; the app stays hidden.
  await page.reload();
  await expect(page.locator('#lockScreen')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#appRoot')).toBeHidden();

  // Wrong passcode is rejected and the app remains locked.
  await page.fill('#lockInput', 'nope');
  await page.click('#lockScreen button[type="submit"]');
  await expect(page.locator('#lockErr')).toBeVisible();
  await expect(page.locator('#appRoot')).toBeHidden();

  // Correct passcode unlocks and the encrypted record round-trips back.
  await page.fill('#lockInput', 'secret123');
  await page.click('#lockScreen button[type="submit"]');
  await expect(page.locator('#appRoot')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#lockScreen')).toHaveCount(0);
  expect(await page.evaluate(() => db.firearms.length)).toBeGreaterThan(0);

  expect(ownErrors, 'No runtime errors from local-edition scripts:\n' + ownErrors.join('\n')).toHaveLength(0);
});
