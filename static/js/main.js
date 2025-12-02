/**
 * Main entry point for the application.
 */
import { renderFileList } from './ui/fileList.js';
import { updateStep2Access, updateStepIndicators, updateProgress, updateNavigationButtons } from './ui/navigation.js';
import { loadTimeline } from './ui/timeline.js';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    renderFileList();
    updateStep2Access();
    updateStepIndicators();
    updateProgress();
    updateNavigationButtons();
    loadTimeline();
});

// Logout handler
function handleLogout() {
    window.location.href = '/logout';
}

// Make handleLogout available globally
window.handleLogout = handleLogout;

// Export functions that might be called from HTML
export { renderFileList, updateStep2Access };


