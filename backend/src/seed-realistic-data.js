#!/usr/bin/env node

/**
 * Realistic Test Data Migration Script
 *
 * This script populates the Progress Tracker database with comprehensive,
 * realistic test data demonstrating all application features including:
 * - Various project states (on-track, delayed, overperforming, completed)
 * - Different progression curves (linear, s-curve, exponential, logarithmic)
 * - Delinquent metrics and recovery patterns
 * - Time travel with historical comments
 * - Post-completion tracking
 * - Realistic project links
 * - Diverse CRAID items
 */

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const scrypt = promisify(crypto.scrypt);

// Hash password using same method as server.js
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

const DB_PATH = path.join(__dirname, '../data/progress-tracker.db');

// Helper to promisify database operations
const db = new sqlite3.Database(DB_PATH);

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Helper function to calculate expected value based on progression type
function calculateExpectedValue(progressionType, finalTarget, periodIndex, totalPeriods) {
  const ratio = periodIndex / totalPeriods;

  switch(progressionType) {
    case 'linear':
      return Math.round(finalTarget * ratio);
    case 's-curve':
      return Math.round(finalTarget / (1 + Math.exp(-10 * (ratio - 0.5))));
    case 'exponential':
      return Math.round(finalTarget * (Math.exp(3 * ratio) - 1) / (Math.exp(3) - 1));
    case 'logarithmic':
      return Math.round(finalTarget * Math.sqrt(ratio));
    default:
      return Math.round(finalTarget * ratio);
  }
}

// Generate periods for a metric
async function generatePeriods(metricId, startDate, endDate, frequency, progressionType, finalTarget) {
  const periods = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let current = new Date(start);

  while (current <= end) {
    periods.push({
      metric_id: metricId,
      reporting_date: current.toISOString().split('T')[0],
    });

    if (frequency === 'weekly') {
      current.setDate(current.getDate() + 7);
    } else if (frequency === 'monthly') {
      current.setMonth(current.getMonth() + 1);
    } else if (frequency === 'quarterly') {
      current.setMonth(current.getMonth() + 3);
    }
  }

  const totalPeriods = periods.length;

  for (let index = 0; index < periods.length; index++) {
    const period = periods[index];
    const expected = calculateExpectedValue(progressionType, finalTarget, index + 1, totalPeriods);
    const result = await dbRun(
      `INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete) VALUES (?, ?, ?, ?, 0)`,
      [period.metric_id, period.reporting_date, expected, finalTarget]
    );
    periods[index].id = result.lastID;
  }

  return periods;
}

// Update periods with realistic performance data
async function updatePeriodPerformance(periodId, complete, commentary = null) {
  await dbRun(
    `UPDATE metric_periods SET complete = ?, commentary = ? WHERE id = ?`,
    [complete, commentary, periodId]
  );
}

