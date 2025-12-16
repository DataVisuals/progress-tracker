import { test, expect } from '@playwright/test';

// NOTE: These tests are Playwright e2e tests, not Vitest unit tests
// Run with: npx playwright test
// They require the app to be running and Playwright browsers to be installed
test.describe('Homepage Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display the main header with logo animation', async ({ page }) => {
    // Check for the Lottie animation container
    const logoAnimation = page.locator('.app-logo-lottie');
    await expect(logoAnimation).toBeVisible({ timeout: 10000 });
  });

  test('should display the Progress Tracker title', async ({ page }) => {
    const title = page.locator('.header-title-text');
    await expect(title).toContainText('Progress Tracker');
  });

  test('should have the header with all main elements', async ({ page }) => {
    // Header should be visible
    const header = page.locator('.app-header-main');
    await expect(header).toBeVisible();

    // Header left section
    const headerLeft = page.locator('.header-left');
    await expect(headerLeft).toBeVisible();

    // Header right section
    const headerRight = page.locator('.header-right');
    await expect(headerRight).toBeVisible();
  });

  test('should have theme toggle button', async ({ page }) => {
    const themeToggle = page.locator('.theme-toggle-btn');
    await expect(themeToggle).toBeVisible();
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Give some time for any async errors
    await page.waitForTimeout(2000);

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes('ResizeObserver') && // Common non-critical error
        !error.includes('Loading chunk') // Chunk loading errors during dev
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should be responsive - mobile view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // App should still be visible
    const app = page.locator('.app');
    await expect(app).toBeVisible();

    // Header should still be visible
    const header = page.locator('.app-header-main');
    await expect(header).toBeVisible();
  });

  test('should be responsive - tablet view', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    const app = page.locator('.app');
    await expect(app).toBeVisible();
  });

  test('should have accessible elements', async ({ page }) => {
    // Check that buttons have visible text or aria-labels
    const themeToggle = page.locator('.theme-toggle-btn');
    const title = await themeToggle.getAttribute('title');
    expect(title).toBeTruthy();
  });

  test('should display app container', async ({ page }) => {
    const appContainer = page.locator('.app-container');
    await expect(appContainer).toBeVisible();
  });

  test('page should have proper document title', async ({ page }) => {
    // Check the page has loaded properly
    const title = await page.title();
    expect(title).toBeTruthy();
  });
});
