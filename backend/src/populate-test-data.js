const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/progress-tracker.db');

const db = new sqlite3.Database(DB_PATH);

// Helper to run queries with promises
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

// Greek alphabet projects with descriptions
const greekProjects = [
  { name: 'Project Alpha Initiative', desc: 'Linear growth - steady progress throughout', manager: 'Sarah Chen' },
  { name: 'Project Beta Platform', desc: 'S-Curve - slow start, rapid middle, plateau', manager: 'Michael Torres' },
  { name: 'Project Gamma System', desc: 'J-Curve - slow start then exponential growth', manager: 'Elena Rodriguez' },
  { name: 'Project Delta Transformation', desc: 'Inverse S-Curve - fast start, slow finish', manager: 'James Wilson' },
  { name: 'Project Epsilon Framework', desc: 'Logarithmic - rapid early progress, diminishing returns', manager: 'Aisha Patel' },
  { name: 'Project Zeta Migration', desc: 'Step function - progress in distinct phases', manager: 'Robert Kim' },
  { name: 'Project Eta Modernization', desc: 'Exponential - accelerating progress', manager: 'Maria Santos' },
  { name: 'Project Theta Analytics', desc: 'Linear with setback - progress, dip, recovery', manager: 'David Zhang' },
  { name: 'Project Iota Integration', desc: 'Double S-Curve - two growth phases', manager: 'Sophie Martin' },
  { name: 'Project Kappa Optimization', desc: 'Polynomial - accelerating then decelerating', manager: 'Ahmed Hassan' },
  { name: 'Project Lambda Architecture', desc: 'Delayed start - late beginning, rapid catch-up', manager: 'Lisa Thompson' },
  { name: 'Project Mu Infrastructure', desc: 'Early completion - fast start, early finish', manager: 'Carlos Mendez' },
  { name: 'Project Nu Digitalization', desc: 'Oscillating - progress with periodic setbacks', manager: 'Jennifer Lee' },
  { name: 'Project Xi Consolidation', desc: 'Plateau pattern - quick start, long plateau, final push', manager: 'Thomas Anderson' },
  { name: 'Project Omicron Redesign', desc: 'Sigmoid - classic S-curve shape', manager: 'Fatima Al-Said' },
  { name: 'Project Pi Research', desc: 'Accelerating - increasingly rapid progress', manager: 'Jonathan Park' },
  { name: 'Project Rho Deployment', desc: 'Decelerating - diminishing progress rate', manager: 'Rachel Cohen' },
  { name: 'Project Sigma Standards', desc: 'Linear progression with steady growth', manager: 'Marcus Johnson' },
  { name: 'Project Tau Technology', desc: 'Gradual acceleration throughout', manager: 'Nina Petrov' },
  { name: 'Project Upsilon Upgrade', desc: 'Stepwise - discrete jumps in progress', manager: 'Kevin O\'Brien' },
  { name: 'Project Phi Foundation', desc: 'Square root - rapid start, gradual slowdown', manager: 'Priya Sharma' },
  { name: 'Project Chi Compliance', desc: 'Cubic - slow, accelerate, decelerate', manager: 'Hans Mueller' },
  { name: 'Project Psi Process', desc: 'Bumpy ride - irregular progress with variations', manager: 'Yuki Tanaka' },
  { name: 'Project Omega Evolution', desc: 'Exponential decay - fast start, asymptotic approach', manager: 'Isabella Romano' }
];