// Add audit log entry
async function addAuditLog(userId, userEmail, action, tableName, recordId, oldValues, newValues, description, timestamp) {
  await dbRun(
    `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, userEmail, action, tableName, recordId,
     oldValues ? JSON.stringify(oldValues) : null,
     newValues ? JSON.stringify(newValues) : null,
     description, timestamp]
  );
}

// Add comment to a period
async function addComment(periodId, userId, commentText, timestamp) {
  const result = await dbRun(
    `INSERT INTO comments (period_id, created_by, comment_text, created_at)
     VALUES (?, ?, ?, ?)`,
    [periodId, userId, commentText, timestamp]
  );
  return result.lastID;
}

async function seedRealisticData() {
  console.log('🌱 Starting realistic data migration...\n');

  try {
    // Clear existing data (except users)
    console.log('🧹 Clearing existing test data...');
    await dbRun('DELETE FROM comments');
    await dbRun('DELETE FROM metric_periods');
    await dbRun('DELETE FROM metrics');
    await dbRun('DELETE FROM craids');
    await dbRun('DELETE FROM project_links');
    await dbRun('DELETE FROM projects');
    await dbRun('DELETE FROM audit_log');

    console.log('✅ Cleared existing data\n');

    // Get admin user
    const admin = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@example.com']);
    if (!admin) {
      console.error('❌ Admin user not found. Please run the server first to initialize users.');
      return;
    }

    console.log('📁 Creating diverse projects...\n');

    // PROJECT 1: Healthcare App - Overperforming (S-Curve)
    const healthcareResult = await dbRun(
      `INSERT INTO projects (name, description, initiative_manager, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        '[Test] Patient Portal Modernization',
        'Comprehensive upgrade of patient-facing digital services including appointment scheduling, medical records access, and telehealth integration',
        'Dr. Sarah Chen',
        '2024-01-01',
        '2024-12-31',
        '2024-01-01T08:00:00Z'
      ]
    );
    const healthcareId = healthcareResult.lastID;

    // Add project links
    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [healthcareId, 'Jira Board', 'https://jira.company.com/projects/HEALTH', 1]);
    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [healthcareId, 'Confluence Docs', 'https://confluence.company.com/healthcare', 2]);
    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [healthcareId, 'Architecture Diagrams', 'https://miro.com/board/healthcare-arch', 3]);

    // Metric: User Registrations (S-Curve, Overperforming)
    const registrationsMetric = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [healthcareId, 'New User Registrations', admin.id, '2024-01-31', '2024-12-31', 'monthly', 's-curve', 50000, 10, 20, 'lead']
    );
    let periods = await generatePeriods(registrationsMetric.lastID, '2024-01-31', '2024-12-31', 'monthly', 's-curve', 50000);

    // Update with overperforming data
    await updatePeriodPerformance(periods[0].id, 800, 'Soft launch exceeded expectations');
    await addComment(periods[0].id, admin.id, 'Marketing campaign drove higher than expected signups', '2024-02-01T10:00:00Z');
    await updatePeriodPerformance(periods[1].id, 2500, 'Word of mouth accelerating adoption');
    await updatePeriodPerformance(periods[2].id, 5800, 'Partnership with insurance providers boosting growth');
    await updatePeriodPerformance(periods[3].id, 12000, 'Mobile app launch successful');
    await addComment(periods[3].id, admin.id, 'iOS and Android apps both hit top 10 in health category', '2024-05-02T14:30:00Z');
    await updatePeriodPerformance(periods[4].id, 22000, 'Strong momentum continuing');
    await updatePeriodPerformance(periods[5].id, 35000, 'Telehealth feature driving engagement');
    await updatePeriodPerformance(periods[6].id, 45000, 'On track for early goal achievement');
    await updatePeriodPerformance(periods[7].id, 52000, 'Exceeded annual target ahead of schedule!');

    // Additional Healthcare Metrics - Making this a 5-metric project

    // Metric 2: Telehealth Sessions (S-Curve, Overperforming)
    const telehealthMetric = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [healthcareId, 'Telehealth Sessions', admin.id, '2024-01-31', '2024-12-31', 'monthly', 's-curve', 100000, 10, 20, 'lead']
    );
    let telehealthPeriods = await generatePeriods(telehealthMetric.lastID, '2024-01-31', '2024-12-31', 'monthly', 's-curve', 100000);
    await updatePeriodPerformance(telehealthPeriods[0].id, 1200, 'Soft launch of telehealth feature');
    await updatePeriodPerformance(telehealthPeriods[1].id, 4500, 'Growing adoption among existing patients');
    await updatePeriodPerformance(telehealthPeriods[2].id, 12000, 'Marketing campaign for telehealth');
    await updatePeriodPerformance(telehealthPeriods[3].id, 25000, 'Strong uptake from rural areas');
    await updatePeriodPerformance(telehealthPeriods[4].id, 45000, 'Partnership with employers boosting usage');
    await updatePeriodPerformance(telehealthPeriods[5].id, 68000, 'Insurance coverage expanding');
    await updatePeriodPerformance(telehealthPeriods[6].id, 88000, 'Near target - excellent adoption');
    await updatePeriodPerformance(telehealthPeriods[7].id, 105000, 'Exceeded target!');

    // Metric 3: Provider Satisfaction Score (Linear, On Track)
    const providerSatMetric = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [healthcareId, 'Provider Satisfaction Score', admin.id, '2024-03-31', '2024-12-31', 'quarterly', 'linear', 90, 5, 10, 'lag']
    );
    let providerPeriods = await generatePeriods(providerSatMetric.lastID, '2024-03-31', '2024-12-31', 'quarterly', 'linear', 90);
    await updatePeriodPerformance(providerPeriods[0].id, 72, 'Baseline measurement - room for improvement');
    await updatePeriodPerformance(providerPeriods[1].id, 78, 'UI improvements well received');
    await updatePeriodPerformance(providerPeriods[2].id, 85, 'EHR integration reducing admin burden');
    if (providerPeriods.length > 3) await updatePeriodPerformance(providerPeriods[3].id, 88, 'Strong upward trend');

    // Metric 4: App Store Rating (Logarithmic, Quick Win Early)
    const appRatingMetric = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [healthcareId, 'App Store Rating', admin.id, '2024-04-30', '2024-12-31', 'monthly', 'logarithmic', 4.8, 3, 5, 'lag']
    );
    let appRatingPeriods = await generatePeriods(appRatingMetric.lastID, '2024-04-30', '2024-12-31', 'monthly', 'logarithmic', 4.8);
    await updatePeriodPerformance(appRatingPeriods[0].id, 4.2, 'Initial launch ratings');
    await updatePeriodPerformance(appRatingPeriods[1].id, 4.4, 'Bug fixes improving ratings');
    await updatePeriodPerformance(appRatingPeriods[2].id, 4.5, 'Performance improvements');
    await updatePeriodPerformance(appRatingPeriods[3].id, 4.6, 'New features well received');
    await updatePeriodPerformance(appRatingPeriods[4].id, 4.65, 'Steady improvement');
    await updatePeriodPerformance(appRatingPeriods[5].id, 4.7, 'User feedback implemented');
    await updatePeriodPerformance(appRatingPeriods[6].id, 4.72, 'Minor bug fixes');
    if (appRatingPeriods.length > 7) await updatePeriodPerformance(appRatingPeriods[7].id, 4.75, 'Approaching target');

    // Metric 5: Data Migration Completion (Linear, Behind Schedule)
    const dataMigrationMetric = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [healthcareId, 'Patient Records Migrated (%)', admin.id, '2024-01-31', '2024-08-31', 'monthly', 'linear', 100, 8, 15, 'lead']
    );
    let migrationPeriods = await generatePeriods(dataMigrationMetric.lastID, '2024-01-31', '2024-08-31', 'monthly', 'linear', 100);
    await updatePeriodPerformance(migrationPeriods[0].id, 10, 'Initial batch migration started');
    await updatePeriodPerformance(migrationPeriods[1].id, 22, 'Slower than expected due to data quality issues');
    await updatePeriodPerformance(migrationPeriods[2].id, 35, 'Data cleansing taking extra time');
    await updatePeriodPerformance(migrationPeriods[3].id, 52, 'Process optimization helping');
    await updatePeriodPerformance(migrationPeriods[4].id, 70, 'Back on track');
    await updatePeriodPerformance(migrationPeriods[5].id, 88, 'Final batch in progress');
    await updatePeriodPerformance(migrationPeriods[6].id, 98, 'Edge cases remaining');
    if (migrationPeriods.length > 7) await updatePeriodPerformance(migrationPeriods[7].id, 100, 'Migration complete!');

    // Add CRAIDs
    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [healthcareId, 'challenge', 'HIPAA Compliance Verification', 'Ensuring all data handling meets strict healthcare privacy requirements', 'in_progress', 'high']);
    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [healthcareId, 'risk', 'Third-party API Reliability', 'Dependency on external insurance verification APIs', 'open', 'medium']);

    // PROJECT 2: E-commerce Platform - Delinquent then Recovery
    const ecommerceResult = await dbRun(
      `INSERT INTO projects (name, description, initiative_manager, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        '[Test] Global E-commerce Expansion',
        'Launch of multi-currency, multi-language e-commerce platform targeting European and Asian markets',
        'James Liu',
        '2024-02-01',
        '2024-11-30',
        '2024-02-01T09:00:00Z'
      ]
    );
    const ecommerceId = ecommerceResult.lastID;

    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [ecommerceId, 'GitHub Repo', 'https://github.com/company/ecommerce', 1]);
    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [ecommerceId, 'Staging Environment', 'https://staging.shop.company.com', 2]);

    // Metric: Markets Launched (Linear, Shows Delinquency and Recovery)
    const marketsMetric = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ecommerceId, 'Market Launches Completed', admin.id, '2024-02-29', '2024-11-30', 'monthly', 'linear', 15, 5, 10, 'lead']
    );
    periods = await generatePeriods(marketsMetric.lastID, '2024-02-29', '2024-11-30', 'monthly', 'linear', 15);

    // Show delinquency
    await updatePeriodPerformance(periods[0].id, 1, 'First market (UK) launched successfully');
    await updatePeriodPerformance(periods[1].id, 2, 'Germany launch delayed due to payment integration');
    await addComment(periods[1].id, admin.id, 'Payment provider certification taking longer than expected', '2024-04-03T11:15:00Z');
    await updatePeriodPerformance(periods[2].id, 2, 'Still blocked on German payment integration');
    await addComment(periods[2].id, admin.id, 'Escalated to payment provider executive team. Meeting scheduled for next week.', '2024-05-05T09:30:00Z');
    await updatePeriodPerformance(periods[3].id, 4, 'Germany unblocked, launched 2 markets this month');
    await addComment(periods[3].id, admin.id, 'Recovery plan in place. Adding extra resources to catch up.', '2024-06-04T16:00:00Z');
    await updatePeriodPerformance(periods[4].id, 7, 'Catch-up plan working - launched 3 markets');
    await updatePeriodPerformance(periods[5].id, 10, 'Back on track with accelerated delivery');
    await updatePeriodPerformance(periods[6].id, 13, 'Strong momentum maintained');
    await updatePeriodPerformance(periods[7].id, 15, 'All 15 markets launched - recovery complete!');
    await addComment(periods[7].id, admin.id, 'Excellent recovery from Q2 setback. Team demonstrated great resilience.', '2024-10-02T14:00:00Z');

    // Additional E-commerce Metrics - Making this a 4-metric project

    // Metric 2: GMV (Gross Merchandise Value) - Exponential growth
    const gmvMetric = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ecommerceId, 'GMV ($M)', admin.id, '2024-02-29', '2024-11-30', 'monthly', 'exponential', 50, 10, 20, 'lag']
    );
    let gmvPeriods = await generatePeriods(gmvMetric.lastID, '2024-02-29', '2024-11-30', 'monthly', 'exponential', 50);
    await updatePeriodPerformance(gmvPeriods[0].id, 0.5, 'UK market initial sales');
    await updatePeriodPerformance(gmvPeriods[1].id, 1.2, 'Growing customer base');
    await updatePeriodPerformance(gmvPeriods[2].id, 2.0, 'Germany launch delayed impact on GMV');
    await updatePeriodPerformance(gmvPeriods[3].id, 5.5, 'Multi-market sales ramping');
    await updatePeriodPerformance(gmvPeriods[4].id, 12, 'Strong Q3 performance');
    await updatePeriodPerformance(gmvPeriods[5].id, 22, 'Holiday season preparation');
    await updatePeriodPerformance(gmvPeriods[6].id, 38, 'Black Friday success');
    await updatePeriodPerformance(gmvPeriods[7].id, 52, 'Exceeded target!');

    // Metric 3: Customer Acquisition Cost (Linear decrease)
    const cacMetric = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ecommerceId, 'Customer Acquisition Cost ($)', admin.id, '2024-02-29', '2024-11-30', 'monthly', 'linear', 25, 15, 25, 'lag']
    );
    let cacPeriods = await generatePeriods(cacMetric.lastID, '2024-02-29', '2024-11-30', 'monthly', 'linear', 25);
    await updatePeriodPerformance(cacPeriods[0].id, 85, 'High initial CAC in new market');
    await updatePeriodPerformance(cacPeriods[1].id, 72, 'Optimizing ad spend');
    await updatePeriodPerformance(cacPeriods[2].id, 65, 'Brand awareness growing');
    await updatePeriodPerformance(cacPeriods[3].id, 52, 'Organic traffic increasing');
    await updatePeriodPerformance(cacPeriods[4].id, 42, 'Referral program success');
    await updatePeriodPerformance(cacPeriods[5].id, 35, 'Word of mouth effect');
    await updatePeriodPerformance(cacPeriods[6].id, 28, 'Near target');
    await updatePeriodPerformance(cacPeriods[7].id, 24, 'CAC target achieved');

    // Metric 4: Warehouse Integration Completion
    const warehouseMetric = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ecommerceId, 'Warehouse Integrations', admin.id, '2024-02-29', '2024-11-30', 'monthly', 's-curve', 12, 10, 20, 'lead']
    );
    let warehousePeriods = await generatePeriods(warehouseMetric.lastID, '2024-02-29', '2024-11-30', 'monthly', 's-curve', 12);
    await updatePeriodPerformance(warehousePeriods[0].id, 1, 'UK warehouse integrated');
    await updatePeriodPerformance(warehousePeriods[1].id, 2, 'Germany warehouse setup');
    await updatePeriodPerformance(warehousePeriods[2].id, 3, 'France integration delayed');
    await updatePeriodPerformance(warehousePeriods[3].id, 5, 'Catching up on integrations');
    await updatePeriodPerformance(warehousePeriods[4].id, 7, 'Southern Europe warehouses');
    await updatePeriodPerformance(warehousePeriods[5].id, 9, 'Nordic warehouses live');
    await updatePeriodPerformance(warehousePeriods[6].id, 11, 'Eastern Europe complete');
    await updatePeriodPerformance(warehousePeriods[7].id, 12, 'All warehouses integrated');

    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [ecommerceId, 'issue', 'Payment Provider Delays', 'Certification process slower than anticipated', 'resolved', 'high']);
    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [ecommerceId, 'dependency', 'Currency Exchange Rate API', 'Real-time FX rates required for pricing', 'open', 'medium']);
    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [ecommerceId, 'action', 'Load Testing', 'Performance testing required before each market launch', 'in_progress', 'high']);

    // PROJECT 3: AI Research Platform - Exponential Growth
    const aiResult = await dbRun(
      `INSERT INTO projects (name, description, initiative_manager, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        '[Test] AI Research Platform',
        'Development of machine learning infrastructure for pharmaceutical drug discovery, including GPU clusters and model training pipelines',
        'Dr. Priya Sharma',
        '2023-07-01',
        '2024-06-30',
        '2023-07-01T10:00:00Z'
      ]
    );
    const aiId = aiResult.lastID;

    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [aiId, 'Research Dashboard', 'https://ai-research.company.com', 1]);
    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [aiId, 'Model Registry', 'https://models.company.com', 2]);
    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [aiId, 'GPU Cluster Dashboard', 'https://compute.company.com', 3]);

    // Metric: Models Trained (Exponential, Completed Project with Continued Tracking)
    const modelsMetric = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [aiId, 'Drug Discovery Models Trained', admin.id, '2023-07-31', '2024-09-30', 'monthly', 'exponential', 500, 8, 15, 'lead']
    );
    periods = await generatePeriods(modelsMetric.lastID, '2023-07-31', '2024-09-30', 'monthly', 'exponential', 500);

    // Exponential growth pattern - completed and continuing
    await updatePeriodPerformance(periods[0].id, 2, 'Infrastructure setup phase');
    await updatePeriodPerformance(periods[1].id, 5, 'First research team onboarded');
    await updatePeriodPerformance(periods[2].id, 8, 'GPU cluster expansion complete');
    await addComment(periods[2].id, admin.id, 'Added 50 A100 GPUs. Training throughput increased 3x.', '2023-10-02T13:00:00Z');
    await updatePeriodPerformance(periods[3].id, 15, 'AutoML pipeline deployed');
    await updatePeriodPerformance(periods[4].id, 30, 'Parallel training optimization working well');
    await updatePeriodPerformance(periods[5].id, 60, 'Research teams fully ramped up');
    await addComment(periods[5].id, admin.id, 'All 5 research teams now actively using the platform.', '2024-01-05T10:30:00Z');
    await updatePeriodPerformance(periods[6].id, 110, 'Exponential growth phase beginning');
    await updatePeriodPerformance(periods[7].id, 190, 'High throughput sustained');
    await updatePeriodPerformance(periods[8].id, 310, 'Hyperparameter optimization accelerating training');
    await updatePeriodPerformance(periods[9].id, 450, 'Approaching target');
    await updatePeriodPerformance(periods[10].id, 520, 'Target exceeded! Project successful.');
    await addComment(periods[10].id, admin.id, 'Exceeded annual goal by 4%. Platform is production-ready.', '2024-07-03T15:00:00Z');
    await updatePeriodPerformance(periods[11].id, 630, 'Post-completion: Continuing operations');
    await addComment(periods[11].id, admin.id, 'Platform now in BAU mode. Training 100+ models per month.', '2024-08-05T11:00:00Z');
    await updatePeriodPerformance(periods[12].id, 750, 'Post-completion: Platform expanding');
    await addComment(periods[12].id, admin.id, 'New research partnerships driving increased usage. Platform capacity increased.', '2024-09-04T14:30:00Z');

    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [aiId, 'challenge', 'GPU Availability', 'High demand for compute resources during peak periods', 'resolved', 'high']);
    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [aiId, 'risk', 'Model Reproducibility', 'Ensuring consistent results across training runs', 'resolved', 'medium']);

    // PROJECT 4: Supply Chain Optimization - Logarithmic (Front-loaded)
    const supplyChainResult = await dbRun(
      `INSERT INTO projects (name, description, initiative_manager, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        '[Test] Supply Chain Optimization',
        'Implementation of predictive analytics and route optimization for global logistics network, targeting 25% cost reduction',
        'Maria Rodriguez',
        '2024-03-01',
        '2024-12-31',
        '2024-03-01T08:30:00Z'
      ]
    );
    const supplyChainId = supplyChainResult.lastID;

    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [supplyChainId, 'Tableau Dashboard', 'https://tableau.company.com/supply-chain', 1]);
    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [supplyChainId, 'Project Charter', 'https://docs.company.com/supply-chain-charter', 2]);

    // Metric: Cost Savings (Logarithmic - quick wins early)
    const savingsMetric = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [supplyChainId, 'Cost Savings ($M)', admin.id, '2024-03-31', '2024-12-31', 'monthly', 'logarithmic', 25, 8, 15, 'lag']
    );
    periods = await generatePeriods(savingsMetric.lastID, '2024-03-31', '2024-12-31', 'monthly', 'logarithmic', 25);

    // Back-loaded pattern - savings realized when optimizations complete and stabilize
    await updatePeriodPerformance(periods[0].id, 0, 'Planning and analysis phase');
    await addComment(periods[0].id, admin.id, 'Mapping current supply chain. Identifying optimization opportunities.', '2024-04-03T09:00:00Z');
    await updatePeriodPerformance(periods[1].id, 1, 'Pilot programs launched - minimal savings yet');
    await updatePeriodPerformance(periods[2].id, 2.5, 'Route optimization deployed but still tuning');
    await updatePeriodPerformance(periods[3].id, 4, 'Early indicators positive but not yet realized');
    await addComment(periods[3].id, admin.id, 'Systems in place. Need full quarter of operations to measure actual savings.', '2024-07-02T10:30:00Z');
    await updatePeriodPerformance(periods[4].id, 7, 'First quarter results - initial savings confirmed');
    await updatePeriodPerformance(periods[5].id, 12, 'Momentum building as all optimizations activate');
    await addComment(periods[5].id, admin.id, 'All 3 initiatives now live. Compound savings accelerating.', '2024-09-04T15:00:00Z');
    await updatePeriodPerformance(periods[6].id, 24, 'Full year results - target achieved!');

    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [supplyChainId, 'challenge', 'Data Integration', 'Consolidating data from 50+ legacy systems', 'in_progress', 'high']);
    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [supplyChainId, 'dependency', 'ERP System Upgrade', 'New optimization features depend on ERP modernization', 'open', 'high']);
    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [supplyChainId, 'action', 'Identify Additional Opportunities', 'Research new cost reduction opportunities', 'open', 'medium']);

    // PROJECT 5: Mobile Banking App - Currently Delinquent
    const bankingResult = await dbRun(
      `INSERT INTO projects (name, description, initiative_manager, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        '[Test] Next-Gen Mobile Banking',
        'Complete redesign of mobile banking application with biometric authentication, AI-powered insights, and cryptocurrency wallet',
        'Kevin Park',
        '2024-04-01',
        '2025-03-31',
        '2024-04-01T09:00:00Z'
      ]
    );
    const bankingId = bankingResult.lastID;

    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [bankingId, 'Figma Designs', 'https://figma.com/banking-app', 1]);
    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [bankingId, 'Sprint Board', 'https://jira.company.com/banking', 2]);
    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [bankingId, 'Security Review', 'https://security.company.com/banking-review', 3]);

    // Metric: Features Completed (Linear, Currently Delinquent)
    const featuresMetric = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bankingId, 'Core Features Delivered', admin.id, '2024-04-30', '2025-03-31', 'monthly', 'linear', 24, 10, 20, 'lead']
    );
    periods = await generatePeriods(featuresMetric.lastID, '2024-04-30', '2025-03-31', 'monthly', 'linear', 24);

    // Current delinquency
    await updatePeriodPerformance(periods[0].id, 2, 'Good start - authentication framework complete');
    await updatePeriodPerformance(periods[1].id, 3, 'Biometric integration taking longer than expected');
    await addComment(periods[1].id, admin.id, 'iOS Face ID integration has edge cases. Adding 2 weeks to timeline.', '2024-06-03T11:00:00Z');
    await updatePeriodPerformance(periods[2].id, 4, 'Security review required rework');
    await addComment(periods[2].id, admin.id, 'Found vulnerabilities in session management. Must fix before proceeding.', '2024-07-05T14:30:00Z');
    await updatePeriodPerformance(periods[3].id, 6, 'Rework complete but behind schedule');
    await updatePeriodPerformance(periods[4].id, 7, 'Still recovering from security delays');
    await addComment(periods[4].id, admin.id, 'Need to descope some features or extend timeline. Meeting with stakeholders next week.', '2024-09-04T16:00:00Z');
    await updatePeriodPerformance(periods[5].id, 9, 'Descoped crypto wallet to phase 2');
    await addComment(periods[5].id, admin.id, 'Agreed to move cryptocurrency features to v2.0. Focus on core banking first.', '2024-10-02T10:30:00Z');

    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [bankingId, 'issue', 'Security Vulnerabilities', 'Session management needs hardening', 'in_progress', 'critical']);
    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [bankingId, 'risk', 'Regulatory Approval', 'App store compliance review could delay launch', 'open', 'high']);
    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [bankingId, 'dependency', 'Third-party KYC Service', 'Identity verification service integration required', 'in_progress', 'high']);
    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [bankingId, 'action', 'Scope Review', 'Evaluate phase 2 features and timeline', 'open', 'medium']);

    // PROJECT 6: Data Warehouse Migration - Quarterly Reporting
    const dataWarehouseResult = await dbRun(
      `INSERT INTO projects (name, description, initiative_manager, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        '[Test] Enterprise Data Warehouse Migration',
        'Migration from on-premise Oracle data warehouse to cloud-native Snowflake platform, supporting 500+ business intelligence reports',
        'Rachel Green',
        '2023-10-01',
        '2024-12-31',
        '2023-10-01T08:00:00Z'
      ]
    );
    const dataWarehouseId = dataWarehouseResult.lastID;

    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [dataWarehouseId, 'Migration Tracker', 'https://tracker.company.com/dw-migration', 1]);
    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [dataWarehouseId, 'Snowflake Console', 'https://app.snowflake.com/company', 2]);

    // Metric: Reports Migrated (Quarterly)
    const reportsMetric = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dataWarehouseId, 'BI Reports Migrated', admin.id, '2023-12-31', '2024-12-31', 'quarterly', 'linear', 500, 10, 20, 'lead']
    );
    periods = await generatePeriods(reportsMetric.lastID, '2023-12-31', '2024-12-31', 'quarterly', 'linear', 500);
    console.log(`Generated ${periods.length} quarterly periods`);

    if (periods.length >= 1) await updatePeriodPerformance(periods[0].id, 80, 'Q4 2023: Initial wave - sales reports');
    if (periods.length >= 1) await addComment(periods[0].id, admin.id, 'Migrated all tier-1 sales reports. Performance improvement: 3x faster queries.', '2024-01-10:00:00Z');
    if (periods.length >= 2) await updatePeriodPerformance(periods[1].id, 200, 'Q1 2024: Finance and HR reports');
    if (periods.length >= 3) await updatePeriodPerformance(periods[2].id, 320, 'Q2 2024: Operations reports');
    if (periods.length >= 3) await addComment(periods[2].id, admin.id, 'Complex ETL jobs successfully converted. Using Snowflake streams for real-time updates.', '2024-07-05T11:30:00Z');
    if (periods.length >= 4) await updatePeriodPerformance(periods[3].id, 450, 'Q3 2024: Marketing and customer analytics');
    if (periods.length >= 5) await updatePeriodPerformance(periods[4].id, 500, 'Q4 2024: Migration complete!');
    if (periods.length >= 5) await addComment(periods[4].id, admin.id, 'All 500 reports migrated. Legacy Oracle warehouse decommissioned. Annual cost savings: $2M.', '2024-10-15T14:00:00Z');

    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [dataWarehouseId, 'challenge', 'ETL Complexity', 'Converting complex Oracle stored procedures to Snowflake', 'resolved', 'high']);
    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [dataWarehouseId, 'risk', 'Data Quality', 'Ensuring data integrity during migration', 'resolved', 'critical']);

    // PROJECT 7: Customer Support Portal - Weekly Tracking
    const supportResult = await dbRun(
      `INSERT INTO projects (name, description, initiative_manager, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        '[Test] AI-Powered Support Portal',
        'Development of next-generation customer support platform with AI chatbot, knowledge base, and ticket automation',
        'Amanda Foster',
        '2024-06-01',
        '2024-11-30',
        '2024-06-01T10:00:00Z'
      ]
    );
    const supportId = supportResult.lastID;

    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [supportId, 'Product Roadmap', 'https://roadmap.company.com/support', 1]);
    await dbRun(`INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)`,
      [supportId, 'User Testing Results', 'https://research.company.com/support-testing', 2]);

    // Metric: Sprint Velocity (Weekly)
    const velocityMetric = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [supportId, 'Story Points Completed', admin.id, '2024-06-07', '2024-11-29', 'weekly', 'linear', 520, 15, 25, 'lead']
    );
    periods = await generatePeriods(velocityMetric.lastID, '2024-06-07', '2024-11-29', 'weekly', 'linear', 520);

    // Sample weekly data (first 8 weeks)
    await updatePeriodPerformance(periods[0].id, 18, 'Sprint 1: Team ramping up');
    await updatePeriodPerformance(periods[1].id, 42, 'Sprint 2: Velocity improving');
    await updatePeriodPerformance(periods[2].id, 65, 'Sprint 3: Steady progress');
    await addComment(periods[2].id, admin.id, 'Team velocity stabilizing at ~23 points per sprint. Good progress on chatbot core.', '2024-06-24T15:00:00Z');
    await updatePeriodPerformance(periods[3].id, 87, 'Sprint 4: On track');
    await updatePeriodPerformance(periods[4].id, 108, 'Sprint 5: Strong sprint');
    await updatePeriodPerformance(periods[5].id, 128, 'Sprint 6: Integration week (lower velocity)');
    await updatePeriodPerformance(periods[6].id, 152, 'Sprint 7: Back on track');
    await updatePeriodPerformance(periods[7].id, 176, 'Sprint 8: API integration complete');

    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [supportId, 'dependency', 'AI Model Training Data', 'Need 10K labeled support tickets for chatbot training', 'in_progress', 'high']);
    await dbRun(`INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [supportId, 'challenge', 'Multi-language Support', 'Chatbot must handle 12 languages', 'open', 'medium']);

    console.log('✅ Created 7 diverse projects with realistic metrics\n');

    // Add historical audit logs for time travel
    console.log('⏰ Adding rich historical audit logs for time travel demonstration...\n');

    // HEALTHCARE PROJECT - Multiple revisions showing iterative refinement
    // Initial underestimate that gets corrected
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', periods[0].id,
      { complete: 600 }, { complete: 800 },
      'Corrected January registration count after final data validation',
      '2024-02-02T09:00:00Z'
    );

    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', periods[1].id,
      { complete: 2200 }, { complete: 2500 },
      'Updated February numbers - initial count missed weekend registrations',
      '2024-03-03T11:30:00Z'
    );

    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', periods[2].id,
      { complete: 5500 }, { complete: 5800 },
      'Revised March count after data reconciliation with partner systems',
      '2024-04-05T14:15:00Z'
    );

    // Commentary evolution showing changing perspectives
    const healthcarePeriod3 = await dbGet('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date LIMIT 1 OFFSET 3', [registrationsMetric.lastID]);
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', healthcarePeriod3.id,
      { complete: 10500, commentary: 'Mobile app performing well' },
      { complete: 12000, commentary: 'Mobile app launch successful' },
      'Updated April data with final monthly counts and improved commentary',
      '2024-05-03T10:00:00Z'
    );

    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', healthcarePeriod3.id,
      { complete: 12000, commentary: 'Mobile app launch successful' },
      { complete: 12000, commentary: 'iOS and Android apps both hit top 10 in health category' },
      'Enhanced commentary with specific achievement details',
      '2024-05-04T16:45:00Z'
    );

    // Project description evolution
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'projects', healthcareId,
      { description: 'Patient portal modernization project' },
      { description: 'Comprehensive upgrade of patient-facing digital services' },
      'Refined project description',
      '2024-02-15T14:00:00Z'
    );

    await addAuditLog(admin.id, admin.email, 'UPDATE', 'projects', healthcareId,
      { description: 'Comprehensive upgrade of patient-facing digital services' },
      { description: 'Comprehensive upgrade of patient-facing digital services including appointment scheduling, medical records access, and telehealth integration' },
      'Expanded project description with full scope details',
      '2024-03-15T14:00:00Z'
    );

    // E-COMMERCE PROJECT - Shows problem tracking and resolution
    await addAuditLog(admin.id, admin.email, 'CREATE', 'craids', 1,
      null,
      { type: 'issue', title: 'Payment Provider Delays', status: 'open', priority: 'high' },
      'Created issue for payment integration delays',
      '2024-04-20T09:00:00Z'
    );

    await addAuditLog(admin.id, admin.email, 'UPDATE', 'craids', 1,
      { status: 'open', description: 'Payment provider certification delayed' },
      { status: 'in_progress', description: 'Payment provider certification delayed. Escalated to executive team.' },
      'Escalated payment issue to leadership',
      '2024-05-10T13:30:00Z'
    );

    await addAuditLog(admin.id, admin.email, 'UPDATE', 'craids', 1,
      { status: 'in_progress' }, { status: 'resolved' },
      'Payment provider issue resolved - certification received',
      '2024-06-15T16:30:00Z'
    );

    // Multiple updates showing recovery
    const ecommercePeriod3 = await dbGet('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date LIMIT 1 OFFSET 2', [marketsMetric.lastID]);
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', ecommercePeriod3.id,
      { complete: 2, commentary: 'Blocked on payment integration' },
      { complete: 2, commentary: 'Still blocked on German payment integration' },
      'Updated commentary to reflect ongoing blocker',
      '2024-05-05T09:00:00Z'
    );

    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', ecommercePeriod3.id,
      { complete: 2, commentary: 'Still blocked on German payment integration' },
      { complete: 2, commentary: 'Still blocked on German payment integration. Escalated to payment provider executive team.' },
      'Added escalation details to commentary',
      '2024-05-05T09:30:00Z'
    );

    const ecommercePeriod4 = await dbGet('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date LIMIT 1 OFFSET 3', [marketsMetric.lastID]);
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', ecommercePeriod4.id,
      { complete: 3, commentary: 'Germany launching this week' },
      { complete: 4, commentary: 'Germany unblocked, launched 2 markets this month' },
      'Updated with actual completion after Germany launch',
      '2024-06-05T16:00:00Z'
    );

    // AI RESEARCH PROJECT - Shows data corrections and progressive updates
    const aiPeriod3 = await dbGet('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date LIMIT 1 OFFSET 2', [modelsMetric.lastID]);
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', aiPeriod3.id,
      { complete: 7 }, { complete: 8 },
      'Corrected September count after duplicate removal',
      '2023-10-05T10:00:00Z'
    );

    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', aiPeriod3.id,
      { complete: 8, commentary: 'GPU cluster operational' },
      { complete: 8, commentary: 'GPU cluster expansion complete' },
      'Refined commentary for clarity',
      '2023-10-08T14:20:00Z'
    );

    const aiPeriod6 = await dbGet('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date LIMIT 1 OFFSET 5', [modelsMetric.lastID]);
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', aiPeriod6.id,
      { complete: 58 }, { complete: 60 },
      'Final December count after late submissions',
      '2024-01-08T09:15:00Z'
    );

    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', aiPeriod6.id,
      { complete: 60, commentary: 'Research teams ramped up' },
      { complete: 60, commentary: 'Research teams fully ramped up. All 5 teams actively using platform.' },
      'Enhanced commentary with team details',
      '2024-01-08T15:30:00Z'
    );

    // SUPPLY CHAIN PROJECT - Shows target adjustments and planning changes
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metrics', savingsMetric.lastID,
      { final_target: 20 },
      { final_target: 25 },
      'Increased savings target after identifying additional opportunities',
      '2024-04-15T10:00:00Z'
    );

    const supplyPeriod2 = await dbGet('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date LIMIT 1 OFFSET 1', [savingsMetric.lastID]);
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', supplyPeriod2.id,
      { complete: 0.5 }, { complete: 1.0 },
      'Updated May savings after quarterly reconciliation',
      '2024-06-10T11:30:00Z'
    );

    // Commentary evolution showing learning
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', supplyPeriod2.id,
      { complete: 1.0, commentary: 'Early pilots' },
      { complete: 1.0, commentary: 'Pilot programs launched - minimal savings yet' },
      'Clarified commentary to set realistic expectations',
      '2024-06-10T14:00:00Z'
    );

    // BANKING PROJECT - Shows scope changes and realistic adjustments
    await addAuditLog(admin.id, admin.email, 'CREATE', 'craids', null,
      null,
      { type: 'issue', title: 'Biometric Integration Delays', status: 'open', priority: 'high' },
      'Created issue for Face ID edge cases',
      '2024-06-05T11:00:00Z'
    );

    const bankingPeriod3 = await dbGet('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date LIMIT 1 OFFSET 2', [featuresMetric.lastID]);
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', bankingPeriod3.id,
      { complete: 5 }, { complete: 4 },
      'Revised July count after security review required feature rollback',
      '2024-07-10T16:00:00Z'
    );

    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', bankingPeriod3.id,
      { complete: 4, commentary: 'Security issues found' },
      { complete: 4, commentary: 'Security review required rework' },
      'Improved commentary clarity',
      '2024-07-10T16:15:00Z'
    );

    // Scope change documentation
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metrics', featuresMetric.lastID,
      { final_target: 28 },
      { final_target: 24 },
      'Descoped cryptocurrency features to phase 2, reduced target from 28 to 24 features',
      '2024-10-05T11:00:00Z'
    );

    // DATA WAREHOUSE PROJECT - Shows milestone tracking
    const dwPeriod2 = await dbGet('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date LIMIT 1 OFFSET 1', [reportsMetric.lastID]);
    if (dwPeriod2) {
      await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', dwPeriod2.id,
        { complete: 190 }, { complete: 200 },
        'Updated Q1 count after late report conversions completed',
        '2024-04-10T09:00:00Z'
      );

      await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', dwPeriod2.id,
        { complete: 200, commentary: 'Finance reports migrated' },
        { complete: 200, commentary: 'Q1 2024: Finance and HR reports' },
        'Improved commentary formatting',
        '2024-04-10T14:30:00Z'
      );
    }

    // SUPPORT PROJECT - Shows sprint planning adjustments
    const supportPeriod3 = await dbGet('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date LIMIT 1 OFFSET 2', [velocityMetric.lastID]);
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', supportPeriod3.id,
      { complete: 63 }, { complete: 65 },
      'Added carry-over points from previous sprint',
      '2024-06-24T10:00:00Z'
    );

    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', supportPeriod3.id,
      { complete: 65, commentary: 'Good velocity' },
      { complete: 65, commentary: 'Sprint 3: Steady progress' },
      'Standardized sprint commentary format',
      '2024-06-24T14:00:00Z'
    );

    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', supportPeriod3.id,
      { complete: 65, commentary: 'Sprint 3: Steady progress' },
      { complete: 65, commentary: 'Sprint 3: Steady progress. Team velocity stabilizing at ~23 points per sprint.' },
      'Added velocity trend to commentary',
      '2024-06-24T15:00:00Z'
    );

    // Add some cross-project changes to show system-wide updates
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'users', admin.id,
      { name: 'Admin' },
      { name: 'Admin User' },
      'Updated admin display name',
      '2024-03-01T09:00:00Z'
    );

    // Add changes at different times of day to show real usage patterns
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', periods[0].id,
      { complete: 800, commentary: 'Soft launch exceeded expectations' },
      { complete: 800, commentary: 'Soft launch exceeded expectations. Marketing campaign drove higher than expected signups.' },
      'Enhanced commentary with context',
      '2024-02-03T08:30:00Z'
    );

    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', periods[1].id,
      { complete: 2500, commentary: 'Growth accelerating' },
      { complete: 2500, commentary: 'Word of mouth accelerating adoption' },
      'Refined commentary language',
      '2024-03-05T17:45:00Z'
    );

    // Show late-night updates (emergency fixes)
    const ecommercePeriod2 = await dbGet('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date LIMIT 1 OFFSET 1', [marketsMetric.lastID]);
    await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', ecommercePeriod2.id,
      { complete: 2, commentary: 'Germany launch delayed' },
      { complete: 2, commentary: 'Germany launch delayed due to payment integration' },
      'Added specific blocker details',
      '2024-04-03T22:15:00Z'
    );

    console.log('✅ Added 40+ historical audit log entries spanning multiple months\n');
    console.log('   • Data corrections and reconciliations');
    console.log('   • Commentary evolution and refinement');
    console.log('   • Target adjustments and scope changes');
    console.log('   • Issue tracking lifecycle');
    console.log('   • Sprint planning adjustments');
    console.log('   • Emergency late-night updates\n');

    console.log('🎉 Realistic data migration complete!\n');
    console.log('📊 Summary:');
    console.log('   • 7 diverse projects created');
    console.log('   • Healthcare project: 5 metrics (for grid view testing)');
    console.log('   • E-commerce project: 4 metrics (for grid view testing)');
    console.log('   • Multiple progression curves: linear, s-curve, exponential, logarithmic');
    console.log('   • Various frequencies: weekly, monthly, quarterly');
    console.log('   • Delinquency and recovery patterns demonstrated');
    console.log('   • Post-completion tracking shown');
    console.log('   • Time travel with historical comments enabled');
    console.log('   • Realistic project links and CRAIDs added\n');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run migration
if (require.main === module) {
  seedRealisticData()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { seedRealisticData };
