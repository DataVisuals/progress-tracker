#!/usr/bin/env node

/**
 * Realistic Test Data Migration Script V2 - Chronological Build
 *
 * This script builds project data chronologically to create realistic time travel:
 * - Data is created incrementally over time
 * - Early snapshots show incomplete projects
 * - Each period is added when its reporting date arrives
 * - Audit logs capture the actual timeline of data entry
 */

const { dbRun, dbGet, dbAll, initDatabase, saveDatabase } = require('./db-sqljs');
const path = require('path');

// Helper function to calculate expected value
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

// Create a period with audit log
async function createPeriodWithAudit(metricId, reportingDate, expected, target, complete, commentary, userId, userEmail, timestamp) {
  const result = await dbRun(
    `INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete, commentary)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [metricId, reportingDate, expected, target, complete || 0, commentary || null]
  );

  // Add audit log for period creation
  await addAuditLog(
    userId, userEmail, 'CREATE', 'metric_periods', result.lastID,
    null,
    { metric_id: metricId, reporting_date: reportingDate, expected, target, complete: complete || 0 },
    `Created period for ${reportingDate}`,
    timestamp
  );

  return result.lastID;
}

// Update period with audit log
async function updatePeriodWithAudit(periodId, updates, userId, userEmail, description, timestamp) {
  const oldPeriod = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [periodId]);

  if (!oldPeriod) {
    console.error(`Period ${periodId} not found`);
    return;
  }

  const setClauses = [];
  const values = [];

  if (updates.complete !== undefined) {
    setClauses.push('complete = ?');
    values.push(updates.complete);
  }
  if (updates.commentary !== undefined) {
    setClauses.push('commentary = ?');
    values.push(updates.commentary);
  }

  values.push(periodId);

  await dbRun(
    `UPDATE metric_periods SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );

  // Create old/new values for audit
  const oldValues = {};
  const newValues = {};
  if (updates.complete !== undefined) {
    oldValues.complete = oldPeriod.complete;
    newValues.complete = updates.complete;
  }
  if (updates.commentary !== undefined) {
    oldValues.commentary = oldPeriod.commentary;
    newValues.commentary = updates.commentary;
  }

  await addAuditLog(userId, userEmail, 'UPDATE', 'metric_periods', periodId,
    oldValues, newValues, description, timestamp);
}

