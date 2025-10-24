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
  { name: 'Alpha Initiative', desc: 'Linear growth - steady progress throughout', manager: 'Sarah Chen' },
  { name: 'Beta Platform', desc: 'S-Curve - slow start, rapid middle, plateau', manager: 'Michael Torres' },
  { name: 'Gamma System', desc: 'J-Curve - slow start then exponential growth', manager: 'Elena Rodriguez' },
  { name: 'Delta Transformation', desc: 'Inverse S-Curve - fast start, slow finish', manager: 'James Wilson' },
  { name: 'Epsilon Framework', desc: 'Logarithmic - rapid early progress, diminishing returns', manager: 'Aisha Patel' },
  { name: 'Zeta Migration', desc: 'Step function - progress in distinct phases', manager: 'Robert Kim' },
  { name: 'Eta Modernization', desc: 'Exponential - accelerating progress', manager: 'Maria Santos' },
  { name: 'Theta Analytics', desc: 'Linear with setback - progress, dip, recovery', manager: 'David Zhang' },
  { name: 'Iota Integration', desc: 'Double S-Curve - two growth phases', manager: 'Sophie Martin' },
  { name: 'Kappa Optimization', desc: 'Polynomial - accelerating then decelerating', manager: 'Ahmed Hassan' },
  { name: 'Lambda Architecture', desc: 'Delayed start - late beginning, rapid catch-up', manager: 'Lisa Thompson' },
  { name: 'Mu Infrastructure', desc: 'Early completion - fast start, early finish', manager: 'Carlos Mendez' },
  { name: 'Nu Digitalization', desc: 'Oscillating - progress with periodic setbacks', manager: 'Jennifer Lee' },
  { name: 'Xi Consolidation', desc: 'Plateau pattern - quick start, long plateau, final push', manager: 'Thomas Anderson' },
  { name: 'Omicron Redesign', desc: 'Sigmoid - classic S-curve shape', manager: 'Fatima Al-Said' },
  { name: 'Pi Research', desc: 'Accelerating - increasingly rapid progress', manager: 'Jonathan Park' },
  { name: 'Rho Deployment', desc: 'Decelerating - diminishing progress rate', manager: 'Rachel Cohen' },
  { name: 'Sigma Standards', desc: 'U-Curve - decline then recovery', manager: 'Marcus Johnson' },
  { name: 'Tau Technology', desc: 'Inverted U - peak in middle, decline', manager: 'Nina Petrov' },
  { name: 'Upsilon Upgrade', desc: 'Stepwise - discrete jumps in progress', manager: 'Kevin O\'Brien' },
  { name: 'Phi Foundation', desc: 'Square root - rapid start, gradual slowdown', manager: 'Priya Sharma' },
  { name: 'Chi Compliance', desc: 'Cubic - slow, accelerate, decelerate', manager: 'Hans Mueller' },
  { name: 'Psi Process', desc: 'Bumpy ride - irregular progress with variations', manager: 'Yuki Tanaka' },
  { name: 'Omega Evolution', desc: 'Exponential decay - fast start, asymptotic approach', manager: 'Isabella Romano' }
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

// Curve generation functions
const curves = {
  linear: (x) => x,
  sCurve: (x) => 1 / (1 + Math.exp(-12 * (x - 0.5))),
  jCurve: (x) => Math.pow(x, 2.5),
  inverseSCurve: (x) => 1 - 1 / (1 + Math.exp(-12 * (x - 0.5))),
  logarithmic: (x) => Math.log(1 + 9 * x) / Math.log(10),
  stepFunction: (x) => Math.floor(x * 4) / 4,
  exponential: (x) => (Math.exp(3 * x) - 1) / (Math.exp(3) - 1),
  linearWithSetback: (x) => x < 0.5 ? x * 1.2 : x * 0.8 + 0.2,
  doubleSCurve: (x) => x < 0.5 ? 0.4 / (1 + Math.exp(-12 * (x - 0.25))) : 0.5 + 0.5 / (1 + Math.exp(-12 * (x - 0.75))),
  polynomial: (x) => 3 * Math.pow(x, 2) - 2 * Math.pow(x, 3),
  delayedStart: (x) => x < 0.3 ? 0 : (x - 0.3) * 1.43,
  earlyCompletion: (x) => x < 0.7 ? x * 1.43 : 1,
  oscillating: (x) => x + 0.1 * Math.sin(x * Math.PI * 4),
  plateau: (x) => x < 0.3 ? x * 2 : x < 0.7 ? 0.6 : 0.6 + (x - 0.7) * 1.33,
  sigmoid: (x) => 1 / (1 + Math.exp(-10 * (x - 0.5))),
  accelerating: (x) => Math.pow(x, 1.5),
  decelerating: (x) => Math.pow(x, 0.5),
  uCurve: (x) => 4 * Math.pow(x - 0.5, 2),
  invertedU: (x) => 1 - 4 * Math.pow(x - 0.5, 2),
  stepwise: (x) => Math.floor(x * 5) / 5 + (x % 0.2) * 0.5,
  squareRoot: (x) => Math.sqrt(x),
  cubic: (x) => 4 * Math.pow(x, 3) - 3 * Math.pow(x, 2) + x,
  bumpy: (x) => x + 0.15 * Math.sin(x * Math.PI * 6) * (1 - x),
  exponentialDecay: (x) => 1 - Math.exp(-4 * x)
};

const curveKeys = Object.keys(curves);

async function populateTestData() {
  try {
    console.log('🚀 Starting test data population...\n');

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
        for (let j = 0; j < dates.length; j++) {
          const progress = j / (dates.length - 1); // 0 to 1
          const curveValue = curveFunc(progress);

          // Add some randomness (±5%) for realism
          const randomness = (Math.random() - 0.5) * 0.1;
          const actual = Math.max(0, Math.min(1, curveValue + randomness));

          const expected = progress; // Linear expectation
          const complete = Math.round(actual * metric.target);
          const expectedValue = Math.round(expected * metric.target);

          await dbRun(
            `INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete)
             VALUES (?, ?, ?, ?, ?)`,
            [metricId, dates[j], expectedValue, metric.target, complete]
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
