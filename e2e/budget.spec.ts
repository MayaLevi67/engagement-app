import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import { prisma } from '../lib/db';

function uniqueEmail() {
  return `e2e-budget-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
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

test.describe('Budget planning', () => {
  test('set a budget, complete a task with a paid amount, see it in the split', async ({ page }) => {
    const email = uniqueEmail();
    await registerAndOnboard(page, email);
    await makePremium(email);

    // Open the budget page and set a total (Budget.setTotalCta / Budget.save).
    await page.goto('/budget');
    await page.getByRole('button', { name: 'הגדרת תקציב' }).click();
    await page.getByRole('spinbutton').first().fill('100000');
    await page.getByRole('button', { name: 'שמירה' }).click();

    // The category breakdown (Budget.breakdownTitle) renders once a total is set.
    await expect(page.getByRole('heading', { name: 'חלוקת קטגוריות' })).toBeVisible({ timeout: 10_000 });

    // Complete the first checklist task, then record a payment on it via the
    // premium task-row PaymentForm (Task 5: paid amounts are no longer set
    // from a completion popup — they're a separate ledger entry recorded
    // through Payments.recordCta / Payments.amount / Payments.save).
    await page.goto('/checklist');
    const firstCheckbox = page.getByRole('checkbox').first();
    await firstCheckbox.click();

    // The checkbox only reflects `checked` once the server action resolves
    // and the parent re-fetches via router.refresh() (same controlled-input
    // caveat as e2e/checklist.spec.ts).
    await expect(firstCheckbox).toBeChecked({ timeout: 10_000 });

    await page.getByRole('button', { name: 'רישום תשלום' }).first().click();
    await page.getByLabel('סכום').fill('8000');
    await page.getByRole('button', { name: 'שמירה' }).click();

    // Budget.rollupTasks only counts paid on DONE tasks, so the task-row's
    // own paid summary should reflect the new payment immediately. This
    // seeded task (prisma/seed.ts's first template) has no estimatedCost,
    // so the summary renders Payments.paidOnly ("שולמו {paid}") rather than
    // paidOfCost — if a future seed change gives it a cost, switch this
    // assertion to match paidOfCost's "שולמו ... מתוך" instead.
    await expect(page.getByText(/שולמו.*8,000/).first()).toBeVisible({ timeout: 10_000 });

    // Back on the budget page, that category shows the committed amount
    // (Budget.committed: "שולם").
    await page.goto('/budget');
    await expect(page.getByText(/שולם:\s*₪8,000/).first()).toBeVisible({ timeout: 10_000 });
  });

  test('logged-out visitor is redirected from /budget', async ({ page }) => {
    await page.goto('/budget');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
