const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-user-activity.db');

let app, adminToken, editorToken, viewerToken;
let testProjectId;

describe('User Activity Report API Tests', () => {
  beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.NODE_ENV = 'test';
    const { createApp } = require('../server');
    const { app: testApp, dbRun, dbGet } = createApp(TEST_DB_PATH);
    app = testApp;

    // Create admin user
    await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      email: 'admin@activity.test',
      password: 'admin123'
    });
    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@activity.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@activity.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create editor user
    await request(app).post('/api/auth/register').send({
      name: 'Editor User',
      email: 'editor@activity.test',
      password: 'editor123'
    });
    const editorUser = await dbGet('SELECT * FROM users WHERE email = ?', ['editor@activity.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['editor', editorUser.id]);
    const editorLogin = await request(app).post('/api/auth/login').send({
      email: 'editor@activity.test',
      password: 'editor123'
    });
    editorToken = editorLogin.body.token;

    // Create viewer user
    await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@activity.test',
      password: 'viewer123'
    });
    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: 'viewer@activity.test',
      password: 'viewer123'
    });
    viewerToken = viewerLogin.body.token;

    // Create some activity to track
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Activity Test Project',
        description: 'Testing user activity',
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      });
    testProjectId = projectResponse.body.id;

    // Create a metric
    const metricResponse = await request(app)
      .post('/api/metrics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project_id: testProjectId,
        name: 'Test Metric',
        type: 'count',
        unit: 'items'
      });

    // Create some activity with editor
    await request(app)
      .put(`/api/projects/${testProjectId}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        name: 'Updated Activity Test Project',
        description: 'Updated by editor'
      });
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/admin/user-activity', () => {
    test('should retrieve user activity report as admin', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('activityBreakdown');
      expect(response.body).toHaveProperty('activityTypes');
      expect(response.body).toHaveProperty('timeline');
      expect(response.body).toHaveProperty('period');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(Array.isArray(response.body.activityBreakdown)).toBe(true);
      expect(Array.isArray(response.body.activityTypes)).toBe(true);
    });

    test('should reject request from non-admin user', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity')
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    test('should reject request from viewer', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
    });

    test('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity');

      expect(response.status).toBe(401);
    });

    test('should filter by days parameter', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity?days=7')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.period).toBe(7);
    });

    test('should return activity breakdown per user', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Should have at least admin and editor activity
      expect(response.body.activityBreakdown.length).toBeGreaterThan(0);

      response.body.activityBreakdown.forEach(user => {
        expect(user).toHaveProperty('user_name');
        expect(user).toHaveProperty('activities');
        expect(typeof user.activities).toBe('object');
      });
    });

    test('should return correct activity types', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Should have at least CREATE and UPDATE for projects
      const activityTypes = response.body.activityTypes;
      expect(activityTypes.some(t => t.includes('projects'))).toBe(true);
    });

    test('should return users ranked by total activity', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify users array contains activity counts
      response.body.users.forEach(user => {
        expect(user).toHaveProperty('user_name');
        expect(user).toHaveProperty('total_activity');
        expect(typeof user.total_activity).toBe('number');
      });

      // Verify sorted by total_activity descending
      for (let i = 0; i < response.body.users.length - 1; i++) {
        expect(response.body.users[i].total_activity >= response.body.users[i + 1].total_activity).toBe(true);
      }
    });

    test('should include timeline data', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.timeline)).toBe(true);

      if (response.body.timeline.length > 0) {
        response.body.timeline.forEach(entry => {
          expect(entry).toHaveProperty('date');
          expect(entry).toHaveProperty('user_name');
          expect(entry).toHaveProperty('count');
        });
      }
    });

    test('should accept different day ranges', async () => {
      const ranges = [7, 30, 90, 365];

      for (const days of ranges) {
        const response = await request(app)
          .get(`/api/admin/user-activity?days=${days}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.period).toBe(days);
      }
    });

    test('should default to 30 days if not specified', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.period).toBe(30);
    });
  });
});
