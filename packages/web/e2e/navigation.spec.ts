import { test, expect } from '@playwright/test';
import { campConfig } from '../../../config/camp.config';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('main nav links exist', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    for (const href of ['/', '/apply', '/members']) {
      await expect(nav.locator(`a[href="${href}"]`).first()).toBeAttached();
    }
  });

  test('shows a Log in link when signed out', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav.locator('a[href="/login"]')).toBeAttached();
  });

  test('logo links to homepage', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    const logo = nav.locator('a[href="/"]').first();
    await expect(logo).toBeVisible();
    await expect(logo).toContainText(campConfig.name);
  });

  test.describe('Mobile menu', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('opens and closes', async ({ page }) => {
      const menuButton = page.locator('button[aria-label="Open navigation menu"]');
      await expect(menuButton).toBeVisible();
      await menuButton.click();

      const mobileMenu = page.locator('#mobile-menu');
      await expect(mobileMenu).toBeVisible();

      await page.locator('#mobile-menu button[aria-label="Close navigation menu"]').click();
      await expect(mobileMenu).not.toBeVisible();
    });

    test('contains the navigation links', async ({ page }) => {
      await page.locator('button[aria-label="Open navigation menu"]').click();
      const mobileMenu = page.locator('#mobile-menu');
      await expect(mobileMenu).toBeVisible();

      for (const linkText of ['Home', 'Apply', 'Members', 'Log in']) {
        await expect(mobileMenu.locator(`a:has-text("${linkText}")`).first()).toBeVisible();
      }
    });
  });
});
