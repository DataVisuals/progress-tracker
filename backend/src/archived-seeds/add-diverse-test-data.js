const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/progress-tracker.db');
const db = new sqlite3.Database(dbPath);

// Utility functions
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
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

// Progression curve functions
function linearProgression(current, total, target) {
  return Math.round((target / total) * current);
}

function exponentialProgression(current, total, target) {
  // Slow start, accelerating growth
  const ratio = current / total;
  return Math.round(target * Math.pow(ratio, 2));
}

function logarithmicProgression(current, total, target) {
  // Fast start, slowing growth
  const ratio = current / total;
  return Math.round(target * Math.log(ratio * (Math.E - 1) + 1));
}

function sCurveProgression(current, total, target) {
  // Slow start, fast middle, slow end (sigmoid)
  const ratio = current / total;
  const sigmoid = 1 / (1 + Math.exp(-12 * (ratio - 0.5)));
  return Math.round(target * sigmoid);
}

// Add realistic variance to values
function addVariance(value, variance = 0.1) {
  const randomFactor = 1 + (Math.random() - 0.5) * 2 * variance;
  return Math.round(value * randomFactor);
}

// Generate test data for a metric
async function generateMetricData(projectId, metricName, config) {
  const {
    startDate,
    periods,
    frequency,
    finalTarget,
    progressionType,
    amberTolerance = 0.85,
    redTolerance = 0.70,
    actualVariance = 0.15,
    overUnderPerform = 'mixed', // 'over', 'under', 'mixed', 'ontrack'
    scopeCreep = null, // { startPeriod: 5, increasePercent: 20, reason: 'explanation' } or null for no scope creep
    commentary = null // Optional commentary about this metric
  } = config;

  console.log(`\n📊 Creating metric: ${metricName}`);
  console.log(`   Type: ${progressionType}, Target: ${finalTarget}, Periods: ${periods}`);
  if (commentary) {
    console.log(`   💬 ${commentary}`);
  }

  // Calculate end date
  const start = new Date(startDate);
  const end = new Date(start);
  if (frequency === 'weekly') {
    end.setDate(end.getDate() + (periods * 7));
  } else if (frequency === 'monthly') {
    end.setMonth(end.getMonth() + periods);
  } else if (frequency === 'quarterly') {
    end.setMonth(end.getMonth() + (periods * 3));
  }

  // Create metric
  const metricResult = await dbRun(
    `INSERT INTO metrics (project_id, name, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [projectId, metricName, startDate, end.toISOString().split('T')[0], frequency, progressionType, finalTarget, amberTolerance, redTolerance]
  );

  const metricId = metricResult.lastID;

  // Select progression function
  let progressionFn;
  switch (progressionType) {
    case 'exponential':
      progressionFn = exponentialProgression;
      break;
    case 'logarithmic':
      progressionFn = logarithmicProgression;
      break;
    case 's-curve':
      progressionFn = sCurveProgression;
      break;
    default:
      progressionFn = linearProgression;
  }

  // Calculate scope creep target if applicable
  let currentTarget = finalTarget;
  if (scopeCreep) {
    currentTarget = Math.round(finalTarget * (1 + scopeCreep.increasePercent / 100));
    console.log(`   🎯 Scope creep applied at period ${scopeCreep.startPeriod}: ${finalTarget} → ${currentTarget} (+${scopeCreep.increasePercent}%)`);
  }

  // Generate periods
  for (let i = 1; i <= periods; i++) {
    const periodDate = new Date(start);
    if (frequency === 'weekly') {
      periodDate.setDate(periodDate.getDate() + (i * 7));
    } else if (frequency === 'monthly') {
      periodDate.setMonth(periodDate.getMonth() + i);
    } else if (frequency === 'quarterly') {
      periodDate.setMonth(periodDate.getMonth() + (i * 3));
    }

    const reportingDate = periodDate.toISOString().split('T')[0];

    // Apply scope creep if we've reached that period
    const targetForPeriod = (scopeCreep && i >= scopeCreep.startPeriod) ? currentTarget : finalTarget;

    // Use original target for calculating expected progression
    const expected = progressionFn(i, periods, finalTarget);

    // Generate actual completion based on performance pattern
    let complete;
    if (overUnderPerform === 'over') {
      // Consistently outperforming
      complete = addVariance(expected * 1.1, actualVariance);
    } else if (overUnderPerform === 'under') {
      // Consistently underperforming
      complete = addVariance(expected * 0.9, actualVariance);
    } else if (overUnderPerform === 'ontrack') {
      // Very close to plan
      complete = addVariance(expected, 0.05);
    } else {
      // Mixed performance
      const performanceMultiplier = Math.random() > 0.5 ?
        (0.85 + Math.random() * 0.3) : // Sometimes over, sometimes under
        (0.95 + Math.random() * 0.1);  // Mostly on track
      complete = addVariance(expected * performanceMultiplier, actualVariance);
    }

    // Cap complete at current target
    complete = Math.min(complete, targetForPeriod);

    await dbRun(
      `INSERT INTO metric_periods (metric_id, reporting_date, expected, complete, target)
       VALUES (?, ?, ?, ?, ?)`,
      [metricId, reportingDate, expected, complete, targetForPeriod]
    );

    console.log(`   Period ${i}/${periods}: ${reportingDate} - Expected: ${expected}, Complete: ${complete}, Target: ${targetForPeriod}`);
  }

  // Note: Time travel feature would require metric_updates table
  // Commenting out for now as table doesn't exist yet
  // if (scopeCreep) {
  //   console.log(`   ⏰ Scope change: ${finalTarget} → ${currentTarget} (${scopeCreep.reason})`);
  // }

  return metricId;
}

// Main execution
async function main() {
  try {
    console.log('🚀 Adding diverse test data with various curve types...\n');

    // Get or create test project
    let project = await dbGet("SELECT id FROM projects WHERE name = 'Test Project - Diverse Curves'");

    if (!project) {
      const projectResult = await dbRun(
        `INSERT INTO projects (name, description, initiative_manager) VALUES (?, ?, ?)`,
        ['Test Project - Diverse Curves', 'Test project demonstrating different progression curves and performance patterns', 'Sarah Chen']
      );
      project = { id: projectResult.lastID };
      console.log(`✅ Created project: Test Project - Diverse Curves (ID: ${project.id})\n`);
    } else {
      console.log(`✅ Using existing project: Test Project - Diverse Curves (ID: ${project.id})\n`);

      // Update initiative manager if not set
      await dbRun('UPDATE projects SET initiative_manager = ? WHERE id = ?', ['Sarah Chen', project.id]);
      console.log('👤 Updated initiative manager to Sarah Chen\n');

      // Clear existing metrics for this project
      await dbRun('DELETE FROM metric_periods WHERE metric_id IN (SELECT id FROM metrics WHERE project_id = ?)', [project.id]);
      await dbRun('DELETE FROM metrics WHERE project_id = ?', [project.id]);
      console.log('🗑️  Cleared existing metrics\n');
    }

    const projectId = project.id;
    const baseDate = '2024-01-01';

    // 1. Linear progression - on track WITH SCOPE CREEP
    await generateMetricData(projectId, 'Revenue Growth (Linear)', {
      startDate: baseDate,
      periods: 12,
      frequency: 'monthly',
      finalTarget: 1000000,
      progressionType: 'linear',
      amberTolerance: 5.0,  // 5% deviation triggers amber
      redTolerance: 10.0,    // 10% deviation triggers red
      actualVariance: 0.12,
      overUnderPerform: 'ontrack',
      scopeCreep: {
        startPeriod: 5,
        increasePercent: 15,
        reason: 'Expanded to include new product line and international markets'
      },
      commentary: 'Steady linear growth with scope expansion in Q2 to capture emerging market opportunities'
    });

    // 2. Exponential progression - over-performing WITH SCOPE CREEP
    await generateMetricData(projectId, 'User Signups (Exponential)', {
      startDate: baseDate,
      periods: 12,
      frequency: 'monthly',
      finalTarget: 50000,
      progressionType: 'exponential',
      amberTolerance: 5.0,
      redTolerance: 10.0,
      actualVariance: 0.20,
      overUnderPerform: 'over',
      scopeCreep: {
        startPeriod: 6,
        increasePercent: 25,
        reason: 'Viral marketing campaign exceeded expectations, raised targets to capitalize on momentum'
      },
      commentary: 'Exponential user acquisition with viral growth pattern, consistently exceeding targets'
    });

    // 3. Logarithmic progression - under-performing (NO SCOPE CREEP for comparison)
    await generateMetricData(projectId, 'Cost Reduction (Logarithmic)', {
      startDate: baseDate,
      periods: 12,
      frequency: 'monthly',
      finalTarget: 500000,
      progressionType: 'logarithmic',
      amberTolerance: 5.0,
      redTolerance: 10.0,
      actualVariance: 0.15,
      overUnderPerform: 'under',
      commentary: 'Cost optimization showing logarithmic gains (quick wins early, harder reductions later) - facing challenges'
      // No scope creep - keeping this one stable for comparison
    });

    // 4. S-Curve progression - mixed performance WITH SCOPE CREEP
    await generateMetricData(projectId, 'Product Adoption (S-Curve)', {
      startDate: baseDate,
      periods: 12,
      frequency: 'monthly',
      finalTarget: 10000,
      progressionType: 's-curve',
      amberTolerance: 5.0,
      redTolerance: 10.0,
      actualVariance: 0.18,
      overUnderPerform: 'mixed',
      scopeCreep: { startPeriod: 7, increasePercent: 20 } // 20% scope increase at period 7
    });

    // 5. Weekly linear - high frequency tracking WITH SCOPE CREEP
    await generateMetricData(projectId, 'Sprint Velocity (Weekly)', {
      startDate: baseDate,
      periods: 26,
      frequency: 'weekly',
      finalTarget: 520,
      progressionType: 'linear',
      amberTolerance: 5.0,
      redTolerance: 10.0,
      actualVariance: 0.15,
      overUnderPerform: 'mixed',
      scopeCreep: { startPeriod: 13, increasePercent: 30 } // 30% scope increase at period 13 (halfway)
    });

    // 6. Quarterly exponential - long-term growth WITH SCOPE CREEP
    await generateMetricData(projectId, 'Market Share (Quarterly)', {
      startDate: baseDate,
      periods: 8,
      frequency: 'quarterly',
      finalTarget: 25,
      progressionType: 'exponential',
      amberTolerance: 5.0,
      redTolerance: 10.0,
      actualVariance: 0.10,
      overUnderPerform: 'over',
      scopeCreep: { startPeriod: 4, increasePercent: 40 } // 40% scope increase at period 4 (halfway)
    });

    // 7. Linear with tight tolerances - strict tracking
    await generateMetricData(projectId, 'Defect Reduction (Strict)', {
      startDate: baseDate,
      periods: 12,
      frequency: 'monthly',
      finalTarget: 100,
      progressionType: 'linear',
      amberTolerance: 2.0,  // Strict: 2% amber
      redTolerance: 5.0,    // Strict: 5% red
      actualVariance: 0.08,
      overUnderPerform: 'ontrack'
    });

    // 8. S-Curve with loose tolerances - exploratory metric WITH SCOPE CREEP
    await generateMetricData(projectId, 'Innovation Projects (Exploratory)', {
      startDate: baseDate,
      periods: 12,
      frequency: 'monthly',
      finalTarget: 50,
      progressionType: 's-curve',
      amberTolerance: 15.0,  // Loose: 15% amber
      redTolerance: 30.0,     // Loose: 30% red
      actualVariance: 0.25,
      overUnderPerform: 'mixed',
      scopeCreep: { startPeriod: 8, increasePercent: 50 } // 50% scope increase at period 8 (major expansion)
    });

    console.log('\n✅ Successfully added diverse test data!');
    console.log('\n📈 Summary:');
    console.log('   - 8 metrics with different progression curves');
    console.log('   - Weekly, monthly, and quarterly frequencies');
    console.log('   - Various performance patterns (over/under/on-track/mixed)');
    console.log('   - Different tolerance levels (strict to loose)');
    console.log('   - Realistic variance in actual vs. expected values');
    console.log('   - 6 metrics with scope creep (15-50% target increases)');
    console.log('   - 2 metrics without scope creep (for comparison)');
    console.log('   - ✨ Use Time Travel feature to see metrics before/after scope changes!');

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
