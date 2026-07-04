import { test, expect } from '@playwright/test';

test('landing page renders in Hebrew by default (RTL)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
});

test('english route renders LTR', async ({ page }) => {
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('protected dashboard redirects logged-out users to login', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
