import { test, expect, type Page } from '@playwright/test';

function uniqueEmail() {
  return `e2e-checklist-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
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

/** Parses the he progress string "{done} מתוך {total} הושלמו" into numbers. */
async function readProgress(page: Page): Promise<{ done: number; total: number }> {
  const text = await page.getByText(/מתוך .* הושלמו/).textContent();
  const match = text?.match(/(\d+)\s*מתוך\s*(\d+)\s*הושלמו/);
  if (!match) throw new Error(`could not parse progress text: ${text}`);
  return { done: Number(match[1]), total: Number(match[2]) };
}

test.describe('checklist', () => {
  test('a freshly onboarded couple gets a seeded checklist', async ({ page }) => {
    await registerAndOnboard(page);

    await page.goto('/checklist');
    await expect(page).toHaveURL(/\/checklist/);

    const progress = await readProgress(page);
    expect(progress.done).toBe(0);
    expect(progress.total).toBeGreaterThan(0); // seeded from the 44 default templates
  });

  test('completing a task increments the progress count', async ({ page }) => {
    await registerAndOnboard(page);
    await page.goto('/checklist');

    const before = await readProgress(page);
    expect(before.total).toBeGreaterThan(0);

    const firstCheckbox = page.getByRole('checkbox').first();
    await firstCheckbox.click();

    // The checkbox is a controlled input driven by server state: it only
    // reflects `checked` once the server action resolves and the parent
    // re-fetches via router.refresh(), so wait for that round trip instead
    // of asserting the DOM changed synchronously on click.
    await expect(firstCheckbox).toBeChecked({ timeout: 10_000 });

    await expect(async () => {
      const after = await readProgress(page);
      expect(after.done).toBe(before.done + 1);
      expect(after.total).toBe(before.total);
    }).toPass();
  });

  test('adding a custom task, deleting it, and restoring it from trash', async ({ page }) => {
    await registerAndOnboard(page);
    await page.goto('/checklist');

    const customTitle = `E2E custom task ${Date.now()}`;

    // Add a custom task.
    await page.getByRole('button', { name: 'הוספת משימה' }).click();
    await page.getByLabel('כותרת').fill(customTitle);
    await page.getByRole('button', { name: 'שמירה' }).click();

    await expect(page.getByText(customTitle)).toBeVisible();

    // Delete it -> it should disappear from the main list.
    const taskRow = page.locator('.rounded-card', { hasText: customTitle });
    await taskRow.getByRole('button', { name: 'מחיקה', exact: true }).click();
    await expect(page.getByText(customTitle)).toHaveCount(0);

    // Open the trash view -> it should be there, restorable.
    await page.getByRole('button', { name: 'נמחקו לאחרונה' }).click();
    await expect(page.getByRole('heading', { name: 'נמחקו לאחרונה' })).toBeVisible();
    await expect(page.getByText(customTitle)).toBeVisible();

    const trashRow = page.locator('.rounded-card', { hasText: customTitle });
    await trashRow.getByRole('button', { name: 'שחזור' }).click();

    // It should leave the trash view...
    await expect(page.getByText(customTitle)).toHaveCount(0);

    // ...and reappear back in the main checklist.
    await page.getByRole('button', { name: 'חזרה לרשימת המשימות' }).click();
    await expect(page.getByText(customTitle)).toBeVisible();
  });
});
