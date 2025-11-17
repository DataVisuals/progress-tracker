# UI Gaps Audit - Fields That Can Be Set But Not Edited

This document identifies all fields that can be set during creation but cannot be edited afterwards due to missing UI.

## Summary

**Total UI Gaps Found: 6 fields across Projects and Metrics**

---

## 1. Projects

### Fields with Edit UI ✓
- **name** - Editable via double-click in project header (`App.jsx:321-339`)
- **description** - Editable via click in project header (`App.jsx:341-373`)
- **initiative_manager** - Editable via `handleProjectRename` (included in update) (`App.jsx:302-319`)
- **portfolio_id** - Editable via portfolio selector (**JUST ADDED!**) (`App.jsx:405-436`)
- **start_date** - Editable via double-click on timeline (`App.jsx:379-403`)
- **end_date** - Editable via double-click on timeline (`App.jsx:379-403`)

### Fields WITHOUT Edit UI ❌
**NONE** - All project fields now have edit UI!

---

## 2. Metrics

### Settable During Creation
From `ProjectSetup.jsx` (lines 147-156), the following fields can be set when creating a metric:
- name
- start_date
- end_date
- frequency
- progression_type
- final_target
- amber_tolerance
- red_tolerance

### Fields with Edit UI ✓
- **name** - Editable via `handleMetricRename` in MetricTabs (`App.jsx:409-429`)
- **amber_tolerance** - Editable via `handleToleranceChange` in MetricChart (`App.jsx:453-471`)
- **red_tolerance** - Editable via `handleToleranceChange` in MetricChart (`App.jsx:453-471`)

### Fields WITHOUT Edit UI ❌

#### 1. **start_date**
- **Set during creation**: `ProjectSetup.jsx:149`
- **Backend support**: YES - could be added to `PUT /api/metrics/:id` endpoint
- **Current status**: Cannot be edited after creation
- **Impact**: HIGH - Changing metric timeline is a common need
- **Location**: `backend/src/schema.sql:26`

#### 2. **end_date**
- **Set during creation**: `ProjectSetup.jsx:150`
- **Backend support**: YES - could be added to `PUT /api/metrics/:id` endpoint
- **Current status**: Cannot be edited after creation
- **Impact**: HIGH - Changing metric timeline is a common need
- **Location**: `backend/src/schema.sql:27`

#### 3. **frequency**
- **Set during creation**: `ProjectSetup.jsx:151` (options: weekly, fortnightly, monthly, quarterly)
- **Backend support**: YES - could be added to `PUT /api/metrics/:id` endpoint
- **Current status**: Cannot be edited after creation
- **Impact**: MEDIUM - Less common to change, but would require regenerating periods
- **Location**: `backend/src/schema.sql:28`
- **Note**: Changing this would require regenerating all metric_periods

#### 4. **progression_type**
- **Set during creation**: `ProjectSetup.jsx:152` (options: linear, exponential, s-curve, logarithmic)
- **Backend support**: YES - Already supported in `PUT /api/metrics/:id` (`server.js:1343-1348`)
- **Current status**: Cannot be edited after creation
- **Impact**: MEDIUM - Affects expected values calculation
- **Location**: `backend/src/schema.sql:29`
- **Note**: Backend already supports this! Just needs frontend UI

#### 5. **final_target**
- **Set during creation**: `ProjectSetup.jsx:153`
- **Backend support**: YES - Already supported in `PUT /api/metrics/:id` (`server.js:1337-1342`)
- **Current status**: Cannot be edited after creation
- **Impact**: HIGH - Target values change frequently in projects
- **Location**: `backend/src/schema.sql:30`
- **Note**: Backend already supports this! Just needs frontend UI

#### 6. **owner_id** (BONUS: Not visible in UI at all!)
- **Set during creation**: Automatically set based on initiative_manager or current user (`server.js:1240-1256`)
- **Backend support**: Exists in schema but not in update endpoint
- **Current status**: Cannot be viewed OR edited
- **Impact**: LOW - Rarely used/displayed
- **Location**: `backend/src/schema.sql:25`
- **Note**: Not exposed in ProjectSetup UI, set automatically

---

## 3. Metric Type (Semi-Hidden Feature)

### **metric_type**
- **Set during creation**: Defaults to 'lead' (`server.js:1272`)
- **Backend support**: YES - Supported in both create and update (`server.js:1349-1354`)
- **Current status**: Cannot be edited OR set during creation (not in ProjectSetup UI)
- **Impact**: LOW - Feature exists but is not exposed in UI
- **Location**: `backend/src/schema.sql:33`
- **Options**: 'lead' or 'lag'
- **Note**: This is a complete feature that exists in backend but has NO frontend UI at all!

---

## 4. Other Entities (No Gaps Found)

### Portfolios ✓
- All fields editable via PortfolioManager component

### Project Links ✓
- All fields editable via ProjectLinksEditor component

### Users ✓
- All fields editable via UserManagement/UserProfile components

### Comments/CRAIDs ✓
- All fields editable via respective components

---

## Prioritized Recommendations

### Priority 1 (HIGH - Common Changes, Backend Ready)
1. **final_target** - Backend ready, just needs UI (dropdown/input on metric)
2. **progression_type** - Backend ready, just needs UI (dropdown on metric)
3. **start_date / end_date** (Metrics) - Need both backend and UI work

### Priority 2 (MEDIUM - Less Common)
4. **frequency** - Complex: would require regenerating periods
5. **metric_type** - Hidden feature, low usage

### Priority 3 (LOW - Rarely Needed)
6. **owner_id** - Not currently displayed anywhere

---

## Implementation Notes

### Easy Wins (Backend Already Supports)
These just need frontend UI:
- `final_target` - Add input field to metric view
- `progression_type` - Add dropdown to metric view

### Medium Complexity
These need backend endpoint updates:
- `start_date` / `end_date` - Add to PUT /api/metrics/:id endpoint

### High Complexity
These require period regeneration:
- `frequency` - Changing this requires deleting and regenerating all periods

---

## Code References

- Project editing: `src/App.jsx:302-436`
- Metric editing: `src/App.jsx:409-471`
- Metric creation: `src/components/ProjectSetup.jsx:145-159`
- Backend metric update: `backend/src/server.js:1297-1384`
- Backend metric create: `backend/src/server.js:1224-1294`
- Schema: `backend/src/schema.sql:21-37` (current) or `backend/src/schema-v3.sql:35-50` (v3)
