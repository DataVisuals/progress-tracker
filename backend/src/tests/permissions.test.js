const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-permissions.db');

let app, adminToken, pmToken, editorToken, viewerToken;
let testProjectId;
let adminUserId, pmUserId, editorUserId, viewerUserId;

describe('Project Permissions API Tests', () => {
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
      email: 'admin@perms.test',
      password: 'admin123'
    });
    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@perms.test']);
    adminUserId = adminUser.id;
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUserId]);
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@perms.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create PM user
    await request(app).post('/api/auth/register').send({
      name: 'PM User',
      email: 'pm@perms.test',
      password: 'pm123'
    });
    const pmUser = await dbGet('SELECT * FROM users WHERE email = ?', ['pm@perms.test']);
    pmUserId = pmUser.id;
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['pm', pmUserId]);
    const pmLogin = await request(app).post('/api/auth/login').send({
      email: 'pm@perms.test',
      password: 'pm123'
    });
    pmToken = pmLogin.body.token;

    // Create editor user
    await request(app).post('/api/auth/register').send({
      name: 'Editor User',
      email: 'editor@perms.test',
      password: 'editor123'
    });
    const editorUser = await dbGet('SELECT * FROM users WHERE email = ?', ['editor@perms.test']);
    editorUserId = editorUser.id;
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['editor', editorUserId]);
    const editorLogin = await request(app).post('/api/auth/login').send({
      email: 'editor@perms.test',
      password: 'editor123'
    });
    editorToken = editorLogin.body.token;

    // Create viewer user
    await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@perms.test',
      password: 'viewer123'
    });
    const viewerUser = await dbGet('SELECT * FROM users WHERE email = ?', ['viewer@perms.test']);
    viewerUserId = viewerUser.id;
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['viewer', viewerUserId]);
    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: 'viewer@perms.test',
      password: 'viewer123'
    });
    viewerToken = viewerLogin.body.token;

    // Create a test project as admin
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Project for Permissions',
        description: 'Testing permissions'
      });
    testProjectId = projectResponse.body.id;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/projects/:projectId/permissions', () => {
    test('should get project permissions as admin', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should reject permissions request without authentication', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/permissions`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/projects/:projectId/permissions', () => {
    test('should grant project permission as admin', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: editorUserId });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('granted');

      // Verify permission was granted
      const permsResponse = await request(app)
        .get(`/api/projects/${testProjectId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`);

      const hasPermission = permsResponse.body.some(p => p.user_id === editorUserId);
      expect(hasPermission).toBe(true);
    });

    test('should reject duplicate permission grant', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: editorUserId });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already');
    });

    test('should reject permission grant as non-admin', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/permissions`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ user_id: viewerUserId });

      expect(response.status).toBe(403);
    });

    test('should reject permission grant without userId', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/projects/:projectId/permissions/:userId', () => {
    test('should reject permission revocation as non-admin', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProjectId}/permissions/${editorUserId}`)
        .set('Authorization', `Bearer ${pmToken}`);

      expect(response.status).toBe(403);
    });

    test('should revoke project permission as admin', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProjectId}/permissions/${editorUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify permission was revoked
      const permsResponse = await request(app)
        .get(`/api/projects/${testProjectId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`);

      const hasPermission = permsResponse.body.some(p => p.user_id === editorUserId);
      expect(hasPermission).toBe(false);
    });

    test('should handle revoking non-existent permission', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProjectId}/permissions/99999`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Permission-based project editing', () => {
    test('should allow admin to edit any project', async () => {
      const response = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated by Admin',
          description: 'Admin edit'
        });

      expect(response.status).toBe(200);
    });

    test('should reject editor without permission from editing', async () => {
      const response = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          name: 'Should Fail',
          description: 'No permission'
        });

      expect(response.status).toBe(403);
    });

    test('should reject viewer from editing even with permission', async () => {
      // Grant permission to viewer
      await request(app)
        .post(`/api/projects/${testProjectId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: viewerUserId });

      const response = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          name: 'Should Fail',
          description: 'Viewer cannot edit'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Historic Data Edit Permissions', () => {
    let testMetricId, historicPeriodId;

    beforeAll(async () => {
      // Create a metric with a period that's in the past
      const metricResponse = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Historic Edit Test Metric',
          start_date: '2020-01-01',
          end_date: '2020-12-31',
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 100
        });

      testMetricId = metricResponse.body.id;

      // Create a historic period (in the past)
      const periodResponse = await request(app)
        .post('/api/metric-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          metric_id: testMetricId,
          reporting_date: '2020-06-01', // Date in the past
          expected: 50,
          target: 100,
          complete: 40
        });

      historicPeriodId = periodResponse.body.id;
    });

    test('should reject historic edit from viewer (403, not 401)', async () => {
      // Grant permission to viewer so they can access the project
      // Note: viewer gets 403 because viewers can't edit at all, not specifically for historic edits
      await request(app)
        .post(`/api/projects/${testProjectId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: viewerUserId });

      const response = await request(app)
        .put(`/api/metric-periods/${historicPeriodId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ complete: 45 });

      // Should get 403 (not authorized), not 401 (not authenticated)
      expect(response.status).toBe(403);
      // Viewers get rejected before the historic edit check, so error won't mention historic edits
      expect(response.body.error).toContain('do not have permission');

      // Verify user token is still valid (didn't get logged out)
      const profileCheck = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(profileCheck.status).toBe(200);
      expect(profileCheck.body.email).toBe('viewer@perms.test');
    });

    test('should allow historic edit from PM user', async () => {
      // Grant PM user permission to the project
      await request(app)
        .post(`/api/projects/${testProjectId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: pmUserId });

      const response = await request(app)
        .put(`/api/metric-periods/${historicPeriodId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ complete: 50 });

      expect(response.status).toBe(200);

      // Verify the edit was saved
      const { createApp } = require('../server');
      const { dbGet } = createApp(TEST_DB_PATH);
      const period = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [historicPeriodId]);

      expect(period.complete).toBe(50);
    });

    test('should allow historic edit from editor user', async () => {
      // Grant permission to editor
      await request(app)
        .post(`/api/projects/${testProjectId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: editorUserId });

      const response = await request(app)
        .put(`/api/metric-periods/${historicPeriodId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ complete: 55 });

      expect(response.status).toBe(200);

      // Verify the edit was saved
      const { createApp } = require('../server');
      const { dbGet } = createApp(TEST_DB_PATH);
      const period = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [historicPeriodId]);

      expect(period.complete).toBe(55);
    });

    test('should allow historic edit from admin user', async () => {
      const response = await request(app)
        .put(`/api/metric-periods/${historicPeriodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ complete: 60 });

      expect(response.status).toBe(200);

      // Verify the edit was saved
      const { createApp } = require('../server');
      const { dbGet } = createApp(TEST_DB_PATH);
      const period = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [historicPeriodId]);

      expect(period.complete).toBe(60);
    });

    test('should allow non-historic edits from all users with permissions', async () => {
      // Create a future period
      const futurePeriodResponse = await request(app)
        .post('/api/metric-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          metric_id: testMetricId,
          reporting_date: '2099-12-01', // Far in the future
          expected: 90,
          target: 100,
          complete: 80
        });

      const futurePeriodId = futurePeriodResponse.body.id;

      // Even viewer should be able to edit future periods (if they had edit permission via role)
      // But viewers can't edit regardless, so test with editor
      const response = await request(app)
        .put(`/api/metric-periods/${futurePeriodId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ complete: 85 });

      expect(response.status).toBe(200);
    });

    test('should log historic edits clearly in audit trail', async () => {
      // Make a historic edit
      await request(app)
        .put(`/api/metric-periods/${historicPeriodId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ complete: 70 });

      // Check audit log
      const auditResponse = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(auditResponse.status).toBe(200);

      // Find the historic edit in audit log
      const historicEdit = auditResponse.body.find(log =>
        log.table_name === 'metric_periods' &&
        log.record_id === historicPeriodId &&
        log.description.includes('HISTORIC EDIT')
      );

      expect(historicEdit).toBeDefined();
      expect(historicEdit.description).toContain('⚠️ HISTORIC EDIT');
      expect(historicEdit.user_email).toBe('pm@perms.test');
    });
  });
});
