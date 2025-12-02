/**
 * Modal Component Page Object Model
 */
const BasePage = require('./base-page');

class ModalComponent extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      conflictModal: '#conflictModal',
      escalationModal: '#supervisorEscalationModal',
      modalClose: '.modal-close',
      modalContent: '.modal-content',
      modalHeader: '.modal-header',
      modalBody: '.modal-body',
    };
  }

  /**
   * Check if modal is visible
   * @param {string} modalId - Modal ID (conflictModal, escalationModal)
   * @returns {Promise<boolean>} True if visible
   */
  async isModalVisible(modalId) {
    const selector = this.selectors[modalId] || `#${modalId}`;
    const element = this.page.locator(selector);
    const display = await element.evaluate(el => window.getComputedStyle(el).display);
    return display !== 'none';
  }

  /**
   * Close modal
   * @param {string} modalId - Modal ID
   */
  async closeModal(modalId) {
    const selector = this.selectors[modalId] || `#${modalId}`;
    const closeButton = this.page.locator(`${selector} ${this.selectors.modalClose}`);
    if (await closeButton.isVisible()) {
      await closeButton.click();
      await this.page.waitForSelector(selector, { state: 'hidden' });
    }
  }

  /**
   * Get modal content
   * @param {string} modalId - Modal ID
   * @returns {Promise<string>} Modal content text
   */
  async getModalContent(modalId) {
    const selector = this.selectors[modalId] || `#${modalId}`;
    const body = this.page.locator(`${selector} ${this.selectors.modalBody}`);
    if (await body.isVisible()) {
      return await body.textContent();
    }
    return '';
  }

  /**
   * Click button in modal
   * @param {string} modalId - Modal ID
   * @param {string} buttonText - Button text
   */
  async clickModalButton(modalId, buttonText) {
    const selector = this.selectors[modalId] || `#${modalId}`;
    const button = this.page.locator(`${selector} button:has-text("${buttonText}")`);
    await button.click();
  }
}

module.exports = ModalComponent;


