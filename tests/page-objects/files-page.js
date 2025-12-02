/**
 * Files Page Object Model
 */
const BasePage = require('./base-page');

class FilesPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      uploadButton: '#bigUploadButton',
      fileInput: '#bulkFileInput',
      fileList: '#fileList',
      fileListItem: '.file-list-item',
      fileContentView: '#fileContentView',
      backButton: '.back-button',
      evidenceCompletenessSection: '#evidenceCompletenessSection',
      bulkUploadProgress: '#bulkUploadProgress',
    };
  }

  /**
   * Click upload button
   */
  async clickUploadButton() {
    await this.click(this.selectors.uploadButton);
  }

  /**
   * Upload file(s)
   * @param {string|string[]} filePath - Path to file or array of paths
   */
  async uploadFile(filePath) {
    const fileInput = this.page.locator(this.selectors.fileInput);
    if (Array.isArray(filePath)) {
      await fileInput.setInputFiles(filePath);
    } else {
      await fileInput.setInputFiles(filePath);
    }
    
    // Wait for upload to complete
    await this.page.waitForSelector(this.selectors.fileListItem, { timeout: 60000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get list of uploaded files
   * @returns {Promise<string[]>} Array of file names
   */
  async getUploadedFiles() {
    const items = await this.page.locator(this.selectors.fileListItem).all();
    const files = [];
    for (const item of items) {
      const text = await item.textContent();
      if (text) files.push(text.trim());
    }
    return files;
  }

  /**
   * Check if file is in the list
   * @param {string} filename - File name to check
   * @returns {Promise<boolean>} True if file exists
   */
  async hasFile(filename) {
    const files = await this.getUploadedFiles();
    return files.some(f => f.includes(filename));
  }

  /**
   * Click on a file to view its content
   * @param {string} filename - File name
   */
  async viewFile(filename) {
    const fileItem = this.page.locator(this.selectors.fileListItem).filter({ hasText: filename }).first();
    await fileItem.click();
    await this.waitForElement(this.selectors.fileContentView);
  }

  /**
   * Go back to file list
   */
  async backToFileList() {
    await this.click(this.selectors.backButton);
    await this.waitForElement(this.selectors.fileList);
  }

  /**
   * Check if evidence completeness section is visible
   * @returns {Promise<boolean>} True if visible
   */
  async isEvidenceCompletenessVisible() {
    return await this.isVisible(this.selectors.evidenceCompletenessSection);
  }

  /**
   * Wait for upload progress to complete
   */
  async waitForUploadComplete() {
    await this.page.waitForSelector(this.selectors.bulkUploadProgress, { 
      state: 'hidden', 
      timeout: 120000 
    }).catch(() => {});
  }
}

module.exports = FilesPage;


