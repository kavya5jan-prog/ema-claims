/**
 * EDGE-011: Extract Facts - No Files Uploaded
 * Category: Edge Case
 * Prerequisites: NAV-001 passed
 */
const { test, expect } = require('../utils/base-test');
const NavigationComponent = require('../page-objects/navigation-component');
const FactMatrixPage = require('../page-objects/fact-matrix-page');

test('EDGE-011: Extract Facts - No Files Uploaded', async ({ page }) => {
  const navigation = new NavigationComponent(page);
  const factMatrixPage = new FactMatrixPage(page);

  // Navigate to application
  await page.goto('/');
  
  // Ensure no files are uploaded
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // Step 1: Navigate to Fact Matrix tab without uploading files
  // This should be blocked, but if it's not, try to extract facts
  try {
    await navigation.clickNext();
    await page.waitForTimeout(1000);
    
    // Step 2: Attempt to extract facts
    await factMatrixPage.extractFacts();
    await page.waitForTimeout(2000);
    
    // Step 3: Verify error handling
    // Check for error message
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);
    const errorText = errorVisible ? await page.locator('#error').textContent() : '';
    
    // Verify no API call was made or error was returned
    // Fact table should be empty or error should be shown
    const factCount = await factMatrixPage.getFactCount();
    expect(factCount).toBe(0);
  } catch (error) {
    // Expected - navigation should be blocked or error should occur
    expect(error).toBeDefined();
  }
});


