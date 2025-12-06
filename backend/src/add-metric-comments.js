const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'progress-tracker.db');
const db = new Database(dbPath);

// Sample comments with varying lengths
const shortComments = [
  "On track",
  "Minor delays expected",
  "Resource constraint identified",
  "Progressing well",
  "Needs attention",
  "Team performing excellently",
  "Slight variance from target"
];

const mediumComments = [
  "The team has made significant progress this period, though we're seeing some technical challenges with the integration layer that may require additional resources in the coming weeks.",
  "Performance metrics are trending positively. We've implemented the new caching strategy which has resulted in improved response times across all endpoints.",
  "Customer feedback has been overwhelmingly positive. The new feature set is driving increased engagement, particularly among enterprise clients.",
  "Development velocity has improved following the team restructure. We're now delivering approximately 30% more story points per sprint than in previous quarters.",
  "Infrastructure costs are slightly above projections due to unexpected scaling requirements. We're exploring optimization opportunities to bring this back in line."
];

const longComments = [
  "This period has presented several interesting challenges that have required careful navigation and strategic decision-making. The primary issue we encountered was related to the integration between our new microservices architecture and the legacy monolithic systems. While we anticipated some friction during this transition, the complexity proved greater than initially estimated. The team has been working diligently to implement robust adapter patterns and maintain data consistency across both architectures. Despite these challenges, we've made substantial progress and are confident we can resolve the remaining issues within the next two reporting periods. Additionally, we've identified several opportunities for performance optimization that could significantly improve overall system throughput once implemented.",
  "The recent sprint retrospective revealed some valuable insights into our development workflow that warrant discussion. Team members expressed concerns about the frequency of context switching between multiple high-priority initiatives, which has been impacting both productivity and code quality. In response, we've implemented a new policy where developers focus on a single epic at a time, with clear completion criteria before moving to the next initiative. Early indicators suggest this approach is yielding positive results, with a noticeable reduction in bug reports and improved developer satisfaction scores. We're also seeing better collaboration patterns emerge as team members are more likely to be working on related features simultaneously.",
  "Our user acquisition metrics this quarter have exceeded expectations across nearly all channels. The targeted marketing campaigns launched in early Q2 have proven particularly effective, driving a 45% increase in qualified leads compared to the same period last year. Conversion rates have also improved, thanks in large part to the streamlined onboarding experience we deployed. However, we're observing some regional variations that deserve closer analysis. The APAC market is showing slower adoption than projected, which may be related to localization issues or competitive pressures specific to that region. We've engaged a local consulting firm to help identify and address these challenges.",
  "Technical debt reduction has been a major focus this period, and I'm pleased to report substantial progress. We've successfully refactored the authentication service, which was identified as one of our highest-risk components due to its age and complexity. The new implementation not only improves security posture but also provides a more flexible foundation for future authentication methods. The refactoring effort took approximately 20% longer than estimated due to the need to maintain backward compatibility with several legacy clients, but the investment has already paid dividends in terms of reduced incident rates and easier maintenance. Next period, we plan to tackle the notification system using similar approaches."
];

try {
  // Get all metric periods
  const metricPeriods = db.prepare(`
    SELECT mp.id, mp.metric_id, m.project_id
    FROM metric_periods mp
    JOIN metrics m ON mp.metric_id = m.id
    ORDER BY RANDOM()
  `).all();

  console.log(`Found ${metricPeriods.length} metric periods`);

  // Delete existing comments (clear all to start fresh)
  const deleted = db.prepare('DELETE FROM comments').run();
  console.log(`Cleared ${deleted.changes} existing comments`);

  let commentsAdded = 0;
  const adminUserId = 1; // Assuming admin user has ID 1

  // Add comments to approximately 70% of periods
  metricPeriods.forEach((period, index) => {
    if (Math.random() < 0.7) {
      let commentText;
      const rand = Math.random();

      // Distribute comment lengths: 40% short, 35% medium, 25% long
      if (rand < 0.4) {
        commentText = shortComments[Math.floor(Math.random() * shortComments.length)];
      } else if (rand < 0.75) {
        commentText = mediumComments[Math.floor(Math.random() * mediumComments.length)];
      } else {
        commentText = longComments[Math.floor(Math.random() * longComments.length)];
      }

      // Insert comment
      db.prepare(`
        INSERT INTO comments (period_id, comment_text, created_by, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `).run(period.id, commentText, adminUserId);

      commentsAdded++;
    }
  });

  console.log(`Added ${commentsAdded} comments to metric periods`);
  console.log('Comment distribution:');
  console.log(`- Approximately ${Math.round(commentsAdded * 0.4)} short comments`);
  console.log(`- Approximately ${Math.round(commentsAdded * 0.35)} medium comments`);
  console.log(`- Approximately ${Math.round(commentsAdded * 0.25)} long comments`);

} catch (error) {
  console.error('Error adding comments:', error);
  process.exit(1);
} finally {
  db.close();
}
