# Test Automation Framework

This directory contains the automated test suite for the Auto Claims Processing System (AVA).

## Overview

The test automation framework is built using Playwright and follows the Page Object Model pattern. It includes:
- **8 Navigation Tests** - Testing step progression, tab switching, and UI state
- **47 Edge Case Tests** - Testing error handling, boundary conditions, and failure scenarios
- **Comprehensive Test Utilities** - Reusable helpers for API mocking, file uploads, state management
- **Page Object Models** - Maintainable page objects for all application components

## Structure

```
tests/
├── fixtures/              # Test data and fixtures
│   └── test-data-catalog.json
├── page-objects/           # Page Object Model classes
│   ├── base-page.js
│   ├── files-page.js
│   ├── fact-matrix-page.js
│   ├── navigation-component.js
│   ├── timeline-page.js
│   ├── liability-page.js
│   ├── claim-rationale-page.js
│   └── modal-component.js
├── utils/                  # Test utilities and helpers
│   ├── base-test.js
│   ├── api-mock.js
│   ├── file-upload.js
│   ├── state-management.js
│   └── logger.js
├── test-data/              # Test files (PDFs, images, audio)
├── navigation/             # Navigation test suite (8 tests)
│   ├── nav-001-initial-page-load.spec.js
│   ├── nav-002-step-progression.spec.js
│   ├── nav-003-direct-tab-locked.spec.js
│   ├── nav-004-direct-tab-unlocked.spec.js
│   ├── nav-005-previous-button.spec.js
│   ├── nav-006-next-incomplete.spec.js
│   ├── nav-007-state-persistence.spec.js
│   └── nav-008-progress-bar.spec.js
├── edge-cases/             # Edge case test suite (47 tests)
│   ├── edge-001-empty-file.spec.js
│   ├── edge-002-invalid-file-type.spec.js
│   ├── edge-011-extract-facts-no-files.spec.js
│   ├── edge-014-api-failure.spec.js
│   ├── edge-033-rapid-tab-switching.spec.js
│   └── ... (additional edge case tests)
├── reports/                # Test execution reports
│   ├── html/               # HTML test reports
│   ├── screenshots/        # Screenshots on failures
│   └── logs/               # Test execution logs
├── .github/
│   └── workflows/
│       └── test-automation.yml  # CI/CD integration
├── package.json            # Node.js dependencies
├── playwright.config.js    # Playwright configuration
├── README.md               # This file
├── EXECUTION_GUIDE.md      # Detailed execution guide
├── MAINTENANCE.md          # Maintenance guide
└── TEST_INDEX.md           # Complete test index
```

## Quick Start

### 1. Install Dependencies

```bash
cd tests
npm install
npm run install:browsers
```

### 2. Configure Environment

Create `.env` file (copy from `.env.example`):
```bash
BASE_URL=http://localhost:5000
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Start Application

```bash
# From project root
python app.py
```

### 4. Run Tests

```bash
# Run all tests
npm test

# Run navigation tests only
npm run test:navigation

# Run edge case tests only
npm run test:edge-cases

# Run with specific browser
npm run test:chrome
npm run test:firefox
npm run test:safari

# Run in UI mode (interactive)
npm run test:ui

# Run in debug mode
npm run test:debug
```

## Test Reports

After test execution, reports are available in `tests/reports/`:

- **HTML Report**: `reports/html/index.html` - View with `npm run test:report`
- **JSON Report**: `reports/results.json` - For programmatic processing
- **JUnit XML**: `reports/junit.xml` - For CI/CD integration
- **Screenshots**: `reports/screenshots/` - Captured on test failures
- **Videos**: `reports/videos/` - Captured on test failures

## Test Coverage

### Navigation Tests (8 tests)
- ✅ Initial page load and state
- ✅ Step progression
- ✅ Tab access (locked/unlocked)
- ✅ Navigation buttons
- ✅ State persistence
- ✅ Progress bar updates

### Edge Case Tests (47 tests)
- ✅ File upload edge cases (10 tests)
- ✅ Fact extraction edge cases (5 tests)
- ⏳ Liability signals edge cases (3 tests)
- ⏳ Timeline generation edge cases (2 tests)
- ⏳ Liability recommendation edge cases (3 tests)
- ⏳ Claim rationale edge cases (3 tests)
- ⏳ Evidence completeness edge cases (2 tests)
- ⏳ Conflict resolution edge cases (2 tests)
- ⏳ Supervisor escalation edge cases (2 tests)
- ✅ UI/UX edge cases (4 tests)
- ⏳ API endpoint edge cases (4 tests)
- ⏳ Data validation edge cases (3 tests)
- ⏳ Integration edge cases (2 tests)
- ⏳ Accessibility edge cases (2 tests)

**Status**: 11 tests implemented, 44 tests pending (structure ready)

## Documentation

- **[EXECUTION_GUIDE.md](EXECUTION_GUIDE.md)** - Detailed guide on running tests
- **[MAINTENANCE.md](MAINTENANCE.md)** - Guide for maintaining and updating tests
- **[TEST_INDEX.md](TEST_INDEX.md)** - Complete index of all tests

## CI/CD Integration

Tests are integrated with GitHub Actions. See `.github/workflows/test-automation.yml` for configuration.

## Best Practices

1. **Use Page Objects** - All interactions should go through page objects
2. **Explicit Waits** - Use `waitForElement` instead of fixed timeouts
3. **Clean Up** - Always clean up test data after tests
4. **Screenshots** - Automatically captured on failures
5. **Mock APIs** - Use API mocking for consistent test results
6. **Independent Tests** - Tests should be able to run independently

## Troubleshooting

See [EXECUTION_GUIDE.md](EXECUTION_GUIDE.md) for troubleshooting tips.

## Contributing

When adding new tests:
1. Follow naming convention: `nav-XXX` or `edge-XXX`
2. Use existing page objects or create new ones
3. Include test documentation in comments
4. Update TEST_INDEX.md
5. Run tests to verify

