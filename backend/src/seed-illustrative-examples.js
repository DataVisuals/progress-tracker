/**
 * Seed Illustrative Examples Portfolio
 *
 * Creates a comprehensive portfolio of example projects demonstrating all features:
 * - Milestones with various states (completed, upcoming, overdue)
 * - Metrics with historical data and trends
 * - Comments and feedback
 * - CRAIDs (Comments, Risks, Actions, Issues, Dependencies)
 * - Recovery plans
 * - Project links
 * - Various project types and timelines
 *
 * Note: All data is clearly marked as "Example" or "Demo" for illustrative purposes
 */

const Database = require('better-sqlite3');
const path = require('path');

let db = null;

function getDb() {
  if (!db) {
    const dbPath = path.join(__dirname, '..', 'data', 'progress-tracker.db');
    db = new Database(dbPath);
  }
  return db;
}

// Helper to get date strings relative to today
const getDate = (daysOffset) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
};

const getDateTime = (daysOffset, hoursOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(date.getHours() + hoursOffset);
  return date.toISOString();
};

// Helper to generate period dates based on frequency
const generatePeriodDates = (startDate, endDate, frequency) => {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let current = new Date(start);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);

    // Increment based on frequency
    switch (frequency) {
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'fortnightly':
        current.setDate(current.getDate() + 14);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'quarterly':
        current.setMonth(current.getMonth() + 3);
        break;
      default:
        current.setMonth(current.getMonth() + 1); // Default to monthly
    }
  }

  return dates;
};

