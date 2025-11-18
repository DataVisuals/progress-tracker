# Backend Test Results

**Last Updated:** 2025-11-18

## Summary

- **Test Suites:** 15 passed, 15 total
- **Tests:** 276 passed, 276 total
- **Time:** ~4.34s

## Test Suites

### Authentication (`auth.test.js`) - 14 tests
- POST /api/auth/register
  - should register a new user
  - should reject duplicate email registration
  - should reject registration without required fields
- POST /api/auth/login
  - should login with correct credentials
  - should reject login with wrong password
  - should reject login with non-existent user
- GET /api/auth/profile
  - should get user profile with valid token
  - should reject request without token
  - should reject request with invalid token
- PUT /api/auth/profile
  - should update user profile
  - should reject profile update without required fields
- POST /api/auth/change-password
  - should change password with correct current password
  - should reject password change with wrong current password
  - should reject password change with short new password

### Permissions (`permissions.test.js`) - 20 tests
- Role-based access control
- Project-specific permissions
- Admin override capabilities

### Metrics (`metrics.test.js`) - 38 tests
- Metric creation with period generation
- Metric updates and target changes
- Period management
- Progression type calculations (linear, s-curve, exponential, logarithmic)

### Metric Periods (`metric-periods.test.js`) - 32 tests
- Period CRUD operations
- Period frequency validation
- Custom period handling

### Comments (`comments.test.js`) - 16 tests
- Comment creation and updates
- Period-specific comments
- User attribution

### Feedback (`feedback.test.js`) - 28 tests
- Feedback submission
- Status workflow (pending -> responded -> resolved)
- Project association

### CRAIDs (`craids.test.js`) - 12 tests
- CRAID creation (Comments, Risks, Actions, Issues, Dependencies)
- Status management
- Priority levels

### Portfolios (`portfolios.test.js`) - 36 tests
- Portfolio Management API Tests
  - GET /api/portfolios (1 test)
  - POST /api/portfolios (6 tests)
  - PUT /api/portfolios/:id (3 tests)
  - DELETE /api/portfolios/:id (3 tests)
  - GET /api/portfolios/:id/report (6 tests)
- **RAG Status Calculation Verification (9 tests)**
  - should return GREEN when complete >= expected
  - should return GREEN when variance is within tolerance (< 5%)
  - should return AMBER when variance exceeds amber tolerance (5-10%)
  - should return RED when variance exceeds red tolerance (> 10%)
  - should return GREY when expected is 0
  - should return GREY when complete is null
  - should return GREEN at exactly amber tolerance boundary (5%)
  - should return AMBER at exactly red tolerance boundary (10%)
  - should classify project as RED if any metric is red
- **Cascade Delete Verification (9 tests)**
  - should cascade delete metrics when project is deleted
  - should cascade delete periods when project is deleted
  - should cascade delete comments when project is deleted
  - should cascade delete periods when metric is deleted
  - should cascade delete comments when metric is deleted
  - should cascade delete project links when project is deleted
  - should cascade delete CRAIDs when project is deleted
  - should NOT cascade delete project when portfolio is deleted
  - should cascade delete project permissions when project is deleted

### Time Travel (`time-travel.test.js`) - 14 tests
- Historical data reconstruction
- Timestamp validation
- Data revert functionality

### Import/Export (`import-export.test.js`) - 20 tests
- Excel import validation
- Data export to Excel
- Template generation

### Consistency Report (`consistency-report.test.js`) - 16 tests
- Data consistency checks
- Cross-metric validation

### Users (`users.test.js`) - 14 tests
- User management
- Role assignment

### Projects (`projects.test.js`) - 16 tests
- Project CRUD operations
- Portfolio assignment

## Coverage Areas

### Core Functionality
- Authentication and authorization
- Role-based permissions (admin, pm, viewer)
- Project and metric management
- Period data tracking

### Data Integrity
- Cascade deletes (project -> metrics -> periods -> comments)
- Foreign key relationships
- Audit logging

### Business Logic
- RAG status calculations (Red/Amber/Green/Grey)
- Tolerance thresholds (amber: 5%, red: 10%)
- Progression types (linear, s-curve, exponential, logarithmic)
- Variance percentage calculations

### API Endpoints
- All CRUD operations
- Authentication middleware
- Error handling
- Input validation

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/tests/portfolios.test.js

# Run with verbose output
npm test -- --verbose
```

## Notes

- Tests use isolated SQLite databases for each test suite
- Database migrations run automatically during test setup
- Test data is cleaned up after each test suite
