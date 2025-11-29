#!/usr/bin/env node

/**
 * Strong Test Data Seed Script
 *
 * Creates extensive, realistic test data including:
 * - 15 projects across 5 portfolios
 * - 6-10 metrics per project with varying timelines
 * - Realistic progression curves with variance
 * - Target changes mid-project
 * - Rich audit log history
 * - Page views and user activity
 * - CRAIDs with lifecycle
 * - Historical comments
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
  { name: 'Digital Transformation', color: '#0066cc', description: 'Technology modernization and digital initiatives' },
  { name: 'Customer Experience', color: '#00a86b', description: 'Customer-facing products and services' },
  { name: 'Infrastructure', color: '#9b59b6', description: 'Core infrastructure and platform services' },
  { name: 'Data & Analytics', color: '#e67e22', description: 'Data platforms and analytics capabilities' },
  { name: 'Security & Compliance', color: '#e74c3c', description: 'Security programs and regulatory compliance' }
];

// Project templates
const PROJECT_TEMPLATES = [
  // Digital Transformation
  {
    portfolio: 'Digital Transformation',
    name: 'Enterprise Mobile Platform',
    description: 'Development of unified mobile platform for employees with secure access to corporate systems, expense management, and collaboration tools.',
    manager: 'Sarah Chen',
    secondaryPM: 'Mike Torres',
    startMonthsAgo: 14,
    durationMonths: 18,
    performance: 'good'
  },
  {
    portfolio: 'Digital Transformation',
    name: 'Legacy System Modernization',
    description: 'Phased migration of core business systems from mainframe to cloud-native microservices architecture with zero downtime.',
    manager: 'Michael Torres',
    secondaryPM: null,
    startMonthsAgo: 18,
    durationMonths: 24,
    performance: 'recovering'
  },
  {
    portfolio: 'Digital Transformation',
    name: 'API Gateway Platform',
    description: 'Enterprise API gateway deployment for secure, scalable integration between internal systems and external partners.',
    manager: 'David Kim',
    secondaryPM: 'Jennifer Lee',
    startMonthsAgo: 8,
    durationMonths: 12,
    performance: 'good'
  },
  // Customer Experience
  {
    portfolio: 'Customer Experience',
    name: 'Omnichannel Contact Center',
    description: 'Implementation of unified contact center with AI-powered routing, sentiment analysis, and real-time agent assistance across voice, chat, email, and social.',
    manager: 'Jennifer Martinez',
    secondaryPM: null,
    startMonthsAgo: 10,
    durationMonths: 15,
    performance: 'struggling'
  },
  {
    portfolio: 'Customer Experience',
    name: 'Customer 360 Platform',
    description: 'Unified customer data platform consolidating interactions across all touchpoints for personalized experiences and predictive insights.',
    manager: 'Robert Johnson',
    secondaryPM: 'Amanda Foster',
    startMonthsAgo: 12,
    durationMonths: 18,
    performance: 'good'
  },
  {
    portfolio: 'Customer Experience',
    name: 'Self-Service Portal Redesign',
    description: 'Complete overhaul of customer self-service portal with modern UX, AI chatbot integration, and mobile-first responsive design.',
    manager: 'Amanda Foster',
    secondaryPM: null,
    startMonthsAgo: 6,
    durationMonths: 12,
    performance: 'good'
  },
  // Infrastructure
  {
    portfolio: 'Infrastructure',
    name: 'Hybrid Cloud Migration',
    description: 'Strategic migration of workloads to hybrid cloud environment with automated scaling, disaster recovery, and cost optimization.',
    manager: 'James Liu',
    secondaryPM: 'Kevin Park',
    startMonthsAgo: 15,
    durationMonths: 20,
    performance: 'declining'
  },
  {
    portfolio: 'Infrastructure',
    name: 'Network Modernization Program',
    description: 'Global network infrastructure upgrade including SD-WAN deployment, 10G backbone implementation, and edge computing rollout.',
    manager: 'Kevin Park',
    secondaryPM: null,
    startMonthsAgo: 11,
    durationMonths: 16,
    performance: 'good'
  },
  {
    portfolio: 'Infrastructure',
    name: 'DevOps Platform Implementation',
    description: 'Enterprise DevOps platform with CI/CD pipelines, container orchestration, infrastructure as code, and automated testing.',
    manager: 'Rachel Green',
    secondaryPM: 'Tom Bradley',
    startMonthsAgo: 7,
    durationMonths: 12,
    performance: 'good'
  },
  // Data & Analytics
  {
    portfolio: 'Data & Analytics',
    name: 'Real-Time Analytics Engine',
    description: 'Streaming analytics platform for real-time business insights, automated decision-making, and predictive alerts.',
    manager: 'Dr. Priya Sharma',
    secondaryPM: null,
    startMonthsAgo: 9,
    durationMonths: 14,
    performance: 'good'
  },
  {
    portfolio: 'Data & Analytics',
    name: 'ML Operations Platform',
    description: 'MLOps infrastructure for model training, deployment, monitoring, automated retraining, and feature store management.',
    manager: 'Dr. Alex Wong',
    secondaryPM: 'Dr. Priya Sharma',
    startMonthsAgo: 13,
    durationMonths: 18,
    performance: 'good'
  },
  {
    portfolio: 'Data & Analytics',
    name: 'Data Governance Framework',
    description: 'Comprehensive data governance including data catalog, lineage tracking, quality monitoring, and policy enforcement.',
    manager: 'Maria Rodriguez',
    secondaryPM: null,
    startMonthsAgo: 10,
    durationMonths: 15,
    performance: 'recovering'
  },
  // Security & Compliance
  {
    portfolio: 'Security & Compliance',
    name: 'Zero Trust Architecture',
    description: 'Implementation of zero trust security model with identity-centric access controls, micro-segmentation, and continuous verification.',
    manager: 'Tom Bradley',
    secondaryPM: 'Chris Anderson',
    startMonthsAgo: 12,
    durationMonths: 18,
    performance: 'good'
  },
  {
    portfolio: 'Security & Compliance',
    name: 'GDPR Compliance Program',
    description: 'Data privacy compliance initiative covering consent management, data subject rights, breach response, and privacy by design.',
    manager: 'Elena Vasquez',
    secondaryPM: null,
    startMonthsAgo: 8,
    durationMonths: 12,
    performance: 'good'
  },
  {
    portfolio: 'Security & Compliance',
    name: 'SOC Modernization',
    description: 'Security Operations Center upgrade with SOAR platform, threat intelligence integration, and automated incident response.',
    manager: 'Chris Anderson',
    secondaryPM: 'Tom Bradley',
    startMonthsAgo: 9,
    durationMonths: 14,
    performance: 'struggling'
  }
];

// Metric templates per project
const METRIC_TEMPLATES = {
  'Enterprise Mobile Platform': [
    { name: 'Active Users', type: 'lag', target: 50000, curve: 's-curve', frequency: 'monthly' },
    { name: 'App Downloads', type: 'lead', target: 75000, curve: 'exponential', frequency: 'monthly' },
    { name: 'Features Delivered', type: 'lead', target: 48, curve: 'linear', frequency: 'monthly' },
    { name: 'User Satisfaction (NPS)', type: 'lag', target: 65, curve: 'logarithmic', frequency: 'monthly' },
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
    { name: 'Infrastructure Cost Savings ($K)', type: 'lag', target: 500, curve: 'exponential', frequency: 'quarterly' },
    { name: 'User Adoption Rate (%)', type: 'lag', target: 95, curve: 's-curve', frequency: 'monthly' },
    { name: 'Incident Reduction (%)', type: 'lag', target: 60, curve: 'logarithmic', frequency: 'monthly' }
  ],
  'API Gateway Platform': [
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
    { name: 'CSAT Score', type: 'lag', target: 4.6, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Agents Trained', type: 'lead', target: 500, curve: 'linear', frequency: 'monthly' }
  ],
  'Customer 360 Platform': [
    { name: 'Data Sources Integrated', type: 'lead', target: 35, curve: 's-curve', frequency: 'monthly' },
    { name: 'Customer Profiles (M)', type: 'lead', target: 10, curve: 'exponential', frequency: 'monthly' },
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
  'Network Modernization Program': [
    { name: 'Sites Upgraded', type: 'lead', target: 150, curve: 'linear', frequency: 'monthly' },
    { name: 'Bandwidth Capacity (Gbps)', type: 'lead', target: 100, curve: 's-curve', frequency: 'monthly' },
    { name: 'Network Latency Reduction (%)', type: 'lag', target: 50, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'SD-WAN Coverage (%)', type: 'lead', target: 95, curve: 's-curve', frequency: 'monthly' },
    { name: 'Outage Reduction (%)', type: 'lag', target: 70, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Operating Cost Reduction ($K)', type: 'lag', target: 800, curve: 'exponential', frequency: 'quarterly' }
  ],
  'DevOps Platform Implementation': [
    { name: 'Pipelines Created', type: 'lead', target: 500, curve: 's-curve', frequency: 'monthly' },
    { name: 'Deployments Per Day', type: 'lag', target: 100, curve: 'exponential', frequency: 'monthly' },
    { name: 'Lead Time (hours)', type: 'lag', target: 2, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Change Failure Rate (%)', type: 'lag', target: 5, curve: 'logarithmic', frequency: 'monthly' },
    { name: 'Teams Onboarded', type: 'lead', target: 50, curve: 'linear', frequency: 'monthly' },
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
    { name: 'Data Stewards Assigned', type: 'lead', target: 100, curve: 'linear', frequency: 'monthly' },
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

// CRAID templates
const CRAID_TEMPLATES = [
  { type: 'challenge', title: 'Resource Availability', description: 'Key team members may be pulled to other priorities', priority: 'medium' },
  { type: 'challenge', title: 'Technical Complexity', description: 'Integration with legacy systems more complex than anticipated', priority: 'high' },
  { type: 'challenge', title: 'Vendor Coordination', description: 'Multiple vendor dependencies requiring careful coordination', priority: 'medium' },
  { type: 'risk', title: 'Budget Overrun', description: 'Potential for scope creep leading to budget pressure', priority: 'medium' },
  { type: 'risk', title: 'Timeline Slippage', description: 'Dependencies may cause delivery delays', priority: 'high' },
  { type: 'risk', title: 'Security Vulnerabilities', description: 'New attack vectors may emerge during implementation', priority: 'high' },
  { type: 'assumption', title: 'API Stability', description: 'Third-party APIs will remain stable during integration', priority: 'medium' },
  { type: 'assumption', title: 'User Adoption', description: 'End users will adopt new system with minimal training', priority: 'low' },
  { type: 'issue', title: 'Performance Degradation', description: 'Observed slowdowns in test environment under load', priority: 'high' },
  { type: 'issue', title: 'Data Quality', description: 'Source data inconsistencies requiring manual cleanup', priority: 'medium' },
  { type: 'dependency', title: 'Infrastructure Readiness', description: 'Dependent on cloud infrastructure team completing setup', priority: 'high' },
  { type: 'dependency', title: 'Third-Party Integration', description: 'Waiting on vendor API documentation and sandbox access', priority: 'medium' }
];

// Commentary templates for periods
const COMMENTARY_TEMPLATES = {
  good: [
    'Strong progress this period. Team velocity continues to improve.',
    'On track with planned deliverables. No blockers.',
    'Exceeded expectations due to process improvements.',
    'Good momentum maintained. Quality metrics strong.',
    'Successful sprint completion. Stakeholders satisfied.',
    'Ahead of schedule. Considering additional scope.',
    'Team collaboration excellent. Dependencies resolved quickly.'
  ],
  amber: [
    'Minor delays due to technical issues. Recovery plan in place.',
    'Slightly behind target. Additional resources allocated.',
    'Some scope items deferred to next period.',
    'Dependencies causing minor delays. Working with other teams.',
    'Quality issues identified. Extra testing required.',
    'Resource constraints impacting velocity. Mitigation in progress.'
  ],
  red: [
    'Significant blocker identified. Escalation in progress.',
    'Behind schedule. Recovery plan being developed.',
    'Critical dependency delayed. Impact assessment underway.',
    'Technical debt causing major slowdown. Refactoring required.',
    'Key resource departed. Replacement being onboarded.',
    'Scope creep impacting delivery. Prioritization review needed.'
  ]
};

// Pages for page view tracking
const PAGES = [
  '/',
  '/projects',
  '/metrics',
  '/portfolio',
  '/admin',
  '/admin/users',
  '/admin/audit',
  '/reports',
  '/reports/user-activity',
  '/reports/page-heatmap'
];

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
  let multiplier;
  if (ragStatus === 'green') {
    multiplier = 0.98 + Math.random() * 0.15; // 98% to 113%
  } else if (ragStatus === 'amber') {
    multiplier = 0.82 + Math.random() * 0.1; // 82% to 92%
  } else { // red
    multiplier = 0.65 + Math.random() * 0.12; // 65% to 77%
  }
  return Math.round(expected * multiplier * 100) / 100;
}

// Get RAG status based on performance pattern and period
function getRAGStatus(performance, periodIndex, totalPeriods) {
  const progress = periodIndex / totalPeriods;

  if (performance === 'good') {
    return Math.random() < 0.85 ? 'green' : 'amber';
  } else if (performance === 'struggling') {
    if (Math.random() < 0.4) return 'green';
    return Math.random() < 0.6 ? 'amber' : 'red';
  } else if (performance === 'recovering') {
    if (progress < 0.4) {
      return Math.random() < 0.3 ? 'green' : (Math.random() < 0.5 ? 'amber' : 'red');
    } else {
      return Math.random() < 0.8 ? 'green' : 'amber';
    }
  } else if (performance === 'declining') {
    if (progress < 0.5) {
      return Math.random() < 0.8 ? 'green' : 'amber';
    } else {
      return Math.random() < 0.3 ? 'green' : (Math.random() < 0.5 ? 'amber' : 'red');
    }
  }
  return 'green';
}

// Get random commentary
function getCommentary(ragStatus) {
  if (Math.random() < 0.3) return null; // 30% chance of no commentary

  const templates = COMMENTARY_TEMPLATES[ragStatus === 'green' ? 'good' : (ragStatus === 'amber' ? 'amber' : 'red')];
  return templates[Math.floor(Math.random() * templates.length)];
}

// Generate periods for a metric
async function generateMetricPeriods(metricId, startDate, endDate, frequency, curve, finalTarget, performance, targetChangeAt = null) {
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
  let currentTarget = finalTarget;

  // Target change mid-project
  const targetChangePeriod = targetChangeAt ? Math.floor(totalPeriods * targetChangeAt) : -1;
  const targetIncrease = 1 + Math.random() * 0.3; // 0-30% increase

  const createdPeriods = [];

  for (let i = 0; i < periods.length; i++) {
    const periodDate = periods[i].date;

    // Apply target change
    if (targetChangeAt && i >= targetChangePeriod && currentTarget === finalTarget) {
      currentTarget = Math.round(finalTarget * targetIncrease);
    }

    const expected = calculateExpected(curve, currentTarget, i + 1, totalPeriods);

    let complete = null;
    let commentary = null;

    // Only fill in past periods
    if (periodDate < now) {
      const ragStatus = getRAGStatus(performance, i, totalPeriods);
      complete = generateComplete(expected, ragStatus);
      commentary = getCommentary(ragStatus);
    }

    const result = await dbRun(
      `INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete, commentary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [metricId, periodDate.toISOString().split('T')[0], expected, currentTarget, complete, commentary]
    );

    createdPeriods.push({
      id: result.lastID,
      date: periodDate,
      complete,
      expected,
      target: currentTarget
    });
  }

  return { periods: createdPeriods, targetChanged: targetChangeAt !== null };
}

// Add audit log entry
async function addAuditLog(userId, userEmail, action, tableName, recordId, oldValues, newValues, description, timestamp) {
  await dbRun(
    `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, userEmail, action, tableName, recordId,
     oldValues ? JSON.stringify(oldValues) : null,
     newValues ? JSON.stringify(newValues) : null,
     description, timestamp]
  );
}

// Add page view
async function addPageView(userId, path, sessionId, timestamp) {
  await dbRun(
    `INSERT INTO page_views (user_id, path, session_id, created_at)
     VALUES (?, ?, ?, ?)`,
    [userId, path, sessionId, timestamp]
  );
}

// Add comment to period
async function addComment(periodId, userId, text, timestamp) {
  return await dbRun(
    `INSERT INTO comments (period_id, created_by, comment_text, created_at)
     VALUES (?, ?, ?, ?)`,
    [periodId, userId, text, timestamp]
  );
}

// Main seed function
async function seedStrongData() {
  console.log('Starting comprehensive data seed...\n');

  try {
    // Clear existing data (except users)
    console.log('Clearing existing test data...');
    await dbRun('DELETE FROM comments');
    await dbRun('DELETE FROM metric_periods');
    await dbRun('DELETE FROM metrics');
    await dbRun('DELETE FROM craids');
    await dbRun('DELETE FROM project_links');
    await dbRun('DELETE FROM projects');
    await dbRun('DELETE FROM audit_log');
    await dbRun('DELETE FROM page_views');
    // Don't delete portfolios - may want to keep them
    console.log('Cleared existing data\n');

    // Get admin user
    const admin = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@example.com']);
    if (!admin) {
      console.error('Admin user not found. Run the server first to initialize users.');
      return;
    }

    // Get all users for activity simulation
    const users = await dbAll('SELECT * FROM users');
    console.log(`Found ${users.length} users for activity simulation\n`);

    // Create portfolios
    console.log('Creating portfolios...');
    const portfolioIds = {};
    for (const p of PORTFOLIOS) {
      let existing = await dbGet('SELECT id FROM portfolios WHERE name = ?', [p.name]);
      if (!existing) {
        const result = await dbRun('INSERT INTO portfolios (name, color, description) VALUES (?, ?, ?)',
          [p.name, p.color, p.description]);
        portfolioIds[p.name] = result.lastID;
      } else {
        portfolioIds[p.name] = existing.id;
        // Update color and description
        await dbRun('UPDATE portfolios SET color = ?, description = ? WHERE id = ?',
          [p.color, p.description, existing.id]);
      }
    }
    console.log(`${PORTFOLIOS.length} portfolios ready\n`);

    // Create projects
    console.log('Creating projects and metrics...');
    const createdProjects = [];

    for (const template of PROJECT_TEMPLATES) {
      const portfolioId = portfolioIds[template.portfolio];

      // Calculate dates
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - template.startMonthsAgo);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + template.durationMonths);

      // Create project
      const projectResult = await dbRun(
        `INSERT INTO projects (name, description, initiative_manager, secondary_pm, portfolio_id, start_date, end_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          template.name,
          template.description,
          template.manager,
          template.secondaryPM,
          portfolioId,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0],
          startDate.toISOString()
        ]
      );
      const projectId = projectResult.lastID;

      // Add project links
      const projectSlug = template.name.toLowerCase().replace(/ /g, '-').substring(0, 20);
      await dbRun('INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)',
        [projectId, 'Confluence', `https://confluence.company.com/${projectSlug}`, 1]);
      await dbRun('INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)',
        [projectId, 'Jira Board', `https://jira.company.com/projects/${projectSlug.substring(0, 6).toUpperCase()}`, 2]);
      if (Math.random() < 0.6) {
        await dbRun('INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)',
          [projectId, 'GitHub', `https://github.com/company/${projectSlug}`, 3]);
      }
      if (Math.random() < 0.4) {
        await dbRun('INSERT INTO project_links (project_id, label, url, display_order) VALUES (?, ?, ?, ?)',
          [projectId, 'Figma', `https://figma.com/file/${projectSlug}`, 4]);
      }

      // Get metrics for this project
      const metrics = METRIC_TEMPLATES[template.name] || [];
      const createdMetrics = [];

      for (const metric of metrics) {
        // Some metrics may have target changes mid-project
        const hasTargetChange = Math.random() < 0.25; // 25% chance
        const targetChangeAt = hasTargetChange ? 0.4 + Math.random() * 0.2 : null; // Between 40-60% through

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
            metric.target,
            10,
            20,
            metric.type
          ]
        );

        const { periods, targetChanged } = await generateMetricPeriods(
          metricResult.lastID,
          startDate,
          endDate,
          metric.frequency,
          metric.curve,
          metric.target,
          template.performance,
          targetChangeAt
        );

        createdMetrics.push({
          id: metricResult.lastID,
          name: metric.name,
          periods,
          targetChanged
        });
      }

      // Add CRAIDs
      const numCraids = 2 + Math.floor(Math.random() * 4); // 2-5 CRAIDs per project
      const shuffledCraids = [...CRAID_TEMPLATES].sort(() => Math.random() - 0.5);

      for (let i = 0; i < numCraids && i < shuffledCraids.length; i++) {
        const craid = shuffledCraids[i];
        const statuses = ['open', 'in_progress', 'resolved', 'closed'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        await dbRun(
          'INSERT INTO craids (project_id, type, title, description, status, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [projectId, craid.type, craid.title, craid.description, status, craid.priority, startDate.toISOString()]
        );
      }

      createdProjects.push({
        id: projectId,
        name: template.name,
        metrics: createdMetrics,
        startDate,
        endDate
      });

      console.log(`   ${template.name}: ${metrics.length} metrics, ${numCraids} CRAIDs`);
    }

    console.log(`\n${createdProjects.length} projects created\n`);

    // Generate audit logs
    console.log('Generating audit logs...');
    let auditCount = 0;

    for (const project of createdProjects) {
      // Project creation audit
      await addAuditLog(admin.id, admin.email, 'CREATE', 'projects', project.id,
        null, { name: project.name }, `Created project: ${project.name}`, project.startDate.toISOString());
      auditCount++;

      for (const metric of project.metrics) {
        // Metric creation audit
        await addAuditLog(admin.id, admin.email, 'CREATE', 'metrics', metric.id,
          null, { name: metric.name }, `Created metric: ${metric.name}`, project.startDate.toISOString());
        auditCount++;

        // Period updates - sample some periods for audit trail
        const pastPeriods = metric.periods.filter(p => p.complete !== null);
        for (let i = 0; i < pastPeriods.length; i++) {
          const period = pastPeriods[i];

          // 40% chance of having audit trail for this period
          if (Math.random() < 0.4) {
            const timestamp = new Date(period.date);
            timestamp.setDate(timestamp.getDate() + Math.floor(Math.random() * 7)); // Within a week of period

            // Initial entry
            const initialValue = Math.round(period.complete * (0.85 + Math.random() * 0.1) * 100) / 100;
            await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', period.id,
              { complete: null }, { complete: initialValue },
              'Initial value entry', timestamp.toISOString());
            auditCount++;

            // 50% chance of correction
            if (Math.random() < 0.5) {
              const correctionTime = new Date(timestamp);
              correctionTime.setHours(correctionTime.getHours() + Math.floor(Math.random() * 48));

              await addAuditLog(admin.id, admin.email, 'UPDATE', 'metric_periods', period.id,
                { complete: initialValue }, { complete: period.complete },
                'Value correction after data validation', correctionTime.toISOString());
              auditCount++;
            }
          }
        }

        // Target change audit
        if (metric.targetChanged) {
          const changeDate = new Date(project.startDate);
          changeDate.setMonth(changeDate.getMonth() + Math.floor(project.metrics[0].periods.length * 0.5));

          await addAuditLog(admin.id, admin.email, 'UPDATE', 'metrics', metric.id,
            { final_target: metric.periods[0]?.target },
            { final_target: metric.periods[metric.periods.length - 1]?.target },
            'Target increased due to expanded scope', changeDate.toISOString());
          auditCount++;
        }
      }
    }

    console.log(`${auditCount} audit log entries created\n`);

    // Generate page views
    console.log('Generating page views...');
    let pageViewCount = 0;

    // Generate page views over the last 90 days
    const pageViewStartDate = new Date();
    pageViewStartDate.setDate(pageViewStartDate.getDate() - 90);

    for (let day = 0; day < 90; day++) {
      const date = new Date(pageViewStartDate);
      date.setDate(date.getDate() + day);

      // More views on weekdays
      const isWeekday = date.getDay() !== 0 && date.getDay() !== 6;
      const baseViews = isWeekday ? 50 : 10;
      const viewsToday = baseViews + Math.floor(Math.random() * 30);

      for (let v = 0; v < viewsToday; v++) {
        const user = users[Math.floor(Math.random() * users.length)];
        const page = PAGES[Math.floor(Math.random() * PAGES.length)];
        const sessionId = `sess_${crypto.randomBytes(8).toString('hex')}`;

        const viewTime = new Date(date);
        viewTime.setHours(8 + Math.floor(Math.random() * 10)); // 8am - 6pm
        viewTime.setMinutes(Math.floor(Math.random() * 60));

        await addPageView(user.id, page, sessionId, viewTime.toISOString());
        pageViewCount++;

        // 60% chance of viewing additional pages in same session
        if (Math.random() < 0.6) {
          const additionalPages = 1 + Math.floor(Math.random() * 4);
          for (let ap = 0; ap < additionalPages; ap++) {
            const nextPage = PAGES[Math.floor(Math.random() * PAGES.length)];
            const nextTime = new Date(viewTime);
            nextTime.setMinutes(nextTime.getMinutes() + (ap + 1) * (1 + Math.floor(Math.random() * 5)));

            await addPageView(user.id, nextPage, sessionId, nextTime.toISOString());
            pageViewCount++;
          }
        }
      }
    }

    console.log(`${pageViewCount} page views created\n`);

    // Generate comments
    console.log('Generating comments...');
    let commentCount = 0;

    const commentTemplates = [
      'Updated based on latest data from the team.',
      'Confirmed with stakeholders.',
      'Adjusted after weekly review meeting.',
      'This reflects the impact of recent changes.',
      'Numbers validated against source system.',
      'Correction applied per audit findings.',
      'Updated to align with quarterly review.',
      'Reflects new baseline after scope change.'
    ];

    for (const project of createdProjects) {
      for (const metric of project.metrics) {
        const pastPeriods = metric.periods.filter(p => p.complete !== null);

        for (const period of pastPeriods) {
          // 20% chance of having a comment
          if (Math.random() < 0.2) {
            const user = users[Math.floor(Math.random() * users.length)];
            const comment = commentTemplates[Math.floor(Math.random() * commentTemplates.length)];
            const timestamp = new Date(period.date);
            timestamp.setDate(timestamp.getDate() + Math.floor(Math.random() * 7));

            await addComment(period.id, user.id, comment, timestamp.toISOString());
            commentCount++;

            // 30% chance of reply
            if (Math.random() < 0.3) {
              const replyUser = users[Math.floor(Math.random() * users.length)];
              const replyTime = new Date(timestamp);
              replyTime.setHours(replyTime.getHours() + 1 + Math.floor(Math.random() * 24));

              await addComment(period.id, replyUser.id, 'Thanks for the update.', replyTime.toISOString());
              commentCount++;
            }
          }
        }
      }
    }

    console.log(`${commentCount} comments created\n`);

    // Summary
    console.log('='.repeat(50));
    console.log('SEED COMPLETE!');
    console.log('='.repeat(50));
    console.log(`
Summary:
  - ${PORTFOLIOS.length} portfolios
  - ${createdProjects.length} projects
  - ${createdProjects.reduce((sum, p) => sum + p.metrics.length, 0)} metrics
  - Various timeline lengths (12-24 months)
  - Multiple progression curves (linear, s-curve, exponential, logarithmic)
  - Weekly, monthly, and quarterly frequencies
  - Target changes mid-project
  - ${auditCount} audit log entries
  - ${pageViewCount} page views (90 days)
  - ${commentCount} comments
  - CRAIDs with various statuses
  - Performance patterns: good, struggling, recovering, declining
`);

  } catch (error) {
    console.error('Error during seed:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run
if (require.main === module) {
  seedStrongData()
    .then(() => {
      console.log('Seed completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seedStrongData };
