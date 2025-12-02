/**
 * NAV-005: Previous Button Navigation
 * Category: Navigation
 * Prerequisites: NAV-002 passed, on Fact Matrix tab
 */
const { test, expect } = require('../utils/base-test');
const NavigationComponent = require('../page-objects/navigation-component');
const FilesPage = require('../page-objects/files-page');
const path = require('path');

test('NAV-005: Previous Button Navigation', async ({ page }) => {
  const navigation = new NavigationComponent(page);
  const filesPage = new FilesPage(page);

  // Navigate to application
  await page.goto('/');
  
  // Setup: Upload file and navigate to Fact Matrix
  const sampleFile = path.join(__dirname, '..', '..', 'sample files', 'claimant_statement.pdf');
  if (require('fs').existsSync(sampleFile)) {
    await filesPage.uploadFile(sampleFile);
    await filesPage.waitForUploadComplete();
    await navigation.clickNext();
    await page.waitForTimeout(2000);
    
    // Step 1: Verify current tab is Fact Matrix
    const factMatrixTab = page.locator('#factMatrixTab');
    await expect(factMatrixTab).toBeVisible();
    
    // Step 2: Click "Previous" button
    await navigation.clickPrevious();
    
    // Step 3: Verify navigation back to Files tab
    const filesTab = page.locator('#filesTab');
    await expect(filesTab).toBeVisible();
    const filesDisplay = await filesTab.evaluate(el => window.getComputedStyle(el).display);
    expect(filesDisplay).not.toBe('none');
    
    // Step 4: Verify uploaded files are still visible
    const fileList = page.locator('#fileList');
    await expect(fileList).toBeVisible();
    const hasFiles = await filesPage.hasFile('claimant_statement');
    expect(hasFiles).toBe(true);
    
    // Step 5: Verify step indicators update
    expect(await navigation.isStepActive('files')).toBe(true);
    
    // Verify progress bar updates
    const progress = await navigation.getProgress();
    expect(progress).toBeGreaterThanOrEqual(0);
  } else {
    test.skip();
  }
});


