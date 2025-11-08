# RAG Status Calculation

## Overview

The RAG (Red/Amber/Green) status indicator shows the health of a metric based on variance between complete and expected values.

## Calculation Logic

Both MetricChart.jsx and MetricTabs.jsx use the same calculation:

```javascript
const variance = complete - expected;
const variancePercent = expected > 0 ? Math.abs((variance / expected) * 100) : 0;
```

### Status Rules

1. **Green**: On track or ahead
   - `variance >= 0` (complete >= expected)

2. **Amber**: Behind schedule but within tolerance
   - `variance < 0 AND variancePercent <= redTolerance AND variancePercent > amberTolerance`
   - Default: 5% < variance ≤ 10%

3. **Red**: Significantly behind schedule
   - `variance < 0 AND variancePercent > redTolerance`
   - Default: variance > 10%

4. **Grey**: No baseline or flat trajectory
   - `expected === 0` OR flat trajectory detected

## Current Period Selection

**MetricTabs** displays the RAG status for the **current period** (most recent reporting date ≤ today), not the absolute latest data point.

This ensures consistency with the chart, which highlights the current period with a red triangle (▼) indicator.

### Example

Given data:
- Nov 7, 2025: complete=10, expected=8 (GREEN - 25% ahead)
- Dec 7, 2025: complete=0, expected=15 (RED - 100% behind)
- Jan 7, 2026: complete=0, expected=23 (RED - 100% behind)

**Current date:** Nov 8, 2025

**MetricTabs shows:** GREEN (uses Nov 7 data, the current period)
**Chart shows:** GREEN bar for Nov 7 with red triangle indicator

## Flat Trajectory Override

If a metric's trajectory is flat (changes <2% over last 3 periods), the RAG status is overridden to grey regardless of variance.

## Test Cases

### Test Case 1: Ahead of Schedule
```javascript
complete: 10, expected: 8
variance: 2 (20% ahead)
Expected: GREEN
```

### Test Case 2: Red Status
```javascript
complete: 80, expected: 100
variance: -20 (20% behind)
Expected: RED (exceeds 10% tolerance)
```

### Test Case 3: Amber Status
```javascript
complete: 93, expected: 100
variance: -7 (7% behind)
Expected: AMBER (between 5% and 10%)
```

### Test Case 4: Current Period Selection
```javascript
Data:
  - Nov 7: complete=10, expected=8 (GREEN)
  - Dec 7: complete=0, expected=15 (RED, future)
  - Jan 7: complete=0, expected=23 (RED, future)

Current date: Nov 8
Expected: GREEN (uses Nov 7, not Dec/Jan)
```

### Test Case 5: Grey Status (No Baseline)
```javascript
complete: 5, expected: 0
Expected: GREY (no baseline to compare against)
```

### Test Case 6: Flat Trajectory Override
```javascript
Data:
  - Sep: complete=10.0, expected=10
  - Oct: complete=10.1, expected=20 (would be RED)
  - Nov: complete=10.15, expected=30 (would be RED)

Expected: GREY (trajectory is flat, overrides RED)
```

## Files

- **MetricTabs.jsx** (lines 9-56): RAG status calculation for metric tabs
- **MetricChart.jsx** (lines 826-860): RAG status calculation for chart bars
- **MetricChart.jsx** (lines 141-218): RAG status display in tooltips

## Bug Fix History

### Issue: Inconsistent RAG Status (Nov 2025)

**Problem:** MetricTabs showed RED while MetricChart showed GREEN for the same metric.

**Root Cause:**
1. Variance calculation was reversed in MetricTabs (`expected - complete` instead of `complete - expected`)
2. MetricTabs was using the most recent data point (future period) instead of current period

**Fix:**
1. Aligned variance calculation: `variance = complete - expected` in both files
2. Changed MetricTabs to use current period (most recent date ≤ today) instead of absolute latest

**Commit:** d6056fe "Fix RAG status calculation inconsistency between chart and metric tabs"
