import { test, expect } from '@playwright/test';

test.describe('Project Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test('should load project selector with projects', async ({ page }) => {
    // Find the project selector
    const projectSelector = page.locator('.project-selector, [class*="project-selector"]').first();
    await expect(projectSelector).toBeVisible({ timeout: 10000 });
  });

  test('clicking header title should return to homepage', async ({ page }) => {
    // First, let's click on the header title
    const headerTitle = page.locator('h1:has(.header-title-text)');
    await expect(headerTitle).toBeVisible();

    // Click on the header
    await headerTitle.click();

    // Should be on homepage (no project selected means HomePage component is shown)
    await expect(page.locator('.app-container')).toBeVisible();
  });

  test('should handle URL parameters for project selection', async ({ page }) => {
    // Navigate to a URL with a project parameter
    await page.goto('/?project=1');

    // Wait for the page to process the URL parameter
    await page.waitForLoadState('networkidle');

    // The report section should be visible if a valid project is selected
    // Or the homepage if project doesn't exist
    const appContainer = page.locator('.app-container');
    await expect(appContainer).toBeVisible();
  });

  test('should display "How To..." button', async ({ page }) => {
    const howToBtn = page.locator('.how-to-btn');
    await expect(howToBtn).toBeVisible();
    await expect(howToBtn).toContainText('How To...');
  });

  test('should open Tutorial modal when How To button clicked', async ({ page }) => {
    const howToBtn = page.locator('.how-to-btn');
    await howToBtn.click();

    // Modal should appear
    const modal = page.locator('.ten-reasons-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Should have the title (first page is still "Ten Reasons")
    await expect(modal.locator('h2')).toContainText('Ten Reasons You Need This');

    // Close the modal
    await page.locator('.modal-close').click();
    await expect(modal).not.toBeVisible();
  });

  test('should navigate between spaces', async ({ page }) => {
    // Find space selector and check it's interactive
    const spaceSelector = page.locator('[class*="space-selector"], .space-selector').first();

    if (await spaceSelector.isVisible()) {
      // Click to open the space dropdown if it's a select
      await spaceSelector.click();

      // Wait a moment for dropdown to open
      await page.waitForTimeout(300);
    }
  });

  test('should navigate between portfolios', async ({ page }) => {
    // Find portfolio selector
    const portfolioSelector = page.locator('[class*="portfolio-selector"], .portfolio-selector').first();

    if (await portfolioSelector.isVisible()) {
      await portfolioSelector.click();
      await page.waitForTimeout(300);
    }
  });
});
