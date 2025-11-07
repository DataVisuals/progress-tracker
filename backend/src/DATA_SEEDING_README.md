# Data Seeding Scripts

This directory contains scripts to populate the Progress Tracker database with test data.

## Active Scripts (Recommended)

### 1. `seed-realistic-data.js` ⭐ **RECOMMENDED**
**Purpose:** Creates comprehensive, realistic test data for development and testing.

**What it creates:**
- Multiple portfolios (Digital Transformation, Customer Experience, Infrastructure, etc.)
- Diverse projects with various states (on-track, delayed, overperforming, completed)
- Different progression curves (linear, s-curve, exponential, logarithmic)
- Delinquent metrics and recovery patterns
- Historical audit trail
- Realistic CRAID items
- Project links

**Usage:**
```bash
node backend/src/seed-realistic-data.js
```

**Use when:** You need a complete, realistic dataset for development or demos.

---

### 2. `seed-diverse-data.js`
**Purpose:** Creates diverse project scenarios with various metric types and progressions.

**What it creates:**
- 5 portfolios
- 6 test users
- Multiple projects across different portfolios
- Various metric frequencies (weekly, monthly, quarterly)
- Different progression curves
- Sample periods with variance

**Usage:**
```bash
node backend/src/seed-diverse-data.js
```

**Use when:** You need variety in project types and progression patterns.

---

### 3. `create-timeline-test-data.js`
**Purpose:** Creates time-travel demonstration data with historical audit trail.

**What it creates:**
- A single project tracked over 60 days
- Historical audit log entries
- Progressive updates to metrics over time
- Commentary added at various points

**Usage:**
```bash
node backend/src/create-timeline-test-data.js
```

**Use when:** Testing the time-travel feature or audit log functionality.

---

### 4. `migrate-mock-data.js`
**Purpose:** Migration script for legacy mock data format.

**What it creates:**
- Basic project structure
- Simple metrics
- Minimal test data

**Usage:**
```bash
node backend/src/migrate-mock-data.js
```

**Use when:** Migrating from old data formats (rarely needed).

---

## Archived Scripts

Older/redundant scripts have been moved to `archived-seeds/` directory:
- `add-diverse-test-data.js`
- `add-variance-to-test-data.js`
- `populate-test-data.js`
- `seed-realistic-data-v2.js`
- `seed-diverse-data.js.bak`

These are kept for reference but should not be used.

---

## Password Hashing

**Important:** All scripts now use **scrypt** with `salt:hash` format, matching the server's authentication method.

**Default passwords:**
- Admin users: `admin123`
- Regular users: `password123`

---

## Database Schema Requirements

All scripts expect the following tables to exist:
- `users`
- `portfolios`
- `projects`
- `metrics`
- `metric_periods`
- `audit_log`
- `craids`
- `project_links`
- `project_permissions`

Run the schema migration first if needed:
```bash
sqlite3 backend/data/progress-tracker.db < backend/src/schema.sql
```

---

## Quick Start

For a complete development environment:

```bash
# 1. Ensure database exists
npm run db:init  # if you have this script

# 2. Seed with realistic data
node backend/src/seed-realistic-data.js

# 3. Start the server
npm start
```

---

## Troubleshooting

### "Cannot find module 'better-sqlite3'"
- Install dependencies: `cd backend && npm install`

### "Table doesn't exist"
- Run schema migration first
- Check that `backend/data/progress-tracker.db` exists

### "Authentication failed"
- All users now use scrypt password hashing
- Default password is `password123` or `admin123`
- If issues persist, re-run the seed script to reset passwords

---

**Last Updated:** 2025-11-07
**Maintainer:** Progress Tracker Team
