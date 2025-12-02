/**
 * File upload helper functions
 */

const path = require('path');
const fs = require('fs');

/**
 * Upload a single file
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} filePath - Path to the file
 */
exports.uploadFile = async (page, filePath) => {
  const fileInput = page.locator('#bulkFileInput');
  await fileInput.setInputFiles(filePath);
  
  // Wait for upload to complete
  await page.waitForSelector('.file-list-item', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1000); // Additional wait for processing
};

/**
 * Upload multiple files
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string[]} filePaths - Array of file paths
 */
exports.uploadMultipleFiles = async (page, filePaths) => {
  const fileInput = page.locator('#bulkFileInput');
  await fileInput.setInputFiles(filePaths);
  
  // Wait for all uploads to complete
  await page.waitForSelector('.file-list-item', { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(2000); // Additional wait for processing
};

/**
 * Create a test file (empty, corrupted, etc.)
 * @param {string} filePath - Path where to create the file
 * @param {Buffer|string} content - File content
 */
exports.createTestFile = (filePath, content = '') => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
};

/**
 * Create an empty file (0 bytes)
 * @param {string} filePath - Path where to create the file
 */
exports.createEmptyFile = (filePath) => {
  exports.createTestFile(filePath, '');
};

/**
 * Create a corrupted PDF file
 * @param {string} filePath - Path where to create the file
 */
exports.createCorruptedPDF = (filePath) => {
  exports.createTestFile(filePath, 'This is not a valid PDF file content');
};

/**
 * Get test data file path
 * @param {string} filename - Name of the test file
 * @returns {string} Full path to the test file
 */
exports.getTestDataPath = (filename) => {
  return path.join(__dirname, '..', 'test-data', filename);
};

/**
 * Check if test file exists
 * @param {string} filename - Name of the test file
 * @returns {boolean} True if file exists
 */
exports.testFileExists = (filename) => {
  const filePath = exports.getTestDataPath(filename);
  return fs.existsSync(filePath);
};


