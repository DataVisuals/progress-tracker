# Time Travel Demonstration - Audit History

## Overview

The Progress Tracker includes a comprehensive audit history system that tracks all changes to projects, metrics, and data. This enables the "Time Travel" feature, which allows users to view historical snapshots of their projects at any point in time.

## Chronological Seed Data (V2)

The `seed-realistic-data-v2.js` script creates data **chronologically** to demonstrate realistic time travel:
- Data is entered as it would be in real life (period by period, month by month)
- Early snapshots show incomplete projects (e.g., April snapshot only shows Jan-March data)
- Each reporting period is created when its reporting date arrives
- Corrections and updates happen days after the initial data entry

### Why Chronological Matters

**Old Approach (Unrealistic):**
- All periods created upfront for Jan-Dec
- Audit log just shows corrections to existing data
- April snapshot would show all future periods with zero values

**New Approach (Realistic):**
- February 1: Create January period (only period that exists)
- March 2: Create February period (now 2 periods exist)
- April 1: Create March period (now 3 periods exist)
- April snapshot correctly shows ONLY Jan-March data

This mirrors how projects actually work - you don't know September's results in April!

## Types of Historical Changes Included

### 1. Data Corrections and Reconciliations
- **Initial underestimates corrected**: Shows realistic pattern where early data gets refined
- **Example**: Healthcare project registrations updated from 600 → 800 after data validation
- **Example**: E-commerce market counts adjusted after late submissions

### 2. Commentary Evolution
- **Iterative refinement**: Shows how commentary gets more detailed over time
- **Example**: "Good velocity" → "Sprint 3: Steady progress" → "Sprint 3: Steady progress. Team velocity stabilizing at ~23 points per sprint."
- **Context additions**: Initial brief notes get expanded with specific details

### 3. Target Adjustments
- **Scope changes**: Shows realistic project scope adjustments
- **Example**: Banking app features reduced from 28 → 24 (crypto wallet descoped to phase 2)
- **Example**: Supply chain savings target increased from $20M → $25M after identifying new opportunities

### 4. Issue Lifecycle Tracking
- **Problem identification**: CRAID items created as issues arise
- **Status progression**: Issues move from open → in_progress → resolved
- **Example**: Payment provider delays tracked from discovery through escalation to resolution

### 5. Sprint and Planning Adjustments
- **Velocity corrections**: Sprint points adjusted for carry-overs
- **Rollback scenarios**: Features removed after security reviews
- **Example**: Banking features rolled back from 5 → 4 after security review

### 6. Real Usage Patterns
- **Time diversity**: Changes span different times of day
  - Morning updates (8:30 AM)
  - Afternoon refinements (2:00 PM - 4:00 PM)
  - Late-night emergency fixes (10:15 PM)
- **Day-of-week variety**: Weekday updates with occasional weekend corrections

## Audit Log Statistics

After running the seed script:

```
Total Audit Entries: 33
├── UPDATE metric_periods: 24
├── UPDATE metrics: 2
├── UPDATE projects: 2
├── CREATE craids: 2
├── UPDATE craids: 2
└── UPDATE users: 1

Date Range: Oct 2023 - Oct 2024
Days with entries: 25 different dates
```

## Projects with Rich History

### 1. Healthcare Project (Patient Portal)
- **7 audit entries** tracking registration data corrections
- Commentary evolution from brief notes to detailed insights
- Project description refinement over time

### 2. E-commerce Project (Global Expansion)
- **9 audit entries** showing problem resolution lifecycle
- Issue tracking from discovery → escalation → resolution
- Recovery pattern from delinquency visible in time travel

### 3. AI Research Project (Drug Discovery)
- **4 audit entries** with data corrections
- Early project timeline (Oct 2023) shows system longevity
- Commentary refinements for clarity

### 4. Supply Chain Project
- **3 audit entries** including target adjustment
- Shows strategic planning changes mid-project
- Commentary evolution showing learning

### 5. Banking Project (Mobile Banking)
- **4 audit entries** including scope change
- Feature rollback after security review
- Target reduction showing realistic trade-offs

### 6. Data Warehouse Project
- **2 audit entries** for quarterly milestone tracking
- Late report additions showing realistic data collection delays

### 7. Support Project (AI Support Portal)
- **3 audit entries** showing sprint adjustments
- Progressive commentary enhancement
- Velocity trend tracking

## Using Time Travel

1. **Access**: Available to admins and PMs on any project
2. **Location**: Below the metric chart, shows slider when historical data exists
3. **Functionality**: Drag slider to see past states of the project
4. **Snapshots**: 33 different historical snapshots available

## What Changes Are Visible?

When traveling back in time, you'll see:
- ✅ Previous values for metric completion
- ✅ Old commentary text
- ✅ Historical project descriptions
- ✅ Old target values
- ✅ Previous CRAID statuses
- ❌ Current structure (metrics that exist today)

## Notable Time Travel Scenarios

### Scenario 1: Data Correction Story
Navigate to **Healthcare Project** → **Feb 2024**:
- You'll see registrations at 600 (before correction)
- Move to **Mar 2024**: Now shows corrected 800

### Scenario 2: Problem Resolution
Navigate to **E-commerce Project** → **Apr 2024**:
- Germany launch shown as blocked
- Move to **Jun 2024**: See resolution and recovery

### Scenario 3: Commentary Enhancement
Navigate to **Support Project** → **Jun 24 10:00 AM**:
- Commentary: "Good velocity"
- Move to **Jun 24 3:00 PM**: Enhanced to "Sprint 3: Steady progress. Team velocity stabilizing..."

### Scenario 4: Scope Change
Navigate to **Banking Project** → **Sep 2024**:
- Target: 28 features
- Move to **Oct 2024**: Target reduced to 24 (crypto descoped)

## Technical Implementation

### Audit Log Schema
```sql
- user_id: Who made the change
- action: CREATE, UPDATE, DELETE
- table_name: Which table was affected
- record_id: Which record changed
- old_values: JSON of previous state
- new_values: JSON of new state
- description: Human-readable explanation
- created_at: Precise timestamp
```

### Time Travel Query
The system queries audit logs to reconstruct historical state:
1. Get all changes before target timestamp
2. Apply changes in chronological order
3. Reconstruct metric_periods state at that moment

## Best Practices Demonstrated

1. **Descriptive audit messages**: Each change has clear explanation
2. **Granular timestamps**: Precise to the second for debugging
3. **JSON state preservation**: Both old and new values stored
4. **Multiple change types**: Shows full spectrum of operations
5. **Realistic patterns**: Mirrors actual project management workflows

## Regenerating Demo Data

To regenerate with fresh audit history:

```bash
cd backend
node src/seed-realistic-data.js
```

This will:
- Clear existing test data
- Create 7 diverse projects
- Generate 40+ audit log entries
- Span 13+ months of history
- Include all change types

## Future Enhancements

Potential additions to consider:
- [ ] Multi-user changes (currently all admin)
- [ ] Bulk import/export changes
- [ ] Merge conflict resolutions
- [ ] Automated system changes
- [ ] API-driven updates vs manual edits
