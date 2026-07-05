import { test, expect, type Page } from '@playwright/test';

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerAndLogin(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel(/name|שם/i).first().fill('Maya');
  await page.getByLabel(/email|אימייל/i).fill(email);
  await page.getByLabel(/password|סיסמה/i).fill('pw12345678');
  await page.getByRole('button', { name: /create account|.*חשבון/i }).click();
}

async function fillNamesAndContinue(page: Page) {
  // Step 1 (names) is required: partner1Name's label ("שם בן/בת הזוג") is a
  // prefix of partner2Name's label ("שם בן/בת הזוג השני/ה"), so `.first()`
  // picks the first field in DOM order (partner1Name).
  await page.getByLabel(/partner|בן\/בת/i).first().fill('Maya');
  await page.getByRole('button', { name: /continue|המשך/i }).click();
}

async function skipRemainingSteps(page: Page) {
  for (let i = 0; i < 4; i++) {
    const skip = page.getByRole('button', { name: /skip|דלג/i });
    // `continue`/`skip` clicks trigger an async Server Action (saveNames/
    // saveStep) before the wizard advances to the next step, so the skip
    // button for the *next* step isn't in the DOM yet right after a click.
    // `isVisible()` doesn't auto-wait, so poll with a bounded `waitFor`
    // instead (it correctly resolves to false once we reach the final
    // "done" step, which has no skip button).
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

test('a new couple is routed into onboarding and can skip to a personalized dashboard', async ({
  page,
}) => {
  await registerAndLogin(page, uniqueEmail());
  await expect(page).toHaveURL(/\/onboarding/); // criterion 1

  await fillNamesAndContinue(page);
  await skipRemainingSteps(page);
  await finishOnboarding(page);

  await expect(page).toHaveURL(/\/dashboard/); // criterion 3
});

test('an onboarded couple hitting /onboarding is sent to the dashboard', async ({ page }) => {
  const email = uniqueEmail();
  await registerAndLogin(page, email);
  await expect(page).toHaveURL(/\/onboarding/);

  // complete onboarding minimally
  await fillNamesAndContinue(page);
  await skipRemainingSteps(page);
  await finishOnboarding(page);
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/dashboard/); // criterion 5
});

test('abandoning mid-wizard and returning resumes with prior answers intact', async ({
  page,
}) => {
  await registerAndLogin(page, uniqueEmail());
  await expect(page).toHaveURL(/\/onboarding/);

  // Step 1 persists on Continue (saveNames), so navigating away and back
  // should resume with the entered name still in the field.
  const partner1 = page.getByLabel(/partner|בן\/בת/i).first();
  await partner1.fill('Asaf');
  await page.getByRole('button', { name: /continue|המשך/i }).click();

  await page.goto('/dashboard'); // still incomplete -> gate bounces back
  await expect(page).toHaveURL(/\/onboarding/); // criterion 4

  await expect(page.getByLabel(/partner|בן\/בת/i).first()).toHaveValue('Asaf');
});
