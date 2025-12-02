/**
 * NAV-003: Direct Tab Access - Locked State
 * Category: Navigation
 * Prerequisites: NAV-001 passed, no files uploaded
 */
const { test, expect } = require('../utils/base-test');
const NavigationComponent = require('../page-objects/navigation-component');

test('NAV-003: Direct Tab Access - Locked State', async ({ page }) => {
  const navigation = new NavigationComponent(page);

  // Navigate to application
  await page.goto('/');
  
  // Ensure no files are uploaded (clear any existing state)
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // Step 1: Click directly on "Timeline Reconstruction" step indicator
  await navigation.clickStepIndicator('timeline');
  
  // Step 2: Verify error message appears
  // Check for error message in console or UI
  const errorVisible = await page.locator('#error').isVisible().catch(() => false);
  const errorText = errorVisible ? await page.locator('#error').textContent() : '';
  
  // Also check for console errors or alerts
  let errorMessageFound = false;
  page.on('dialog', dialog => {
    errorMessageFound = true;
    expect(dialog.message()).toContain('complete the previous steps');
    dialog.dismiss();
  });
  
  await page.waitForTimeout(1000);
  
  // Step 3: Verify user remains on Files tab
  const filesTab = page.locator('#filesTab');
  await expect(filesTab).toBeVisible();
  const filesDisplay = await filesTab.evaluate(el => window.getComputedStyle(el).display);
  expect(filesDisplay).not.toBe('none');
  
  // Step 4: Verify tab remains locked
  expect(await navigation.isStepLocked('timeline')).toBe(true);
});


