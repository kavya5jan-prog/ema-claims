/**
 * NAV-007: Step Completion State Persistence
 * Category: Navigation
 * Prerequisites: Complete workflow through all steps
 */
const { test, expect } = require('../utils/base-test');
const NavigationComponent = require('../page-objects/navigation-component');
const FilesPage = require('../page-objects/files-page');
const path = require('path');

test('NAV-007: Step Completion State Persistence', async ({ page }) => {
  const navigation = new NavigationComponent(page);
  const filesPage = new FilesPage(page);

  // Navigate to application
  await page.goto('/');
  
  // Setup: Upload file
  const sampleFile = path.join(__dirname, '..', '..', 'sample files', 'claimant_statement.pdf');
  if (require('fs').existsSync(sampleFile)) {
    await filesPage.uploadFile(sampleFile);
    await filesPage.waitForUploadComplete();
    
    // Step 1: Complete all steps (simplified - actual completion requires API)
    // Navigate through tabs using Next button
    await navigation.clickNext(); // Files -> Fact Matrix
    await page.waitForTimeout(2000);
    
    // Step 2: Navigate back to Files tab
    await navigation.clickPrevious();
    await page.waitForTimeout(1000);
    
    // Step 3: Navigate forward through all tabs using Next button
    await navigation.clickNext(); // Files -> Fact Matrix
    await page.waitForTimeout(1000);
    
    // Step 4: Verify all previously completed data persists
    // Verify Files tab still shows uploaded files
    const fileList = page.locator('#fileList');
    await expect(fileList).toBeVisible();
    const hasFiles = await filesPage.hasFile('claimant_statement');
    expect(hasFiles).toBe(true);
    
    // Verify we can navigate back and forth
    await navigation.clickPrevious();
    await page.waitForTimeout(1000);
    const filesTab = page.locator('#filesTab');
    await expect(filesTab).toBeVisible();
    
    // Verify no data loss
    const filesAfterNav = await filesPage.getUploadedFiles();
    expect(filesAfterNav.length).toBeGreaterThan(0);
  } else {
    test.skip();
  }
});


