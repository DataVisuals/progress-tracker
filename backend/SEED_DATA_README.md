# Realistic Test Data

This directory contains a comprehensive data seeding script that populates the Progress Tracker with realistic, diverse test data.

## Running the Seed Script

```bash
node backend/src/seed-realistic-data.js
```

**Note:** This will **clear all existing data** except user accounts. Run with caution!

## What's Included

The seed script creates 7 diverse projects showcasing all application features:

### 1. Patient Portal Modernization (Healthcare)
- **Status:** Overperforming ✅
- **Curve:** S-Curve (slow start, rapid growth, leveling off)
- **Frequency:** Monthly
- **Demonstrates:** Exceeding targets, successful product launch
- **50K user registrations target - achieved 52K by month 8**

### 2. Global E-commerce Expansion
- **Status:** Recovered from delinquency ✅
- **Curve:** Linear
- **Frequency:** Monthly
- **Demonstrates:** Delinquency → Recovery pattern, team resilience
- **15 market launches - delayed in Q2, recovered by Q4**

### 3. AI Research Platform
- **Status:** Completed + Continued tracking ✅
- **Curve:** Exponential (rapid acceleration)
- **Frequency:** Monthly
- **Demonstrates:** Post-completion tracking, exponential growth
- **500 models trained - exceeded goal, continuing operations**

### 4. Supply Chain Optimization
- **Status:** Diminishing returns ⚠️
- **Curve:** Logarithmic (front-loaded wins)
- **Frequency:** Monthly
- **Demonstrates:** Quick wins then plateau, need for new initiatives
- **$25M savings target - approaching saturation at $24M**

### 5. Next-Gen Mobile Banking
- **Status:** Currently delinquent ⚠️
- **Curve:** Linear
- **Frequency:** Monthly
- **Demonstrates:** Active problems, security delays, descoping
- **24 features target - behind schedule due to security rework**

### 6. Enterprise Data Warehouse Migration
- **Status:** Successfully completed ✅
- **Curve:** Linear
- **Frequency:** Quarterly
- **Demonstrates:** Large-scale migration, quarterly reporting
- **500 reports migrated - on time, on budget**

### 7. AI-Powered Support Portal
- **Status:** In progress ✅
- **Curve:** Linear
- **Frequency:** Weekly
- **Demonstrates:** Agile/sprint tracking, weekly velocity
- **520 story points target - steady progress**

## Features Demonstrated

### Performance Patterns
- ✅ **Overperformance** - Healthcare project exceeding targets
- ⚠️ **Delinquency** - Banking and e-commerce showing delays
- 🔄 **Recovery** - E-commerce recovering from setbacks
- 📈 **Post-completion** - AI platform continuing after success
- 📉 **Diminishing returns** - Supply chain hitting plateau

### Progression Curves
- **Linear** - Steady, predictable progress
- **S-Curve** - Slow start, rapid middle, slow end (adoption curves)
- **Exponential** - Compounding growth (ML training, network effects)
- **Logarithmic** - Quick wins early, harder later (optimization)

### Frequencies
- **Weekly** - Agile sprint tracking
- **Monthly** - Most common, general project tracking
- **Quarterly** - Executive reporting, large initiatives

### Additional Features
- **Comments** - Historical context for key decisions and milestones
- **CRAIDs** - Challenges, Risks, Actions, Issues, Dependencies
- **Project Links** - Jira boards, documentation, dashboards
- **Time Travel** - Audit logs showing historical changes
- **Realistic Commentary** - Authentic project narratives

## Time Travel Capabilities

The seed data includes historical audit logs demonstrating:
- Metric value revisions with explanations
- Project description updates
- CRAID status changes (open → in_progress → resolved)
- Commentary on delays and recovery plans

## Use Cases

This data set is perfect for:
- **Demos** - Show prospective clients realistic project tracking
- **Training** - Onboard new users with realistic scenarios
- **Testing** - Validate features with diverse data patterns
- **Development** - Test edge cases and performance
- **Presentations** - Screenshot-ready professional examples

## Data Highlights

| Metric | Value |
|--------|-------|
| Projects | 7 |
| Metrics | 7 |
| Periods | ~150 |
| Comments | ~25 |
| CRAIDs | ~18 |
| Links | ~15 |
| Audit Logs | Historical changes |

## Customization

To add your own test data:
1. Copy `seed-realistic-data.js`
2. Modify project details, metrics, and performance data
3. Run your custom seed script

## Resetting Data

To restore the realistic test data:
```bash
node backend/src/seed-realistic-data.js
```

This will clear existing data and repopulate with the standard test set.
