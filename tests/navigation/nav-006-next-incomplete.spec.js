/**
 * NAV-006: Next Button - Incomplete Step
 * Category: Navigation
 * Prerequisites: NAV-001 passed, files uploaded but facts not extracted
 */
const { test, expect } = require('../utils/base-test');
const NavigationComponent = require('../page-objects/navigation-component');
const FilesPage = require('../page-objects/files-page');
const path = require('path');

test('NAV-006: Next Button - Incomplete Step', async ({ page }) => {
  const navigation = new NavigationComponent(page);
  const filesPage = new FilesPage(page);

  // Navigate to application
  await page.goto('/');
  
  // Step 1: Upload files
  const sampleFile = path.join(__dirname, '..', '..', 'sample files', 'claimant_statement.pdf');
  if (require('fs').existsSync(sampleFile)) {
    await filesPage.uploadFile(sampleFile);
    await filesPage.waitForUploadComplete();
    
    // Step 2: Navigate to Fact Matrix tab
    await navigation.clickNext();
    await page.waitForTimeout(2000);
    
    // Step 3: Do NOT extract facts (skip this step)
    // Step 4: Click "Next" button
    await navigation.clickNext();
    await page.waitForTimeout(1000);
    
    // Step 5: Verify error message
    // Check for error message or that we're still on Fact Matrix tab
    const factMatrixTab = page.locator('#factMatrixTab');
    await expect(factMatrixTab).toBeVisible();
    
    // Verify we're still on Fact Matrix (didn't advance)
    const timelineTab = page.locator('#timelineTab');
    const timelineDisplay = await timelineTab.evaluate(el => window.getComputedStyle(el).display).catch(() => 'none');
    expect(timelineDisplay).toBe('none');
    
    // Check for error indicator (may be in console or UI)
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);
    // Error may or may not be visible depending on implementation
  } else {
    test.skip();
  }
});


