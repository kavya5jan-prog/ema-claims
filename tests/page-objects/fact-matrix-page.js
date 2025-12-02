/**
 * Fact Matrix Page Object Model
 */
const BasePage = require('./base-page');

class FactMatrixPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      factTable: '#factTable',
      factTableBody: '#factTableBody',
      factRow: '#factTableBody tr',
      categoryFilter: '#categoryFilter',
      sourceFilter: '#sourceFilter',
      searchFilter: '#searchFilter',
      sortBy: '#sortBy',
      conflictModal: '#conflictModal',
      conflictModalBody: '#conflictModalBody',
      closeConflictModal: '.modal-close',
      acceptedDecisionsSection: '#acceptedDecisionsSection',
      acceptedDecisionsTable: '#acceptedDecisionsTable',
      factMatrixLoading: '#factMatrixLoading',
      extractFactsButton: 'button:has-text("Extract Facts")',
      analyzeSignalsButton: 'button:has-text("Analyze Liability Signals")',
    };
  }

  /**
   * Extract facts from uploaded files
   */
  async extractFacts() {
    const button = this.page.locator(this.selectors.extractFactsButton).first();
    if (await button.isVisible()) {
      await button.click();
      await this.waitForLoadingComplete();
    }
  }

  /**
   * Analyze liability signals
   */
  async analyzeLiabilitySignals() {
    const button = this.page.locator(this.selectors.analyzeSignalsButton).first();
    if (await button.isVisible()) {
      await button.click();
      await this.waitForLoadingComplete();
    }
  }

  /**
   * Get number of facts in the table
   * @returns {Promise<number>} Number of facts
   */
  async getFactCount() {
    const rows = await this.page.locator(this.selectors.factRow).count();
    return rows;
  }

  /**
   * Filter facts by category
   * @param {string} category - Category to filter by
   */
  async filterByCategory(category) {
    await this.page.selectOption(this.selectors.categoryFilter, category);
    await this.page.waitForTimeout(500); // Wait for filter to apply
  }

  /**
   * Filter facts by source
   * @param {string} source - Source to filter by
   */
  async filterBySource(source) {
    await this.page.selectOption(this.selectors.sourceFilter, source);
    await this.page.waitForTimeout(500);
  }

  /**
   * Search facts
   * @param {string} searchTerm - Search term
   */
  async searchFacts(searchTerm) {
    await this.fill(this.selectors.searchFilter, searchTerm);
    await this.page.waitForTimeout(500);
  }

  /**
   * Sort facts
   * @param {string} sortOption - Sort option (confidence, category, source)
   */
  async sortFacts(sortOption) {
    await this.page.selectOption(this.selectors.sortBy, sortOption);
    await this.page.waitForTimeout(500);
  }

  /**
   * Check if conflict modal is visible
   * @returns {Promise<boolean>} True if visible
   */
  async isConflictModalVisible() {
    return await this.isVisible(this.selectors.conflictModal);
  }

  /**
   * Close conflict modal
   */
  async closeConflictModal() {
    await this.click(this.selectors.closeConflictModal);
    await this.page.waitForSelector(this.selectors.conflictModal, { state: 'hidden' });
  }

  /**
   * Resolve conflict (selects first option)
   */
  async resolveConflict() {
    // This would need to be implemented based on actual conflict modal structure
    const firstOption = this.page.locator('input[type="radio"]').first();
    await firstOption.click();
    const submitButton = this.page.locator('button:has-text("Resolve")').first();
    await submitButton.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Check if accepted decisions section is visible
   * @returns {Promise<boolean>} True if visible
   */
  async hasAcceptedDecisions() {
    return await this.isVisible(this.selectors.acceptedDecisionsSection);
  }
}

module.exports = FactMatrixPage;


