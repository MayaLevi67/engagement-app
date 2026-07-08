import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import { prisma } from '../lib/db';

function uniqueEmail() {
  return `e2e-premium-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
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

// Seeded premium concept (see prisma/seed.ts: "Italian Summer" / isPremium: true).
const PREMIUM_CONCEPT_ID = 'concept-italian-summer';
const PREMIUM_CONCEPT_URL = `/concepts/${PREMIUM_CONCEPT_ID}`;

// Seed has 44 checklist task templates; FREE_CHECKLIST_LIMIT is 10 -> 34 hidden for a free couple.
const HIDDEN_TASK_COUNT = 34;

async function weddingIdForEmail(email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email }, include: { wedding: true } });
  if (!user?.wedding) throw new Error(`No wedding found for ${email}`);
  return user.wedding.id;
}

test.describe('premium', () => {
  test('a free couple is gated from budget, checklist tail, and premium concepts', async ({ page }) => {
    const email = uniqueEmail();
    await registerAndOnboard(page, email);

    // /budget shows the paywall, not the real budget UI.
    await page.goto('/budget');
    await expect(page).toHaveURL(/\/budget/);
    await expect(
      page.getByRole('heading', { name: /Premium feature|פיצ'?ר פרימיום/i }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Unlock Premium|שדרגו לפרימיום/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Set budget|הגדרת תקציב/i })).toHaveCount(0);

    // /checklist shows the "+N more" teaser instead of the full list.
    await page.goto('/checklist');
    await expect(page).toHaveURL(/\/checklist/);
    await expect(
      page.getByText(new RegExp(`\\+${HIDDEN_TASK_COUNT} more tasks|עוד ${HIDDEN_TASK_COUNT} משימות`)),
    ).toBeVisible();

    // A premium concept's detail page shows the lock / Unlock CTA, not Select.
    await page.goto(PREMIUM_CONCEPT_URL);
    await expect(page).toHaveURL(new RegExp(PREMIUM_CONCEPT_ID));
    await expect(page.getByText(/Premium feature|פיצ'?ר פרימיום/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Select this concept$|^בחרו קונספט זה$/i }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Unlock Premium|שדרגו לפרימיום/i }).first()).toBeVisible();
  });

  test('a premium couple has full budget, checklist, and concept access', async ({ page }) => {
    const email = uniqueEmail();
    await registerAndOnboard(page, email);

    // Simulate a completed webhook grant (no live Stripe round-trip).
    const weddingId = await weddingIdForEmail(email);
    await prisma.wedding.update({ where: { id: weddingId }, data: { premiumUnlockedAt: new Date() } });

    // /budget now shows the real budget UI and a total can be set.
    await page.goto('/budget');
    await expect(page).toHaveURL(/\/budget/);
    await expect(page.getByRole('heading', { name: /Premium feature|פיצ'?ר פרימיום/i })).toHaveCount(0);
    await page.getByRole('button', { name: /Set budget|הגדרת תקציב/i }).click();
    await page.getByRole('spinbutton').first().fill('100000');
    await page.getByRole('button', { name: /^Save$|^שמירה$/i }).click();
    await expect(
      page.getByRole('heading', { name: /Category plan|חלוקת קטגוריות/i }),
    ).toBeVisible({ timeout: 10_000 });

    // /checklist shows every task with no "+N more" teaser.
    await page.goto('/checklist');
    await expect(page).toHaveURL(/\/checklist/);
    await expect(page.getByText(/more tasks|משימות — שדרגו/i)).toHaveCount(0);

    // The premium concept can be selected.
    await page.goto(PREMIUM_CONCEPT_URL);
    await expect(page).toHaveURL(new RegExp(PREMIUM_CONCEPT_ID));
    const selectButton = page.getByRole('button', { name: /^Select this concept$|^בחרו קונספט זה$/i });
    await expect(selectButton).toBeVisible();
    await selectButton.click();
    await expect(
      page.getByRole('button', { name: /Remove selection|הסירו בחירה/i }),
    ).toBeVisible();
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