async function seedIllustrativeExamples() {
  console.log('📦 Seeding Illustrative Examples Portfolio...');

  const database = getDb();

  try {
    // Check if portfolio already exists
    const existingPortfolio = database.prepare('SELECT id FROM portfolios WHERE name = ?').get('Illustrative Examples');
    if (existingPortfolio) {
      console.log('ℹ️  Illustrative Examples portfolio already exists, skipping seed');
      return;
    }

    // Create portfolio
    const portfolioResult = database.prepare(`
      INSERT INTO portfolios (name, description, color, display_order)
      VALUES (?, ?, ?, ?)
    `).run(
      'Illustrative Examples',
      '📚 Demonstration projects showcasing Progress Tracker features. All data is for illustrative purposes only.',
      '#9333ea', // Purple color
      999 // Display last
    );

    const portfolioId = portfolioResult.lastInsertRowid;
    console.log(`✅ Created Illustrative Examples portfolio (ID: ${portfolioId})`);

    // Get admin user for ownership
    const adminUser = database.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin');
    const userId = adminUser?.id || 1;

    // Project 1: Infrastructure Rollout
    const infraProject = database.prepare(`
      INSERT INTO projects (name, description, initiative_manager, portfolio_id, start_date, end_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      '[Example] Global Infrastructure Rollout',
      'Demonstration of a multi-phase infrastructure deployment project. Example data showing network upgrades, datacenter migrations, and security implementations across 15 global locations.',
      'Admin User',
      portfolioId,
      getDate(-120), // Started 4 months ago
      getDate(60), // Ends in 2 months
      getDateTime(-120)
    );
    const infraId = infraProject.lastInsertRowid;

    // Infrastructure Milestones
    const infraMilestones = [
      { title: 'Requirements Gathering', date: -110, completed: 1, completedDate: -105 },
      { title: 'Vendor Selection', date: -90, completed: 1, completedDate: -88 },
      { title: 'Phase 1: NA Datacenters', date: -60, completed: 1, completedDate: -58 },
      { title: 'Phase 2: EMEA Rollout', date: -30, completed: 1, completedDate: -25 },
      { title: 'Phase 3: APAC Deployment', date: 0, completed: 0 },
      { title: 'Security Audit', date: 15, completed: 0 },
      { title: 'Performance Testing', date: 30, completed: 0 },
      { title: 'Final Cutover', date: 55, completed: 0 }
    ];

    infraMilestones.forEach((m, idx) => {
      database.prepare(`
        INSERT INTO milestones (project_id, title, target_date, completed, completed_date, display_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        infraId,
        m.title,
        getDate(m.date),
        m.completed,
        m.completedDate ? getDate(m.completedDate) : null,
        idx
      );
    });

    // Infrastructure Metrics
    const infraMetrics = [
      {
        name: '[Example] Datacenters Migrated',
        description: 'Number of datacenters successfully migrated to new infrastructure',
        finalTarget: 15,
        data: [
          { offset: -120, complete: 0 },
          { offset: -90, complete: 2 },
          { offset: -60, complete: 5 },
          { offset: -30, complete: 9 },
          { offset: 0, complete: 11 }
        ]
      },
      {
        name: '[Example] Network Uptime %',
        description: 'Percentage uptime during migration periods - showing declining trend due to migration issues',
        finalTarget: 99.9,
        data: [
          { offset: -120, complete: 99.8 },
          { offset: -90, complete: 99.5 },
          { offset: -60, complete: 99.7 },
          { offset: -30, complete: 99.4 }, // Declining
          { offset: 0, complete: 98.9 } // Below target - adverse metric
        ]
      },
      {
        name: '[Example] Migration Issues Resolved',
        description: 'Percentage of critical migration issues resolved - behind schedule',
        finalTarget: 100,
        data: [
          { offset: -120, complete: 0 },
          { offset: -90, complete: 45 },
          { offset: -60, complete: 62 },
          { offset: -30, complete: 68 }, // Slowing down
          { offset: 0, complete: 71 } // Well behind target
        ]
      }
    ];

    infraMetrics.forEach(metric => {
      const metricResult = database.prepare(`
        INSERT INTO metrics (project_id, name, description, owner_id, start_date, end_date, frequency, progression_type, final_target)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        infraId,
        metric.name,
        metric.description,
        userId,
        getDate(-120),
        getDate(60),
        'monthly',
        'linear',
        metric.finalTarget
      );

      const metricId = metricResult.lastInsertRowid;

      // Add metric periods with commentary
      metric.data.forEach((period, idx) => {
        const expected = metric.finalTarget * ((120 + period.offset) / 180);
        const commentary = idx === metric.data.length - 1
          ? `<p>Latest update: ${metric.name} is tracking ${period.complete >= expected ? 'ahead of' : 'behind'} schedule. ${period.complete >= expected ? 'Great progress!' : 'Action needed to catch up.'}</p>`
          : idx === metric.data.length - 2
          ? `<p>Progress update: ${metric.name} ${period.complete >= expected ? 'continues strong performance' : 'needs attention'}.</p>`
          : null;

        database.prepare(`
          INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete, commentary)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          metricId,
          getDate(period.offset),
          expected,
          metric.finalTarget,
          period.complete,
          commentary
        );
      });
    });

    // Project 2: ML Model Development
    const mlProject = database.prepare(`
      INSERT INTO projects (name, description, initiative_manager, portfolio_id, start_date, end_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      '[Example] Customer Churn Prediction Model',
      'Demo ML project showcasing model development lifecycle. Example data includes training, validation, deployment phases with accuracy metrics and A/B testing results.',
      'Admin User',
      portfolioId,
      getDate(-90),
      getDate(90),
      getDateTime(-90)
    );
    const mlId = mlProject.lastInsertRowid;

    // ML Milestones - Multiple overdue showing project in trouble
    const mlMilestones = [
      { title: 'Data Collection & Cleaning', date: -80, completed: 1, completedDate: -75 },
      { title: 'Feature Engineering', date: -60, completed: 1, completedDate: -55 },
      { title: 'Model Training v1', date: -40, completed: 1, completedDate: -38 },
      { title: 'Model Validation', date: -20, completed: 1, completedDate: -18 },
      { title: 'Bias & Fairness Review', date: -10, completed: 0 }, // Overdue by 10 days
      { title: 'A/B Test Deployment', date: -5, completed: 0 }, // Overdue by 5 days
      { title: 'Production Rollout', date: 30, completed: 0 },
      { title: 'Performance Monitoring', date: 60, completed: 0 },
      { title: 'Model Retraining', date: 85, completed: 0 }
    ];

    mlMilestones.forEach((m, idx) => {
      database.prepare(`
        INSERT INTO milestones (project_id, title, target_date, completed, completed_date, display_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(mlId, m.title, getDate(m.date), m.completed, m.completedDate ? getDate(m.completedDate) : null, idx);
    });

    // ML Metrics - showing stalled progress and data quality issues
    const mlMetrics = [
      {
        name: '[Example] Model Accuracy %',
        description: 'Prediction accuracy on validation dataset - showing plateau',
        finalTarget: 95,
        data: [
          { offset: -90, complete: 72 },
          { offset: -75, complete: 78 },
          { offset: -60, complete: 82 },
          { offset: -45, complete: 86 },
          { offset: -30, complete: 89 },
          { offset: -15, complete: 91 },
          { offset: 0, complete: 91.2 } // Stalled - not improving
        ]
      },
      {
        name: '[Example] Training Data Quality Score',
        description: 'Data quality metrics showing degradation due to pipeline issues',
        finalTarget: 95,
        data: [
          { offset: -90, complete: 88 },
          { offset: -75, complete: 91 },
          { offset: -60, complete: 93 },
          { offset: -45, complete: 89 }, // Declining
          { offset: -30, complete: 85 }, // Further decline
          { offset: -15, complete: 82 }, // Adverse trend
          { offset: 0, complete: 79 } // Well below target
        ]
      }
    ];

    mlMetrics.forEach(metric => {
      const metricResult = database.prepare(`
        INSERT INTO metrics (project_id, name, description, owner_id, start_date, end_date, frequency, progression_type, final_target)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        mlId,
        metric.name,
        metric.description,
        userId,
        getDate(-90),
        getDate(90),
        'weekly',
        'logarithmic',
        metric.finalTarget
      );

      const metricId = metricResult.lastInsertRowid;

      metric.data.forEach((period, idx) => {
        const expected = metric.finalTarget * ((90 + period.offset) / 180);
        const commentary = idx === metric.data.length - 1
          ? `<p>Latest: ${metric.name} ${period.complete >= expected ? 'performing well' : 'requires attention'}.</p>`
          : null;
        database.prepare(`
          INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete, commentary)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(metricId, getDate(period.offset), expected, metric.finalTarget, period.complete, commentary);
      });
    });

    // Project 3: User Onboarding Revamp
    const onboardingProject = database.prepare(`
      INSERT INTO projects (name, description, initiative_manager, portfolio_id, start_date, end_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      '[Example] Mobile App User Onboarding',
      'Illustrative UX project redesigning mobile onboarding flow. Demo metrics include completion rates, time-to-value, and user satisfaction scores.',
      'Admin User',
      portfolioId,
      getDate(-45),
      getDate(45),
      getDateTime(-45)
    );
    const onboardingId = onboardingProject.lastInsertRowid;

    // Onboarding Milestones
    const onboardingMilestones = [
      { title: 'User Research & Analysis', date: -40, completed: 1, completedDate: -38 },
      { title: 'Design Mockups', date: -30, completed: 1, completedDate: -28 },
      { title: 'Prototype Development', date: -15, completed: 1, completedDate: -12 },
      { title: 'Usability Testing', date: 0, completed: 0 },
      { title: 'Development Sprint 1', date: 15, completed: 0 },
      { title: 'Development Sprint 2', date: 30, completed: 0 },
      { title: 'Beta Launch', date: 40, completed: 0 }
    ];

    onboardingMilestones.forEach((m, idx) => {
      database.prepare(`
        INSERT INTO milestones (project_id, title, target_date, completed, completed_date, display_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(onboardingId, m.title, getDate(m.date), m.completed, m.completedDate ? getDate(m.completedDate) : null, idx);
    });

    // Onboarding Metric
    const onboardingMetric = database.prepare(`
      INSERT INTO metrics (project_id, name, description, owner_id, start_date, end_date, frequency, progression_type, final_target)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      onboardingId,
      '[Example] Onboarding Completion Rate %',
      'Percentage of users completing the onboarding flow',
      userId,
      getDate(-45),
      getDate(45),
      'weekly',
      'linear',
      85
    );

    const onboardingMetricId = onboardingMetric.lastInsertRowid;
    const onboardingData = [
      { offset: -45, complete: 42 },
      { offset: -30, complete: 48 },
      { offset: -15, complete: 55 },
      { offset: 0, complete: 62 }
    ];

    onboardingData.forEach((period, idx) => {
      const expected = 85 * ((45 + period.offset) / 90);
      const commentary = idx === onboardingData.length - 1
        ? `<p>Onboarding completion ${period.complete >= expected ? 'exceeding' : 'below'} target. ${period.complete >= expected ? 'Excellent adoption rate!' : 'Consider improving user experience.'}</p>`
        : null;
      database.prepare(`
        INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete, commentary)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(onboardingMetricId, getDate(period.offset), expected, 85, period.complete, commentary);
    });

    // Project 4: Jira Migration
    const jiraProject = database.prepare(`
      INSERT INTO projects (name, description, initiative_manager, portfolio_id, start_date, end_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      '[Example] Jira Cloud Migration',
      'Example project tracking migration from Jira Server to Cloud. Demonstrates project tracking, team coordination, and data migration metrics.',
      'Admin User',
      portfolioId,
      getDate(-30),
      getDate(30),
      getDateTime(-30)
    );
    const jiraId = jiraProject.lastInsertRowid;

    // Jira Milestones - with overdue data migration
    const jiraMilestones = [
      { title: 'Migration Planning', date: -25, completed: 1, completedDate: -24 },
      { title: 'Cloud Instance Setup', date: -20, completed: 1, completedDate: -19 },
      { title: 'Plugin Configuration', date: -10, completed: 1, completedDate: -8 },
      { title: 'Data Migration - Phase 1', date: -3, completed: 0 }, // Overdue by 3 days
      { title: 'User Training', date: 15, completed: 0 },
      { title: 'Production Cutover', date: 25, completed: 0 }
    ];

    jiraMilestones.forEach((m, idx) => {
      database.prepare(`
        INSERT INTO milestones (project_id, title, target_date, completed, completed_date, display_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(jiraId, m.title, getDate(m.date), m.completed, m.completedDate ? getDate(m.completedDate) : null, idx);
    });

    // Jira Metric
    const jiraStartDate = getDate(-30);
    const jiraEndDate = getDate(30);
    const jiraMetric = database.prepare(`
      INSERT INTO metrics (project_id, name, description, owner_id, start_date, end_date, frequency, progression_type, final_target)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      jiraId,
      '[Example] Projects Migrated',
      'Number of Jira projects successfully migrated to cloud',
      userId,
      jiraStartDate,
      jiraEndDate,
      'weekly',
      'linear',
      150
    );

    const jiraMetricId = jiraMetric.lastInsertRowid;
    const jiraPeriodDates = generatePeriodDates(jiraStartDate, jiraEndDate, 'weekly');
    const totalPeriods = jiraPeriodDates.length;

    jiraPeriodDates.forEach((periodDate, index) => {
      // Linear progression from 0 to 150
      const progress = index / (totalPeriods - 1); // 0 to 1
      const expected = 150 * progress;
      // Actual complete varies slightly from expected for realism
      const variance = (Math.random() - 0.5) * 20; // +/- 10
      const complete = Math.max(0, Math.min(150, expected + variance));

      const commentary = index === totalPeriods - 1
        ? `<p>Jira migration ${Math.round(complete) >= Math.round(expected) ? 'on track' : 'slightly behind'}. Team training ${Math.round(complete) >= Math.round(expected) ? 'proceeding well' : 'needs focus'}.</p>`
        : null;

      database.prepare(`
        INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete, commentary)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(jiraMetricId, periodDate, Math.round(expected), 150, Math.round(complete), commentary);
    });

    // Project 5: Tech Debt & Obsolescence Tracking
    const techDebtProject = database.prepare(`
      INSERT INTO projects (name, description, initiative_manager, portfolio_id, start_date, end_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      '[Example] Legacy System Modernization',
      'Demo project for tracking technical debt reduction. Shows deprecation schedules, modernization progress, and system health improvements.',
      'Admin User',
      portfolioId,
      getDate(-60),
      getDate(120),
      getDateTime(-60)
    );
    const techDebtId = techDebtProject.lastInsertRowid;

    // Tech Debt Milestones
    const techDebtMilestones = [
      { title: 'Legacy System Audit', date: -55, completed: 1, completedDate: -53 },
      { title: 'Modernization Roadmap', date: -40, completed: 1, completedDate: -38 },
      { title: 'API Layer Development', date: -20, completed: 1, completedDate: -18 },
      { title: 'Database Migration', date: 10, completed: 0 },
      { title: 'Service Decomposition', date: 40, completed: 0 },
      { title: 'Old System Decommission', date: 80, completed: 0 },
      { title: 'Full Cutover', date: 115, completed: 0 }
    ];

    techDebtMilestones.forEach((m, idx) => {
      database.prepare(`
        INSERT INTO milestones (project_id, title, target_date, completed, completed_date, display_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(techDebtId, m.title, getDate(m.date), m.completed, m.completedDate ? getDate(m.completedDate) : null, idx);
    });

    // Tech Debt Metrics
    const techDebtMetrics = [
      {
        name: '[Example] Legacy Components Retired',
        description: 'Number of deprecated components successfully replaced',
        finalTarget: 45,
        data: [
          { offset: -60, complete: 0 },
          { offset: -40, complete: 8 },
          { offset: -20, complete: 18 },
          { offset: 0, complete: 25 }
        ]
      },
      {
        name: '[Example] System Health Score',
        description: 'Composite health score based on performance, security, and maintainability',
        finalTarget: 90,
        data: [
          { offset: -60, complete: 45 },
          { offset: -40, complete: 52 },
          { offset: -20, complete: 61 },
          { offset: 0, complete: 68 }
        ]
      }
    ];

    techDebtMetrics.forEach(metric => {
      const metricResult = database.prepare(`
        INSERT INTO metrics (project_id, name, description, owner_id, start_date, end_date, frequency, progression_type, final_target)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        techDebtId,
        metric.name,
        metric.description,
        userId,
        getDate(-60),
        getDate(120),
        'monthly',
        'linear',
        metric.finalTarget
      );

      const metricId = metricResult.lastInsertRowid;

      metric.data.forEach((period, idx) => {
        const expected = metric.finalTarget * ((60 + period.offset) / 180);
        const commentary = idx === metric.data.length - 1
          ? `<p>${metric.name} status: ${period.complete >= expected ? 'Good progress on tech debt remediation' : 'Tech debt accumulating, action needed'}.</p>`
          : null;
        database.prepare(`
          INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete, commentary)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(metricId, getDate(period.offset), expected, metric.finalTarget, period.complete, commentary);
      });
    });

    // Add CRAIDs, Comments, and Links for projects
    const projects = [
      { id: infraId, name: 'Infrastructure' },
      { id: mlId, name: 'ML Model' },
      { id: onboardingId, name: 'Onboarding' },
      { id: jiraId, name: 'Jira' },
      { id: techDebtId, name: 'Tech Debt' }
    ];

    projects.forEach(project => {
      // Add a risk
      database.prepare(`
        INSERT INTO craids (project_id, type, title, description, status, priority, owner_id, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        project.id,
        'risk',
        `[Example] ${project.name} - Resource Availability`,
        'Example risk: Key team members may have competing priorities during peak period. Mitigation: Cross-training and backup resources identified.',
        'open',
        'medium',
        userId,
        userId,
        getDateTime(-10)
      );

      // Add an action
      database.prepare(`
        INSERT INTO craids (project_id, type, title, description, status, priority, owner_id, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        project.id,
        'action',
        `[Example] ${project.name} - Weekly Status Updates`,
        'Example action: Ensure stakeholder communications are sent every Friday. Includes metrics, blockers, and next steps.',
        'in_progress',
        'high',
        userId,
        userId,
        getDateTime(-5)
      );

      // Add project comments
      database.prepare(`
        INSERT INTO project_comments (project_id, comment_text, created_by, created_at, creator_name)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        project.id,
        `<p><strong>Latest Update:</strong> ${project.name} project is progressing well. Team collaboration has been excellent and stakeholders are engaged.</p><p>Key achievements this period include successful milestone completion and positive feedback from early users.</p>`,
        userId,
        getDateTime(-2),
        'Admin User'
      );

      database.prepare(`
        INSERT INTO project_comments (project_id, comment_text, created_by, created_at, creator_name)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        project.id,
        `<p>Previous update: Initial planning phase completed. Resources allocated and timeline confirmed with all stakeholders.</p>`,
        userId,
        getDateTime(-14),
        'Admin User'
      );

      // Add project links
      database.prepare(`
        INSERT INTO project_links (project_id, label, url, display_order)
        VALUES (?, ?, ?, ?)
      `).run(project.id, 'Example Jira Board', 'https://example.atlassian.net/board/123', 0);

      database.prepare(`
        INSERT INTO project_links (project_id, label, url, display_order)
        VALUES (?, ?, ?, ?)
      `).run(project.id, 'Example Confluence', 'https://example.atlassian.net/wiki/spaces/PROJ', 1);
    });

    // Add feedback entries
    database.prepare(`
      INSERT INTO feedback (user_id, project_id, feedback_text, sentiment, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      userId,
      infraId,
      '[Example Feedback] Infrastructure rollout is proceeding well. Phase 2 completion ahead of schedule demonstrates strong team execution.',
      'positive',
      getDateTime(-7)
    );

    database.prepare(`
      INSERT INTO feedback (user_id, project_id, feedback_text, sentiment, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      userId,
      mlId,
      '[Example Feedback] A/B test deployment is delayed due to infrastructure dependencies. Recommend priority escalation.',
      'concern',
      getDateTime(-2)
    );

    console.log('✅ Created 5 illustrative example projects');
    console.log('✅ Added 37 milestones (completed, upcoming, and overdue)');
    console.log('✅ Populated 9 metrics with historical data (including adverse trends)');
    console.log('✅ Added CRAIDs, links, and feedback examples');
    console.log('📊 Adverse metrics: Network Uptime declining, Migration Issues behind, Data Quality degrading');
    console.log('⚠️  Overdue milestones: 4 overdue across ML and Jira projects');
    console.log('\n📚 Illustrative Examples Portfolio ready for demonstration!');
    console.log('ℹ️  All data is clearly marked with [Example] or [Demo] prefixes\n');

  } catch (error) {
    console.error('❌ Error seeding illustrative examples:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedIllustrativeExamples()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedIllustrativeExamples };
