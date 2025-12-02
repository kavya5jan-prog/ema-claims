# Test Execution Guide

## Prerequisites

1. **Install Node.js** (v16 or higher)
2. **Install dependencies**:
   ```bash
   cd tests
   npm install
   npm run install:browsers
   ```

3. **Set environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env and set BASE_URL and OPENAI_API_KEY
   ```

4. **Start the application**:
   ```bash
   # From project root
   python app.py
   # Or use the webServer configuration in playwright.config.js
   ```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Navigation Tests Only
```bash
npm run test:navigation
```

### Run Edge Case Tests Only
```bash
npm run test:edge-cases
```

### Run Tests in Specific Browser
```bash
npm run test:chrome
npm run test:firefox
npm run test:safari
```

### Run Tests with UI Mode
```bash
npm run test:ui
```

### Run Tests in Debug Mode
```bash
npm run test:debug
```

## Test Reports

After test execution, reports are available in:
- **HTML Report**: `tests/reports/html/index.html`
- **JSON Report**: `tests/reports/results.json`
- **JUnit XML**: `tests/reports/junit.xml`
- **Screenshots**: `tests/reports/screenshots/` (on failures)
- **Videos**: `tests/reports/videos/` (on failures)

View HTML report:
```bash
npm run test:report
```

## Test Structure

### Navigation Tests
Located in `tests/navigation/`:
- `nav-001-initial-page-load.spec.js`
- `nav-002-step-progression.spec.js`
- `nav-003-direct-tab-locked.spec.js`
- `nav-004-direct-tab-unlocked.spec.js`
- `nav-005-previous-button.spec.js`
- `nav-006-next-incomplete.spec.js`
- `nav-007-state-persistence.spec.js`
- `nav-008-progress-bar.spec.js`

### Edge Case Tests
Located in `tests/edge-cases/`:
- File upload edge cases (EDGE-001 to EDGE-010)
- Fact extraction edge cases (EDGE-011 to EDGE-015)
- Analysis feature edge cases (EDGE-016 to EDGE-028)
- Advanced feature edge cases (EDGE-029 to EDGE-045)
- Accessibility edge cases (EDGE-046 to EDGE-047)

## Troubleshooting

### Tests Fail to Start
- Verify application is running on the configured BASE_URL
- Check that all dependencies are installed
- Ensure browsers are installed: `npm run install:browsers`

### Tests Timeout
- Increase timeout in `playwright.config.js`
- Check application performance
- Verify network connectivity

### API Tests Fail
- Verify OPENAI_API_KEY is set correctly
- Check API rate limits
- Verify API endpoints are accessible

### Screenshots Not Generated
- Check `tests/reports/screenshots/` directory exists
- Verify write permissions
- Check disk space

## CI/CD Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Install dependencies
  run: |
    cd tests
    npm install
    npm run install:browsers

- name: Run tests
  run: |
    cd tests
    npm test

- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: test-results
    path: tests/reports/
```

## Best Practices

1. **Run tests in sequence** for edge cases (they may have dependencies)
2. **Use test data fixtures** instead of hardcoding file paths
3. **Clean up test data** after each test
4. **Use explicit waits** instead of fixed timeouts where possible
5. **Take screenshots** on failures for debugging
6. **Mock external APIs** for consistent test results
7. **Run tests in multiple browsers** to ensure compatibility


