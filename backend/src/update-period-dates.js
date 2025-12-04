const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/progress-tracker.db');
const db = new Database(dbPath);

console.log('📅 Updating Metric Period Dates...\n');

// Calculate shift amount based on metrics table
const metricsDateQuery = db.prepare('SELECT MIN(start_date) as earliest FROM metrics').get();
const periodsDateQuery = db.prepare('SELECT MIN(reporting_date) as earliest FROM metric_periods').get();

if (!metricsDateQuery.earliest || !periodsDateQuery.earliest) {
  console.log('⚠️  No metrics or periods found.');
  process.exit(0);
}

const metricEarliest = new Date(metricsDateQuery.earliest);
const periodEarliest = new Date(periodsDateQuery.earliest);

// Calculate days to shift
const daysToShift = Math.floor((metricEarliest - periodEarliest) / (1000 * 60 * 60 * 24));

if (daysToShift === 0) {
  console.log('✅ Periods are already aligned with metrics. No update needed.');
  process.exit(0);
}

console.log(`Earliest metric date: ${metricEarliest.toISOString().split('T')[0]}`);
console.log(`Earliest period date: ${periodEarliest.toISOString().split('T')[0]}`);
console.log(`Days to shift: ${daysToShift} days\n`);

// Get all periods
const periods = db.prepare('SELECT id, reporting_date FROM metric_periods').all();

console.log(`Found ${periods.length} periods to update...\n`);

// Update periods in a transaction
const updateStmt = db.prepare('UPDATE metric_periods SET reporting_date = ? WHERE id = ?');

const transaction = db.transaction((periods) => {
  let updated = 0;
  periods.forEach(period => {
    const oldDate = new Date(period.reporting_date);
    const newDate = new Date(oldDate);
    newDate.setDate(newDate.getDate() + daysToShift);

    const newDateStr = newDate.toISOString().split('T')[0];
    updateStmt.run(newDateStr, period.id);
    updated++;
  });
  return updated;
});

try {
  const updatedCount = transaction(periods);
  console.log(`✅ Updated ${updatedCount} metric periods\n`);

  // Verify the update
  const newMinMax = db.prepare('SELECT MIN(reporting_date) as min, MAX(reporting_date) as max FROM metric_periods').get();
  console.log(`New period date range: ${newMinMax.min} to ${newMinMax.max}`);

  console.log('\n✨ Period dates successfully updated!');
} catch (err) {
  console.error('❌ Error updating periods:', err);
  process.exit(1);
}

db.close();
