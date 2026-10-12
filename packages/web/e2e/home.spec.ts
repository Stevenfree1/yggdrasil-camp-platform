import { test, expect } from '@playwright/test';
import { campConfig } from '../../../config/camp.config';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads with the camp name in the title', async ({ page }) => {
    await expect(page).toHaveTitle(new RegExp(campConfig.name, 'i'));
  });

  test('navigation bar is visible', async ({ page }) => {
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
  });

  test('hero shows the camp name and both CTAs', async ({ page }) => {
    const hero = page.locator('main > section').first();
    await expect(hero).toBeVisible();
    await expect(page.locator('h1')).toContainText(campConfig.name);
    await expect(hero.locator('a[href="/apply"]')).toBeVisible();
    await expect(hero.locator('a[href="/login"]')).toBeVisible();
  });

  test('shows the what-we-do cards and joining steps', async ({ page }) => {
    await expect(page.locator('main article')).toHaveCount(3);
    await expect(page.locator('main ol > li')).toHaveCount(4);
  });

  test('footer renders with links', async ({ page }) => {
    const footer = page.locator('footer[role="contentinfo"]');
    await expect(footer).toBeVisible();
    await expect(footer.locator('a[href="/apply"]')).toBeVisible();
    await expect(footer.locator('a[href="/members"]')).toBeVisible();
    await expect(footer.locator(`a[href="mailto:${campConfig.email}"]`)).toBeVisible();
  });

  test('dark mode toggle works', async ({ page }) => {
    const toggle = page.locator('button[aria-label*="Switch to"]');
    await expect(toggle).toBeVisible();
    const initialLabel = await toggle.getAttribute('aria-label');
    await toggle.click();
    expect(await toggle.getAttribute('aria-label')).not.toBe(initialLabel);
  });

  test('skip-to-content link exists', async ({ page }) => {
    await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#main-content');
    await expect(page.locator('#main-content')).toBeAttached();
  });

  test('page has no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known benign errors (e.g., favicon 404, HMR, signed-out profile query)
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('HMR') && !e.includes('webpack') && !e.includes('401')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
