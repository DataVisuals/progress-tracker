const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/progress-tracker.db');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

// Initialize schema v2 (normalized)
const schema = fs.readFileSync(path.join(__dirname, 'schema-v2.sql'), 'utf8');
db.exec(schema, (err) => {
  if (err) console.error('Schema initialization error:', err);
});

// Promisify database operations for easier use
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
      // Sigmoid: 1 / (1 + e^(-10(x-0.5)))
      return Math.round(finalTarget / (1 + Math.exp(-10 * (ratio - 0.5))));
    case 'j-curve':
      // Exponential: x^2
      return Math.round(finalTarget * Math.pow(ratio, 2));
    default:
      return Math.round(finalTarget * ratio);
  }
}

// Generate periods when metric is created
async function generateMetricPeriods(metricId, startDate, endDate, frequency, progressionType, finalTarget) {
  const periods = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let current = new Date(start);

  while (current <= end) {
    periods.push({
      metric_id: metricId,
      reporting_date: current.toISOString().split('T')[0],
    });

    // Increment based on frequency
    if (frequency === 'weekly') {
      current.setDate(current.getDate() + 7);
    } else if (frequency === 'monthly') {
      current.setMonth(current.getMonth() + 1);
    } else if (frequency === 'quarterly') {
      current.setMonth(current.getMonth() + 3);
    }
  }

  const totalPeriods = periods.length;

  // Calculate expected values and insert
  for (let index = 0; index < periods.length; index++) {
    const period = periods[index];
    const expected = calculateExpectedValue(progressionType, finalTarget, index + 1, totalPeriods);
    await dbRun(`INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete) VALUES (?, ?, ?, ?, 0)`,
      [period.metric_id, period.reporting_date, expected, finalTarget]);
  }
}

module.exports = { db, dbRun, dbGet, dbAll, generateMetricPeriods, calculateExpectedValue };
