import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import { prisma } from '../lib/db';

function uniqueEmail() {
  return `e2e-vendors-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
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

test.describe('Vendors', () => {
  test('browse, shortlist, quote, book, push a paid quote into the budget', async ({ page }) => {
    const email = uniqueEmail();
    await registerAndOnboard(page, email);
    await makePremium(email);

    // A budget is needed for the committed rollup to be meaningful.
    await page.goto('/budget');
    await page.getByRole('button', { name: /set budget|הגדרת תקציב/i }).click();
    await page.getByRole('spinbutton').first().fill('150000');
    await page.getByRole('button', { name: /^save$|^שמירה$/i }).click();

    // Open the directory, see the disclaimer, open the seeded music vendor.
    // The card's title resolves via titleLocale AUTO, so under the he-IL
    // e2e locale it renders the Hebrew name (name_he), not name_en — match
    // both. It also appears in the "for your wedding" matches strip, so the
    // directory listing below can match it twice — .first() picks either,
    // both point at the same vendor id.
    await page.goto('/vendors');
    await expect(page.getByText(/for information only|למידע בלבד/i)).toBeVisible();
    await page.getByRole('link', { name: /Groove DJ Collective|גרוב תקליטנים/ }).first().click();
    await expect(page).toHaveURL(/\/vendors\/vendor-groove-dj/);

    // Set a quote amount, link it to a checklist task, add to budget as paid.
    await page.getByLabel(/quoted amount|סכום מוצע/i).fill('9000');
    await page.getByLabel(/quoted amount|סכום מוצע/i).press('Tab');
    await page.getByLabel(/link to a checklist task|קישור למשימה/i).selectOption({ index: 1 });
    const addToBudgetPaid = page.getByRole('button', { name: /add to budget \(paid\)|הוספה לתקציב \(שולם\)/i });
    await addToBudgetPaid.click();
    await expect(page.getByText(/added to your budget|נוסף לתקציב שלכם/i)).toBeVisible();

    // The amount now shows in the budget's committed total for that task's
    // category (not just the word "committed" — the actual paid figure).
    await page.goto('/budget');
    await expect(page.getByText(/שולם:\s*₪9,000/).first()).toBeVisible({ timeout: 10_000 });
  });

  test('a private vendor is visible only to its couple', async ({ page }) => {
    await registerAndOnboard(page, uniqueEmail());
    await page.goto('/vendors');
    await page.getByRole('button', { name: /add your own vendor|הוספת ספק משלכם/i }).click();
    await page.getByLabel(/name|שם/i).first().fill('Cousin Dan DJ');
    await page.getByRole('button', { name: /^save$|^שמירה$/i }).click();
    await expect(page.getByText('Cousin Dan DJ')).toBeVisible();

    // A second, unrelated couple never sees it in their own directory.
    const otherContext = await page.context().browser()!.newContext({ locale: 'he-IL' });
    const otherPage = await otherContext.newPage();
    await registerAndOnboard(otherPage, uniqueEmail());
    await otherPage.goto('/vendors');
    await expect(otherPage.getByText('Cousin Dan DJ')).toHaveCount(0);
    await otherContext.close();
  });

  test('logged-out visitor is redirected from /vendors', async ({ page }) => {
    await page.goto('/vendors');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
