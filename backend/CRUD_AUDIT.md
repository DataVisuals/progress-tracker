# CRUD Operations Audit

## Summary

| Resource | Create | Read | Update | Delete | Notes |
|----------|--------|------|--------|--------|-------|
| **Projects** | ✅ POST | ✅ GET | ✅ PUT | ✅ DELETE | Complete CRUD |
| **Metrics** | ✅ POST | ✅ GET | ✅ PUT | ✅ DELETE | Complete CRUD |
| **Metric Periods** | ✅ POST | ✅ GET | ✅ PUT, PATCH | ❌ **MISSING** | **No DELETE endpoint!** |
| **Comments** | ✅ POST | ✅ GET | ❌ **MISSING** | ✅ DELETE | **No UPDATE endpoint!** |
| **CRAIDs** | ✅ POST | ✅ GET | ✅ PUT | ✅ DELETE | Complete CRUD |
| **Users** | ✅ POST (register) | ✅ GET | ✅ PUT (role) | ✅ DELETE | Complete CRUD |
| **Permissions** | ✅ POST | ✅ GET | ❌ N/A | ✅ DELETE | Grant/Revoke model |
| **Audit Log** | Auto | ✅ GET | ❌ N/A | ❌ N/A | Read-only |

## Detailed Analysis

### ✅ Complete CRUD Operations

#### 1. Projects
- **Create**: `POST /api/projects`
- **Read**: `GET /api/projects`
- **Update**: `PUT /api/projects/:id`
- **Delete**: `DELETE /api/projects/:id`

#### 2. Metrics
- **Create**: `POST /api/projects/:projectId/metrics`
- **Read**: `GET /api/projects/:projectId/metrics`
- **Update**: `PUT /api/metrics/:id`
- **Delete**: `DELETE /api/metrics/:id`

#### 3. CRAIDs (Comments, Risks, Actions, Issues, Dependencies)
- **Create**: `POST /api/projects/:projectId/craids`
- **Read**: `GET /api/projects/:projectId/craids`
- **Update**: `PUT /api/craids/:id`
- **Delete**: `DELETE /api/craids/:id`

#### 4. Users
- **Create**: `POST /api/auth/register`
- **Read**: `GET /api/users` (admin only)
- **Update**: `PUT /api/users/:id/role` (admin only)
- **Delete**: `DELETE /api/users/:id` (admin only, cannot delete self)

### ⚠️ Incomplete CRUD Operations

#### 1. Metric Periods ❌ **MISSING DELETE**
- **Create**: `POST /api/metric-periods` ✅
- **Read**: `GET /api/metrics/:metricId/periods` ✅
- **Update**: `PUT /api/metric-periods/:id` (full update) ✅
- **Update**: `PATCH /api/metric-periods/:id` (partial update) ✅
- **Delete**: ❌ **NO DELETE ENDPOINT**

**Issue**: Users can create and update metric periods, but cannot delete them. This could lead to unwanted data accumulation.

**Recommendation**: Add `DELETE /api/metric-periods/:id` endpoint

#### 2. Comments ❌ **MISSING UPDATE**
- **Create**: `POST /api/periods/:periodId/comments` ✅
- **Read**: `GET /api/periods/:periodId/comments` ✅
- **Update**: ❌ **NO UPDATE ENDPOINT**
- **Delete**: `DELETE /api/comments/:id` ✅

**Issue**: Users can create comments but cannot edit them if they make a mistake or want to update the content.

**Recommendation**: Add `PUT /api/comments/:id` or `PATCH /api/comments/:id` endpoint

### ✅ By Design (No Issues)

#### Project Permissions
- Grant/Revoke model (not traditional CRUD)
- Create = Grant permission
- Delete = Revoke permission
- Read = List permissions
- No "update" concept - you either have permission or you don't

#### Audit Log
- Read-only by design
- Automatically created by system
- Should never be updated or deleted to maintain integrity

## Required Fixes

### 1. Add DELETE endpoint for Metric Periods
```javascript
app.delete('/api/metric-periods/:id', authenticateToken, async (req, res) => {
  // Permission check
  // Delete metric period
  // Audit log
});
```

### 2. Add UPDATE endpoint for Comments
```javascript
app.put('/api/comments/:id', authenticateToken, async (req, res) => {
  // Permission check
  // Update comment content
  // Audit log
});
```

## Test Coverage Needed

All endpoints should be tested for:
1. Success cases with valid data
2. Authentication requirements
3. Authorization/permission checks
4. Invalid data handling
5. Not found scenarios
6. Cascading deletes (where applicable)
