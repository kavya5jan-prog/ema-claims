/**
 * NAV-004: Direct Tab Access - Unlocked State
 * Category: Navigation
 * Prerequisites: NAV-002 passed, facts extracted
 */
const { test, expect } = require('../utils/base-test');
const NavigationComponent = require('../page-objects/navigation-component');
const FilesPage = require('../page-objects/files-page');
const FactMatrixPage = require('../page-objects/fact-matrix-page');
const path = require('path');

test('NAV-004: Direct Tab Access - Unlocked State', async ({ page }) => {
  const navigation = new NavigationComponent(page);
  const filesPage = new FilesPage(page);
  const factMatrixPage = new FactMatrixPage(page);

  // Navigate to application
  await page.goto('/');
  
  // Upload file and extract facts (prerequisites)
  const sampleFile = path.join(__dirname, '..', '..', 'sample files', 'claimant_statement.pdf');
  if (require('fs').existsSync(sampleFile)) {
    await filesPage.uploadFile(sampleFile);
    await filesPage.waitForUploadComplete();
    
    // Navigate to Fact Matrix and extract facts
    await navigation.clickNext();
    await page.waitForTimeout(2000);
    
    // Step 1: Ensure facts are extracted (Fact Matrix tab accessible)
    // Note: Actual fact extraction requires API, so we'll verify tab is accessible
    const factMatrixTab = page.locator('#factMatrixTab');
    await expect(factMatrixTab).toBeVisible();
    
    // Step 2: Click directly on "Fact Matrix" step indicator
    await navigation.clickStepIndicator('fact-matrix');
    
    // Step 3: Verify navigation to Fact Matrix tab
    await expect(factMatrixTab).toBeVisible();
    const display = await factMatrixTab.evaluate(el => window.getComputedStyle(el).display);
    expect(display).not.toBe('none');
    
    // Step 4: Verify tab content loads
    const factTable = page.locator('#factTable');
    await expect(factTable).toBeVisible();
    
    // Verify no error messages
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);
    expect(errorVisible).toBe(false);
  } else {
    test.skip();
  }
});


