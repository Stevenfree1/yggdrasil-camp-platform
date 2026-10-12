import { test, expect } from '@playwright/test';

test.describe('Public pages', () => {
  test('/apply page loads with form', async ({ page }) => {
    await page.goto('/apply');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.locator('input, textarea, select').count()).toBeGreaterThan(0);
  });

  test('/members redirects signed-out visitors to /login', async ({ page }) => {
    await page.goto('/members');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('/login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('/forgot-password page loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('removed marketing pages return 404', async ({ page }) => {
    for (const path of ['/about', '/art', '/events', '/donate']) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
    }
  });

  test('404 page shows for invalid routes', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await expect(page.locator('text=404')).toBeVisible();
    await expect(page.locator('a:has-text("Return Home")')).toBeVisible();
  });
});
