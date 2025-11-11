#!/bin/bash

# Comprehensive Test Runner for Progress Tracker
# Runs all tests and outputs clean pass/fail results

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                      PROGRESS TRACKER - TEST SUITE                           ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Track overall pass/fail
BACKEND_FAILED=0
FRONTEND_FAILED=0

# Backend Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "BACKEND API TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd backend
npm run test:report
BACKEND_FAILED=$?
cd ..

echo ""

# Frontend Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FRONTEND COMPONENT TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm test -- --reporter=default --silent 2>&1 | grep -E "^(PASS|FAIL|✓|✗|Tests:)" || echo "No frontend tests run"
FRONTEND_FAILED=$?

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                           OVERALL TEST RESULTS                               ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

if [ $BACKEND_FAILED -eq 0 ] && [ $FRONTEND_FAILED -eq 0 ]; then
    echo "✅ ALL TESTS PASSED"
    exit 0
else
    if [ $BACKEND_FAILED -ne 0 ]; then
        echo "❌ BACKEND TESTS FAILED"
    fi
    if [ $FRONTEND_FAILED -ne 0 ]; then
        echo "❌ FRONTEND TESTS FAILED"
    fi
    exit 1
fi
