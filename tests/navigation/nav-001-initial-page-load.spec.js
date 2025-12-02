/**
 * NAV-001: Initial Page Load
 * Category: Navigation
 * Prerequisites: None
 */
const { test, expect } = require('../utils/base-test');
const NavigationComponent = require('../page-objects/navigation-component');

test('NAV-001: Initial Page Load', async ({ page }) => {
  const navigation = new NavigationComponent(page);

  // Step 1: Navigate to application root URL
  await page.goto('/');
  
  // Step 2: Verify page loads successfully
  await expect(page).toHaveTitle(/File Content Extractor|AVA/);
  
  // Step 3: Check all step indicators are visible
  await expect(page.locator('[data-step="files"]')).toBeVisible();
  await expect(page.locator('[data-step="fact-matrix"]')).toBeVisible();
  await expect(page.locator('[data-step="timeline"]')).toBeVisible();
  await expect(page.locator('[data-step="liability-recommendation"]')).toBeVisible();
  await expect(page.locator('[data-step="claim-rationale"]')).toBeVisible();
  
  // Step 4: Verify Files tab is active by default
  const filesTab = page.locator('#filesTab');
  await expect(filesTab).toBeVisible();
  const filesDisplay = await filesTab.evaluate(el => window.getComputedStyle(el).display);
  expect(filesDisplay).not.toBe('none');
  
  // Step 5: Verify all other tabs are locked (except Files)
  expect(await navigation.isStepLocked('fact-matrix')).toBe(true);
  expect(await navigation.isStepLocked('timeline')).toBe(true);
  expect(await navigation.isStepLocked('liability-recommendation')).toBe(true);
  expect(await navigation.isStepLocked('claim-rationale')).toBe(true);
  
  // Step 6: Verify Previous button is disabled
  expect(await navigation.isPreviousButtonEnabled()).toBe(false);
  
  // Step 7: Verify Next button is enabled
  expect(await navigation.isNextButtonEnabled()).toBe(true);
  
  // Verify progress bar shows 0% completion
  const progress = await navigation.getProgress();
  expect(progress).toBe(0);
  
  // Verify no console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  await page.waitForTimeout(1000);
  expect(errors.length).toBe(0);
});


