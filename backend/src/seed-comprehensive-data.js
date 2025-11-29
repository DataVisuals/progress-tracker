#!/usr/bin/env node

/**
 * Comprehensive Test Data Script
 *
 * Creates extensive test data with:
 * - 15+ projects across multiple portfolios
 * - 6-10 metrics per project
 * - Long-running projects (18-24 month timelines)
 * - Scope expansion mid-project
 * - Realistic progression curves with variance
 * - Various RAG statuses
 */

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const { promisify } = require('util');
const path = require('path');

const scrypt = promisify(crypto.scrypt);

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

// Portfolio definitions
const PORTFOLIOS = [
  { name: 'Digital Transformation', color: '#0066cc' },
  { name: 'Customer Experience', color: '#00a86b' },
  { name: 'Infrastructure', color: '#9b59b6' },
  { name: 'Data & Analytics', color: '#e67e22' },
  { name: 'Security & Compliance', color: '#e74c3c' }
];

// Project templates with realistic names and descriptions
const PROJECT_TEMPLATES = [
  {
    portfolio: 'Digital Transformation',
    name: 'Enterprise Mobile Platform',
    description: 'Development of a unified mobile platform for employees, enabling secure access to corporate systems, expense management, and collaboration tools.',
    manager: 'Sarah Chen',
    durationMonths: 18
  },
  {
    portfolio: 'Digital Transformation',
    name: 'Legacy System Modernization',
    description: 'Phased migration of core business systems from mainframe to cloud-native microservices architecture.',
    manager: 'Michael Torres',
    durationMonths: 24
  },
  {
    portfolio: 'Digital Transformation',
    name: 'API Gateway Implementation',
    description: 'Deployment of enterprise API gateway for secure, scalable integration between internal and external systems.',
    manager: 'David Kim',
    durationMonths: 12
  },
  {
    portfolio: 'Customer Experience',
    name: 'Omnichannel Contact Center',
    description: 'Implementation of unified contact center solution with AI-powered routing, sentiment analysis, and real-time agent assistance.',
    manager: 'Jennifer Martinez',
    durationMonths: 15
  },
  {
    portfolio: 'Customer Experience',
    name: 'Customer 360 Platform',
    description: 'Creation of unified customer data platform consolidating interactions across all touchpoints for personalized experiences.',
    manager: 'Robert Johnson',
    durationMonths: 18
  },
  {
    portfolio: 'Customer Experience',
    name: 'Self-Service Portal Redesign',
    description: 'Complete overhaul of customer self-service capabilities with modern UX, chatbot integration, and mobile-first design.',
    manager: 'Amanda Foster',
    durationMonths: 12
  },
  {
    portfolio: 'Infrastructure',
    name: 'Hybrid Cloud Migration',
    description: 'Strategic migration of workloads to hybrid cloud environment with automated scaling and disaster recovery.',
    manager: 'James Liu',
    durationMonths: 20
  },
  {
    portfolio: 'Infrastructure',
    name: 'Network Modernization',
    description: 'Upgrade of global network infrastructure including SD-WAN deployment and 10G backbone implementation.',
    manager: 'Kevin Park',
    durationMonths: 16
  },
  {
    portfolio: 'Infrastructure',
    name: 'DevOps Platform',
    description: 'Implementation of enterprise DevOps platform with CI/CD pipelines, container orchestration, and infrastructure as code.',
    manager: 'Rachel Green',
    durationMonths: 12
  },
  {
    portfolio: 'Data & Analytics',
    name: 'Real-Time Analytics Engine',
    description: 'Development of streaming analytics platform for real-time business insights and automated decision-making.',
    manager: 'Dr. Priya Sharma',
    durationMonths: 14
  },
  {
    portfolio: 'Data & Analytics',
    name: 'ML Operations Platform',
    description: 'Creation of MLOps infrastructure for model training, deployment, monitoring, and automated retraining.',
    manager: 'Dr. Alex Wong',
    durationMonths: 18
  },
  {
    portfolio: 'Data & Analytics',
    name: 'Data Governance Framework',
    description: 'Implementation of comprehensive data governance including data catalog, lineage tracking, and quality monitoring.',
    manager: 'Maria Rodriguez',
    durationMonths: 15
  },
  {
    portfolio: 'Security & Compliance',
    name: 'Zero Trust Architecture',
    description: 'Implementation of zero trust security model with identity-centric access controls and micro-segmentation.',
    manager: 'Tom Bradley',
    durationMonths: 18
  },
  {
    portfolio: 'Security & Compliance',
    name: 'GDPR Compliance Program',
    description: 'Comprehensive data privacy compliance initiative covering consent management, data subject rights, and breach response.',
    manager: 'Elena Vasquez',
    durationMonths: 12
  },
  {
    portfolio: 'Security & Compliance',
    name: 'SOC Modernization',
    description: 'Upgrade of Security Operations Center with SOAR platform, threat intelligence integration, and automated response.',
    manager: 'Chris Anderson',
    durationMonths: 14
  }
];

