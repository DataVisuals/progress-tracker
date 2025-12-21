const Database = require('better-sqlite3');
const path = require('path');

// Helper to format dates
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

(async () => {
  try {
    const dbPath = path.join(__dirname, '../data/progress-tracker.db');
    const db = new Database(dbPath);

    console.log('Starting to create diverse backlog data...\n');

    // Get existing data
    const spaces = db.prepare('SELECT id, name FROM spaces').all();
    const portfolios = db.prepare('SELECT id, name, space_id FROM portfolios').all();
    const users = db.prepare('SELECT id, name FROM users').all();

    console.log(`Found ${spaces.length} spaces, ${portfolios.length} portfolios, ${users.length} users\n`);

    // Create spaces if none exist
    if (spaces.length === 0) {
      console.log('Creating spaces...\n');
      const spaceNames = [
        { name: 'Technology', description: 'Technology and infrastructure projects' },
        { name: 'Product', description: 'Product development initiatives' },
        { name: 'Operations', description: 'Operational improvements and process efficiency' }
      ];

      const insertSpace = db.prepare("INSERT INTO spaces (name, description) VALUES (?, ?)");
      for (const space of spaceNames) {
        const info = insertSpace.run(space.name, space.description);
        spaces.push({ id: info.lastInsertRowid, name: space.name });
        console.log(`Created space: ${space.name}`);
      }
      console.log('');
    }

    // Create a map of space names to IDs
    const spaceMap = {};
    spaces.forEach(s => { spaceMap[s.name] = s.id; });

    // Refresh portfolios list
    const currentPortfolios = db.prepare('SELECT id, name, space_id FROM portfolios').all();

    // Create portfolios for spaces that don't have any
    const portfolioColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const insertPortfolio = db.prepare("INSERT INTO portfolios (name, description, space_id, color) VALUES (?, ?, ?, ?)");

    for (const space of spaces) {
      const hasPortfolio = currentPortfolios.some(p => p.space_id === space.id);
      if (!hasPortfolio) {
        const color = portfolioColors[space.id % portfolioColors.length];
        const info = insertPortfolio.run(`${space.name} Portfolio`, `Portfolio for ${space.name} initiatives`, space.id, color);
        currentPortfolios.push({ id: info.lastInsertRowid, name: `${space.name} Portfolio`, space_id: space.id });
        console.log(`Created portfolio: ${space.name} Portfolio`);
      }
    }

    const portfoliosBySpace = {};
    currentPortfolios.forEach(p => {
      if (!portfoliosBySpace[p.space_id]) {
        portfoliosBySpace[p.space_id] = [];
      }
      portfoliosBySpace[p.space_id].push(p);
    });

    // Get a random user as creator
    const adminUser = users.find(u => u.name.toLowerCase().includes('admin')) || users[0];

    // Define diverse backlog items with all fields
    const backlogItems = [
      // Technology Ideas
      {
        name: 'API Gateway Modernization',
        description: 'Replace the legacy API gateway with a modern solution supporting GraphQL, rate limiting, and improved observability. This would reduce latency and improve developer experience across all teams.',
        priority: 'high',
        initiative_manager: 'James Park',
        start_date: addMonths(new Date(), 2),
        end_date: addMonths(new Date(), 8),
        spaceHint: 'Technology'
      },
      {
        name: 'Kubernetes Cost Optimization',
        description: 'Implement automated pod scaling and right-sizing to reduce cloud spend by an estimated 30%. Includes setting up Spot instances for non-critical workloads.',
        priority: 'medium',
        initiative_manager: 'David Kumar',
        start_date: addMonths(new Date(), 1),
        end_date: addMonths(new Date(), 4),
        spaceHint: 'Technology'
      },
      {
        name: 'Real-time Event Streaming Platform',
        description: 'Build a centralized Kafka-based event streaming platform to enable real-time data flows between microservices. Would unlock new product capabilities and improve system decoupling.',
        priority: 'high',
        initiative_manager: 'Emily Watson',
        start_date: addMonths(new Date(), 3),
        end_date: addMonths(new Date(), 12),
        spaceHint: 'Technology'
      },
      {
        name: 'Database Sharding Strategy',
        description: 'Design and implement horizontal database sharding to handle 10x data growth. Includes schema changes, migration tooling, and application-level routing logic.',
        priority: 'medium',
        initiative_manager: 'David Kumar',
        start_date: addMonths(new Date(), 4),
        end_date: addMonths(new Date(), 10),
        spaceHint: 'Technology'
      },

      // Product Ideas
      {
        name: 'Personalized Dashboard Experience',
        description: 'Allow users to customize their dashboard layout with drag-and-drop widgets. Includes saving multiple dashboard configurations and sharing templates with team members.',
        priority: 'medium',
        initiative_manager: 'Sarah Chen',
        start_date: addMonths(new Date(), 1),
        end_date: addMonths(new Date(), 5),
        spaceHint: 'Product'
      },
      {
        name: 'Advanced Search with Filters',
        description: 'Implement Elasticsearch-powered search with faceted filtering, saved searches, and search analytics. Would dramatically improve user productivity for power users.',
        priority: 'high',
        initiative_manager: 'Michael Rodriguez',
        start_date: addMonths(new Date(), 2),
        end_date: addMonths(new Date(), 6),
        spaceHint: 'Product'
      },
      {
        name: 'Collaborative Editing Features',
        description: 'Add real-time collaborative editing capabilities for documents and reports. Multiple users could edit simultaneously with presence indicators and conflict resolution.',
        priority: 'low',
        initiative_manager: 'Lisa Anderson',
        start_date: addMonths(new Date(), 6),
        end_date: addMonths(new Date(), 14),
        spaceHint: 'Product'
      },
      {
        name: 'Mobile App Push Notifications',
        description: 'Implement smart push notifications with user preferences, quiet hours, and actionable notification buttons. Includes analytics for notification engagement rates.',
        priority: 'medium',
        initiative_manager: 'Sarah Chen',
        start_date: addMonths(new Date(), 1),
        end_date: addMonths(new Date(), 4),
        spaceHint: 'Product'
      },
      {
        name: 'Customer Feedback Portal',
        description: 'Build a dedicated portal for customers to submit feature requests, report issues, and vote on roadmap items. Would improve customer engagement and product direction.',
        priority: 'high',
        initiative_manager: 'Emily Watson',
        start_date: addMonths(new Date(), 2),
        end_date: addMonths(new Date(), 7),
        spaceHint: 'Product'
      },

      // Operations Ideas
      {
        name: 'Automated Compliance Reporting',
        description: 'Create automated monthly compliance reports for SOC2, GDPR, and HIPAA requirements. Would save approximately 40 hours per month of manual report generation.',
        priority: 'medium',
        initiative_manager: 'David Kumar',
        start_date: addMonths(new Date(), 3),
        end_date: addMonths(new Date(), 8),
        spaceHint: 'Operations'
      },
      {
        name: 'Vendor Management System',
        description: 'Centralized system for managing vendor contracts, renewals, and performance metrics. Includes automated alerts for contract expirations and spend tracking.',
        priority: 'low',
        initiative_manager: 'Lisa Anderson',
        start_date: addMonths(new Date(), 4),
        end_date: addMonths(new Date(), 10),
        spaceHint: 'Operations'
      },
      {
        name: 'AI-Powered Document Classification',
        description: 'Use machine learning to automatically classify and tag incoming documents. Would reduce manual processing time by 60% and improve searchability.',
        priority: 'high',
        initiative_manager: 'Emily Watson',
        start_date: addMonths(new Date(), 2),
        end_date: addMonths(new Date(), 8),
        spaceHint: 'Operations'
      },
      {
        name: 'Workflow Automation Engine',
        description: 'Build a visual workflow designer allowing business users to create automated workflows without coding. Supports conditional logic, approvals, and external integrations.',
        priority: 'medium',
        initiative_manager: 'Michael Rodriguez',
        start_date: addMonths(new Date(), 4),
        end_date: addMonths(new Date(), 12),
        spaceHint: 'Operations'
      }
    ];

    // Clear existing backlog items
    db.prepare('DELETE FROM backlog_items').run();
    console.log('Cleared existing backlog items\n');

    // Prepare insert statement (space is derived from portfolio, so not stored directly)
    const insertBacklog = db.prepare(`
      INSERT INTO backlog_items (name, description, portfolio_id, initiative_manager, priority, start_date, end_date, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    // Insert backlog items
    for (const item of backlogItems) {
      // Find matching space for portfolio lookup
      let spaceId = null;
      let portfolioId = null;

      // Try to find a space that matches the hint
      for (const [name, id] of Object.entries(spaceMap)) {
        if (item.spaceHint && name.toLowerCase().includes(item.spaceHint.toLowerCase())) {
          spaceId = id;
          break;
        }
      }

      // If no matching space found, use first available
      if (!spaceId) {
        spaceId = spaces[0].id;
      }

      // Find a portfolio in that space (portfolio is mandatory)
      const spacePortfolios = portfoliosBySpace[spaceId] || [];
      if (spacePortfolios.length > 0) {
        portfolioId = spacePortfolios[Math.floor(Math.random() * spacePortfolios.length)].id;
      } else {
        console.warn(`Warning: No portfolio found for space ${spaceId}, skipping item ${item.name}`);
        continue;
      }

      insertBacklog.run(
        item.name,
        item.description,
        portfolioId,
        item.initiative_manager,
        item.priority,
        formatDate(item.start_date),
        formatDate(item.end_date),
        adminUser.id
      );

      console.log(`Created backlog item: ${item.name} (${item.priority} priority)`);
    }

    db.close();

    console.log(`\n✅ Successfully created ${backlogItems.length} backlog items!`);
    console.log('\nBacklog items include:');
    console.log('- Various priorities (high, medium, low)');
    console.log('- Start and end dates');
    console.log('- Assigned initiative managers');
    console.log('- Detailed descriptions');
    console.log('- Space and portfolio assignments');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
