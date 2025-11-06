const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/progress-tracker.db');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

let db = null;

// Initialize better-sqlite3 database
function initDatabase() {
  if (db) return db;

  // Create or open database (synchronous!)
  db = new Database(DB_PATH);

  if (fs.existsSync(DB_PATH)) {
    console.log('📁 Loaded existing database from:', DB_PATH);
  } else {
    console.log('📁 Created new database');
  }

  // Initialize schema v3 (with portfolios)
  const schema = fs.readFileSync(path.join(__dirname, 'schema-v3.sql'), 'utf8');
  try {
    db.exec(schema);
    console.log('✅ Schema initialized successfully');

    // Enable foreign keys
    db.pragma('foreign_keys = ON');
  } catch (err) {
    console.error('Schema initialization error:', err);
  }

  return db;
}

// Promisified database operations (keeping async for API compatibility)
async function dbRun(sql, params = []) {
  const database = initDatabase();

  try {
    const stmt = database.prepare(sql);
    const info = stmt.run(params);

    return {
      lastID: info.lastInsertRowid || 0,
      changes: info.changes
    };
  } catch (error) {
    console.error('dbRun error:', error, 'SQL:', sql, 'Params:', params);
    throw error;
  }
}

async function dbGet(sql, params = []) {
  const database = initDatabase();

  try {
    const stmt = database.prepare(sql);
    const row = stmt.get(params);
    return row; // Returns undefined if no row found
  } catch (error) {
    console.error('dbGet error:', error, 'SQL:', sql, 'Params:', params);
    throw error;
  }
}

async function dbAll(sql, params = []) {
  const database = initDatabase();

  try {
    const stmt = database.prepare(sql);
    const rows = stmt.all(params);
    return rows; // Returns empty array if no rows
  } catch (error) {
    console.error('dbAll error:', error, 'SQL:', sql, 'Params:', params);
    throw error;
  }
}

// Helper function to calculate expected value based on progression type
function calculateExpectedValue(progressionType, finalTarget, periodIndex, totalPeriods) {
  const ratio = periodIndex / totalPeriods;

  switch(progressionType) {
    case 'linear':
      return Math.round(finalTarget * ratio);
    case 's-curve':
      // Sigmoid S-curve: 1 / (1 + e^(-10(x-0.5)))
      // This creates slow start, fast middle, slow end
      return Math.round(finalTarget / (1 + Math.exp(-10 * (ratio - 0.5))));
    case 'exponential':
      // Exponential J-curve: e^(3x) - 1 normalized
      // This creates slow start, then rapid acceleration
      return Math.round(finalTarget * (Math.exp(3 * ratio) - 1) / (Math.exp(3) - 1));
    case 'logarithmic':
      // Square root curve: front-loaded progress
      // This creates fast start, gradually slowing down
      return Math.round(finalTarget * Math.sqrt(ratio));
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

  // Validate frequency before generating periods
  const validFrequencies = ['weekly', 'fortnightly', 'monthly', 'quarterly'];
  if (!validFrequencies.includes(frequency)) {
    throw new Error(`Invalid frequency: ${frequency}. Must be one of: ${validFrequencies.join(', ')}`);
  }

  while (current <= end) {
    periods.push({
      metric_id: metricId,
      reporting_date: current.toISOString().split('T')[0],
    });

    // Increment based on frequency
    if (frequency === 'weekly') {
      current.setDate(current.getDate() + 7);
    } else if (frequency === 'fortnightly') {
      current.setDate(current.getDate() + 14);
    } else if (frequency === 'monthly') {
      current.setMonth(current.getMonth() + 1);
    } else if (frequency === 'quarterly') {
      current.setMonth(current.getMonth() + 3);
    }

    // Safety check to prevent infinite loops
    if (periods.length > 1000) {
      throw new Error('Too many periods to generate. Please check your date range and frequency.');
    }
  }

  const totalPeriods = periods.length;
  const database = initDatabase();

  // Use a transaction for better performance
  const insertStmt = database.prepare(
    'INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete) VALUES (?, ?, ?, ?, 0)'
  );

  const insertMany = database.transaction((periodsToInsert) => {
    for (let index = 0; index < periodsToInsert.length; index++) {
      const period = periodsToInsert[index];
      const expected = calculateExpectedValue(progressionType, finalTarget, index + 1, totalPeriods);
      insertStmt.run(period.metric_id, period.reporting_date, expected, finalTarget);
    }
  });

  insertMany(periods);
}

// Export database instance getter
async function getDb() {
  return initDatabase();
}

// No need for saveDatabase - better-sqlite3 writes to disk automatically!
function saveDatabase() {
  // This function is kept for API compatibility but does nothing
  // better-sqlite3 automatically saves to disk
}

module.exports = {
  getDb,
  dbRun,
  dbGet,
  dbAll,
  generateMetricPeriods,
  calculateExpectedValue,
  saveDatabase,
  initDatabase
};
