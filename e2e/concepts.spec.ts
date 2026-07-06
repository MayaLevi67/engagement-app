import { test, expect, type Page } from '@playwright/test';

function uniqueEmail() {
  return `e2e-concepts-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
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

test.describe('concepts', () => {
  test('couple browses concepts, selects one, and pushes an idea to the checklist', async ({ page }) => {
    await registerAndOnboard(page);

    await page.goto('/concepts');
    await expect(page).toHaveURL(/\/concepts/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Open the first concept (seeded "Party Time" sorts first).
    await page.getByRole('link', { name: /Party Time|מסיבה/ }).first().click();
    await expect(page).toHaveURL(/\/concepts\/concept-/);

    // Select it as the wedding's direction.
    await page.getByRole('button', { name: /Select this concept|בחרו קונספט זה/ }).click();
    await expect(page.getByRole('button', { name: /Remove selection|הסירו בחירה/ })).toBeVisible();

    // Push the first idea to the checklist.
    const addButton = page.getByRole('button', { name: /Add to checklist|הוספה לרשימה/ }).first();
    await addButton.click();
    await expect(page.getByRole('button', { name: /Added|נוסף/ }).first()).toBeDisabled();

    // It appears in the checklist as an added task.
    await page.goto('/checklist');
    await expect(page).toHaveURL(/\/checklist/);
    await expect(page.getByText(/DJ|תקליטן/).first()).toBeVisible();
  });

  test('logged-out users are redirected from /concepts', async ({ page }) => {
    await page.goto('/concepts');
    await expect(page).toHaveURL(/\/login/);
  });
});
