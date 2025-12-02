/**
 * Timeline Page Object Model
 */
const BasePage = require('./base-page');

class TimelinePage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      timelineEventsContainer: '#timelineEventsContainer',
      timelineEventsList: '#timelineEventsList',
      timelineEvent: '#timelineEventsList li',
      saveTimelineButton: '#saveTimelineButton',
      timelineLoading: '#timelineLoading',
      timelineEmptyState: '#timelineEmptyState',
    };
  }

  /**
   * Generate timeline
   */
  async generateTimeline() {
    // This would trigger timeline generation - implementation depends on UI
    await this.waitForLoadingComplete();
  }

  /**
   * Save timeline
   */
  async saveTimeline() {
    const button = this.page.locator(this.selectors.saveTimelineButton);
    if (await button.isVisible()) {
      await button.click();
      await this.waitForLoadingComplete();
    }
  }

  /**
   * Get number of timeline events
   * @returns {Promise<number>} Number of events
   */
  async getEventCount() {
    const events = await this.page.locator(this.selectors.timelineEvent).count();
    return events;
  }

  /**
   * Check if timeline is empty
   * @returns {Promise<boolean>} True if empty
   */
  async isEmpty() {
    return await this.isVisible(this.selectors.timelineEmptyState);
  }

  /**
   * Get timeline events as array
   * @returns {Promise<string[]>} Array of event descriptions
   */
  async getEvents() {
    const events = [];
    const elements = await this.page.locator(this.selectors.timelineEvent).all();
    for (const element of elements) {
      const text = await element.textContent();
      if (text) events.push(text.trim());
    }
    return events;
  }
}

module.exports = TimelinePage;