// Generate dates for the past year (12 months of data)
function generateDates() {
  const dates = [];
  const today = new Date();
  for (let i = 11; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

// Curve generation functions - all monotonically increasing
const curves = {
  linear: (x) => x,
  sCurve: (x) => 1 / (1 + Math.exp(-12 * (x - 0.5))),
  jCurve: (x) => Math.pow(x, 2.5),
  inverseSCurve: (x) => {
    // Modified to be monotonically increasing
    const base = 1 / (1 + Math.exp(-12 * (x - 0.5)));
    return 0.7 * x + 0.3 * (1 - base);
  },
  logarithmic: (x) => Math.log(1 + 9 * x) / Math.log(10),
  stepFunction: (x) => Math.floor(x * 4) / 4 + (x % 0.25) * 0.5,
  exponential: (x) => (Math.exp(3 * x) - 1) / (Math.exp(3) - 1),
  linearWithPlateau: (x) => x < 0.4 ? x * 1.5 : 0.6 + (x - 0.4) * 0.67,
  doubleSCurve: (x) => {
    if (x < 0.5) {
      return 0.4 * (1 / (1 + Math.exp(-12 * (x - 0.25))));
    } else {
      return 0.4 + 0.6 * (1 / (1 + Math.exp(-12 * ((x - 0.5) / 0.5 - 0.5))));
    }
  },
  polynomial: (x) => 3 * Math.pow(x, 2) - 2 * Math.pow(x, 3),
  delayedStart: (x) => x < 0.3 ? x * 0.5 : 0.15 + (x - 0.3) * 1.21,
  earlyCompletion: (x) => x < 0.7 ? x * 1.2 : 0.84 + (x - 0.7) * 0.53,
  oscillatingUp: (x) => x + 0.05 * Math.sin(x * Math.PI * 4),
  plateau: (x) => x < 0.3 ? x * 2 : (x < 0.7 ? 0.6 : 0.6 + (x - 0.7) * 1.33),
  sigmoid: (x) => 1 / (1 + Math.exp(-10 * (x - 0.5))),
  accelerating: (x) => Math.pow(x, 1.5),
  decelerating: (x) => Math.pow(x, 0.5),
  gradualStart: (x) => Math.pow(x, 1.2),
  fastStart: (x) => Math.pow(x, 0.8),
  stepwise: (x) => {
    const step = Math.floor(x * 5) / 5;
    const remainder = (x * 5) % 1;
    return step + remainder * 0.2;
  },
  squareRoot: (x) => Math.sqrt(x),
  cubic: (x) => Math.pow(x, 3),
  smoothWave: (x) => x + 0.03 * Math.sin(x * Math.PI * 6),
  exponentialDecay: (x) => 1 - Math.exp(-4 * x)
};

const curveKeys = Object.keys(curves);

async function clearTestData() {
  console.log('🗑️  Clearing existing test data...\n');

  // Delete all projects (cascade will handle related data)
  await dbRun('DELETE FROM projects');

  console.log('✅ Existing test data cleared\n');
}

async function populateTestData() {
  try {
    console.log('🚀 Starting test data population...\n');

    // Clear existing data first
    await clearTestData();

    // Get admin user ID
    const admin = await dbGet('SELECT id FROM users WHERE role = "admin" LIMIT 1');
    if (!admin) {
      console.error('❌ No admin user found. Please create an admin user first.');
      return;
    }

    const dates = generateDates();
    console.log(`📅 Generating data for ${dates.length} months\n`);

    // Create all 24 Greek alphabet projects
    for (let i = 0; i < greekProjects.length; i++) {
      const project = greekProjects[i];
      const curveFunc = curves[curveKeys[i]];

      console.log(`Creating project ${i + 1}/24: ${project.name}`);

      // Create project
      const projectResult = await dbRun(
        'INSERT INTO projects (name, description, initiative_manager) VALUES (?, ?, ?)',
        [project.name, project.desc, project.manager]
      );
      const projectId = projectResult.lastID;

      // Create 3 metrics per project
      const metrics = [
        { name: 'Delivery Progress', target: 100, owner: admin.id },
        { name: 'Quality Score', target: 95, owner: admin.id },
        { name: 'Team Velocity', target: 80, owner: admin.id }
      ];

      for (const metric of metrics) {
        const metricResult = await dbRun(
          `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, final_target)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [projectId, metric.name, metric.owner, dates[0], dates[dates.length - 1], 'monthly', metric.target]
        );
        const metricId = metricResult.lastID;

        // Generate metric periods using the curve function
        // IMPORTANT: Ensure complete values are monotonically increasing
        let previousComplete = 0;
        const baseTarget = metric.target;
        const scopeGrowthFactor = 1.15; // 15% total growth
        const finalTarget = Math.round(baseTarget * scopeGrowthFactor);

        for (let j = 0; j < dates.length; j++) {
          const progress = j / (dates.length - 1); // 0 to 1
          const curveValue = curveFunc(progress);

          // Expected follows the curve toward the ORIGINAL baseline target
          const expectedValue = Math.round(curveValue * baseTarget);

          // Scope grows during project, but mostly absorbed by the end
          // Scope peaks around 60-70% of project, then team absorbs/completes it
          let scopeProgressFactor;
          if (progress < 0.7) {
            // Scope grows from 1.0 to scopeGrowthFactor until 70% mark
            scopeProgressFactor = 1 + ((progress / 0.7) * (scopeGrowthFactor - 1));
          } else {
            // After 70%, scope stabilizes and gets absorbed
            // By end, only 2-5% scope increase remains
            const remaining = 1 - ((progress - 0.7) / 0.3); // Goes from 1 to 0
            const endScopeGrowth = 1.02; // Only 2% increase at end
            scopeProgressFactor = endScopeGrowth + (remaining * (scopeGrowthFactor - endScopeGrowth));
          }
          const target = Math.round(baseTarget * scopeProgressFactor);

          // Complete progresses toward the current target
          // This ensures at end: complete ≈ target (minimal remaining)
          const idealComplete = Math.round(curveValue * target);
          const complete = Math.max(previousComplete, idealComplete);
          previousComplete = complete;

          // Generate realistic commentary for certain periods
          let commentary = null;
          const variance = complete - expectedValue;
          const variancePercent = expectedValue > 0 ? (variance / expectedValue) * 100 : 0;

          // Add commentary based on project progress and variance
          if (j === 0) {
            commentary = "Project kickoff - initial baseline established.";
          } else if (j === 1) {
            commentary = "Early phase - team ramping up, processes being established.";
          } else if (j === Math.floor(dates.length / 3)) {
            if (variancePercent > 10) {
              commentary = "Strong progress - ahead of schedule. Team has good momentum.";
            } else if (variancePercent < -10) {
              commentary = "Behind schedule - addressing resource constraints and dependencies.";
            } else {
              commentary = "On track - meeting expectations. Key milestones achieved.";
            }
          } else if (j === Math.floor(dates.length / 2)) {
            commentary = "Mid-project review - scope adjustments made based on learnings.";
          } else if (j === Math.floor(dates.length * 2 / 3)) {
            if (variancePercent > 5) {
              commentary = "Excellent progress - quality remains high while staying ahead of plan.";
            } else if (variancePercent < -5) {
              commentary = "Some delays encountered - mitigation strategies in place.";
            } else {
              commentary = "Final phase initiated - focus on quality and integration.";
            }
          } else if (j === dates.length - 2) {
            commentary = "Approaching completion - final testing and documentation underway.";
          } else if (j === dates.length - 1) {
            if (complete >= target * 0.95) {
              commentary = "Project successfully completed - delivering on objectives.";
            } else {
              commentary = "Project closing - remaining items tracked for post-launch.";
            }
          } else if (Math.abs(variancePercent) > 15 && j > 2) {
            if (variancePercent > 0) {
              commentary = "Significantly ahead of plan - considering scope expansion.";
            } else {
              commentary = "Behind target - additional resources allocated to recover schedule.";
            }
          }

          await dbRun(
            `INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete, commentary)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [metricId, dates[j], expectedValue, target, complete, commentary]
          );
        }
      }

      // Add some CRAIDs for variety
      if (i % 3 === 0) {
        await dbRun(
          `INSERT INTO craids (project_id, type, title, description, status, owner_id, priority)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            'risk',
            'Resource Availability Risk',
            'Key team members may be allocated to other initiatives',
            'open',
            admin.id,
            'high'
          ]
        );
      }

      if (i % 4 === 0) {
        await dbRun(
          `INSERT INTO craids (project_id, type, title, description, status, owner_id, priority)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            'action',
            'Complete security review',
            'Schedule and complete comprehensive security audit',
            'in_progress',
            admin.id,
            'medium'
          ]
        );
      }
    }

    console.log('\n✅ Test data population completed successfully!');
    console.log(`📊 Created:`);
    console.log(`   - ${greekProjects.length} projects`);
    console.log(`   - ${greekProjects.length * 3} metrics`);
    console.log(`   - ${greekProjects.length * 3 * dates.length} metric periods`);
    console.log(`   - Various CRAIDs for realism\n`);

  } catch (err) {
    console.error('❌ Error populating test data:', err);
  } finally {
    db.close();
  }
}

populateTestData();