// Metric templates per project type
const METRIC_TEMPLATES = {
  'Enterprise Mobile Platform': [
    { name: 'Active Users', type: 'lag', target: 50000, curve: 's-curve', frequency: 'monthly' },
    { name: 'App Downloads', type: 'lead', target: 75000, curve: 'exponential', frequency: 'monthly' },
    { name: 'Features Delivered', type: 'lead', target: 48, curve: 'linear', frequency: 'monthly' },
    { name: 'User Satisfaction Score', type: 'lag', target: 4.5, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Bug Resolution Rate (%)', type: 'lead', target: 95, curve: 'logarithmic', frequency: 'weekly' },
    { name: 'API Response Time (ms)', type: 'lead', target: 200, curve: 'logarithmic', frequency: 'weekly' },
    { name: 'Security Vulnerabilities Fixed', type: 'lead', target: 120, curve: 'linear', frequency: 'monthly' },
    { name: 'Integration Partners', type: 'lead', target: 15, curve: 's-curve', frequency: 'monthly' }
  ],
  'Legacy System Modernization': [
    { name: 'Modules Migrated', type: 'lead', target: 45, curve: 's-curve', frequency: 'monthly' },
    { name: 'Lines of Code Converted (K)', type: 'lead', target: 2500, curve: 'linear', frequency: 'monthly' },
    { name: 'Test Coverage (%)', type: 'lead', target: 90, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Legacy Dependencies Removed', type: 'lead', target: 200, curve: 'linear', frequency: 'monthly' },
    { name: 'Performance Improvement (%)', type: 'lag', target: 40, curve: 's-curve', frequency: 'quarterly' },
    { name: 'Infrastructure Cost Reduction ($K)', type: 'lag', target: 500, curve: 'exponential', frequency: 'quarterly' },
    { name: 'User Adoption Rate (%)', type: 'lag', target: 95, curve: 's-curve', frequency: 'monthly' },
    { name: 'Incident Reduction (%)', type: 'lag', target: 60, curve: 'logarithmic', frequency: 'monthly' }
  ],
  'API Gateway Implementation': [
    { name: 'APIs Onboarded', type: 'lead', target: 150, curve: 's-curve', frequency: 'monthly' },
    { name: 'API Calls (M/day)', type: 'lag', target: 50, curve: 'exponential', frequency: 'weekly' },
    { name: 'Latency P99 (ms)', type: 'lead', target: 50, curve: 'logarithmic', frequency: 'weekly' },
    { name: 'Partner Integrations', type: 'lead', target: 25, curve: 'linear', frequency: 'monthly' },
    { name: 'Developer Adoption', type: 'lag', target: 200, curve: 's-curve', frequency: 'monthly' },
    { name: 'Error Rate (%)', type: 'lead', target: 0.1, curve: 'logarithmic', frequency: 'weekly' }
  ],
  'Omnichannel Contact Center': [
    { name: 'Channels Integrated', type: 'lead', target: 8, curve: 'linear', frequency: 'monthly' },
    { name: 'Agent Productivity Gain (%)', type: 'lag', target: 35, curve: 's-curve', frequency: 'monthly' },
    { name: 'First Contact Resolution (%)', type: 'lag', target: 85, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Average Handle Time Reduction (%)', type: 'lag', target: 25, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'AI Deflection Rate (%)', type: 'lag', target: 40, curve: 's-curve', frequency: 'monthly' },
    { name: 'Customer Satisfaction', type: 'lag', target: 4.6, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Agents Trained', type: 'lead', target: 500, curve: 'linear', frequency: 'monthly' }
  ],
  'Customer 360 Platform': [
    { name: 'Data Sources Integrated', type: 'lead', target: 35, curve: 's-curve', frequency: 'monthly' },
    { name: 'Customer Profiles Created (M)', type: 'lead', target: 10, curve: 'exponential', frequency: 'monthly' },
    { name: 'Data Quality Score (%)', type: 'lead', target: 95, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Personalization Campaigns', type: 'lag', target: 100, curve: 'exponential', frequency: 'monthly' },
    { name: 'Revenue Attribution ($M)', type: 'lag', target: 25, curve: 'exponential', frequency: 'quarterly' },
    { name: 'Marketing ROI Improvement (%)', type: 'lag', target: 40, curve: 's-curve', frequency: 'quarterly' },
    { name: 'Business Users Enabled', type: 'lead', target: 200, curve: 'linear', frequency: 'monthly' }
  ],
  'Self-Service Portal Redesign': [
    { name: 'Pages Redesigned', type: 'lead', target: 75, curve: 'linear', frequency: 'monthly' },
    { name: 'Self-Service Completion Rate (%)', type: 'lag', target: 80, curve: 's-curve', frequency: 'monthly' },
    { name: 'Support Ticket Reduction (%)', type: 'lag', target: 45, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Mobile Usage (%)', type: 'lag', target: 60, curve: 'exponential', frequency: 'monthly' },
    { name: 'Task Completion Time (min)', type: 'lag', target: 3, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'NPS Score', type: 'lag', target: 65, curve: 'logarithmic', frequency: 'monthly' }
  ],
  'Hybrid Cloud Migration': [
    { name: 'Workloads Migrated', type: 'lead', target: 200, curve: 's-curve', frequency: 'monthly' },
    { name: 'Data Migrated (TB)', type: 'lead', target: 500, curve: 'linear', frequency: 'monthly' },
    { name: 'Cost Savings ($M)', type: 'lag', target: 15, curve: 'exponential', frequency: 'quarterly' },
    { name: 'Availability SLA (%)', type: 'lead', target: 99.95, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Deployment Frequency (per day)', type: 'lag', target: 50, curve: 'exponential', frequency: 'monthly' },
    { name: 'Recovery Time (hours)', type: 'lead', target: 1, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Cloud-Native Services Adopted', type: 'lead', target: 40, curve: 's-curve', frequency: 'monthly' },
    { name: 'Carbon Footprint Reduction (%)', type: 'lag', target: 30, curve: 's-curve', frequency: 'quarterly' }
  ],
  'Network Modernization': [
    { name: 'Sites Upgraded', type: 'lead', target: 150, curve: 'linear', frequency: 'monthly' },
    { name: 'Bandwidth Capacity (Gbps)', type: 'lead', target: 100, curve: 's-curve', frequency: 'monthly' },
    { name: 'Network Latency Reduction (%)', type: 'lag', target: 50, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'SD-WAN Coverage (%)', type: 'lead', target: 95, curve: 's-curve', frequency: 'monthly' },
    { name: 'Outage Reduction (%)', type: 'lag', target: 70, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Operating Cost Reduction ($K)', type: 'lag', target: 800, curve: 'exponential', frequency: 'quarterly' }
  ],
  'DevOps Platform': [
    { name: 'Pipelines Created', type: 'lead', target: 500, curve: 's-curve', frequency: 'monthly' },
    { name: 'Deployment Frequency', type: 'lag', target: 100, curve: 'exponential', frequency: 'monthly' },
    { name: 'Lead Time (hours)', type: 'lag', target: 2, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Change Failure Rate (%)', type: 'lag', target: 5, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Team Onboarded', type: 'lead', target: 50, curve: 'linear', frequency: 'monthly' },
    { name: 'Automation Coverage (%)', type: 'lead', target: 90, curve: 'logarithmic', frequency: 'monthly' }
  ],
  'Real-Time Analytics Engine': [
    { name: 'Data Streams Connected', type: 'lead', target: 100, curve: 's-curve', frequency: 'monthly' },
    { name: 'Events Processed (M/hour)', type: 'lead', target: 50, curve: 'exponential', frequency: 'monthly' },
    { name: 'Dashboard Users', type: 'lag', target: 500, curve: 's-curve', frequency: 'monthly' },
    { name: 'Latency P95 (ms)', type: 'lead', target: 100, curve: 'logarithmic', frequency: 'weekly' },
    { name: 'Business Insights Generated', type: 'lag', target: 200, curve: 'exponential', frequency: 'monthly' },
    { name: 'Decision Automation Rate (%)', type: 'lag', target: 30, curve: 's-curve', frequency: 'monthly' },
    { name: 'Cost per Event ($)', type: 'lead', target: 0.001, curve: 'logarithmic', frequency: 'monthly' }
  ],
  'ML Operations Platform': [
    { name: 'Models in Production', type: 'lead', target: 100, curve: 's-curve', frequency: 'monthly' },
    { name: 'Experiments Run', type: 'lead', target: 5000, curve: 'exponential', frequency: 'monthly' },
    { name: 'Model Accuracy Improvement (%)', type: 'lag', target: 25, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Time to Deploy (days)', type: 'lag', target: 1, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Data Scientists Enabled', type: 'lead', target: 75, curve: 'linear', frequency: 'monthly' },
    { name: 'Compute Cost Optimization (%)', type: 'lag', target: 40, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Model Drift Alerts', type: 'lead', target: 50, curve: 's-curve', frequency: 'monthly' },
    { name: 'Feature Store Features', type: 'lead', target: 500, curve: 'exponential', frequency: 'monthly' }
  ],
  'Data Governance Framework': [
    { name: 'Data Assets Cataloged', type: 'lead', target: 10000, curve: 's-curve', frequency: 'monthly' },
    { name: 'Lineage Coverage (%)', type: 'lead', target: 90, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Data Quality Score (%)', type: 'lag', target: 95, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Policy Violations Resolved', type: 'lead', target: 500, curve: 'linear', frequency: 'monthly' },
    { name: 'Stewards Assigned', type: 'lead', target: 100, curve: 'linear', frequency: 'monthly' },
    { name: 'Compliance Score (%)', type: 'lag', target: 98, curve: 'logarithmic', frequency: 'monthly' }
  ],
  'Zero Trust Architecture': [
    { name: 'Applications Protected', type: 'lead', target: 300, curve: 's-curve', frequency: 'monthly' },
    { name: 'Users Enrolled', type: 'lead', target: 25000, curve: 's-curve', frequency: 'monthly' },
    { name: 'MFA Coverage (%)', type: 'lead', target: 100, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Risk Score Reduction (%)', type: 'lag', target: 60, curve: 's-curve', frequency: 'monthly' },
    { name: 'Incident Response Time (min)', type: 'lag', target: 15, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Micro-Segments Created', type: 'lead', target: 500, curve: 'linear', frequency: 'monthly' },
    { name: 'Policy Exceptions Reduced', type: 'lead', target: 200, curve: 'linear', frequency: 'monthly' }
  ],
  'GDPR Compliance Program': [
    { name: 'Data Inventories Completed', type: 'lead', target: 50, curve: 'linear', frequency: 'monthly' },
    { name: 'Consent Records (M)', type: 'lead', target: 5, curve: 's-curve', frequency: 'monthly' },
    { name: 'DSR Response Time (days)', type: 'lag', target: 15, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Privacy Impact Assessments', type: 'lead', target: 100, curve: 'linear', frequency: 'monthly' },
    { name: 'Staff Training Completion (%)', type: 'lead', target: 100, curve: 's-curve', frequency: 'monthly' },
    { name: 'Audit Findings Resolved', type: 'lead', target: 75, curve: 'linear', frequency: 'monthly' }
  ],
  'SOC Modernization': [
    { name: 'Detection Rules Deployed', type: 'lead', target: 500, curve: 's-curve', frequency: 'monthly' },
    { name: 'Mean Time to Detect (min)', type: 'lag', target: 5, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Automated Responses (%)', type: 'lead', target: 70, curve: 's-curve', frequency: 'monthly' },
    { name: 'Threat Intelligence Feeds', type: 'lead', target: 50, curve: 'linear', frequency: 'monthly' },
    { name: 'False Positive Reduction (%)', type: 'lag', target: 60, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Analyst Efficiency Gain (%)', type: 'lag', target: 50, curve: 's-curve', frequency: 'monthly' },
    { name: 'Coverage Score (%)', type: 'lead', target: 95, curve: 'logarithmic', frequency: 'monthly' }
  ]
};

// Calculate expected value based on curve type
function calculateExpected(curve, finalTarget, periodIndex, totalPeriods) {
  const ratio = periodIndex / totalPeriods;
  switch(curve) {
    case 'linear': return Math.round(finalTarget * ratio * 100) / 100;
    case 's-curve': return Math.round(finalTarget / (1 + Math.exp(-10 * (ratio - 0.5))) * 100) / 100;
    case 'exponential': return Math.round(finalTarget * (Math.exp(3 * ratio) - 1) / (Math.exp(3) - 1) * 100) / 100;
    case 'logarithmic': return Math.round(finalTarget * Math.sqrt(ratio) * 100) / 100;
    default: return Math.round(finalTarget * ratio * 100) / 100;
  }
}

// Generate realistic completion value with variance
function generateComplete(expected, ragStatus, variance = 0.15) {
  const multiplier = ragStatus === 'green' ? 1 + Math.random() * variance
    : ragStatus === 'amber' ? 0.85 + Math.random() * 0.1
    : 0.7 + Math.random() * 0.1;
  return Math.round(expected * multiplier * 100) / 100;
}

// Generate periods for a metric with scope expansion
async function generateMetricPeriods(metricId, startDate, endDate, frequency, curve, finalTarget, performance, scopeExpansion = null) {
  const periods = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let current = new Date(start);

  // Generate period dates
  while (current <= end) {
    periods.push({ date: new Date(current) });
    if (frequency === 'weekly') current.setDate(current.getDate() + 7);
    else if (frequency === 'monthly') current.setMonth(current.getMonth() + 1);
    else if (frequency === 'quarterly') current.setMonth(current.getMonth() + 3);
  }

  const totalPeriods = periods.length;
  const now = new Date();

  // Scope expansion: increase target mid-project
  let currentTarget = finalTarget;
  const scopeExpandPeriod = scopeExpansion ? Math.floor(totalPeriods * 0.4) : -1;

  for (let i = 0; i < periods.length; i++) {
    const periodDate = periods[i].date;

    // Apply scope expansion
    if (scopeExpansion && i >= scopeExpandPeriod) {
      currentTarget = Math.round(finalTarget * scopeExpansion);
    }

    const expected = calculateExpected(curve, currentTarget, i + 1, totalPeriods);

    // Only fill in complete values for past periods
    let complete = null;
    let commentary = null;

    if (periodDate < now) {
      // Determine RAG status based on performance pattern
      let ragStatus = 'green';
      if (performance === 'struggling') {
        ragStatus = Math.random() < 0.6 ? 'amber' : (Math.random() < 0.3 ? 'red' : 'green');
      } else if (performance === 'recovering') {
        ragStatus = i < totalPeriods / 2 ? (Math.random() < 0.5 ? 'amber' : 'red') : 'green';
      } else if (performance === 'declining') {
        ragStatus = i > totalPeriods / 2 ? (Math.random() < 0.5 ? 'amber' : 'red') : 'green';
      }

      complete = generateComplete(expected, ragStatus);

      // Add commentary for amber/red periods
      if (ragStatus === 'red') {
        commentary = 'Behind schedule. Recovery plan in progress.';
      } else if (ragStatus === 'amber') {
        commentary = 'Minor delays. Mitigation actions underway.';
      } else if (i > 0 && Math.random() < 0.2) {
        commentary = 'Strong progress this period.';
      }
    }

    await dbRun(
      `INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete, commentary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [metricId, periodDate.toISOString().split('T')[0], expected, currentTarget, complete, commentary]
    );
  }
}

async function seedComprehensiveData() {
  console.log('🌱 Starting comprehensive data seed...\n');

  try {
    // Get admin user
    const admin = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@example.com']);
    if (!admin) {
      console.error('❌ Admin user not found. Run the server first.');
      return;
    }

    // Ensure portfolios exist
    console.log('📁 Creating portfolios...');
    const portfolioIds = {};
    for (const p of PORTFOLIOS) {
      let existing = await dbGet('SELECT id FROM portfolios WHERE name = ?', [p.name]);
      if (!existing) {
        const result = await dbRun('INSERT INTO portfolios (name, color) VALUES (?, ?)', [p.name, p.color]);
        portfolioIds[p.name] = result.lastID;
      } else {
        portfolioIds[p.name] = existing.id;
      }
    }
    console.log(`✅ ${PORTFOLIOS.length} portfolios ready\n`);

    // Create projects
    console.log('📊 Creating projects and metrics...');

    for (const template of PROJECT_TEMPLATES) {
      const portfolioId = portfolioIds[template.portfolio];

      // Calculate dates - projects start at different times over the past 18 months
      const monthsAgo = Math.floor(Math.random() * 12) + 6; // 6-18 months ago
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsAgo);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + template.durationMonths);

      // Create project
      const projectResult = await dbRun(
        `INSERT INTO projects (name, description, initiative_manager, portfolio_id, start_date, end_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          template.name,
          template.description,
          template.manager,
          portfolioId,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0],
          startDate.toISOString()
        ]
      );
      const projectId = projectResult.lastID;

      // Add project links
      await dbRun('INSERT INTO project_links (project_id, label, url) VALUES (?, ?, ?)',
        [projectId, 'Confluence', `https://confluence.company.com/${template.name.toLowerCase().replace(/ /g, '-')}`]);
      await dbRun('INSERT INTO project_links (project_id, label, url) VALUES (?, ?, ?)',
        [projectId, 'Jira', `https://jira.company.com/projects/${template.name.substring(0, 3).toUpperCase()}`]);

      // Get metrics for this project
      const metrics = METRIC_TEMPLATES[template.name] || [];

      // Determine project performance pattern
      const patterns = ['good', 'good', 'good', 'struggling', 'recovering', 'declining'];
      const performance = patterns[Math.floor(Math.random() * patterns.length)];

      // Create metrics
      for (const metric of metrics) {
        // Some metrics may have scope expansion
        const hasExpansion = Math.random() < 0.2; // 20% chance
        const expansionFactor = hasExpansion ? 1.3 + Math.random() * 0.4 : null; // 30-70% increase

        const metricResult = await dbRun(
          `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            metric.name,
            admin.id,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0],
            metric.frequency,
            metric.curve,
            hasExpansion ? Math.round(metric.target * expansionFactor) : metric.target,
            10,
            20,
            metric.type
          ]
        );

        await generateMetricPeriods(
          metricResult.lastID,
          startDate,
          endDate,
          metric.frequency,
          metric.curve,
          metric.target,
          performance,
          expansionFactor
        );
      }

      // Add CRAIDs
      if (Math.random() < 0.7) {
        await dbRun('INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)',
          [projectId, 'risk', 'Resource Availability', 'Key team members may be pulled to other priorities', 'open', 'medium']);
      }
      if (Math.random() < 0.5) {
        await dbRun('INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)',
          [projectId, 'dependency', 'Third-party Integration', 'Dependent on vendor timeline for API availability', 'in_progress', 'high']);
      }
      if (Math.random() < 0.3) {
        await dbRun('INSERT INTO craids (project_id, type, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?)',
          [projectId, 'issue', 'Technical Debt', 'Legacy code complexity impacting delivery speed', 'in_progress', 'medium']);
      }

      console.log(`   ✅ ${template.name}: ${metrics.length} metrics`);
    }

    console.log('\n🎉 Comprehensive data seed complete!');
    console.log(`   • ${PROJECT_TEMPLATES.length} projects created`);
    console.log(`   • Multiple metrics per project (6-10 each)`);
    console.log(`   • Long timelines (12-24 months)`);
    console.log(`   • Varied progression curves`);
    console.log(`   • Scope expansion scenarios included`);
    console.log(`   • Realistic RAG statuses distributed`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    db.close();
  }
}

if (require.main === module) {
  seedComprehensiveData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedComprehensiveData };
