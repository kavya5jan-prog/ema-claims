/**
 * State management utilities for localStorage and sessionStorage
 */

/**
 * Clear all browser storage
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
exports.clearStorage = async (page) => {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
};

/**
 * Get localStorage value
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} key - Storage key
 * @returns {Promise<string|null>} Storage value
 */
exports.getLocalStorage = async (page, key) => {
  return await page.evaluate((k) => {
    return localStorage.getItem(k);
  }, key);
};

/**
 * Set localStorage value
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} key - Storage key
 * @param {string} value - Storage value
 */
exports.setLocalStorage = async (page, key, value) => {
  await page.evaluate(([k, v]) => {
    localStorage.setItem(k, v);
  }, [key, value]);
};

/**
 * Check if localStorage has key
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} key - Storage key
 * @returns {Promise<boolean>} True if key exists
 */
exports.hasLocalStorageKey = async (page, key) => {
  return await page.evaluate((k) => {
    return localStorage.getItem(k) !== null;
  }, key);
};

/**
 * Get all localStorage keys
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string[]>} Array of keys
 */
exports.getAllLocalStorageKeys = async (page) => {
  return await page.evaluate(() => {
    return Object.keys(localStorage);
  });
};


