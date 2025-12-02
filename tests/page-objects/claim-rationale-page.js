/**
 * Claim Rationale Page Object Model
 */
const BasePage = require('./base-page');

class ClaimRationalePage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      rationaleDisplay: '#rationaleDisplay',
      rationaleEdit: '#rationaleEdit',
      editButton: '#editRationaleButton',
      saveButton: '#saveRationaleButton',
      cancelButton: '#cancelEditRationaleButton',
      escalationButton: '#supervisorEscalationButton',
      downloadButton: '#downloadRationaleButton',
      rationaleEmptyState: '#rationaleEmptyState',
      escalationModal: '#supervisorEscalationModal',
      escalationModalBody: '#supervisorEscalationModalBody',
      closeEscalationModal: '.modal-close',
    };
  }

  /**
   * Generate claim rationale
   */
  async generateRationale() {
    // This would trigger rationale generation - implementation depends on UI
    await this.waitForLoadingComplete();
  }

  /**
   * Edit rationale
   */
  async editRationale() {
    await this.click(this.selectors.editButton);
    await this.waitForElement(this.selectors.rationaleEdit);
  }

  /**
   * Save edited rationale
   */
  async saveRationale() {
    await this.click(this.selectors.saveButton);
    await this.waitForLoadingComplete();
  }

  /**
   * Cancel editing rationale
   */
  async cancelEdit() {
    await this.click(this.selectors.cancelButton);
  }

  /**
   * Get rationale text
   * @returns {Promise<string>} Rationale text
   */
  async getRationaleText() {
    const display = this.page.locator(this.selectors.rationaleDisplay);
    if (await display.isVisible()) {
      return await display.textContent();
    }
    return '';
  }

  /**
   * Set rationale text (in edit mode)
   * @param {string} text - Text to set
   */
  async setRationaleText(text) {
    const editArea = this.page.locator(this.selectors.rationaleEdit);
    if (await editArea.isVisible()) {
      await editArea.fill(text);
    }
  }

  /**
   * Open supervisor escalation modal
   */
  async openEscalationModal() {
    await this.click(this.selectors.escalationButton);
    await this.waitForElement(this.selectors.escalationModal);
  }

  /**
   * Close escalation modal
   */
  async closeEscalationModal() {
    await this.click(this.selectors.closeEscalationModal);
    await this.page.waitForSelector(this.selectors.escalationModal, { state: 'hidden' });
  }

  /**
   * Download rationale PDF
   */
  async downloadPDF() {
    await this.click(this.selectors.downloadButton);
    // Wait for download to start
    await this.page.waitForTimeout(2000);
  }

  /**
   * Check if rationale is visible
   * @returns {Promise<boolean>} True if visible
   */
  async isRationaleVisible() {
    return await this.isVisible(this.selectors.rationaleDisplay);
  }

  /**
   * Check if empty state is visible
   * @returns {Promise<boolean>} True if visible
   */
  async isEmpty() {
    return await this.isVisible(this.selectors.rationaleEmptyState);
  }
}

module.exports = ClaimRationalePage;


