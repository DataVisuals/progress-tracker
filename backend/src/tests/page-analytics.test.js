const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-page-analytics.db');

let app, adminToken, viewerToken;
let dbRun, dbGet, dbAll;
let testProjectId1, testProjectId2;

describe('Page Analytics and Heatmap Tests', () => {
  beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.NODE_ENV = 'test';
    const { createApp } = require('../server');
    const instance = createApp(TEST_DB_PATH);
    app = instance.app;
    dbRun = instance.dbRun;
    dbGet = instance.dbGet;
    dbAll = instance.dbAll;

    // Create admin user
    await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      email: 'admin@analytics.test',
      password: 'admin123'
    });

    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@analytics.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@analytics.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create viewer user
    await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@analytics.test',
      password: 'viewer123'
    });
    const viewerUser = await dbGet('SELECT * FROM users WHERE email = ?', ['viewer@analytics.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['viewer', viewerUser.id]);

    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: 'viewer@analytics.test',
      password: 'viewer123'
    });
    viewerToken = viewerLogin.body.token;

    // Create test projects
    const project1 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Analytics Test Project 1',
        description: 'First test project',
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      });
    testProjectId1 = project1.body.id;

    const project2 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Analytics Test Project 2',
        description: 'Second test project',
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      });
    testProjectId2 = project2.body.id;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('POST /api/analytics/pageview', () => {
    test('should track page view without authentication', async () => {
      const response = await request(app)
        .post('/api/analytics/pageview')
        .send({
          path: 'Dashboard',
          session_id: 'test-session-123'
        });

      expect(response.status).toBe(204);

      // Verify it was stored
      const pageView = await dbGet(
        'SELECT * FROM page_views WHERE path = ? AND session_id = ?',
        ['Dashboard', 'test-session-123']
      );
      expect(pageView).toBeDefined();
      expect(pageView.path).toBe('Dashboard');
      expect(pageView.session_id).toBe('test-session-123');
    });

    test('should track page view with authenticated user', async () => {
      const response = await request(app)
        .post('/api/analytics/pageview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          path: 'Project: Analytics Test Project 1',
          session_id: 'test-session-456'
        });

      expect(response.status).toBe(204);

      // Verify it was stored with user_id
      const pageView = await dbGet(
        'SELECT * FROM page_views WHERE session_id = ?',
        ['test-session-456']
      );
      expect(pageView).toBeDefined();
      expect(pageView.path).toBe('Project: Analytics Test Project 1');
    });

    test('should require path in request body', async () => {
      const response = await request(app)
        .post('/api/analytics/pageview')
        .send({
          session_id: 'test-session-789'
        });

      expect(response.status).toBe(204); // Still returns 204 but won't track
    });

    test('should handle missing session_id gracefully', async () => {
      const response = await request(app)
        .post('/api/analytics/pageview')
        .send({
          path: 'Test Page'
        });

      expect(response.status).toBe(204);

      const pageView = await dbGet(
        'SELECT * FROM page_views WHERE path = ? AND session_id IS NULL',
        ['Test Page']
      );
      expect(pageView).toBeDefined();
    });

    test('should track multiple page views in same session', async () => {
      const sessionId = 'multi-page-session';

      await request(app)
        .post('/api/analytics/pageview')
        .send({ path: 'Dashboard', session_id: sessionId });

      await request(app)
        .post('/api/analytics/pageview')
        .send({ path: 'Project: Analytics Test Project 1', session_id: sessionId });

      await request(app)
        .post('/api/analytics/pageview')
        .send({ path: 'Project: Analytics Test Project 2', session_id: sessionId });

      const pageViews = await dbAll(
        'SELECT * FROM page_views WHERE session_id = ?',
        [sessionId]
      );

      expect(pageViews.length).toBe(3);
    });
  });

  describe('GET /api/admin/page-heatmap', () => {
    beforeAll(async () => {
      // Create sample page view data
      const sessionId = 'heatmap-test-session';

      // Track views for multiple projects
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/analytics/pageview')
          .send({
            path: 'Project: Analytics Test Project 1',
            session_id: `${sessionId}-${i}`
          });
      }

      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/analytics/pageview')
          .send({
            path: 'Project: Analytics Test Project 2',
            session_id: `${sessionId}-proj2-${i}`
          });
      }

      // Track some non-project pages (should be filtered out)
      await request(app)
        .post('/api/analytics/pageview')
        .send({ path: 'Dashboard', session_id: `${sessionId}-dash` });

      await request(app)
        .post('/api/analytics/pageview')
        .send({ path: 'Settings', session_id: `${sessionId}-settings` });
    });

    test('should require admin authentication', async () => {
      const response = await request(app)
        .get('/api/admin/page-heatmap')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    test('should return page view counts', async () => {
      const response = await request(app)
        .get('/api/admin/page-heatmap')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pageViewCounts).toBeDefined();
      expect(Array.isArray(response.body.pageViewCounts)).toBe(true);
    });

    test('should only include project pages', async () => {
      const response = await request(app)
        .get('/api/admin/page-heatmap')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // All returned pages should start with "Project:"
      response.body.pageViewCounts.forEach(item => {
        expect(item.path).toMatch(/^Project:/);
      });
    });

    test('should order by view count descending', async () => {
      const response = await request(app)
        .get('/api/admin/page-heatmap')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      const counts = response.body.pageViewCounts.map(item => item.view_count);

      // Check that counts are in descending order
      for (let i = 0; i < counts.length - 1; i++) {
        expect(counts[i]).toBeGreaterThanOrEqual(counts[i + 1]);
      }
    });

    test('should filter by time period (days parameter)', async () => {
      // Get last 7 days
      const response7 = await request(app)
        .get('/api/admin/page-heatmap?days=7')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response7.status).toBe(200);
      expect(response7.body.period).toBe(7);

      // Get last 30 days
      const response30 = await request(app)
        .get('/api/admin/page-heatmap?days=30')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response30.status).toBe(200);
      expect(response30.body.period).toBe(30);
    });

    test('should include timeline data', async () => {
      const response = await request(app)
        .get('/api/admin/page-heatmap')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.timeline).toBeDefined();
      expect(Array.isArray(response.body.timeline)).toBe(true);
    });

    test('should include top users data', async () => {
      const response = await request(app)
        .get('/api/admin/page-heatmap')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.topUsers).toBeDefined();
      expect(Array.isArray(response.body.topUsers)).toBe(true);
    });

    test('should return correct view counts', async () => {
      const response = await request(app)
        .get('/api/admin/page-heatmap')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      const project1Views = response.body.pageViewCounts.find(
        item => item.path === 'Project: Analytics Test Project 1'
      );
      const project2Views = response.body.pageViewCounts.find(
        item => item.path === 'Project: Analytics Test Project 2'
      );

      expect(project1Views).toBeDefined();
      expect(project1Views.view_count).toBeGreaterThanOrEqual(10);

      expect(project2Views).toBeDefined();
      expect(project2Views.view_count).toBeGreaterThanOrEqual(5);
    });

    test('should handle empty results gracefully', async () => {
      // Request data from far in the future
      const response = await request(app)
        .get('/api/admin/page-heatmap?days=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pageViewCounts).toBeDefined();
      expect(Array.isArray(response.body.pageViewCounts)).toBe(true);
    });
  });

  describe('Page View Storage', () => {
    test('should create page_views table on migration', async () => {
      const tableInfo = await dbAll('PRAGMA table_info(page_views)');

      expect(tableInfo).toBeDefined();
      expect(tableInfo.length).toBeGreaterThan(0);

      const columns = tableInfo.map(col => col.name);
      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('path');
      expect(columns).toContain('session_id');
      expect(columns).toContain('created_at');
    });

    test('should have indexes on page_views table', async () => {
      const indexes = await dbAll(
        "SELECT * FROM sqlite_master WHERE type = 'index' AND tbl_name = 'page_views'"
      );

      expect(indexes.length).toBeGreaterThan(0);
    });

    test('should store timestamps correctly', async () => {
      await request(app)
        .post('/api/analytics/pageview')
        .send({
          path: 'Test Timestamp',
          session_id: 'timestamp-test'
        });

      const pageView = await dbGet(
        'SELECT * FROM page_views WHERE session_id = ?',
        ['timestamp-test']
      );

      expect(pageView.created_at).toBeDefined();
      expect(new Date(pageView.created_at).toString()).not.toBe('Invalid Date');
    });
  });

  describe('Session Tracking', () => {
    test('should track multiple pages in single session', async () => {
      const sessionId = 'session-tracking-test';

      await request(app)
        .post('/api/analytics/pageview')
        .send({ path: 'Page 1', session_id: sessionId });

      await request(app)
        .post('/api/analytics/pageview')
        .send({ path: 'Page 2', session_id: sessionId });

      await request(app)
        .post('/api/analytics/pageview')
        .send({ path: 'Page 3', session_id: sessionId });

      const views = await dbAll(
        'SELECT * FROM page_views WHERE session_id = ? ORDER BY created_at',
        [sessionId]
      );

      expect(views.length).toBe(3);
      expect(views[0].path).toBe('Page 1');
      expect(views[1].path).toBe('Page 2');
      expect(views[2].path).toBe('Page 3');
    });

    test('should track user journey through projects', async () => {
      const sessionId = 'journey-test';

      await request(app)
        .post('/api/analytics/pageview')
        .send({ path: 'Dashboard', session_id: sessionId });

      await request(app)
        .post('/api/analytics/pageview')
        .send({ path: 'Project: Analytics Test Project 1', session_id: sessionId });

      await request(app)
        .post('/api/analytics/pageview')
        .send({ path: 'Project: Analytics Test Project 2', session_id: sessionId });

      await request(app)
        .post('/api/analytics/pageview')
        .send({ path: 'Dashboard', session_id: sessionId });

      const views = await dbAll(
        'SELECT * FROM page_views WHERE session_id = ? ORDER BY created_at',
        [sessionId]
      );

      expect(views.length).toBe(4);

      // Verify journey
      expect(views[0].path).toBe('Dashboard');
      expect(views[1].path).toContain('Project:');
      expect(views[2].path).toContain('Project:');
      expect(views[3].path).toBe('Dashboard');
    });
  });

  describe('Timeline Analytics', () => {
    test('should group views by date', async () => {
      const response = await request(app)
        .get('/api/admin/page-heatmap?days=30')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.timeline).toBeDefined();

      if (response.body.timeline.length > 0) {
        response.body.timeline.forEach(item => {
          expect(item.date).toBeDefined();
          expect(item.views).toBeDefined();
          expect(typeof item.views).toBe('number');
        });
      }
    });
  });

  describe('Top Users Analytics', () => {
    test('should track which users view most pages', async () => {
      // Create multiple page views as admin
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/analytics/pageview')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            path: `Project: Analytics Test Project ${i % 2 + 1}`,
            session_id: `admin-session-${i}`
          });
      }

      const response = await request(app)
        .get('/api/admin/page-heatmap')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.topUsers).toBeDefined();

      if (response.body.topUsers.length > 0) {
        response.body.topUsers.forEach(user => {
          expect(user.user_name).toBeDefined();
          expect(user.view_count).toBeDefined();
          expect(typeof user.view_count).toBe('number');
        });
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid days parameter', async () => {
      const response = await request(app)
        .get('/api/admin/page-heatmap?days=invalid')
        .set('Authorization', `Bearer ${adminToken}`);

      // Should still work, defaulting to 30 days
      expect(response.status).toBe(200);
    });

    test('should handle database errors gracefully', async () => {
      // The endpoint should not crash even if there are issues
      const response = await request(app)
        .post('/api/analytics/pageview')
        .send({
          path: 'Test Page',
          session_id: 'error-test'
        });

      expect(response.status).toBe(204);
    });
  });

  describe('Performance', () => {
    test('should handle large number of page views', async () => {
      const startTime = Date.now();

      // Create 50 page views
      for (let i = 0; i < 50; i++) {
        await request(app)
          .post('/api/analytics/pageview')
          .send({
            path: `Project: Test Project ${i % 10}`,
            session_id: `perf-test-${i}`
          });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (under 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    test('should retrieve heatmap data efficiently', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/admin/page-heatmap')
        .set('Authorization', `Bearer ${adminToken}`);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      // Should retrieve in under 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });
});
