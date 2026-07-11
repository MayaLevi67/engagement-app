import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import { prisma } from '../lib/db';

function uniqueEmail() {
  return `e2e-charts-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
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

async function weddingIdForEmail(email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email }, include: { wedding: true } });
  if (!user?.wedding) throw new Error(`No wedding found for ${email}`);
  return user.wedding.id;
}

/** Simulates a completed premium-unlock webhook (no live Stripe round-trip). */
async function makePremium(email: string): Promise<void> {
  const weddingId = await weddingIdForEmail(email);
  await prisma.wedding.update({ where: { id: weddingId }, data: { premiumUnlockedAt: new Date() } });
}

const SET_BUDGET_CTA = /^Set budget$|^הגדרת תקציב$/;
const SAVE = /^Save$|^שמירה$/;
const RECORD_CTA = /^Record payment$|^רישום תשלום$/;
const COST_LABEL = /^Cost$|^עלות$/;
const AMOUNT_LABEL = /^Amount$|^סכום$/;
// Not anchored: the <label> wraps the <select>, and the accessible name the
// browser computes for a label-wrapped combobox appends the selected
// option's text (e.g. "Paid by" + "Both"), so an exact ^$ match never fires.
const PAYER_LABEL = /Paid by|שולם על ידי/;
const PAYMENTS_NAV = /^Payments$|^תשלומים$/;
const ALLOCATION_TITLE = /^Recommended allocation$|^הקצאה מומלצת$/;
const BY_PAYER_TITLE = /^Paid by$|^מי שילם$/;
const PAID_OF_COST = /₪3,000 of ₪10,000 paid|שולמו ₪3,000 מתוך ₪10,000/;

test.describe('charts', () => {
  test('a premium couple sees the allocation donut on Budget and the by-payer donut on Payments', async ({
    page,
  }) => {
    const email = uniqueEmail();
    await registerAndOnboard(page, email);
    await makePremium(email);

    // Set a budget total so the recommended per-category allocation (and its
    // donut) has non-zero slices to render.
    await page.goto('/budget');
    await page.getByRole('button', { name: SET_BUDGET_CTA }).click();
    await page.getByRole('spinbutton').first().fill('100000');
    await page.getByRole('button', { name: SAVE }).first().click();

    // The allocation donut's title (Charts.allocationTitle) renders once the
    // category plan appears — it's a genuine heading, not just visible text.
    await expect(page.getByRole('heading', { name: ALLOCATION_TITLE })).toBeVisible({ timeout: 10_000 });
    const budgetSvg = page.locator('svg[role="img"]');
    await expect(budgetSvg).toBeVisible();
    expect(await budgetSvg.locator('path').count()).toBeGreaterThan(0);

    // Record a payment on the first checklist task so the by-payer roll-up
    // (and its donut) has a non-zero slice.
    await page.goto('/checklist');
    await page.getByRole('button', { name: RECORD_CTA }).first().click();
    await page.getByLabel(COST_LABEL).fill('10000');
    await page.getByLabel(AMOUNT_LABEL).fill('3000');
    await page.getByLabel(PAYER_LABEL).selectOption('BOTH');
    await page.getByRole('button', { name: SAVE }).first().click();

    // Wait for the save to actually land (task row reflects the new payment)
    // before navigating, so the payments nav click isn't racing the form close.
    await expect(page.getByText(PAID_OF_COST)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: PAYMENTS_NAV }).click();
    await expect(page).toHaveURL(/\/payments/);

    // The by-payer donut's title (Charts.byPayerTitle) renders alongside the
    // existing "By payer" numeric list, with a real svg of paths behind it.
    await expect(page.getByRole('heading', { name: BY_PAYER_TITLE })).toBeVisible({ timeout: 10_000 });
    const paymentsSvg = page.locator('svg[role="img"]');
    await expect(paymentsSvg).toBeVisible();
    expect(await paymentsSvg.locator('path').count()).toBeGreaterThan(0);
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
