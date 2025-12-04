#!/usr/bin/env node

/**
 * Update Project Dates Script
 *
 * This script updates all project start and end dates to be current/future
 * by shifting them forward to today's date as a reference point.
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'progress-tracker.db');
const db = new Database(dbPath);

console.log('🗓️  Updating project dates to current/future...\n');

// Get today's date
const today = new Date();
today.setHours(0, 0, 0, 0);

// Get all projects with their dates
const projects = db.prepare('SELECT id, name, start_date, end_date FROM projects WHERE start_date IS NOT NULL AND end_date IS NOT NULL').all();

console.log(`Found ${projects.length} projects with dates\n`);

// Calculate the date shift needed
// Find the earliest start date
let earliestDate = null;
projects.forEach(p => {
  const startDate = new Date(p.start_date);
  if (!earliestDate || startDate < earliestDate) {
    earliestDate = startDate;
  }
});

if (!earliestDate) {
  console.log('No projects with dates found');
  db.close();
  process.exit(0);
}

// Calculate days to shift forward (from earliest project to today minus 6 months to give some history)
const sixMonthsAgo = new Date(today);
sixMonthsAgo.setMonth(today.getMonth() - 6);

const daysToShift = Math.floor((sixMonthsAgo - earliestDate) / (1000 * 60 * 60 * 24));

console.log(`Earliest project date: ${earliestDate.toISOString().split('T')[0]}`);
console.log(`Shifting all dates forward by ${daysToShift} days (to start 6 months ago)`);
console.log(`Reference date (6 months ago): ${sixMonthsAgo.toISOString().split('T')[0]}\n`);

// Update each project
const updateStmt = db.prepare('UPDATE projects SET start_date = ?, end_date = ? WHERE id = ?');

const transaction = db.transaction((projects) => {
  projects.forEach(project => {
    const oldStart = new Date(project.start_date);
    const oldEnd = new Date(project.end_date);

    const newStart = new Date(oldStart);
    newStart.setDate(newStart.getDate() + daysToShift);

    const newEnd = new Date(oldEnd);
    newEnd.setDate(newEnd.getDate() + daysToShift);

    updateStmt.run(
      newStart.toISOString().split('T')[0],
      newEnd.toISOString().split('T')[0],
      project.id
    );

    console.log(`✅ ${project.name}`);
    console.log(`   ${oldStart.toISOString().split('T')[0]} → ${newStart.toISOString().split('T')[0]} (start)`);
    console.log(`   ${oldEnd.toISOString().split('T')[0]} → ${newEnd.toISOString().split('T')[0]} (end)`);
  });
});

transaction(projects);

console.log(`\n✅ Updated ${projects.length} projects!`);

// Now update milestone dates with the same shift
console.log('\n🎯 Updating milestone dates...\n');

const milestones = db.prepare('SELECT id, title, target_date FROM milestones WHERE target_date IS NOT NULL').all();

if (milestones.length > 0) {
  const updateMilestoneStmt = db.prepare('UPDATE milestones SET target_date = ? WHERE id = ?');

  const milestoneTransaction = db.transaction((milestones) => {
    milestones.forEach(milestone => {
      const oldDate = new Date(milestone.target_date);
      const newDate = new Date(oldDate);
      newDate.setDate(newDate.getDate() + daysToShift);

      updateMilestoneStmt.run(
        newDate.toISOString().split('T')[0],
        milestone.id
      );
    });
  });

  milestoneTransaction(milestones);
  console.log(`✅ Updated ${milestones.length} milestones!`);
}

// Update metric dates
console.log('\n📊 Updating metric dates...\n');

const metrics = db.prepare('SELECT id, name, start_date, end_date FROM metrics WHERE start_date IS NOT NULL').all();

if (metrics.length > 0) {
  const updateMetricStmt = db.prepare('UPDATE metrics SET start_date = ?, end_date = ? WHERE id = ?');

  const metricTransaction = db.transaction((metrics) => {
    metrics.forEach(metric => {
      const oldStart = new Date(metric.start_date);
      const newStart = new Date(oldStart);
      newStart.setDate(newStart.getDate() + daysToShift);

      let newEnd = null;
      if (metric.end_date) {
        const oldEnd = new Date(metric.end_date);
        newEnd = new Date(oldEnd);
        newEnd.setDate(newEnd.getDate() + daysToShift);
      }

      updateMetricStmt.run(
        newStart.toISOString().split('T')[0],
        newEnd ? newEnd.toISOString().split('T')[0] : null,
        metric.id
      );
    });
  });

  metricTransaction(metrics);
  console.log(`✅ Updated ${metrics.length} metrics!`);
}

// Update data table reporting dates if it exists
try {
  console.log('\n📅 Updating data table reporting dates...\n');
  const dataRows = db.prepare('SELECT id, reporting_date FROM data').all();

  if (dataRows.length > 0) {
    const updateDataStmt = db.prepare('UPDATE data SET reporting_date = ? WHERE id = ?');

    const dataTransaction = db.transaction((rows) => {
      rows.forEach(row => {
        const oldDate = new Date(row.reporting_date);
        const newDate = new Date(oldDate);
        newDate.setDate(newDate.getDate() + daysToShift);

        updateDataStmt.run(
          newDate.toISOString().split('T')[0],
          row.id
        );
      });
    });

    dataTransaction(dataRows);
    console.log(`✅ Updated ${dataRows.length} data rows!`);
  }
} catch (err) {
  console.log('⚠️  Data table not found or has different structure, skipping');
}

db.close();

console.log('\n🎉 All dates updated successfully!\n');
console.log(`Projects now span from ${sixMonthsAgo.toISOString().split('T')[0]} onwards`);
