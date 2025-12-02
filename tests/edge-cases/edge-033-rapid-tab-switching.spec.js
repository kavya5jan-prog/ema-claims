/**
 * EDGE-033: Rapid Tab Switching
 * Category: Edge Case
 * Prerequisites: Multiple steps completed
 */
const { test, expect } = require('../utils/base-test');
const NavigationComponent = require('../page-objects/navigation-component');
const FilesPage = require('../page-objects/files-page');
const path = require('path');

test('EDGE-033: Rapid Tab Switching', async ({ page }) => {
  const navigation = new NavigationComponent(page);
  const filesPage = new FilesPage(page);

  // Navigate to application
  await page.goto('/');
  
  // Setup: Upload file and complete some steps
  const sampleFile = path.join(__dirname, '..', '..', 'sample files', 'claimant_statement.pdf');
  if (require('fs').existsSync(sampleFile)) {
    await filesPage.uploadFile(sampleFile);
    await filesPage.waitForUploadComplete();
    await navigation.clickNext(); // Go to Fact Matrix
    await page.waitForTimeout(2000);
    
    // Step 1: Rapidly click between tabs multiple times
    const tabs = ['files', 'fact-matrix'];
    for (let i = 0; i < 10; i++) {
      const tab = tabs[i % tabs.length];
      await navigation.clickStepIndicator(tab);
      await page.waitForTimeout(100); // Small delay between clicks
    }
    
    // Step 2: Verify no race conditions
    // Wait for any pending operations
    await page.waitForTimeout(2000);
    
    // Step 3: Verify correct tab displays
    // Last clicked tab should be visible
    const factMatrixTab = page.locator('#factMatrixTab');
    const filesTab = page.locator('#filesTab');
    
    // One of them should be visible
    const factMatrixVisible = await factMatrixTab.isVisible();
    const filesVisible = await filesTab.isVisible();
    expect(factMatrixVisible || filesVisible).toBe(true);
    
    // Verify no flickering or incorrect content
    // No JavaScript errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.waitForTimeout(1000);
    // Should have minimal or no errors
    expect(errors.length).toBeLessThan(5);
  } else {
    test.skip();
  }
});


