# Testing Guide

## Overview

This project has comprehensive test suites for both backend API and frontend components. We use a custom test reporter that provides clean, easy-to-read output with one line per test.

## Running Tests

### Backend Tests with Clean Output

```bash
cd backend
npm run test:report
```

This will run all backend tests and show:
- ✓ One line per passed test
- ✗ One line per failed test
- Summary with total passed/failed counts
- List of failed tests with error details

### Backend Tests with Standard Output

```bash
cd backend
npm test
```

### Frontend Tests

```bash
npm test
```

### Run All Tests

```bash
./run-all-tests.sh
```

## Test Output Format

The custom reporter (`test:report`) provides output in this format:

```
✓ Portfolio Management API Tests › POST /api/portfolios › should create portfolio as admin - PASSED
✗ Metrics API Tests › POST /api/projects/:projectId/metrics › should create a metric - FAILED
  Error: expect(received).toBe(expected) // Object.is equality
```

At the end, you'll see a summary:

```
================================================================================
TEST SUMMARY
================================================================================

Total Tests: 121
✓ Passed: 71
✗ Failed: 50

--------------------------------------------------------------------------------
FAILED TESTS:
--------------------------------------------------------------------------------

✗ Metrics API Tests › POST /api/projects/:projectId/metrics › should create a metric
  Error: expect(received).toBe(expected) // Object.is equality
  Expected: 201
```

## Current Test Status

### Backend Tests

| Test Suite | Status | Notes |
|------------|--------|-------|
| Portfolio Management | ✅ ALL PASSING | 12/12 tests passing |
| Authentication | ⚠️ PARTIAL | Some tests failing |
| Project Permissions | ⚠️ PARTIAL | Some tests failing |
| Metrics | ⚠️ PARTIAL | Some tests failing |
| CRAIDs | ⚠️ PARTIAL | Some tests failing |
| Comments | ❌ FAILING | Setup issues |
| Audit Log | ⚠️ PARTIAL | Some tests passing |
| Users | ⚠️ PARTIAL | Some tests failing |
| Project Links | ✅ PASSING | Tests passing |

**Total:** 71 passing, 50 failing out of 121 tests

## How We Missed the Portfolio Bug

The portfolio creation bug (`logAuditEvent` not defined) was introduced but not caught because:

1. **Tests weren't run before deployment** - The backend tests exist and would have caught it
2. **No pre-commit hooks** - Tests should run automatically before commits
3. **Test failures were being ignored** - Many tests were already failing, making it easy to miss new failures

## Recommendations

### 1. Run Tests Before Every Commit

```bash
npm run test:report
```

Only commit if all tests pass.

### 2. Add Pre-Commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
cd backend
npm run test:report
if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Commit aborted."
    exit 1
fi
```

### 3. Fix Existing Test Failures

Many tests are failing due to:
- Database setup issues (missing tables)
- Incorrect test assertions
- Changed API responses

These should be fixed to maintain test reliability.

### 4. Run Tests in CI/CD

Set up GitHub Actions or similar to run tests on every push:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: cd backend && npm install
      - run: cd backend && npm test
```

## Adding New Tests

### Backend Test Structure

Tests are located in `backend/src/tests/`:

```javascript
describe('Feature Name API Tests', () => {
  test('should do something', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send({ data: 'value' });

    expect(response.status).toBe(200);
  });
});
```

### Frontend Test Structure

Tests are located in `src/__tests__/` or `src/components/__tests__/`:

```javascript
import { render, screen } from '@testing-library/react';
import Component from '../Component';

test('renders component', () => {
  render(<Component />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

## Test Coverage Goals

- **Backend API:** 100% of endpoints should have tests
- **Frontend Components:** Critical user flows should be tested
- **Integration:** End-to-end tests for key features

## Debugging Failed Tests

1. **Read the error message carefully** - The custom reporter shows the exact assertion that failed
2. **Run the specific test** - Use `jest -t "test name"` to run just one test
3. **Check the test database** - Tests use separate databases (e.g., `test-portfolios.db`)
4. **Look at the test setup** - `beforeAll` and `beforeEach` blocks set up test data

## Questions?

For help with testing, see:
- Jest documentation: https://jestjs.io/
- Testing Library: https://testing-library.com/
- Supertest (API testing): https://github.com/visionmedia/supertest
