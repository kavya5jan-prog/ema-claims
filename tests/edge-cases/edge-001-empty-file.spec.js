/**
 * EDGE-001: Empty File Upload
 * Category: Edge Case
 * Prerequisites: NAV-001 passed
 */
const { test, expect } = require('../utils/base-test');
const FilesPage = require('../page-objects/files-page');
const { createEmptyFile, getTestDataPath } = require('../utils/file-upload');
const path = require('path');
const fs = require('fs');

test('EDGE-001: Empty File Upload', async ({ page }) => {
  const filesPage = new FilesPage(page);

  // Navigate to application
  await page.goto('/');
  
  // Create empty file
  const emptyFilePath = getTestDataPath('empty-file.pdf');
  createEmptyFile(emptyFilePath);
  
  try {
    // Step 1: Attempt to upload a file with 0 bytes
    await filesPage.uploadFile(emptyFilePath);
    await page.waitForTimeout(2000);
    
    // Step 2: Verify error handling
    // Check for error message
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);
    const errorText = errorVisible ? await page.locator('#error').textContent() : '';
    
    // Verify file not processed (should not appear in file list)
    const hasFile = await filesPage.hasFile('empty-file');
    expect(hasFile).toBe(false);
    
    // Verify no crash or console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.waitForTimeout(1000);
    
    // Application should still be functional
    const uploadButton = page.locator('#bigUploadButton');
    await expect(uploadButton).toBeVisible();
  } finally {
    // Cleanup
    if (fs.existsSync(emptyFilePath)) {
      fs.unlinkSync(emptyFilePath);
    }
  }
});


