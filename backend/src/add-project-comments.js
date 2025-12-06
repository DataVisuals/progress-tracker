const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'progress-tracker.db');
const db = new Database(dbPath);

// Sample project-level comments
const projectComments = [
  "Project is progressing well overall. Team morale is high and stakeholder engagement has been excellent.",
  "We've encountered some technical challenges this quarter that have required additional architectural reviews. The team has been working closely with the enterprise architecture group to ensure our solutions align with long-term strategic goals. Despite these challenges, we remain confident in our ability to deliver on schedule.",
  "Excellent progress this period. The team has exceeded expectations across all key performance indicators. Particular kudos to the development team for their outstanding work on the core platform components.",
  "This project continues to face resource constraints that are impacting our ability to maintain the planned velocity. We've escalated this to senior leadership and are exploring options for bringing in additional contractors to support critical path activities. A recovery plan has been drafted and is under review.",
  "Strong collaboration between teams this quarter has resulted in significant improvements to our delivery pipeline. The implementation of automated testing frameworks has reduced our defect rate by approximately 40% compared to the previous quarter.",
  "The recent stakeholder workshop surfaced some interesting feedback about feature prioritization that warrants careful consideration. While our current roadmap addresses the core requirements, there may be opportunities to deliver additional value by adjusting our sprint planning to accommodate some of the suggested enhancements. The product owner is currently evaluating these suggestions and will present recommendations at the next steering committee meeting.",
  "Performance metrics indicate we're tracking slightly ahead of plan, which provides some buffer for addressing the technical debt we've been accumulating. The team has proposed dedicating 20% of sprint capacity to refactoring activities over the next two quarters.",
  "User acceptance testing has revealed some usability issues that need to be addressed before we can proceed to production deployment. While these issues are not critical, they do impact the user experience in ways that could affect adoption rates. The UX team is conducting additional research to inform our remediation strategy.",
  "Integration with legacy systems continues to be more complex than originally anticipated. We've engaged specialized consultants with deep expertise in the mainframe environment to help accelerate this work stream. Early signs are positive but we're maintaining close oversight.",
  "The recent security audit identified several areas requiring attention. None of the findings were classified as critical, but we're taking a proactive approach to addressing all recommendations. A dedicated security sprint has been scheduled for next month."
];

try {
  // Get all projects
  const projects = db.prepare('SELECT id, name FROM projects').all();
  console.log(`Found ${projects.length} projects`);

  const adminUserId = 1;
  let commentsAdded = 0;

  // Add 2-4 comments per project
  projects.forEach((project) => {
    const numComments = Math.floor(Math.random() * 3) + 2; // 2-4 comments

    for (let i = 0; i < numComments; i++) {
      const comment = projectComments[Math.floor(Math.random() * projectComments.length)];

      // Create comments at different times (simulate historical comments)
      const daysAgo = Math.floor(Math.random() * 90); // 0-90 days ago

      db.prepare(`
        INSERT INTO project_comments (project_id, comment_text, created_by, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now', '-${daysAgo} days'), datetime('now', '-${daysAgo} days'))
      `).run(project.id, comment, adminUserId);

      commentsAdded++;
    }
  });

  console.log(`Added ${commentsAdded} project-level comments`);
  console.log(`Average: ${(commentsAdded / projects.length).toFixed(1)} comments per project`);

} catch (error) {
  console.error('Error adding project comments:', error);
  process.exit(1);
} finally {
  db.close();
}
