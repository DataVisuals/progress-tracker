const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// Helper to generate dates
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Calculate target values based on progression curve
function calculateTarget(finalTarget, periodIndex, totalPeriods, progressionType) {
  const t = periodIndex / totalPeriods;

  switch (progressionType) {
    case 'linear':
      return Math.round(finalTarget * t);
    case 'exponential':
      return Math.round(finalTarget * Math.pow(t, 2));
    case 's-curve':
      const sCurve = t < 0.5
        ? 2 * Math.pow(t, 2)
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
      return Math.round(finalTarget * sCurve);
    case 'logarithmic':
      if (t === 0) return 0;
      return Math.round(finalTarget * (1 - Math.pow(1 - t, 2)));
    default:
      return Math.round(finalTarget * t);
  }
}

(() => {
  try {
    const dbPath = path.join(__dirname, '../data/progress-tracker.db');
    const db = new Database(dbPath);

    console.log('Starting to create diverse project data...\n');

    // Get existing data
    const existingPortfolios = db.prepare('SELECT id, name FROM portfolios').all();
    const existingUsers = db.prepare('SELECT id, name, email FROM users').all();

    let portfolioMap = {};
    let userMap = {};

    existingPortfolios.forEach(row => {
      portfolioMap[row.name] = row.id;
    });

    existingUsers.forEach(row => {
      userMap[row.email] = { id: row.id, name: row.name };
    });

    // Create additional portfolios if needed
    const portfolios = [
      { name: 'Digital Transformation', description: 'Digital innovation and modernization initiatives' },
      { name: 'Customer Experience', description: 'Projects focused on improving customer satisfaction' },
      { name: 'Infrastructure', description: 'IT infrastructure and platform improvements' },
      { name: 'Product Development', description: 'New product features and enhancements' },
      { name: 'Operational Excellence', description: 'Process improvement and efficiency projects' }
    ];

    const insertPortfolio = db.prepare("INSERT INTO portfolios (name, description, created_at) VALUES (?, ?, datetime('now'))");

    portfolios.forEach(portfolio => {
      if (!portfolioMap[portfolio.name]) {
        const info = insertPortfolio.run(portfolio.name, portfolio.description);
        portfolioMap[portfolio.name] = info.lastInsertRowid;
        console.log(`Created portfolio: ${portfolio.name}`);
      }
    });

    // Create additional users if needed
    const users = [
      { name: 'Sarah Chen', email: 'sarah.chen@example.com', role: 'admin' },
      { name: 'Michael Rodriguez', email: 'michael.r@example.com', role: 'user' },
      { name: 'Emily Watson', email: 'emily.watson@example.com', role: 'user' },
      { name: 'James Park', email: 'james.park@example.com', role: 'user' },
      { name: 'Lisa Anderson', email: 'lisa.anderson@example.com', role: 'user' },
      { name: 'David Kumar', email: 'david.kumar@example.com', role: 'user' }
    ];

    const hashedPassword = bcrypt.hashSync('password123', 10);
    const insertUser = db.prepare("INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, datetime('now'))");

    for (const user of users) {
      if (!userMap[user.email]) {
        const info = insertUser.run(user.name, user.email, hashedPassword, user.role);
        userMap[user.email] = { id: info.lastInsertRowid, name: user.name };
        console.log(`Created user: ${user.name}`);
      }
    }

    // Define diverse projects
    const projects = [
      {
        name: 'Mobile App Redesign',
        description: 'Complete overhaul of mobile application with modern UI/UX',
        portfolio: 'Digital Transformation',
        manager: 'Sarah Chen',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2025-03-31'),
        metrics: [
          { name: 'UI Screens Completed', target: 45, progression: 'logarithmic', frequency: 'monthly', amberTol: 8, redTol: 15 },
          { name: 'User Stories Implemented', target: 120, progression: 's-curve', frequency: 'monthly', amberTol: 5, redTol: 12 }
        ],
        comments: [
          { date: '2024-10-01', author: 'Sarah Chen', text: 'Design phase progressing well. Team is ahead of schedule on mockups.' },
          { date: '2024-11-01', author: 'Michael Rodriguez', text: 'Some technical challenges with the new navigation pattern. May need to revisit.' }
        ]
      },
      {
        name: 'Customer Portal Enhancement',
        description: 'Add self-service features and improve portal performance',
        portfolio: 'Customer Experience',
        manager: 'Michael Rodriguez',
        startDate: new Date('2024-08-01'),
        endDate: new Date('2025-02-28'),
        metrics: [
          { name: 'Features Delivered', target: 30, progression: 'linear', frequency: 'monthly', amberTol: 7, redTol: 14 },
          { name: 'Performance Score', target: 95, progression: 'exponential', frequency: 'monthly', amberTol: 5, redTol: 10 },
          { name: 'User Acceptance Tests', target: 150, progression: 's-curve', frequency: 'monthly', amberTol: 6, redTol: 12 }
        ],
        comments: [
          { date: '2024-09-15', author: 'Emily Watson', text: 'Initial user feedback is very positive. Request for additional filter options.' },
          { date: '2024-10-20', author: 'Michael Rodriguez', text: 'Performance improvements exceeding expectations. Load time reduced by 40%.' }
        ]
      },
      {
        name: 'Cloud Migration Phase 2',
        description: 'Migrate remaining legacy systems to cloud infrastructure',
        portfolio: 'Infrastructure',
        manager: 'James Park',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2025-06-30'),
        metrics: [
          { name: 'Systems Migrated', target: 24, progression: 'linear', frequency: 'monthly', amberTol: 10, redTol: 20 },
          { name: 'Data Transfer (TB)', target: 500, progression: 'exponential', frequency: 'monthly', amberTol: 8, redTol: 15 }
        ],
        comments: [
          { date: '2024-08-10', author: 'James Park', text: 'Initial migrations taking longer than expected due to data cleanup requirements.' },
          { date: '2024-09-20', author: 'David Kumar', text: 'Automated migration scripts working well. Should accelerate remaining migrations.' },
          { date: '2024-10-25', author: 'James Park', text: 'On track for Q1 2025 completion. Team performing excellently.' }
        ]
      },
      {
        name: 'AI-Powered Recommendations',
        description: 'Implement machine learning for personalized product recommendations',
        portfolio: 'Product Development',
        manager: 'Emily Watson',
        startDate: new Date('2024-10-01'),
        endDate: new Date('2025-04-30'),
        metrics: [
          { name: 'Model Iterations', target: 20, progression: 'logarithmic', frequency: 'monthly', amberTol: 10, redTol: 20 },
          { name: 'Training Data Points (M)', target: 50, progression: 's-curve', frequency: 'monthly', amberTol: 5, redTol: 12 },
          { name: 'Accuracy Score', target: 92, progression: 'exponential', frequency: 'monthly', amberTol: 3, redTol: 7 }
        ],
        comments: [
          { date: '2024-10-15', author: 'Emily Watson', text: 'Data quality is better than expected. This will help model accuracy significantly.' },
          { date: '2024-11-01', author: 'Sarah Chen', text: 'Baseline model showing promising results. 78% accuracy on test set.' }
        ]
      },
      {
        name: 'Process Automation Initiative',
        description: 'Automate manual processes in finance and HR departments',
        portfolio: 'Operational Excellence',
        manager: 'Lisa Anderson',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2025-05-31'),
        metrics: [
          { name: 'Processes Automated', target: 36, progression: 'linear', frequency: 'monthly', amberTol: 8, redTol: 15 },
          { name: 'Time Saved (Hours/Month)', target: 800, progression: 's-curve', frequency: 'monthly', amberTol: 10, redTol: 18 },
          { name: 'Error Reduction %', target: 85, progression: 'logarithmic', frequency: 'quarterly', amberTol: 5, redTol: 10 }
        ],
        comments: [
          { date: '2024-08-15', author: 'Lisa Anderson', text: 'Change management is critical. Scheduling extra training sessions.' },
          { date: '2024-09-25', author: 'James Park', text: 'Early wins in invoice processing. Finance team very happy with results.' },
          { date: '2024-10-30', author: 'Lisa Anderson', text: 'Ahead of schedule. Looking to expand scope to include procurement processes.' }
        ]
      },
      {
        name: 'Security Compliance Upgrade',
        description: 'Implement SOC 2 Type II compliance requirements',
        portfolio: 'Infrastructure',
        manager: 'David Kumar',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2025-03-31'),
        metrics: [
          { name: 'Controls Implemented', target: 75, progression: 'linear', frequency: 'monthly', amberTol: 6, redTol: 12 },
          { name: 'Systems Audited', target: 45, progression: 'linear', frequency: 'monthly', amberTol: 8, redTol: 15 }
        ],
        comments: [
          { date: '2024-09-20', author: 'David Kumar', text: 'More work than initially estimated. Adding 2 contractors to team.' },
          { date: '2024-10-28', author: 'Sarah Chen', text: 'Documentation requirements are extensive but progressing well.' }
        ]
      },
      {
        name: 'Data Analytics Platform',
        description: 'Build centralized analytics platform for business intelligence',
        portfolio: 'Digital Transformation',
        manager: 'Michael Rodriguez',
        startDate: new Date('2024-08-15'),
        endDate: new Date('2025-08-31'),
        metrics: [
          { name: 'Data Sources Integrated', target: 40, progression: 's-curve', frequency: 'monthly', amberTol: 10, redTol: 18 },
          { name: 'Dashboards Created', target: 60, progression: 'exponential', frequency: 'monthly', amberTol: 7, redTol: 14 },
          { name: 'Users Onboarded', target: 250, progression: 'exponential', frequency: 'monthly', amberTol: 12, redTol: 20 }
        ],
        comments: [
          { date: '2024-09-10', author: 'Michael Rodriguez', text: 'Platform learning curve steeper than expected. Team training ongoing.' },
          { date: '2024-10-15', author: 'Emily Watson', text: 'First dashboard received excellent feedback from executive team.' },
          { date: '2024-11-01', author: 'Michael Rodriguez', text: 'Integration with legacy systems proving challenging but solvable.' }
        ]
      }
    ];

    // Prepare statements for bulk inserts
    const insertProject = db.prepare(
      "INSERT INTO projects (name, description, initiative_manager, start_date, end_date, portfolio_id, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
    );
    const insertMetric = db.prepare(
      "INSERT INTO metrics (project_id, name, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    );
    const insertPeriod = db.prepare(
      "INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    );
    const insertComment = db.prepare(
      'INSERT INTO comments (period_id, created_by, comment_text, created_at) VALUES (?, ?, ?, ?)'
    );

    // Insert projects with full data
    for (const project of projects) {
      const portfolioId = portfolioMap[project.portfolio];

      const projectInfo = insertProject.run(
        project.name,
        project.description,
        project.manager,
        formatDate(project.startDate),
        formatDate(project.endDate),
        portfolioId
      );

      const projectId = projectInfo.lastInsertRowid;
      console.log(`\nCreated project: ${project.name}`);

      // Insert metrics and their periods
      for (const metric of project.metrics) {
        const metricStart = project.startDate;
        const metricEnd = project.endDate;

        const metricInfo = insertMetric.run(
          projectId,
          metric.name,
          formatDate(metricStart),
          formatDate(metricEnd),
          metric.frequency,
          metric.progression,
          metric.target,
          metric.amberTol,
          metric.redTol
        );

        const metricId = metricInfo.lastInsertRowid;
        console.log(`  Added metric: ${metric.name} (${metric.progression})`);

        // Generate periods
        let currentDate = new Date(metricStart);
        const periods = [];
        let periodIndex = 0;

        while (currentDate <= metricEnd) {
          periods.push({
            date: new Date(currentDate),
            index: periodIndex
          });

          switch (metric.frequency) {
            case 'weekly':
              currentDate = addMonths(currentDate, 0.25);
              break;
            case 'fortnightly':
              currentDate = addMonths(currentDate, 0.5);
              break;
            case 'monthly':
              currentDate = addMonths(currentDate, 1);
              break;
            case 'quarterly':
              currentDate = addMonths(currentDate, 3);
              break;
          }
          periodIndex++;
        }

        // Insert periods with realistic progress
        const now = new Date();
        for (let i = 0; i < periods.length; i++) {
          const period = periods[i];
          const expectedValue = calculateTarget(metric.target, i + 1, periods.length, metric.progression);
          const targetValue = calculateTarget(metric.target, i + 1, periods.length, metric.progression);

          let completeValue = null;
          if (period.date < now) {
            // Add realistic variance for past periods
            const variance = (Math.random() - 0.5) * 0.15; // ±15% variance
            completeValue = Math.max(0, Math.round(targetValue * (1 + variance)));
          }

          insertPeriod.run(metricId, formatDate(period.date), expectedValue, targetValue, completeValue);
        }
        console.log(`    Generated ${periods.length} periods`);
      }

      // Insert comments using the comments table
      for (const comment of project.comments) {
        const author = userMap[`${comment.author.toLowerCase().replace(' ', '.')}@example.com`];
        if (author) {
          // Find a metric period to attach the comment to (use the first metric's first period)
          const metricResult = db.prepare('SELECT id FROM metrics WHERE project_id = ? LIMIT 1').get(projectId);
          if (metricResult) {
            const metricId = metricResult.id;
            const periodResult = db.prepare(
              'SELECT id FROM metric_periods WHERE metric_id = ? AND reporting_date >= ? LIMIT 1'
            ).get(metricId, comment.date);
            if (periodResult) {
              const periodId = periodResult.id;
              insertComment.run(periodId, author.id, comment.text, comment.date);
            }
          }
        }
      }
      console.log(`  Added ${project.comments.length} comments`);
    }

    // Close database connection
    db.close();

    console.log('\n✅ Successfully created diverse project data!');
    console.log(`\nCreated ${projects.length} projects across ${Object.keys(portfolioMap).length} portfolios`);
    console.log(`Projects include various progression curves: linear, exponential, s-curve, and logarithmic`);
    console.log(`Added multiple metrics per project and user comments`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
