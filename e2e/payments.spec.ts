import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import { prisma } from '../lib/db';

function uniqueEmail() {
  return `e2e-payments-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
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

const RECORD_CTA = /^Record payment$|^רישום תשלום$/;
const SAVE = /^Save$|^שמירה$/;
const COST_LABEL = /^Cost$|^עלות$/;
const AMOUNT_LABEL = /^Amount$|^סכום$/;
// Not anchored: the <label> wraps the <select>, and the accessible name the
// browser computes for a label-wrapped combobox appends the selected
// option's text (e.g. "Paid by" + "Both"), so an exact ^$ match never fires.
const PAYER_LABEL = /Paid by|שולם על ידי/;
const PAYWALL_TITLE = /Payment tracking is a Premium feature|מעקב תשלומים הוא פיצ'?ר פרימיום/;
const PAID_OF_COST = /₪3,000 of ₪10,000 paid|שולמו ₪3,000 מתוך ₪10,000/;
const REMAINING = /₪7,000 remaining|נותרו ₪7,000/;
const PAYMENTS_NAV = /^Payments$|^תשלומים$/;
const BOTH_LABEL = /Both|משותף/;

test.describe('payments', () => {
  test('a premium couple records a task payment and sees it reflected in checklist and /payments', async ({
    page,
  }) => {
    const email = uniqueEmail();
    await registerAndOnboard(page, email);
    await makePremium(email);

    await page.goto('/checklist');
    await expect(page).toHaveURL(/\/checklist/);

    // Open the record-payment form on the first checklist task.
    await page.getByRole('button', { name: RECORD_CTA }).first().click();

    await page.getByLabel(COST_LABEL).fill('10000');
    await page.getByLabel(AMOUNT_LABEL).fill('3000');
    await page.getByLabel(PAYER_LABEL).selectOption('BOTH');
    await page.getByRole('button', { name: SAVE }).first().click();

    // Task row now shows paid 3,000 of cost 10,000, with 7,000 remaining.
    await expect(page.getByText(PAID_OF_COST)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(REMAINING)).toBeVisible();

    // The record CTA is gone from that row's toolbar once the form is closed;
    // navigate to the /payments roll-up (via the side nav) to verify the ledger.
    await page.getByRole('link', { name: PAYMENTS_NAV }).click();
    await expect(page).toHaveURL(/\/payments/);

    // Exactly one task has a cost/payment recorded -> its row is the only
    // button containing both the cost (₪10,000) and remaining (₪7,000) figures.
    const paymentRow = page
      .getByRole('button')
      .filter({ hasText: '₪10,000' })
      .filter({ hasText: '₪7,000' });
    await expect(paymentRow).toBeVisible();
    await expect(paymentRow).toContainText('₪3,000');

    // The by-payer roll-up shows a "Both" total of ₪3,000. The section also
    // renders the by-payer donut's own legend (a second "Both" <li>), so
    // scope the query to the fallback list itself via its data-testid
    // rather than filtering by DOM order — this fails if the fallback
    // list is ever removed, even though the donut legend still exists.
    const byPayerList = page.getByTestId('by-payer-list');
    const byPayerRow = byPayerList.locator('li').filter({ hasText: BOTH_LABEL });
    await expect(byPayerRow).toContainText('₪3,000');
  });

  test('a free couple is paywalled on /payments and has no record-payment affordance on tasks', async ({
    page,
  }) => {
    const email = uniqueEmail();
    await registerAndOnboard(page, email);

    await page.goto('/payments');
    await expect(page).toHaveURL(/\/payments/);
    await expect(page.getByRole('heading', { name: PAYWALL_TITLE })).toBeVisible();

    await page.goto('/checklist');
    await expect(page).toHaveURL(/\/checklist/);
    await expect(page.getByRole('button', { name: RECORD_CTA })).toHaveCount(0);
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
