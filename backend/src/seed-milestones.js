const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'progress-tracker.db');
const db = new Database(dbPath);

console.log('🎯 Seeding milestones...\n');

// Get all projects
const projects = db.prepare('SELECT id, name FROM projects ORDER BY id LIMIT 10').all();

console.log(`Found ${projects.length} projects\n`);

// Project-specific milestone templates based on realistic project names
const projectMilestones = {
  'Patient Portal': [
    { title: 'Requirements & Compliance Review', description: 'HIPAA compliance review and requirements finalized', daysFromNow: -30 },
    { title: 'UI/UX Design Approval', description: 'Patient-centric design approved by stakeholders', daysFromNow: -10 },
    { title: 'Portal MVP Launch', description: 'Core features available to pilot patient group', daysFromNow: 15 },
    { title: 'Full Feature Rollout', description: 'All portal features live for all patients', daysFromNow: 45 },
    { title: 'Mobile App Release', description: 'iOS and Android apps launched', daysFromNow: 75 },
    { title: 'Integration Complete', description: 'EHR system fully integrated', daysFromNow: 105 }
  ],
  'E-commerce': [
    { title: 'Market Research Complete', description: 'International market analysis and strategy approved', daysFromNow: -25 },
    { title: 'Platform Localization', description: 'Multi-language and currency support implemented', daysFromNow: -5 },
    { title: 'Pilot Market Launch', description: 'Soft launch in first international market', daysFromNow: 20 },
    { title: 'Payment Gateway Integration', description: 'Local payment methods integrated', daysFromNow: 50 },
    { title: 'Full Regional Rollout', description: 'All target markets operational', daysFromNow: 80 },
    { title: 'Performance Optimization', description: 'CDN and performance targets achieved', daysFromNow: 110 }
  ],
  'AI Research': [
    { title: 'Research Dataset Compiled', description: 'Training and validation datasets prepared', daysFromNow: -35 },
    { title: 'Baseline Model Trained', description: 'Initial model achieving baseline accuracy', daysFromNow: -10 },
    { title: 'Model Optimization Complete', description: 'Hyperparameter tuning and optimization done', daysFromNow: 15 },
    { title: 'Ethical Review Passed', description: 'AI ethics board approval obtained', daysFromNow: 40 },
    { title: 'Beta Testing Launch', description: 'Limited beta release to research partners', daysFromNow: 70 },
    { title: 'Production Deployment', description: 'Full production release with monitoring', daysFromNow: 100 }
  ],
  'Supply Chain': [
    { title: 'Process Analysis Complete', description: 'Current supply chain mapped and analyzed', daysFromNow: -40 },
    { title: 'Vendor Onboarding', description: 'Key suppliers integrated into new system', daysFromNow: -15 },
    { title: 'Pilot Warehouse Live', description: 'First distribution center on new system', daysFromNow: 10 },
    { title: 'Regional Expansion', description: 'All regional warehouses migrated', daysFromNow: 45 },
    { title: 'IoT Integration', description: 'Sensor network and tracking fully operational', daysFromNow: 75 },
    { title: 'AI Forecasting Enabled', description: 'Predictive analytics driving decisions', daysFromNow: 110 }
  ],
  'Mobile Banking': [
    { title: 'Security Audit Passed', description: 'Penetration testing and security review complete', daysFromNow: -20 },
    { title: 'Core Features Beta', description: 'Essential banking features in beta testing', daysFromNow: 5 },
    { title: 'App Store Approval', description: 'iOS and Android approvals obtained', daysFromNow: 25 },
    { title: 'Public Launch', description: 'General availability to all customers', daysFromNow: 50 },
    { title: 'Biometric Authentication', description: 'Face ID and fingerprint login enabled', daysFromNow: 80 },
    { title: 'Investment Features', description: 'Stock trading and investment tools live', daysFromNow: 115 }
  ],
  'Data Warehouse': [
    { title: 'Migration Strategy Approved', description: 'Technical architecture and plan finalized', daysFromNow: -35 },
    { title: 'Dev Environment Migrated', description: 'Development data warehouse operational', daysFromNow: -10 },
    { title: 'ETL Pipelines Built', description: 'All data pipelines tested and validated', daysFromNow: 20 },
    { title: 'UAT Environment Ready', description: 'User acceptance testing in progress', daysFromNow: 50 },
    { title: 'Production Cutover', description: 'Live production migration complete', daysFromNow: 85 },
    { title: 'Legacy Decommission', description: 'Old warehouse shut down', daysFromNow: 120 }
  ],
  'Support Portal': [
    { title: 'AI Model Training Complete', description: 'Support chatbot trained on knowledge base', daysFromNow: -28 },
    { title: 'Internal Beta Launch', description: 'Support team testing AI features', daysFromNow: -7 },
    { title: 'Customer Pilot Program', description: 'Limited customer group testing portal', daysFromNow: 18 },
    { title: 'Full Portal Launch', description: 'AI-powered support available to all users', daysFromNow: 48 },
    { title: 'Multi-channel Integration', description: 'Email, chat, phone integrated', daysFromNow: 78 },
    { title: 'Advanced Analytics', description: 'Customer insights and reporting live', daysFromNow: 108 }
  ]
};

