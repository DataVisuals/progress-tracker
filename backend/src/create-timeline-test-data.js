const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, '../data/progress-tracker.db');
const db = new sqlite3.Database(DB_PATH);

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
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

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

async function createTimelineTestData() {
  try {
    console.log('🚀 Creating comprehensive timeline test data...\n');

    // Clear existing data
    console.log('🧹 Clearing existing test data...');
    await dbRun('DELETE FROM audit_log');
    await dbRun('DELETE FROM metric_periods');
    await dbRun('DELETE FROM metrics');
    await dbRun('DELETE FROM projects');
    await dbRun('DELETE FROM users WHERE email != ?', ['admin@example.com']);
    console.log('✓ Cleared\n');

    // Get or create admin user
    let admin = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@example.com']);
    if (!admin) {
      const hash = bcrypt.hashSync('admin123', 10);
      const result = await dbRun(
        'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)',
        ['admin@example.com', 'Admin User', hash, 'admin']
      );
      admin = { id: result.lastID, email: 'admin@example.com', name: 'Admin User' };
    }

    // Timeline: 60 days ago to now
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 60);

    // Day 1 (60 days ago): Create project
    console.log('📅 Day 1 (60 days ago): Creating project...');
    const day1 = new Date(startDate);
    const projectResult = await dbRun(
      'INSERT INTO projects (name, description, initiative_manager, created_at) VALUES (?, ?, ?, ?)',
      ['Time Travel Demo Project', 'Demonstrates time travel feature with historical data', 'Demo Manager', day1.toISOString()]
    );
    const projectId = projectResult.lastID;

    await dbRun(
      `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_values, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [admin.id, admin.email, 'CREATE', 'projects', projectId,
       JSON.stringify({ name: 'Time Travel Demo Project', description: 'Demonstrates time travel feature with historical data' }),
       'Created project "Time Travel Demo Project"', day1.toISOString()]
    );
    console.log(`✓ Project created (ID: ${projectId})\n`);

    // Day 5 (55 days ago): Create first metric
    console.log('📅 Day 5 (55 days ago): Creating first metric...');
    const day5 = new Date(startDate);
    day5.setDate(day5.getDate() + 4);

    const metricStartDate = new Date(day5);
    const metricEndDate = new Date(day5);
    metricEndDate.setDate(metricEndDate.getDate() + 90); // 90-day project

    const metricResult = await dbRun(
      `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'User Signups', admin.id, metricStartDate.toISOString().split('T')[0],
       metricEndDate.toISOString().split('T')[0], 'weekly', 'linear', 100, day5.toISOString()]
    );
    const metricId = metricResult.lastID;

    await dbRun(
      `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_values, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [admin.id, admin.email, 'CREATE', 'metrics', metricId,
       JSON.stringify({ name: 'User Signups', final_target: 100 }),
       'Created metric "User Signups"', day5.toISOString()]
    );
    console.log(`✓ Metric created (ID: ${metricId})\n`);

    // Day 7-60: Create periods and update them progressively
    console.log('📅 Days 7-60: Creating and updating periods...\n');

    // Generate weekly periods
    const periods = [];
    let currentPeriodDate = new Date(metricStartDate);
    let periodIndex = 0;

    while (currentPeriodDate <= metricEndDate && periodIndex < 13) {
      periods.push({
        date: currentPeriodDate.toISOString().split('T')[0],
        expected: Math.round(100 * ((periodIndex + 1) / 13)),
        target: 100
      });
      currentPeriodDate.setDate(currentPeriodDate.getDate() + 7);
      periodIndex++;
    }

    // Create periods starting from day 7
    const day7 = new Date(startDate);
    day7.setDate(day7.getDate() + 6);

    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const creationDate = new Date(day7);
      creationDate.setDate(creationDate.getDate() + (i * 2)); // Stagger creation over time

      const periodResult = await dbRun(
        `INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [metricId, period.date, period.expected, period.target, 0, creationDate.toISOString()]
      );

      await dbRun(
        `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_values, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [admin.id, admin.email, 'CREATE', 'metric_periods', periodResult.lastID,
         JSON.stringify({ metric_id: metricId, reporting_date: period.date, expected: period.expected, target: period.target, complete: 0 }),
         `Created period for ${period.date}`, creationDate.toISOString()]
      );

      console.log(`  ✓ Period ${i + 1} created: ${period.date} (expected: ${period.expected})`);

      // Update periods with progress over time
      // Updates should happen AFTER the period's reporting date (when work is actually done)
      const periodDate = new Date(period.date);
      const updatesPerPeriod = 3;

      // Track cumulative complete value across all periods
      let cumulativeComplete = i === 0 ? 0 : period.expected; // Start from expected of previous period

      for (let j = 0; j < updatesPerPeriod; j++) {
        // Schedule updates after the period date (days 1, 3, 5 after period)
        const updateDate = new Date(periodDate);
        updateDate.setDate(updateDate.getDate() + (j + 1) * 2);

        // Only create updates if the update date is in the past
        if (updateDate > now) break;

        // Calculate incremental progress for this period
        const periodProgress = Math.round(period.expected * ((j + 1) / updatesPerPeriod));
        const oldComplete = j === 0 ? (i === 0 ? 0 : periods[i-1].expected) : cumulativeComplete;
        const newComplete = (i === 0 ? 0 : periods[i-1].expected) + periodProgress;
        cumulativeComplete = newComplete;

        await dbRun(
          `UPDATE metric_periods SET complete = ?, updated_at = ? WHERE id = ?`,
          [newComplete, updateDate.toISOString(), periodResult.lastID]
        );

        await dbRun(
          `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [admin.id, admin.email, 'UPDATE', 'metric_periods', periodResult.lastID,
           JSON.stringify({ complete: oldComplete }),
           JSON.stringify({ complete: newComplete }),
           `Updated progress from ${oldComplete} to ${newComplete}`, updateDate.toISOString()]
        );

        console.log(`    → Update ${j + 1} on ${updateDate.toISOString().split('T')[0]}: complete = ${newComplete}`);
      }

      // Add commentary updates for most periods (to test time travel filtering)
      if (i < 8) { // Add comments to first 8 periods (if they're in the past)
        const commentDate = new Date(periodDate);
        commentDate.setDate(commentDate.getDate() + 4); // 4 days after period

        if (commentDate <= now) {
          const comments = [
            'Strong start - team is ramped up and productive',
            'On track with planned deliverables, velocity is steady',
            'Some delays due to external API dependencies',
            'Dependencies resolved, back on schedule',
            'Exceeded expectations this period with early feature completion',
            'Minor performance issues identified and resolved quickly',
            'Integration testing taking longer than expected',
            'Sprint completed successfully, all stories delivered'
          ];

          await dbRun(
            `UPDATE metric_periods SET commentary = ? WHERE id = ?`,
            [comments[i], periodResult.lastID]
          );

          await dbRun(
            `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values, description, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [admin.id, admin.email, 'UPDATE', 'metric_periods', periodResult.lastID,
             JSON.stringify({ commentary: null }),
             JSON.stringify({ commentary: comments[i] }),
             `Added commentary`, commentDate.toISOString()]
          );

          console.log(`    → Commentary added on ${commentDate.toISOString().split('T')[0]}`);
        }
      }
    }

    console.log('\n✅ Timeline test data created successfully!\n');
    console.log('📊 Summary:');
    console.log(`  • Project: "${(await dbGet('SELECT name FROM projects WHERE id = ?', [projectId])).name}"`);
    console.log(`  • Metric: "${(await dbGet('SELECT name FROM metrics WHERE id = ?', [metricId])).name}"`);
    console.log(`  • Periods: ${periods.length}`);

    const auditCount = await dbGet('SELECT COUNT(*) as count FROM audit_log');
    console.log(`  • Audit log entries: ${auditCount.count}`);
    console.log(`  • Timeline: ${startDate.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);
    console.log(`  • Duration: 60 days\n`);

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    db.close();
  }
}

createTimelineTestData();