async function seedChronologicalData() {
  console.log('🌱 Starting chronological data migration...\n');

  try {
    // Initialize database
    await initDatabase();

    // Clear existing data
    console.log('🧹 Clearing existing test data...');
    await dbRun('DELETE FROM comments');
    await dbRun('DELETE FROM metric_periods');
    await dbRun('DELETE FROM metrics');
    await dbRun('DELETE FROM craids');
    await dbRun('DELETE FROM project_links');
    await dbRun('DELETE FROM projects');
    await dbRun('DELETE FROM portfolios');
    await dbRun('DELETE FROM audit_log');
    console.log('✅ Cleared existing data\n');

    // Get admin user
    const admin = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@example.com']);
    if (!admin) {
      console.error('❌ Admin user not found');
      return;
    }

    console.log('📂 Creating Portfolios...\n');

    // Create portfolios
    const digitalHealthResult = await dbRun(
      `INSERT INTO portfolios (name, description, color, display_order)
       VALUES (?, ?, ?, ?)`,
      ['Digital Health', 'Patient-facing digital health initiatives', '#10b981', 1]
    );
    const digitalHealthId = digitalHealthResult.lastID;

    const infrastructureResult = await dbRun(
      `INSERT INTO portfolios (name, description, color, display_order)
       VALUES (?, ?, ?, ?)`,
      ['Infrastructure', 'Core technology infrastructure projects', '#3b82f6', 2]
    );

    const analyticsResult = await dbRun(
      `INSERT INTO portfolios (name, description, color, display_order)
       VALUES (?, ?, ?, ?)`,
      ['Analytics & BI', 'Business intelligence and analytics initiatives', '#8b5cf6', 3]
    );

    console.log('✅ Created 3 portfolios\n');

    console.log('📁 Creating Healthcare Project with chronological data...\n');

    // Create project - January 1, 2024 (assigned to Digital Health portfolio)
    const projectResult = await dbRun(
      `INSERT INTO projects (name, description, initiative_manager, start_date, end_date, portfolio_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        '[Test] Patient Portal Modernization',
        'Patient portal modernization project',
        'Dr. Sarah Chen',
        '2024-01-01',
        '2024-12-31',
        digitalHealthId,
        '2024-01-01T08:00:00Z'
      ]
    );
    const healthcareId = projectResult.lastID;

    // Create metric - January 1, 2024
    const metricResult = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [healthcareId, 'New User Registrations', admin.id, '2024-01-31', '2024-12-31', 'monthly', 's-curve', 50000, 10, 20, 'lead']
    );
    const metricId = metricResult.lastID;

    // FEBRUARY 1, 2024 - Create January period and enter initial data
    console.log('📅 Feb 1: Creating January period...');
    const jan = await createPeriodWithAudit(
      metricId, '2024-01-31', 500, 50000, 600,
      'Soft launch exceeded expectations',
      admin.id, admin.email, '2024-02-01T09:00:00Z'
    );

    // FEBRUARY 2, 2024 - Correct January data
    console.log('📅 Feb 2: Correcting January count...');
    await updatePeriodWithAudit(
      jan,
      { complete: 800 },
      admin.id, admin.email,
      'Corrected January registration count after final data validation',
      '2024-02-02T09:00:00Z'
    );

    // FEBRUARY 3, 2024 - Enhance January commentary
    await updatePeriodWithAudit(
      jan,
      { commentary: 'Soft launch exceeded expectations. Marketing campaign drove higher than expected signups.' },
      admin.id, admin.email,
      'Enhanced commentary with context',
      '2024-02-03T08:30:00Z'
    );

    // MARCH 2, 2024 - Create February period
    console.log('📅 Mar 2: Creating February period...');
    const feb = await createPeriodWithAudit(
      metricId, '2024-03-02', 1500, 50000, 2200,
      'Growth accelerating',
      admin.id, admin.email, '2024-03-02T10:00:00Z'
    );

    // MARCH 3, 2024 - Correct February data
    console.log('📅 Mar 3: Correcting February count...');
    await updatePeriodWithAudit(
      feb,
      { complete: 2500 },
      admin.id, admin.email,
      'Updated February numbers - initial count missed weekend registrations',
      '2024-03-03T11:30:00Z'
    );

    // MARCH 5, 2024 - Enhance February commentary
    await updatePeriodWithAudit(
      feb,
      { commentary: 'Word of mouth accelerating adoption' },
      admin.id, admin.email,
      'Refined commentary language',
      '2024-03-05T17:45:00Z'
    );

    // MARCH 15, 2024 - Update project description
    await addAuditLog(
      admin.id, admin.email, 'UPDATE', 'projects', healthcareId,
      { description: 'Patient portal modernization project' },
      { description: 'Comprehensive upgrade of patient-facing digital services including appointment scheduling, medical records access, and telehealth integration' },
      'Expanded project description with full scope details',
      '2024-03-15T14:00:00Z'
    );

    // APRIL 1, 2024 - Create March period
    console.log('📅 Apr 1: Creating March period...');
    const mar = await createPeriodWithAudit(
      metricId, '2024-04-01', 4500, 50000, 5500,
      'Partnership with insurance providers',
      admin.id, admin.email, '2024-04-01T09:30:00Z'
    );

    // APRIL 5, 2024 - Correct March data
    console.log('📅 Apr 5: Correcting March count...');
    await updatePeriodWithAudit(
      mar,
      { complete: 5800 },
      admin.id, admin.email,
      'Revised March count after data reconciliation with partner systems',
      '2024-04-05T14:15:00Z'
    );

    // APRIL 6, 2024 - Enhance March commentary
    await updatePeriodWithAudit(
      mar,
      { commentary: 'Partnership with insurance providers boosting growth' },
      admin.id, admin.email,
      'Added context about insurance partnerships',
      '2024-04-06T11:00:00Z'
    );

    // MAY 1, 2024 - Create April period
    console.log('📅 May 1: Creating April period...');
    const apr = await createPeriodWithAudit(
      metricId, '2024-05-01', 10000, 50000, 10500,
      'Mobile app performing well',
      admin.id, admin.email, '2024-05-01T10:00:00Z'
    );

    // MAY 3, 2024 - Correct April data and update commentary
    console.log('📅 May 3: Updating April results...');
    await updatePeriodWithAudit(
      apr,
      { complete: 12000, commentary: 'Mobile app launch successful' },
      admin.id, admin.email,
      'Updated April data with final monthly counts and improved commentary',
      '2024-05-03T10:00:00Z'
    );

    // MAY 4, 2024 - Enhance April commentary
    await updatePeriodWithAudit(
      apr,
      { commentary: 'iOS and Android apps both hit top 10 in health category' },
      admin.id, admin.email,
      'Enhanced commentary with specific achievement details',
      '2024-05-04T16:45:00Z'
    );

    // JUNE 1, 2024 - Create May period
    console.log('📅 Jun 1: Creating May period...');
    const may = await createPeriodWithAudit(
      metricId, '2024-06-01', 18000, 50000, 22000,
      'Strong momentum continuing',
      admin.id, admin.email, '2024-06-01T09:15:00Z'
    );

    // JULY 1, 2024 - Create June period
    console.log('📅 Jul 1: Creating June period...');
    const jun = await createPeriodWithAudit(
      metricId, '2024-07-01', 28000, 50000, 35000,
      'Telehealth feature driving engagement',
      admin.id, admin.email, '2024-07-01T10:00:00Z'
    );

    // AUGUST 1, 2024 - Create July period
    console.log('📅 Aug 1: Creating July period...');
    const jul = await createPeriodWithAudit(
      metricId, '2024-08-01', 38000, 50000, 45000,
      'On track for early goal achievement',
      admin.id, admin.email, '2024-08-01T09:00:00Z'
    );

    // SEPTEMBER 1, 2024 - Create August period
    console.log('📅 Sep 1: Creating August period...');
    const aug = await createPeriodWithAudit(
      metricId, '2024-09-01', 45000, 50000, 52000,
      'Exceeded annual target ahead of schedule!',
      admin.id, admin.email, '2024-09-01T11:00:00Z'
    );

    console.log('\n✅ Created Healthcare project with chronological audit trail\n');

    // Get audit log count
    const auditCount = await dbGet('SELECT COUNT(*) as count FROM audit_log');
    console.log('🎉 Data migration complete!\n');
    console.log('📊 Summary:');
    console.log(`   • 1 project created`);
    console.log(`   • 8 reporting periods created chronologically`);
    console.log(`   • ${auditCount.count} audit log entries`);
    console.log('   • Timeline: Jan 2024 - Sep 2024');
    console.log('   • Realistic data entry patterns demonstrated\n');

    console.log('⏱️  Time Travel Snapshots:');
    console.log('   • Feb 1: Only January period exists');
    console.log('   • Mar 2: January + February periods');
    console.log('   • Apr 1: Through March');
    console.log('   • May 1: Through April');
    console.log('   • etc...\n');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    // Save database to disk
    saveDatabase();
  }
}

// Run migration
if (require.main === module) {
  seedChronologicalData()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { seedChronologicalData };
