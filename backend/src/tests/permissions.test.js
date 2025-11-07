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
    process.env.DB_PATH = TEST_DB_PATH;
    app = require('../server');

    const { dbRun, dbGet } = require('../db');

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
        .send({ userId: editorUserId });

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
        .send({ userId: editorUserId });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already');
    });

    test('should reject permission grant as non-admin', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/permissions`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ userId: viewerUserId });

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
        .send({ userId: viewerUserId });

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
});
