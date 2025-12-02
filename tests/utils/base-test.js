/**
 * Base test class with common setup/teardown methods
 */
const playwright = require('@playwright/test');
const { test: base, expect } = playwright;

/**
 * Extended test with custom fixtures
 */
exports.test = base.extend({
  // Custom fixture for page with automatic cleanup
  page: async ({ page }, use) => {
    // Setup: Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await use(page);
    
    // Teardown: Cleanup after test
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  },
});

exports.expect = expect;

/**
 * Wait for API call to complete
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} urlPattern - URL pattern to wait for
 * @param {number} timeout - Timeout in milliseconds (default: 60000)
 */
exports.waitForAPI = async (page, urlPattern, timeout = 60000) => {
  await page.waitForResponse(
    response => response.url().includes(urlPattern) && response.status() === 200,
    { timeout }
  );
};

/**
 * Wait for element to be visible with explicit wait
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 */
exports.waitForElement = async (page, selector, timeout = 30000) => {
  await page.waitForSelector(selector, { state: 'visible', timeout });
};

/**
 * Capture screenshot on failure
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} testName - Name of the test
 */
exports.captureScreenshot = async (page, testName) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ 
    path: `tests/reports/screenshots/${testName}-${timestamp}.png`,
    fullPage: true 
  });
};

/**
 * Log test step
 * @param {string} step - Step description
 */
exports.logStep = (step) => {
  console.log(`[STEP] ${step}`);
};

/**
 * Wait for loading indicator to disappear
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
exports.waitForLoadingComplete = async (page) => {
  // Wait for any loading spinners to disappear
  await page.waitForSelector('.spinner', { state: 'hidden', timeout: 60000 }).catch(() => {});
  await page.waitForSelector('.tab-loading', { state: 'hidden', timeout: 60000 }).catch(() => {});
  await page.waitForSelector('#loading', { state: 'hidden', timeout: 60000 }).catch(() => {});
  
  // Wait for page to be idle
  await page.waitForLoadState('networkidle');
};

