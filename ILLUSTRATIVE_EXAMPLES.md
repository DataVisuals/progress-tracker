# Illustrative Examples Portfolio

This document describes the "Illustrative Examples" portfolio that is automatically created on server startup to demonstrate Progress Tracker features.

## Overview

The Illustrative Examples portfolio contains **5 diverse example projects** showcasing all features of the Progress Tracker application. All data is clearly marked with `[Example]` or `[Demo]` prefixes to indicate it is for illustrative purposes only.

## Portfolio Details

- **Name**: Illustrative Examples
- **Color**: Purple (#9333ea)
- **Description**: 📚 Demonstration projects showcasing Progress Tracker features. All data is for illustrative purposes only.

## Example Projects

### 1. Global Infrastructure Rollout
**Type**: Multi-phase infrastructure deployment
**Duration**: 6 months (4 months completed, 2 months remaining)
**Status**: In Progress

**Demonstrates**:
- Completed, upcoming, and future milestones
- Multiple milestone phases (Requirements, Vendor Selection, Regional Rollouts)
- Multiple metrics tracking different aspects:
  - Datacenters Migrated (count-based metric)
  - Network Uptime % (percentage-based metric)
- Historical data showing progress over time

**Milestones** (8 total):
- ✅ Requirements Gathering
- ✅ Vendor Selection
- ✅ Phase 1: NA Datacenters
- ✅ Phase 2: EMEA Rollout
- 🔵 Phase 3: APAC Deployment (Today)
- 🔵 Security Audit (15 days out)
- 🔵 Performance Testing (30 days out)
- 🔵 Final Cutover (55 days out)

### 2. Customer Churn Prediction Model
**Type**: Machine Learning project
**Duration**: 6 months (3 months completed, 3 months remaining)
**Status**: Behind Schedule (overdue milestone)

**Demonstrates**:
- ML/Data Science project lifecycle
- Logarithmic progression type (typical for ML accuracy improvements)
- Overdue milestone (A/B Test Deployment - 5 days late)
- Model accuracy tracking over time

**Milestones** (8 total):
- ✅ Data Collection & Cleaning
- ✅ Feature Engineering
- ✅ Model Training v1
- ✅ Model Validation
- ❌ A/B Test Deployment (OVERDUE by 5 days)
- 🔵 Production Rollout
- 🔵 Performance Monitoring
- 🔵 Model Retraining

**Metrics**:
- Model Accuracy % (shows improving trend from 72% to 92.5%)

### 3. Mobile App User Onboarding
**Type**: UX/Product project
**Duration**: 3 months (1.5 months completed, 1.5 months remaining)
**Status**: On Track

**Demonstrates**:
- UX research and design workflow
- Sprint-based development approach
- User completion rate tracking
- Beta launch planning

**Milestones** (7 total):
- ✅ User Research & Analysis
- ✅ Design Mockups
- ✅ Prototype Development
- 🔵 Usability Testing (Today)
- 🔵 Development Sprint 1
- 🔵 Development Sprint 2
- 🔵 Beta Launch

**Metrics**:
- Onboarding Completion Rate % (trending upward from 42% to 62%)

### 4. Jira Cloud Migration
**Type**: System migration project
**Duration**: 2 months (1 month completed, 1 month remaining)
**Status**: On Track

**Demonstrates**:
- Migration project tracking
- Phase-based execution
- User training coordination
- Linear progression with clear milestones

**Milestones** (6 total):
- ✅ Migration Planning
- ✅ Cloud Instance Setup
- ✅ Plugin Configuration
- 🔵 Data Migration - Phase 1
- 🔵 User Training
- 🔵 Production Cutover

**Metrics**:
- Projects Migrated (89 of 150 completed)

### 5. Legacy System Modernization
**Type**: Technical debt / Obsolescence tracking
**Duration**: 6 months (2 months completed, 4 months remaining)
**Status**: On Track

**Demonstrates**:
- Long-term modernization efforts
- Multiple simultaneous metrics
- Technical debt reduction tracking
- System health improvements
- Decommissioning schedules

**Milestones** (7 total):
- ✅ Legacy System Audit
- ✅ Modernization Roadmap
- ✅ API Layer Development
- 🔵 Database Migration (10 days out)
- 🔵 Service Decomposition
- 🔵 Old System Decommission
- 🔵 Full Cutover

**Metrics**:
- Legacy Components Retired (25 of 45 completed)
- System Health Score (68 of 90 target)

## Additional Features Demonstrated

### CRAIDs (Comments, Risks, Actions, Issues, Dependencies)
Each project includes:
- **1 Risk**: Resource availability concerns with mitigation strategies
- **1 Action**: Weekly status update requirements

### Project Links
Each project includes example links to:
- Example Jira Board
- Example Confluence documentation

### Feedback
- Positive feedback on Infrastructure rollout progress
- Concern feedback about ML model A/B test delay

## Data Characteristics

### Time Periods
All dates are generated relative to today:
- Past completed milestones: -120 to -5 days
- Current milestones: Around today (0 days)
- Future milestones: +5 to +115 days

### Metric Data
- Historical data points show realistic progression
- Different progression types (linear, logarithmic)
- Various measurement types (counts, percentages, composite scores)
- Demonstrates both ahead-of-schedule and behind-schedule scenarios

### Milestone States
- **Completed**: Green checkmarks, completion dates recorded
- **Upcoming**: Blue circles, clear target dates
- **Overdue**: Red indicators with pulse animation (ML project)

## Usage

The Illustrative Examples portfolio is automatically seeded:
1. **On first server startup** - Creates portfolio and all projects
2. **Subsequent startups** - Skips if portfolio already exists (no duplicates)

### Manual Seeding
To manually run the seed script:
```bash
node backend/src/seed-illustrative-examples.js
```

### Removing Examples
To remove the illustrative examples:
1. Delete the "Illustrative Examples" portfolio via the UI
2. All associated projects, metrics, milestones, and data will be cascade-deleted

## Experimental Features

The Milestones tab is marked as **Experimental** with an orange badge, indicating:
- New feature under active development
- Functionality may change based on user feedback
- Full documentation forthcoming

## Benefits

This portfolio provides:
- **Onboarding**: New users can explore features without creating dummy data
- **Demonstrations**: Sales/demo presentations have realistic examples
- **Testing**: QA and development can use consistent test data
- **Training**: Documentation and training materials reference real examples
- **Feature Showcase**: Highlights all major Progress Tracker capabilities

## Clear Labeling

All illustrative data is prefixed:
- Projects: `[Example]`
- Metrics: `[Example]`
- Feedback: `[Example Feedback]`
- CRAIDs: `[Example]`

This ensures users can easily distinguish demonstration data from production data.
