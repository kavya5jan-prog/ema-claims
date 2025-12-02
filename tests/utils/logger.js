/**
 * Logging utility for test execution
 */

const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'reports', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `test-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

/**
 * Write log entry
 * @param {string} level - Log level (INFO, ERROR, WARN, DEBUG)
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 */
const writeLog = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data,
  };
  
  const logLine = `[${timestamp}] [${level}] ${message} ${Object.keys(data).length > 0 ? JSON.stringify(data) : ''}\n`;
  
  // Write to file
  fs.appendFileSync(logFile, logLine);
  
  // Also log to console
  console.log(`[${level}] ${message}`);
};

/**
 * Log info message
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
exports.info = (message, data = {}) => {
  writeLog('INFO', message, data);
};

/**
 * Log error message
 * @param {string} message - Log message
 * @param {Error} error - Error object
 */
exports.error = (message, error = null) => {
  writeLog('ERROR', message, error ? { error: error.message, stack: error.stack } : {});
};

/**
 * Log warning message
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
exports.warn = (message, data = {}) => {
  writeLog('WARN', message, data);
};

/**
 * Log debug message
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
exports.debug = (message, data = {}) => {
  if (process.env.DEBUG) {
    writeLog('DEBUG', message, data);
  }
};

/**
 * Log test step
 * @param {string} step - Step description
 */
exports.step = (step) => {
  writeLog('STEP', step);
};


