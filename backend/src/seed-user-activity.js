#!/usr/bin/env node

/**
 * User Activity Seed Script
 *
 * Generates realistic user activity patterns in the audit log:
 * - Multiple users with different activity levels
 * - Various activity types (CREATE, UPDATE, DELETE)
 * - Realistic time distribution (weekdays, business hours weighted)
 * - Activity patterns over the last 90 days
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Activity type weights (more updates than creates/deletes)
const ACTIVITY_TYPES = [
  { action: 'CREATE', table: 'projects', weight: 5 },
  { action: 'UPDATE', table: 'projects', weight: 25 },
  { action: 'CREATE', table: 'metrics', weight: 10 },
  { action: 'UPDATE', table: 'metrics', weight: 30 },
  { action: 'DELETE', table: 'metrics', weight: 3 },
  { action: 'CREATE', table: 'metric_periods', weight: 15 },
  { action: 'UPDATE', table: 'metric_periods', weight: 40 },
  { action: 'DELETE', table: 'metric_periods', weight: 5 },
  { action: 'CREATE', table: 'comments', weight: 20 },
  { action: 'UPDATE', table: 'comments', weight: 10 },
  { action: 'DELETE', table: 'comments', weight: 3 },
  { action: 'CREATE', table: 'project_links', weight: 8 },
  { action: 'UPDATE', table: 'project_links', weight: 5 },
  { action: 'DELETE', table: 'project_links', weight: 2 },
  { action: 'CREATE', table: 'craids', weight: 6 },
  { action: 'UPDATE', table: 'craids', weight: 15 },
  { action: 'CREATE', table: 'feedback', weight: 8 },
  { action: 'UPDATE', table: 'feedback', weight: 4 },
];

// User activity profiles (some users more active than others)
const USER_PROFILES = {
  'power_user': { activityMultiplier: 3.0, peakHours: [9, 10, 14, 15, 16] },
  'regular': { activityMultiplier: 1.0, peakHours: [10, 11, 14, 15] },
  'light': { activityMultiplier: 0.4, peakHours: [11, 14] },
  'sporadic': { activityMultiplier: 0.2, peakHours: [10, 15] },
};

function getRandomActivityType() {
  const totalWeight = ACTIVITY_TYPES.reduce((sum, a) => sum + a.weight, 0);
  let random = Math.random() * totalWeight;

  for (const activity of ACTIVITY_TYPES) {
    random -= activity.weight;
    if (random <= 0) {
      return activity;
    }
  }
  return ACTIVITY_TYPES[0];
}

function getRandomTimestamp(daysAgo, profile) {
  const now = new Date();
  const date = new Date(now);
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));

  // Weight towards weekdays
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    // Weekend - 20% chance to keep, otherwise shift to weekday
    if (Math.random() > 0.2) {
      date.setDate(date.getDate() + (dayOfWeek === 0 ? 1 : -1));
    }
  }

  // Set time - weight towards business hours with peak times
  const peakHours = profile.peakHours;
  let hour;
  if (Math.random() < 0.6 && peakHours.length > 0) {
    // 60% chance of peak hour
    hour = peakHours[Math.floor(Math.random() * peakHours.length)];
  } else {
    // Business hours with some variance
    hour = 8 + Math.floor(Math.random() * 10); // 8am - 6pm
  }

  date.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));

  return date.toISOString();
}

async function seed() {
  console.log('Seeding user activity data...\n');

  try {
    // Get all users
    const users = await dbAll('SELECT * FROM users');
    if (users.length === 0) {
      console.error('No users found. Run the server first.');
      return;
    }
    console.log(`Found ${users.length} users\n`);

    // Get projects and metrics for realistic record IDs
    const projects = await dbAll('SELECT id FROM projects');
    const metrics = await dbAll('SELECT id FROM metrics');
    const metricPeriods = await dbAll('SELECT id FROM metric_periods LIMIT 500');
    const comments = await dbAll('SELECT id FROM comments LIMIT 200');

    console.log(`Found ${projects.length} projects, ${metrics.length} metrics, ${metricPeriods.length} periods, ${comments.length} comments\n`);

    // Assign profiles to users
    const profileNames = Object.keys(USER_PROFILES);
    const userProfiles = users.map((user, idx) => {
      // First user is power user (admin), vary the rest
      let profileName;
      if (idx === 0) {
        profileName = 'power_user';
      } else if (idx < 3) {
        profileName = 'regular';
      } else if (idx < 5) {
        profileName = 'light';
      } else {
        profileName = 'sporadic';
      }

      return {
        ...user,
        profile: USER_PROFILES[profileName],
        profileName
      };
    });

    // Generate activity entries
    const baseActivityCount = 150; // Base activities per user over 90 days
    let totalInserted = 0;

    for (const user of userProfiles) {
      const activityCount = Math.floor(baseActivityCount * user.profile.activityMultiplier);
      console.log(`Generating ${activityCount} activities for ${user.name} (${user.profileName})...`);

      for (let i = 0; i < activityCount; i++) {
        const activity = getRandomActivityType();
        const timestamp = getRandomTimestamp(90, user.profile);

        // Get appropriate record ID based on table
        let recordId = 1;
        switch (activity.table) {
          case 'projects':
            recordId = projects[Math.floor(Math.random() * projects.length)]?.id || 1;
            break;
          case 'metrics':
            recordId = metrics[Math.floor(Math.random() * metrics.length)]?.id || 1;
            break;
          case 'metric_periods':
            recordId = metricPeriods[Math.floor(Math.random() * metricPeriods.length)]?.id || 1;
            break;
          case 'comments':
            recordId = comments[Math.floor(Math.random() * comments.length)]?.id || 1;
            break;
          default:
            recordId = Math.floor(Math.random() * 50) + 1;
        }

        // Generate old/new values JSON based on action type
        let oldValues = null;
        let newValues = null;
        let description = '';

        const possibleFields = {
          projects: ['name', 'description', 'status', 'initiative_manager', 'start_date', 'end_date'],
          metrics: ['name', 'target', 'amber_tolerance', 'red_tolerance', 'unit'],
          metric_periods: ['actual', 'target', 'notes'],
          comments: ['text', 'status'],
          project_links: ['url', 'name'],
          craids: ['status', 'description', 'owner', 'due_date'],
          feedback: ['status', 'response'],
        };

        const fields = possibleFields[activity.table] || ['value'];
        const field = fields[Math.floor(Math.random() * fields.length)];

        // Generate realistic values based on field type
        const generateValue = (fieldName, isOld = false) => {
          const offset = isOld ? 0 : Math.floor(Math.random() * 20) + 5;
          switch (fieldName) {
            case 'actual':
            case 'target':
              return Math.floor(Math.random() * 100) + offset;
            case 'amber_tolerance':
              return Math.floor(Math.random() * 10) + 5;
            case 'red_tolerance':
              return Math.floor(Math.random() * 15) + 10;
            case 'name':
              const names = ['Q1 Review', 'Sprint Update', 'Phase 2', 'Migration', 'Release v2.0'];
              return names[Math.floor(Math.random() * names.length)];
            case 'description':
              const descs = ['Updated scope', 'New requirements added', 'Timeline adjusted', 'Resources allocated'];
              return descs[Math.floor(Math.random() * descs.length)];
            case 'status':
              const statuses = ['active', 'on-hold', 'completed', 'at-risk', 'pending'];
              return statuses[Math.floor(Math.random() * statuses.length)];
            case 'notes':
              const notes = ['On track', 'Delayed due to dependencies', 'Ahead of schedule', 'Needs review'];
              return notes[Math.floor(Math.random() * notes.length)];
            case 'unit':
              const units = ['%', 'days', 'count', 'hours', '$'];
              return units[Math.floor(Math.random() * units.length)];
            case 'url':
              return `https://example.com/doc-${Math.floor(Math.random() * 1000)}`;
            case 'text':
              const texts = ['Great progress this week', 'Need more resources', 'Blocked by external team'];
              return texts[Math.floor(Math.random() * texts.length)];
            case 'owner':
              const owners = ['John Smith', 'Sarah Johnson', 'Mike Chen', 'Lisa Brown'];
              return owners[Math.floor(Math.random() * owners.length)];
            case 'due_date':
            case 'start_date':
            case 'end_date':
              const d = new Date();
              d.setDate(d.getDate() + Math.floor(Math.random() * 90) - 30);
              return d.toISOString().split('T')[0];
            case 'initiative_manager':
              const managers = ['Alice Wong', 'Bob Taylor', 'Carol Martinez'];
              return managers[Math.floor(Math.random() * managers.length)];
            case 'response':
              const responses = ['Thank you for the feedback', 'We will look into this', 'Implemented in next release'];
              return responses[Math.floor(Math.random() * responses.length)];
            default:
              return isOld ? 'previous' : 'updated';
          }
        };

        if (activity.action === 'CREATE') {
          newValues = JSON.stringify({ [field]: generateValue(field, false) });
          description = `Created ${activity.table.replace('_', ' ')}`;
        } else if (activity.action === 'DELETE') {
          oldValues = JSON.stringify({ [field]: generateValue(field, true) });
          description = `Deleted ${activity.table.replace('_', ' ')}`;
        } else {
          oldValues = JSON.stringify({ [field]: generateValue(field, true) });
          newValues = JSON.stringify({ [field]: generateValue(field, false) });
          description = `Updated ${field} on ${activity.table.replace('_', ' ')}`;
        }

        await dbRun(
          `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [user.id, user.email, activity.action, activity.table, recordId, oldValues, newValues, description, timestamp]
        );
        totalInserted++;
      }
    }

    console.log(`\nInserted ${totalInserted} audit log entries\n`);

    // Also add some recent page views to make users appear "active"
    console.log('Adding recent page views...');
    const now = new Date();
    let pageViewsInserted = 0;

    for (const user of userProfiles.slice(0, 5)) { // First 5 users
      // Add page views in the last 2 hours
      const viewCount = Math.floor(Math.random() * 10) + 3;
      for (let i = 0; i < viewCount; i++) {
        const minutesAgo = Math.floor(Math.random() * 120); // Last 2 hours
        const viewTime = new Date(now);
        viewTime.setMinutes(viewTime.getMinutes() - minutesAgo);

        const project = projects[Math.floor(Math.random() * projects.length)];
        if (project) {
          // Get project name
          const projectData = await dbAll('SELECT name FROM projects WHERE id = ?', [project.id]);
          if (projectData[0]) {
            await dbRun(
              `INSERT INTO page_views (user_id, path, created_at) VALUES (?, ?, ?)`,
              [user.id, `Project: ${projectData[0].name}`, viewTime.toISOString()]
            );
            pageViewsInserted++;
          }
        }
      }
    }

    console.log(`Inserted ${pageViewsInserted} recent page views\n`);

    // Summary
    const activitySummary = await dbAll(`
      SELECT
        COALESCE(u.name, 'Unknown') as user_name,
        COUNT(*) as activity_count
      FROM audit_log a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.created_at >= datetime('now', '-90 days')
      GROUP BY u.name
      ORDER BY activity_count DESC
    `);

    console.log('Activity Summary (last 90 days):');
    console.log('================================');
    activitySummary.forEach(row => {
      console.log(`  ${row.user_name}: ${row.activity_count} activities`);
    });

    const activeUsers = await dbAll(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM page_views
      WHERE created_at >= datetime('now', '-30 minutes')
    `);
    console.log(`\nActive users (last 30 min): ${activeUsers[0]?.count || 0}`);

    console.log('\nDone!');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    db.close();
  }
}

seed();
