import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the Progress Tracker header', async ({ page }) => {
    await expect(page.locator('.header-title-text')).toContainText('Progress Tracker');
  });

  test('should show login button when not authenticated', async ({ page }) => {
    // Look for login-related elements
    const loginButton = page.locator('button:has-text("Login"), .login-btn, [class*="login"]').first();
    await expect(loginButton).toBeVisible({ timeout: 10000 });
  });

  test('should display homepage dashboard when no project selected', async ({ page }) => {
    // When no project is selected, the HomePage component should be visible
    await expect(page.locator('.app-container')).toBeVisible();
  });

  test('should have working space selector or show all spaces by default', async ({ page }) => {
    // Space selector uses portfolio-selector class with data-testid
    // It may not be visible if no spaces are configured (returns null)
    const spaceSelector = page.locator('[data-testid="space-selector-main"]');
    const portfolioSelector = page.locator('.portfolio-selector').first();

    // Either space selector is visible, or at minimum the portfolio selector should be
    const spaceVisible = await spaceSelector.isVisible().catch(() => false);
    const portfolioVisible = await portfolioSelector.isVisible().catch(() => false);

    expect(spaceVisible || portfolioVisible).toBe(true);
  });

  test('should have working portfolio selector', async ({ page }) => {
    // Check that portfolio selector exists
    const portfolioSelector = page.locator('.portfolio-selector, [class*="portfolio"]').first();
    await expect(portfolioSelector).toBeVisible({ timeout: 10000 });
  });

  test('should have working project selector', async ({ page }) => {
    // Check that project selector exists
    const projectSelector = page.locator('.project-selector, [class*="project-selector"]').first();
    await expect(projectSelector).toBeVisible({ timeout: 10000 });
  });

  test('should toggle dark mode', async ({ page }) => {
    const themeToggle = page.locator('.theme-toggle-btn');
    await expect(themeToggle).toBeVisible();

    // Click to toggle dark mode
    await themeToggle.click();

    // Check that dark mode class is applied
    await expect(page.locator('html')).toHaveClass(/dark-mode/);

    // Click again to toggle back
    await themeToggle.click();

    // Check that dark mode class is removed
    await expect(page.locator('html')).not.toHaveClass(/dark-mode/);
  });
});
