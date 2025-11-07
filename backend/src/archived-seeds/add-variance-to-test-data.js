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

async function addVarianceToTestData() {
  try {
    console.log('📊 Adding variance to test data...\n');

    // Get the test project
    const project = await dbGet('SELECT id FROM projects WHERE name = ?', ['Time Travel Demo Project']);
    if (!project) {
      console.log('❌ Test project not found. Run create-timeline-test-data.js first.');
      return;
    }

    const metric = await dbGet('SELECT id FROM metrics WHERE project_id = ?', [project.id]);
    if (!metric) {
      console.log('❌ Test metric not found.');
      return;
    }

    // Get admin user
    const admin = await dbGet('SELECT * FROM users WHERE role = ?', ['admin']);

    // Get all periods
    const periods = await dbAll(
      'SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date',
      [metric.id]
    );

    console.log(`Found ${periods.length} periods to modify\n`);

    // Make some periods lag behind (5-15% variance)
    const now = new Date();
    let modifiedCount = 0;

    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];

      // Only modify periods that are in the past
      const periodDate = new Date(period.reporting_date);
      if (periodDate > now) continue;

      // Make every 3rd and 4th period lag behind
      if (i % 4 === 2) {
        // 6-10% behind (amber warning)
        const variance = -Math.floor(period.expected * (0.06 + Math.random() * 0.04));
        const newComplete = Math.max(0, period.expected + variance);

        await dbRun(
          'UPDATE metric_periods SET complete = ? WHERE id = ?',
          [newComplete, period.id]
        );

        await dbRun(
          `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values, description, ip_address, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [admin.id, admin.email, 'UPDATE', 'metric_periods', period.id,
           JSON.stringify({ complete: period.complete }),
           JSON.stringify({ complete: newComplete }),
           `Adjusted to show amber variance (${Math.abs(variance / period.expected * 100).toFixed(1)}% behind)`,
           null,
           now.toISOString()]
        );

        console.log(`  ⚠ Period ${i + 1} (${period.reporting_date}): ${period.complete} → ${newComplete} (${Math.abs(variance / period.expected * 100).toFixed(1)}% behind) - AMBER`);
        modifiedCount++;
      } else if (i % 4 === 3) {
        // 11-15% behind (red warning)
        const variance = -Math.floor(period.expected * (0.11 + Math.random() * 0.04));
        const newComplete = Math.max(0, period.expected + variance);

        await dbRun(
          'UPDATE metric_periods SET complete = ? WHERE id = ?',
          [newComplete, period.id]
        );

        await dbRun(
          `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values, description, ip_address, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [admin.id, admin.email, 'UPDATE', 'metric_periods', period.id,
           JSON.stringify({ complete: period.complete }),
           JSON.stringify({ complete: newComplete }),
           `Adjusted to show red variance (${Math.abs(variance / period.expected * 100).toFixed(1)}% behind)`,
           null,
           now.toISOString()]
        );

        console.log(`  ⚠️ Period ${i + 1} (${period.reporting_date}): ${period.complete} → ${newComplete} (${Math.abs(variance / period.expected * 100).toFixed(1)}% behind) - RED`);
        modifiedCount++;
      }
    }

    console.log(`\n✅ Modified ${modifiedCount} periods to show variance indicators`);
    console.log(`   - Amber warnings (⚠): 5-10% behind schedule`);
    console.log(`   - Red warnings (⚠️): >10% behind schedule\n`);

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    db.close();
  }
}

addVarianceToTestData();
