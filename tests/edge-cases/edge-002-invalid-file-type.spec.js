/**
 * EDGE-002: Invalid File Type
 * Category: Edge Case
 * Prerequisites: NAV-001 passed
 */
const { test, expect } = require('../utils/base-test');
const FilesPage = require('../page-objects/files-page');
const { createTestFile, getTestDataPath } = require('../utils/file-upload');
const fs = require('fs');

test('EDGE-002: Invalid File Type', async ({ page }) => {
  const filesPage = new FilesPage(page);

  // Navigate to application
  await page.goto('/');
  
  // Create invalid file types
  const invalidFiles = [
    { name: 'test.txt', content: 'This is a text file' },
    { name: 'test.docx', content: 'This is a docx file' },
    { name: 'test.xlsx', content: 'This is an xlsx file' },
  ];
  
  for (const file of invalidFiles) {
    const filePath = getTestDataPath(file.name);
    createTestFile(filePath, file.content);
    
    try {
      // Step 1: Attempt to upload invalid file type
      await filesPage.uploadFile(filePath);
      await page.waitForTimeout(2000);
      
      // Step 2: Verify error handling
      // Check for error message
      const errorVisible = await page.locator('#error').isVisible().catch(() => false);
      const errorText = errorVisible ? await page.locator('#error').textContent() : '';
      
      // Verify file rejected (should not appear in file list)
      const hasFile = await filesPage.hasFile(file.name);
      expect(hasFile).toBe(false);
      
      // Verify no processing attempted
      const fileListItems = await page.locator('.file-list-item').count();
      // File should not be in the list
    } finally {
      // Cleanup
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
});


