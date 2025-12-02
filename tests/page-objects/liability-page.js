/**
 * Liability Recommendation Page Object Model
 */
const BasePage = require('./base-page');

class LiabilityPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      claimantLiabilityInput: '#claimantLiabilityPercent',
      otherDriverLiabilityInput: '#otherDriverLiabilityPercent',
      recommendationExplanation: '#recommendationExplanation',
      updateButton: 'button:has-text("Update Recommendation")',
      keyFactorsList: '#keyFactorsList',
      confidenceFill: '#confidenceFill',
      confidenceText: '#confidenceText',
      recommendationForm: '#recommendationForm',
      recommendationEmptyState: '#recommendationEmptyState',
      recommendationLoading: '#liabilityRecommendationLoading',
    };
  }

  /**
   * Get liability recommendation
   */
  async getRecommendation() {
    // This would trigger recommendation generation - implementation depends on UI
    await this.waitForLoadingComplete();
  }

  /**
   * Set claimant liability percentage
   * @param {number} percentage - Percentage (0-100)
   */
  async setClaimantLiability(percentage) {
    await this.fill(this.selectors.claimantLiabilityInput, percentage.toString());
  }

  /**
   * Set other driver liability percentage
   * @param {number} percentage - Percentage (0-100)
   */
  async setOtherDriverLiability(percentage) {
    await this.fill(this.selectors.otherDriverLiabilityInput, percentage.toString());
  }

  /**
   * Get claimant liability percentage
   * @returns {Promise<number>} Percentage
   */
  async getClaimantLiability() {
    const value = await this.page.inputValue(this.selectors.claimantLiabilityInput);
    return parseInt(value) || 0;
  }

  /**
   * Get other driver liability percentage
   * @returns {Promise<number>} Percentage
   */
  async getOtherDriverLiability() {
    const value = await this.page.inputValue(this.selectors.otherDriverLiabilityInput);
    return parseInt(value) || 0;
  }

  /**
   * Update recommendation
   */
  async updateRecommendation() {
    await this.click(this.selectors.updateButton);
    await this.waitForLoadingComplete();
  }

  /**
   * Get confidence percentage
   * @returns {Promise<number>} Confidence percentage
   */
  async getConfidence() {
    const text = await this.getText(this.selectors.confidenceText);
    const match = text.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Get key factors
   * @returns {Promise<string[]>} Array of key factors
   */
  async getKeyFactors() {
    const factors = [];
    const elements = await this.page.locator(`${this.selectors.keyFactorsList} li`).all();
    for (const element of elements) {
      const text = await element.textContent();
      if (text) factors.push(text.trim());
    }
    return factors;
  }

  /**
   * Check if recommendation form is visible
   * @returns {Promise<boolean>} True if visible
   */
  async isRecommendationVisible() {
    return await this.isVisible(this.selectors.recommendationForm);
  }

  /**
   * Check if empty state is visible
   * @returns {Promise<boolean>} True if visible
   */
  async isEmpty() {
    return await this.isVisible(this.selectors.recommendationEmptyState);
  }
}

module.exports = LiabilityPage;


