/**
 * NAV-002: Step Progression - Files to Fact Matrix
 * Category: Navigation
 * Prerequisites: NAV-001 passed
 */
const { test, expect } = require('../utils/base-test');
const NavigationComponent = require('../page-objects/navigation-component');
const FilesPage = require('../page-objects/files-page');
const path = require('path');

test('NAV-002: Step Progression - Files to Fact Matrix', async ({ page }) => {
  const navigation = new NavigationComponent(page);
  const filesPage = new FilesPage(page);

  // Navigate to application
  await page.goto('/');
  
  // Step 1: Upload at least one valid file
  const testFile = path.join(__dirname, '..', 'test-data', 'claimant_statement.pdf');
  // If test file doesn't exist, use sample file from project
  const sampleFile = path.join(__dirname, '..', '..', 'sample files', 'claimant_statement.pdf');
  const fileToUpload = require('fs').existsSync(testFile) ? testFile : sampleFile;
  
  if (require('fs').existsSync(fileToUpload)) {
    await filesPage.uploadFile(fileToUpload);
    
    // Step 2: Wait for upload to complete
    await filesPage.waitForUploadComplete();
    
    // Step 3: Click "Next" button
    await navigation.clickNext();
    
    // Step 4: Verify navigation to Fact Matrix tab
    const factMatrixTab = page.locator('#factMatrixTab');
    await expect(factMatrixTab).toBeVisible();
    const display = await factMatrixTab.evaluate(el => window.getComputedStyle(el).display);
    expect(display).not.toBe('none');
    
    // Step 5: Verify Files step indicator shows as completed
    expect(await navigation.isStepCompleted('files')).toBe(true);
    
    // Step 6: Verify Fact Matrix step indicator shows as active
    expect(await navigation.isStepActive('fact-matrix')).toBe(true);
    
    // Step 7: Verify Previous button is enabled
    expect(await navigation.isPreviousButtonEnabled()).toBe(true);
    
    // Step 8: Verify progress bar updates
    const progress = await navigation.getProgress();
    expect(progress).toBeGreaterThan(0);
  } else {
    test.skip();
  }
});