// Fallback template for unknown project types
const defaultTemplate = [
  { title: 'Project Kickoff', description: 'Project initiated and team assembled', daysFromNow: -40 },
  { title: 'Planning Complete', description: 'Detailed project plan approved', daysFromNow: -15 },
  { title: 'Development Milestone', description: 'Key development phase completed', daysFromNow: 15 },
  { title: 'Testing Phase', description: 'Comprehensive testing underway', daysFromNow: 50 },
  { title: 'Launch Preparation', description: 'Ready for production deployment', daysFromNow: 85 },
  { title: 'Go Live', description: 'Project successfully deployed', daysFromNow: 115 }
];

// Helper function to match project name to milestone template
const getMilestonesForProject = (projectName) => {
  for (const [key, milestones] of Object.entries(projectMilestones)) {
    if (projectName.toLowerCase().includes(key.toLowerCase())) {
      return milestones;
    }
  }
  return defaultTemplate;
};

// Helper to calculate date
const getDate = (daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
};

// Helper to determine if milestone should be completed
const shouldBeComplete = (daysFromNow) => {
  if (daysFromNow >= 0) return false; // Future milestones are never complete
  if (daysFromNow < -30) return Math.random() > 0.1; // 90% of milestones >30 days ago are complete
  return Math.random() > 0.3; // 70% of recent past milestones are complete
};

// Insert milestones for each project
const insertMilestone = db.prepare(`
  INSERT INTO milestones (project_id, title, description, target_date, completed, completed_date, display_order, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

const insertMany = db.transaction((projectId, milestones) => {
  milestones.forEach((milestone, index) => {
    const targetDate = getDate(milestone.daysFromNow);
    const completed = shouldBeComplete(milestone.daysFromNow);
    const completedDate = completed ? getDate(milestone.daysFromNow + Math.floor(Math.random() * 3)) : null;

    insertMilestone.run(
      projectId,
      milestone.title,
      milestone.description,
      targetDate,
      completed ? 1 : 0,
      completedDate,
      index
    );
  });
});

// Clear existing milestones
console.log('Clearing existing milestones...');
db.prepare('DELETE FROM milestones').run();

// Add milestones to projects
let totalMilestones = 0;
projects.forEach((project) => {
  const milestones = getMilestonesForProject(project.name);

  console.log(`Adding ${milestones.length} milestones to "${project.name}"`);
  insertMany(project.id, milestones);
  totalMilestones += milestones.length;
});

console.log(`\n✅ Successfully seeded ${totalMilestones} milestones across ${projects.length} projects!`);

// Show some examples
console.log('\nSample milestones:');
const samples = db.prepare(`
  SELECT m.*, p.name as project_name
  FROM milestones m
  JOIN projects p ON m.project_id = p.id
  ORDER BY m.target_date
  LIMIT 5
`).all();

samples.forEach(m => {
  const status = m.completed ? '✓ Complete' : new Date(m.target_date) < new Date() ? '⚠ Overdue' : '○ Upcoming';
  console.log(`  ${status} | ${m.project_name} - ${m.title} (${m.target_date})`);
});

db.close();
console.log('\nDone! 🎉');
