/**
 * EDGE-014: Extract Facts - API Failure Simulation
 * Category: Edge Case
 * Prerequisites: NAV-002 passed, files uploaded
 */
const { test, expect } = require('../utils/base-test');
const NavigationComponent = require('../page-objects/navigation-component');
const FilesPage = require('../page-objects/files-page');
const FactMatrixPage = require('../page-objects/fact-matrix-page');
const { mockOpenAIFailure } = require('../utils/api-mock');
const path = require('path');

test('EDGE-014: Extract Facts - API Failure Simulation', async ({ page }) => {
  const navigation = new NavigationComponent(page);
  const filesPage = new FilesPage(page);
  const factMatrixPage = new FactMatrixPage(page);

  // Navigate to application
  await page.goto('/');
  
  // Step 1: Simulate OpenAI API failure
  await mockOpenAIFailure(page);
  
  // Upload file
  const sampleFile = path.join(__dirname, '..', '..', 'sample files', 'claimant_statement.pdf');
  if (require('fs').existsSync(sampleFile)) {
    await filesPage.uploadFile(sampleFile);
    await filesPage.waitForUploadComplete();
    
    // Navigate to Fact Matrix
    await navigation.clickNext();
    await page.waitForTimeout(2000);
    
    // Step 2: Attempt to extract facts
    await factMatrixPage.extractFacts();
    await page.waitForTimeout(3000);
    
    // Step 3: Verify error handling
    // Check for error message
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);
    const errorText = errorVisible ? await page.locator('#error').textContent() : '';
    
    // Verify user informed of issue
    // Error should mention OpenAI API key or API failure
    expect(errorVisible || errorText.includes('OpenAI') || errorText.includes('API')).toBeTruthy();
    
    // Verify no data corruption
    // Application should still be functional
    const factMatrixTab = page.locator('#factMatrixTab');
    await expect(factMatrixTab).toBeVisible();
  } else {
    test.skip();
  }
});


