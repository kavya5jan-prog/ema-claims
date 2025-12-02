/**
 * API mocking utilities for failure scenarios
 */

/**
 * Mock API response
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} urlPattern - URL pattern to intercept
 * @param {Object} response - Mock response object
 * @param {number} status - HTTP status code (default: 200)
 */
exports.mockAPIResponse = async (page, urlPattern, response, status = 200) => {
  await page.route(`**/${urlPattern}`, route => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
};

/**
 * Mock API failure (network error)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} urlPattern - URL pattern to intercept
 */
exports.mockAPIFailure = async (page, urlPattern) => {
  await page.route(`**/${urlPattern}`, route => {
    route.abort('failed');
  });
};

/**
 * Mock API timeout (slow response)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} urlPattern - URL pattern to intercept
 * @param {number} delay - Delay in milliseconds (default: 35000)
 */
exports.mockAPITimeout = async (page, urlPattern, delay = 35000) => {
  await page.route(`**/${urlPattern}`, async route => {
    await new Promise(resolve => setTimeout(resolve, delay));
    route.continue();
  });
};

/**
 * Mock malformed JSON response
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} urlPattern - URL pattern to intercept
 */
exports.mockMalformedResponse = async (page, urlPattern) => {
  await page.route(`**/${urlPattern}`, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: 'Invalid JSON {',
    });
  });
};

/**
 * Mock OpenAI API failure
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
exports.mockOpenAIFailure = async (page) => {
  await page.route('**/extract-facts', route => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in your environment.'
      }),
    });
  });
};

/**
 * Restore all mocked routes
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
exports.restoreMocks = async (page) => {
  await page.unroute('**/*');
};


