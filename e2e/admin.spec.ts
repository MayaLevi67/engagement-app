import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import { prisma } from '../lib/db';

function uniqueEmail() {
  return `e2e-admin-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerAndLogin(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel(/name|שם/i).first().fill('Maya');
  await page.getByLabel(/email|אימייל/i).fill(email);
  await page.getByLabel(/password|סיסמה/i).fill('pw12345678');
  await page.getByRole('button', { name: /create account|.*חשבון/i }).click();
}

async function fillNamesAndContinue(page: Page) {
  await page.getByLabel(/partner|בן\/בת/i).first().fill('Maya');
  await page.getByRole('button', { name: /continue|המשך/i }).click();
}

async function skipRemainingSteps(page: Page) {
  for (let i = 0; i < 4; i++) {
    const skip = page.getByRole('button', { name: /skip|דלג/i });
    const appeared = await skip
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) {
      await skip.click();
    } else {
      break;
    }
  }
}

async function finishOnboarding(page: Page) {
  await page.getByRole('button', { name: /dashboard|לוח|enter/i }).click();
}

/** Registers a fresh couple and completes onboarding minimally, landing on /dashboard. */
async function registerAndOnboard(page: Page) {
  await registerAndLogin(page, uniqueEmail());
  await expect(page).toHaveURL(/\/onboarding/);
  await fillNamesAndContinue(page);
  await skipRemainingSteps(page);
  await finishOnboarding(page);
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('Admin panel', () => {
  test('a non-admin is redirected away from /admin and every sub-route', async ({ page }) => {
    await registerAndOnboard(page); // a normal USER, lands on /dashboard

    for (const path of [
      '/admin',
      '/admin/concepts',
      '/admin/vendors',
      '/admin/budget-templates',
      '/admin/checklist-templates',
    ]) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/admin/);
      // proxy/layout bounce lands on /dashboard (or /login if the session dropped)
      await expect(page).toHaveURL(/\/(dashboard|login)/);
    }
  });

  test('an admin sees the shell overview + nav and can open a CMS', async ({ page }) => {
    const email = uniqueEmail();
    await registerAndLogin(page, email); // creates the user (role USER)
    await expect(page).toHaveURL(/\/onboarding/);
    await fillNamesAndContinue(page);
    await skipRemainingSteps(page);
    await finishOnboarding(page);
    await expect(page).toHaveURL(/\/dashboard/);

    // Promote to ADMIN in the DB, then clear the session and re-login so the
    // new JWT also carries ADMIN (the edge proxy's /admin gate reads the JWT).
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel(/email|אימייל/i).fill(email);
    await page.getByLabel(/password|סיסמה/i).fill('pw12345678');
    await page.getByRole('button', { name: /sign in|התחבר/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { level: 2, name: /overview|סקירה/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /concepts|קונספטים/i }).first()).toBeVisible();
    await page.getByRole('link', { name: /concepts|קונספטים/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/concepts/);
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
