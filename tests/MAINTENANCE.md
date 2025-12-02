# Test Maintenance Guide

## Adding New Tests

### 1. Create Test File
Create a new test file in the appropriate directory:
- Navigation tests: `tests/navigation/`
- Edge case tests: `tests/edge-cases/`

### 2. Use Base Test
Import and use the base test utilities:
```javascript
const { test, expect } = require('../utils/base-test');
```

### 3. Use Page Objects
Use existing page objects or create new ones:
```javascript
const FilesPage = require('../page-objects/files-page');
const filesPage = new FilesPage(page);
```

### 4. Follow Naming Convention
- Navigation tests: `nav-XXX-description.spec.js`
- Edge case tests: `edge-XXX-description.spec.js`

### 5. Add Test Documentation
Include test ID, category, prerequisites, steps, and expected results in comments.

## Updating Page Objects

### When to Update
- UI elements change
- New features are added
- Selectors need to be updated

### How to Update
1. Locate the page object in `tests/page-objects/`
2. Update selectors or methods
3. Update all tests that use the page object
4. Run tests to verify changes

## Managing Test Data

### Adding Test Files
1. Place files in `tests/test-data/`
2. Update `tests/fixtures/test-data-catalog.json`
3. Use helper functions from `tests/utils/file-upload.js`

### Creating Test Files Programmatically
```javascript
const { createTestFile, getTestDataPath } = require('../utils/file-upload');
const filePath = getTestDataPath('test-file.pdf');
createTestFile(filePath, content);
```

## Debugging Failed Tests

### 1. Check Screenshots
Screenshots are automatically captured on failure in `tests/reports/screenshots/`

### 2. Check Videos
Videos are captured on failure in `tests/reports/videos/`

### 3. Check Logs
Test execution logs are in `tests/reports/logs/`

### 4. Run in Debug Mode
```bash
npm run test:debug
```

### 5. Run in UI Mode
```bash
npm run test:ui
```

## Common Issues and Solutions

### Issue: Tests Flaky
**Solution**: 
- Add explicit waits
- Increase timeout values
- Use `waitForLoadState` instead of fixed timeouts

### Issue: Selectors Not Found
**Solution**:
- Verify selectors in browser DevTools
- Update page objects with correct selectors
- Use more specific selectors

### Issue: API Tests Fail
**Solution**:
- Verify API keys are set
- Check API rate limits
- Use API mocking for consistent results

### Issue: Tests Slow
**Solution**:
- Run tests in parallel where possible
- Optimize wait strategies
- Use headless mode

## Test Data Management

### Cleanup
Always clean up test data after tests:
```javascript
try {
  // Test code
} finally {
  // Cleanup
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
```

### Test Data Lifecycle
1. Create test data before test
2. Use test data during test
3. Clean up test data after test

## Version Control

### What to Commit
- Test files (`.spec.js`)
- Page objects
- Test utilities
- Configuration files
- Documentation

### What NOT to Commit
- Test reports
- Screenshots (except for documentation)
- Videos
- Node modules
- `.env` files

## Performance Optimization

### Parallel Execution
Navigation tests can run in parallel. Edge case tests should run sequentially.

### Test Timeouts
Adjust timeouts in `playwright.config.js`:
```javascript
use: {
  actionTimeout: 30000,
  navigationTimeout: 60000,
}
```

### Browser Selection
Run tests only in necessary browsers for faster execution:
```bash
npm run test:chrome  # Only Chrome
```

## Continuous Improvement

### Regular Updates
- Update Playwright version quarterly
- Review and update selectors monthly
- Refactor tests as application evolves

### Test Coverage
- Aim for 80%+ coverage of critical paths
- Prioritize edge cases
- Maintain navigation test coverage

### Feedback Loop
- Review test failures regularly
- Update tests based on application changes
- Share test results with development team


