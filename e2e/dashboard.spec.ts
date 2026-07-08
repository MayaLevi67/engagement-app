import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import { prisma } from '../lib/db';

function uniqueEmail() {
  return `e2e-dashboard-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
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
async function registerAndOnboard(page: Page, email: string) {
  await registerAndLogin(page, email);
  await expect(page).toHaveURL(/\/onboarding/);
  await fillNamesAndContinue(page);
  await skipRemainingSteps(page);
  await finishOnboarding(page);
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Budget is a premium feature (see e2e/premium.spec.ts) — promote the test couple. */
async function makePremium(email: string) {
  const wedding = (await prisma.user.findUnique({ where: { email }, include: { wedding: true } }))?.wedding;
  await prisma.wedding.update({ where: { id: wedding!.id }, data: { premiumUnlockedAt: new Date() } });
}

test.describe('Dashboard', () => {
  test('shows the hero + section cards, and the budget card flips from nudge to summary', async ({ page }) => {
    const email = uniqueEmail();
    await registerAndOnboard(page, email); // lands on /dashboard

    // Onboarding skips the date, so the hero shows the set-date state (Dashboard.noDateTitle);
    // the checklist card renders (its title is always shown regardless of seeded data).
    await expect(page.getByText(/set your wedding date|הגדירו את תאריך החתונה/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /checklist|צ'ק ליסט/i })).toBeVisible();

    // Budget card starts as a nudge (Dashboard.budgetBody) — not the summary text.
    const budgetNudge = page.getByText(/set a total and let us split it|הגדירו סכום כולל ואנחנו נחלק אותו/i);
    await expect(budgetNudge).toBeVisible();
    await expect(page.getByText(/committed of|שולמו מתוך/i)).toHaveCount(0);

    // Set a budget, come back, and the budget card shows a summary instead of the nudge.
    await makePremium(email);
    await page.goto('/budget');
    await page.getByRole('button', { name: /set budget|הגדרת תקציב/i }).click();
    await page.getByRole('spinbutton').first().fill('120000');
    await page.getByRole('button', { name: /^save$|שמירה/i }).click();

    // The save is an async server action; wait for the category breakdown
    // (which only renders once the total is persisted, per Budget.breakdownTitle)
    // before navigating away, so the dashboard read isn't racing the write.
    await expect(page.getByRole('heading', { name: /category plan|חלוקת קטגוריות/i })).toBeVisible({ timeout: 10_000 });

    await page.goto('/dashboard');
    await expect(page.getByText(/committed of|שולמו מתוך/i)).toBeVisible();
    await expect(budgetNudge).toHaveCount(0);
  });

  test('logged-out visitor cannot reach the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
