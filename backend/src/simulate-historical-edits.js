const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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

async function simulateHistoricalEdits() {
  try {
    console.log('🕐 Starting historical edits simulation...\n');

    // Get the first project and its metric periods
    const project = await dbGet('SELECT id FROM projects ORDER BY id LIMIT 1');
    if (!project) {
      console.log('❌ No projects found. Please create a project first.');
      return;
    }

    const metrics = await dbAll('SELECT id FROM metrics WHERE project_id = ?', [project.id]);
    if (metrics.length === 0) {
      console.log('❌ No metrics found. Please create a metric first.');
      return;
    }

    const periods = await dbAll(`
      SELECT id, metric_id, reporting_date, complete, expected, target
      FROM metric_periods
      WHERE metric_id IN (${metrics.map(() => '?').join(',')})
      ORDER BY reporting_date
      LIMIT 10
    `, metrics.map(m => m.id));

    if (periods.length === 0) {
      console.log('❌ No metric periods found.');
      return;
    }

    console.log(`📊 Found ${periods.length} metric periods to simulate edits on\n`);

    // Get admin user for audit log
    const user = await dbGet('SELECT id, email FROM users WHERE role = "admin" LIMIT 1');
    if (!user) {
      console.log('❌ No admin user found.');
      return;
    }

    // Simulate edits over the past 30 days
    const now = new Date();
    const daysToSimulate = 30;
    const editsPerPeriod = 5;

    for (const period of periods) {
      console.log(`\n📝 Simulating edits for period ${period.id} (${period.reporting_date})`);

      // Start with a low complete value
      let currentComplete = Math.floor(period.target * 0.1);

      for (let i = 0; i < editsPerPeriod; i++) {
        // Create a timestamp going backwards from now
        const daysAgo = Math.floor((daysToSimulate / editsPerPeriod) * (editsPerPeriod - i));
        const timestamp = new Date(now);
        timestamp.setDate(timestamp.getDate() - daysAgo);
        timestamp.setHours(10 + i * 2, 30, 0, 0); // Spread throughout the day

        const oldComplete = currentComplete;
        // Gradually increase the complete value
        currentComplete = Math.min(
          period.target,
          Math.floor(period.target * (0.1 + (i / editsPerPeriod) * 0.8))
        );

        // Insert audit log entry with custom timestamp
        await dbRun(`
          INSERT INTO audit_log (
            user_id, user_email, action, table_name, record_id,
            old_values, new_values, description, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          user.id,
          user.email,
          'UPDATE',
          'metric_periods',
          period.id,
          JSON.stringify({ complete: oldComplete }),
          JSON.stringify({ complete: currentComplete }),
          `Updated complete value from ${oldComplete} to ${currentComplete}`,
          timestamp.toISOString()
        ]);

        console.log(`  ✓ ${timestamp.toISOString().split('T')[0]}: ${oldComplete} → ${currentComplete}`);
      }

      // Update the actual period to the final value
      await dbRun(
        'UPDATE metric_periods SET complete = ? WHERE id = ?',
        [currentComplete, period.id]
      );
    }

    console.log('\n\n✅ Historical edits simulation complete!');
    console.log(`📅 Created ${periods.length * editsPerPeriod} audit log entries`);
    console.log(`🕐 Spanning ${daysToSimulate} days`);

    // Show summary
    const auditCount = await dbGet(
      "SELECT COUNT(*) as count FROM audit_log WHERE table_name = 'metric_periods'"
    );
    console.log(`\n📊 Total audit log entries for metric_periods: ${auditCount.count}`);

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    db.close();
  }
}

simulateHistoricalEdits();
