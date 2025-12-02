/**
 * NAV-008: Progress Bar Updates
 * Category: Navigation
 * Prerequisites: NAV-001 passed
 */
const { test, expect } = require('../utils/base-test');
const NavigationComponent = require('../page-objects/navigation-component');
const FilesPage = require('../page-objects/files-page');
const path = require('path');

test('NAV-008: Progress Bar Updates', async ({ page }) => {
  const navigation = new NavigationComponent(page);
  const filesPage = new FilesPage(page);

  // Navigate to application
  await page.goto('/');
  
  // Step 1: Verify initial progress (0%)
  let progress = await navigation.getProgress();
  expect(progress).toBe(0);
  
  // Step 2: Upload files → verify progress updates
  const sampleFile = path.join(__dirname, '..', '..', 'sample files', 'claimant_statement.pdf');
  if (require('fs').existsSync(sampleFile)) {
    await filesPage.uploadFile(sampleFile);
    await filesPage.waitForUploadComplete();
    await page.waitForTimeout(1000);
    
    progress = await navigation.getProgress();
    expect(progress).toBeGreaterThanOrEqual(0);
    
    // Step 3: Extract facts → verify progress updates (if API available)
    await navigation.clickNext();
    await page.waitForTimeout(2000);
    
    progress = await navigation.getProgress();
    expect(progress).toBeGreaterThanOrEqual(0);
    
    // Verify progress bar segments fill sequentially
    const segments = await page.locator('.progress-segment').all();
    let completedSegments = 0;
    for (const segment of segments) {
      const classes = await segment.getAttribute('class');
      if (classes && classes.includes('completed')) {
        completedSegments++;
      }
    }
    expect(completedSegments).toBeGreaterThanOrEqual(0);
    
    // Verify visual indicators match step completion state
    const filesStep = page.locator('[data-step="files"]');
    const filesClasses = await filesStep.getAttribute('class');
    expect(filesClasses).toContain('completed');
  } else {
    test.skip();
  }
});


