import { test, expect } from '@playwright/test';

// playwright.config.ts pins use.locale to 'he-IL', so this only proves a
// Hebrew-preferring browser gets the Hebrew landing page: next-intl negotiates
// the locale from Accept-Language, and 'he' also happens to be the routing
// defaultLocale (the fallback for unrecognized locales).
test('a Hebrew-preferring visitor gets the Hebrew landing (RTL)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
});

test('english route renders LTR', async ({ page }) => {
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('protected dashboard redirects logged-out users to a real login page', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel(/email|אימייל/i)).toBeVisible();
});
