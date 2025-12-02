/**
 * Navigation Component Page Object Model
 */
const BasePage = require('./base-page');

class NavigationComponent extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      stepIndicator: (stepId) => `[data-step="${stepId}"]`,
      prevButton: '#prevButton',
      nextButton: '#nextButton',
      progressBar: '#segmentedProgressBar',
      progressSegment: '.progress-segment',
      filesTab: '#filesTab',
      factMatrixTab: '#factMatrixTab',
      timelineTab: '#timelineTab',
      liabilityTab: '#liabilityRecommendationTab',
      rationaleTab: '#claimRationaleTab',
    };
  }

  /**
   * Click on step indicator
   * @param {string} stepId - Step ID (files, fact-matrix, timeline, etc.)
   */
  async clickStepIndicator(stepId) {
    await this.click(this.selectors.stepIndicator(stepId));
    await this.page.waitForTimeout(500);
  }

  /**
   * Click previous button
   */
  async clickPrevious() {
    await this.click(this.selectors.prevButton);
    await this.page.waitForTimeout(500);
  }

  /**
   * Click next button
   */
  async clickNext() {
    await this.click(this.selectors.nextButton);
    await this.page.waitForTimeout(500);
  }

  /**
   * Check if step is locked
   * @param {string} stepId - Step ID
   * @returns {Promise<boolean>} True if locked
   */
  async isStepLocked(stepId) {
    const stepElement = this.page.locator(this.selectors.stepIndicator(stepId));
    const classes = await stepElement.getAttribute('class');
    return classes ? classes.includes('locked') : false;
  }

  /**
   * Check if step is completed
   * @param {string} stepId - Step ID
   * @returns {Promise<boolean>} True if completed
   */
  async isStepCompleted(stepId) {
    const stepElement = this.page.locator(this.selectors.stepIndicator(stepId));
    const classes = await stepElement.getAttribute('class');
    return classes ? classes.includes('completed') : false;
  }

  /**
   * Check if step is active
   * @param {string} stepId - Step ID
   * @returns {Promise<boolean>} True if active
   */
  async isStepActive(stepId) {
    const stepElement = this.page.locator(this.selectors.stepIndicator(stepId));
    const classes = await stepElement.getAttribute('class');
    return classes ? classes.includes('active') : false;
  }

  /**
   * Check if previous button is enabled
   * @returns {Promise<boolean>} True if enabled
   */
  async isPreviousButtonEnabled() {
    const button = this.page.locator(this.selectors.prevButton);
    return !(await button.isDisabled());
  }

  /**
   * Check if next button is enabled
   * @returns {Promise<boolean>} True if enabled
   */
  async isNextButtonEnabled() {
    const button = this.page.locator(this.selectors.nextButton);
    return !(await button.isDisabled());
  }

  /**
   * Get current active tab
   * @returns {Promise<string|null>} Tab ID or null
   */
  async getActiveTab() {
    const tabs = ['filesTab', 'factMatrixTab', 'timelineTab', 'liabilityTab', 'rationaleTab'];
    for (const tab of tabs) {
      const selector = this.selectors[tab];
      const element = this.page.locator(selector);
      if (await element.isVisible()) {
        const display = await element.evaluate(el => window.getComputedStyle(el).display);
        if (display !== 'none') {
          return tab.replace('Tab', '');
        }
      }
    }
    return null;
  }

  /**
   * Get progress percentage
   * @returns {Promise<number>} Progress percentage (0-100)
   */
  async getProgress() {
    const segments = await this.page.locator(this.selectors.progressSegment).all();
    let completed = 0;
    for (const segment of segments) {
      const classes = await segment.getAttribute('class');
      if (classes && classes.includes('completed')) {
        completed++;
      }
    }
    return (completed / segments.length) * 100;
  }

  /**
   * Navigate to specific tab
   * @param {string} tabName - Tab name (files, fact-matrix, timeline, etc.)
   */
  async navigateToTab(tabName) {
    await this.clickStepIndicator(tabName);
    await this.page.waitForTimeout(1000);
  }
}

module.exports = NavigationComponent;


