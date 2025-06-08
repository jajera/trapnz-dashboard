# TrapNZ Dashboard - Test Suite Documentation

## Overview

This comprehensive test suite ensures the reliability and consistency of the TrapNZ Dashboard. It includes unit tests, integration tests, frontend tests, and live validation to catch bugs before they reach production.

## Test Structure

```
test/
├── api.test.js          # API endpoint tests
├── frontend.test.js     # Frontend UI and logic tests
├── integration.test.js  # End-to-end integration tests
└── setup.js            # Test configuration and utilities
```

## Running Tests

### Quick Commands

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:api          # API tests only
npm run test:frontend     # Frontend tests only
npm run test:integration  # Integration tests only

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# Complete validation (tests + live API validation)
npm run validate
```

## Test Categories

### 1. API Tests (`test/api.test.js`)
- **Basic API Endpoints**: Projects, trap status, trap details
- **Alert System**: Alert generation and consistency
- **Advanced Analytics**: Charts, anomalies, maintenance predictions
- **Data Consistency**: Cross-endpoint data validation
- **Error Handling**: Invalid parameters, missing data
- **Performance**: Response times, large data handling

### 2. Frontend Tests (`test/frontend.test.js`)
- **UI Structure**: Dashboard cards, modals, filters
- **Dashboard Functions**: Data display, alert rendering
- **Data Consistency**: Recent catches logic, alert filtering
- **Error Handling**: API failures, missing data
- **Modal Functionality**: Show/hide, title updates

### 3. Integration Tests (`test/integration.test.js`)
- **Alert System Integration**: End-to-end alert consistency
- **Dashboard Metrics**: Cross-endpoint data validation
- **Line Assignment**: Pattern matching and consistency
- **Analytics Integration**: Multi-endpoint data flow
- **Error Recovery**: Graceful degradation
- **Performance**: Concurrent requests, large datasets

## Key Test Scenarios

### Alert Count Consistency
Tests ensure that alert counts in the Real-time Performance section match the actual filtered results in drilldowns:

```javascript
// Tests this specific issue reported by user
it('should have consistent alert counts between API and drilldown', async () => {
  const alerts = await request(app).get('/api/alerts');
  // For each alert, verify drilldown matches count
  // Applies same filtering logic as frontend
});
```

### MK12 Status Consistency
Validates that traps with recent catches (like MK12) show as "Active" across all sections:

```javascript
it('should handle MK12 status consistency across all endpoints', async () => {
  // Finds MK12 trap
  // Checks if it has recent catches
  // Verifies it's not incorrectly flagged as inactive
});
```

### Recent Catches Logic
Ensures recent catches count is consistent between dashboard and modal views:

```javascript
it('should validate recent catches logic', () => {
  // Tests the 7-day recent catch window
  // Validates status override for recent catches
  // Ensures consistency across UI components
});
```

## Validation Script

The `npm run validate` command runs a comprehensive validation that:

1. **Runs Complete Test Suite**: All 60 tests must pass
2. **Starts Live Server**: Ensures server can start properly
3. **Tests Live APIs**: Validates all endpoints respond correctly
4. **Validates Specific Issues**: Tests the exact problems reported:
   - Alert count consistency (e.g., "8 alerts" vs "2 in drilldown")
   - MK12 status consistency across sections
   - Recent catches count accuracy

### Sample Validation Output

```
🧪 TrapNZ Dashboard - Comprehensive Test & Validation Suite
===========================================================

1. Running Complete Test Suite...
✅ All tests passed!

2. Starting Server for Live Validation...
✅ Server already running

3. Running Live API Validation...
✅ /api/projects - OK
✅ /api/traps/status - OK
✅ /api/alerts - OK
✅ /api/traps/details - OK
✅ /api/analytics - OK
✅ /api/analytics/advanced - OK
✅ All API endpoints responding

🔍 Validating Specific Issues Fixed:

1. Testing Alert Count Consistency...
   📊 Inactive High Performers: 2 alerts
   ✅ Drilldown matches: 2 traps

2. Testing MK12 Status Consistency...
   📍 MK12 Found:
      - Official Status: Inactive
      - Last Catch: 2025-06-06T10:30:00.000Z
      - Has Recent Catch: Yes
      - Efficiency: 21.0%
   ✅ MK12 should show as Active (has recent catch)
   ✅ MK12 correctly excluded from Inactive High Performers

3. Testing Recent Catches Consistency...
   📊 Dashboard reports: 5 recent catches
   📊 Calculated from details: 5 recent catches
   ✅ Recent catches count is consistent

✅ Issue validation complete!

🎉 All validations completed successfully!
✅ The dashboard is ready for production use.
```

## Test Coverage

Current coverage: ~37% of server code, focusing on critical paths:
- All API endpoints
- Alert generation logic
- Data consistency functions
- Error handling paths

## Environment Setup

Tests require:
- `TRAPNZ_WFS_TOKEN` environment variable
- Node.js 18+
- All dependencies installed (`npm install`)

## Continuous Integration

The test suite is designed for CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Tests
  run: npm test
  env:
    TRAPNZ_WFS_TOKEN: ${{ secrets.TRAPNZ_TOKEN }}

- name: Validate System
  run: npm run validate
```

## Adding New Tests

### For New API Endpoints
1. Add tests to `test/api.test.js`
2. Include structure validation, error handling, and performance tests
3. Add integration tests to verify data consistency

### For Frontend Changes
1. Add tests to `test/frontend.test.js`
2. Test UI structure, data display, and user interactions
3. Validate error handling and edge cases

### For Bug Fixes
1. Create a test that reproduces the bug
2. Verify the test fails before the fix
3. Ensure the test passes after the fix
4. Add to validation script if it's a critical issue

## Debugging Failed Tests

### Common Issues
- **Server not running**: Tests start their own server instance
- **Token issues**: Set `TRAPNZ_WFS_TOKEN` environment variable
- **Timing issues**: Integration tests have 30-second timeout
- **Data inconsistency**: Check if external API data changed

### Debug Commands
```bash
# Run single test file with verbose output
npx vitest run test/api.test.js --reporter=verbose

# Run specific test
npx vitest run -t "should get projects list"

# Debug mode
npx vitest run --inspect-brk
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Real Data**: Tests use live API data for accuracy
3. **Comprehensive Coverage**: Test happy path, edge cases, and errors
4. **Performance Aware**: Include timing and load tests
5. **Documentation**: Keep tests readable and well-commented

## Maintenance

- **Weekly**: Run full validation suite
- **Before Releases**: Run `npm run validate`
- **After Bug Reports**: Add specific test cases
- **Monthly**: Review and update test coverage

This test suite provides confidence that the dashboard works correctly and catches regressions before they impact users.
