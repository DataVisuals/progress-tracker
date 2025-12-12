# Testing Audit - Gap Analysis
**Date:** December 11, 2024
**Type:** Delta analysis from Dec 6 audit

---

## Summary

Test coverage has degraded slightly since the last audit, with 47 additional failing tests despite 46 new tests being added. Several new features were added without corresponding tests.

---

## Prior Analysis (Dec 6, 2024) vs Current State (Dec 11, 2024)

| Metric | Prior | Current | Delta |
|--------|-------|---------|-------|
| **Frontend Tests** | 562 | 608 | +46 |
| **Frontend Passing** | 380 | 379 | -1 |
| **Frontend Failing** | 162 | 209 | +47 |
| **Test Files (Fail/Pass)** | 26/10 | 30/10 | +4 failing |

---

## New Features Since Last Audit (Untested)

These features were added since Dec 6 without tests:

### High Priority
1. **Jump to Project (Cmd+K / Ctrl+K)** - `src/components/JumpToProject.jsx`
   - Keyboard shortcut listener in App.jsx
   - Fuzzy search matching
   - Type-ahead navigation

2. **Arrow Key Metric Navigation** - `src/App.jsx:256-283`
   - Left/right arrow navigation between metrics
   - Input field exclusion logic

3. **Milestone Clarity Scores** - `src/components/Milestones.jsx`
   - ClarityIndicator added to milestone descriptions

### Medium Priority
4. **Clarity Indicators on Commentary Panel** - `src/components/panels/CommentaryPanel.jsx`
   - Added ClarityIndicator to comment footers
   - HTML stripping for clarity scoring

5. **Recent Changes Field-Level Detection** - Multiple files
   - `backend/src/server.js` - project_id enrichment
   - `src/components/panels/RecentUpdatesPanel.jsx` - navigation fix
   - Squiggly underline on specific changed fields

6. **Clarity Panel & Rankings** - `src/components/panels/ClarityPanel.jsx`
   - Dashboard panel for clarity scores

---

## Critical Test Gaps

### Components Without Any Tests

| Component | Location | Lines | Risk Level |
|-----------|----------|-------|------------|
| JumpToProject | `src/components/JumpToProject.jsx` | 233 | **High** |
| ClarityIndicator | `src/components/ClarityIndicator.jsx` | ~150 | **High** |
| Milestones | `src/components/Milestones.jsx` | 258 | **High** |
| CommentaryPanel | `src/components/panels/CommentaryPanel.jsx` | 186 | Medium |
| RecentUpdatesPanel | `src/components/panels/RecentUpdatesPanel.jsx` | 242 | Medium |
| ClarityPanel | `src/components/panels/ClarityPanel.jsx` | ~200 | Medium |
| AuditLog | `src/components/AuditLog.jsx` | ~300 | Medium |
| UserManagement | `src/components/UserManagement.jsx` | ~400 | Medium |
| TimeTravel | `src/components/TimeTravel.jsx` | ~250 | Medium |
| RecoveryPlans | `src/components/RecoveryPlans.jsx` | ~300 | Low |
| ProjectDependencies | `src/components/ProjectDependencies.jsx` | ~200 | Low |

### Utility Functions Without Tests

| Utility | Location | Purpose |
|---------|----------|---------|
| clarityScore | `src/utils/clarityScore.js` | Text quality scoring |
| tokenUtils | `src/utils/tokenUtils.js` | JWT token management |

---

## Existing Test Failures to Fix

### Broken Test Files (Blocking)

1. **ProjectTimelinePanel.test.jsx** - 25 tests failing
   - Root cause: Module structure mismatch
   - All tests in file fail

2. **useProjectQueries.test.jsx** - Import failures
   - Error: `Cannot find module 'src/utils/tokenUtils'`
   - Cascading failures

3. **SpaceSelector.test.jsx** - Props validation
   - Expects different prop structure

4. **Feedback.test.jsx** - API client mock issues

### Test Files Needing Updates

- `src/__tests__/App.dropdowns.test.jsx` - May need keyboard shortcut tests
- `src/components/__tests__/Login.test.jsx` - Token utils import

---

## Component Coverage Summary

```
Total Components:    57 (44 main + 13 panels)
With Tests:          11 (~19%)
Without Tests:       46 (~81%)

Panel Components:    13
Panels Tested:        1 (ProjectTimelinePanel - but failing)
Panels Untested:     12
```

---

## Recommended Fix Order

### Phase 1: Unblock Tests (1-2 hours)
- [ ] Fix `tokenUtils` import path issue
- [ ] Update ProjectTimelinePanel test mocks
- [ ] Fix SpaceSelector prop expectations

### Phase 2: High-Risk Features (2-3 hours)
- [ ] Add tests for JumpToProject.jsx
  - Keyboard shortcut activation
  - Fuzzy search matching
  - Navigation on selection
- [ ] Add tests for ClarityIndicator.jsx
  - Score calculation
  - Tooltip display
  - Theme variants
- [ ] Add tests for clarityScore.js utility

### Phase 3: New Features (2-3 hours)
- [ ] Test arrow key metric navigation
- [ ] Test CommentaryPanel clarity indicators
- [ ] Test RecentUpdatesPanel navigation
- [ ] Test Milestones clarity display

### Phase 4: Dashboard Panels (3-4 hours)
- [ ] ClarityPanel
- [ ] CommentaryPanel
- [ ] RecentUpdatesPanel
- [ ] ActiveUsersPanel
- [ ] AuditPanel
- [ ] (8 more panels)

### Phase 5: Core Components (4-6 hours)
- [ ] Milestones.jsx
- [ ] UserManagement.jsx
- [ ] AuditLog.jsx
- [ ] TimeTravel.jsx
- [ ] RecoveryPlans.jsx

---

## Backend Gaps (From Prior Audit)

### Untested Endpoints
```
GET  /api/health
POST /api/log-frontend-error
GET  /api/auth/check-name
POST /api/auth/logout
PUT  /api/projects/:projectId/metrics/reorder
GET  /api/comments/by-user
POST /api/users/:id/reset-password
GET  /api/inconsistency-report
GET  /api/chaser-report/:spaceId
GET  /api/admin/active-users
GET  /api/admin/page-heatmap
GET  /api/analytics/performance
GET  /api/recent-changes (NEW)
```

---

## Test Commands

```bash
# Run all frontend tests
npm test

# Run specific test file
npm test -- src/components/__tests__/JumpToProject.test.jsx

# Run with coverage
npm test -- --coverage

# Run backend tests
cd backend && npm test
```

---

## Files Changed Since Last Audit

Key files modified that may need test updates:

- `src/App.jsx` - Keyboard shortcuts, arrow navigation
- `src/components/MetricChart.jsx` - Clarity indicators
- `src/components/panels/CommentaryPanel.jsx` - Clarity indicators
- `src/components/panels/RecentUpdatesPanel.jsx` - Navigation fix
- `src/components/Milestones.jsx` - Clarity indicators
- `src/components/ClarityIndicator.css` - Always visible
- `src/components/HomePage.css` - Various fixes
- `backend/src/server.js` - project_id in audit enrichment

---

*This audit should be updated after each testing session.*
