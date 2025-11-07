const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-audit.db');

let app, adminToken, editorToken;
let testProjectId;

describe('Audit Log API Tests', () => {
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
      email: 'admin@audit.test',
      password: 'admin123'
    });
    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@audit.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@audit.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create editor user
    await request(app).post('/api/auth/register').send({
      name: 'Editor User',
      email: 'editor@audit.test',
      password: 'editor123'
    });
    const editorUser = await dbGet('SELECT * FROM users WHERE email = ?', ['editor@audit.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['editor', editorUser.id]);
    const editorLogin = await request(app).post('/api/auth/login').send({
      email: 'editor@audit.test',
      password: 'editor123'
    });
    editorToken = editorLogin.body.token;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/audit', () => {
    beforeAll(async () => {
      // Create some auditable actions
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Audit Test Project',
          description: 'Testing audit logs'
        });
      testProjectId = projectResponse.body.id;

      // Update the project
      await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Audit Test Project',
          description: 'Updated description'
        });

      // Delete the project
      await request(app)
        .delete(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    test('should retrieve audit log as admin', async () => {
      const response = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Verify audit entries have required fields
      response.body.forEach(entry => {
        expect(entry).toHaveProperty('action');
        expect(entry).toHaveProperty('table_name');
        expect(entry).toHaveProperty('user_email');
        expect(entry).toHaveProperty('timestamp');
      });
    });

    test('should reject audit log request from non-admin', async () => {
      const response = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(403);
    });

    test('should reject audit log request without authentication', async () => {
      const response = await request(app)
        .get('/api/audit');

      expect(response.status).toBe(401);
    });

    test('should include CREATE, UPDATE, and DELETE actions', async () => {
      const response = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      const actions = [...new Set(response.body.map(e => e.action))];
      expect(actions).toContain('CREATE');
      expect(actions).toContain('UPDATE');
      expect(actions).toContain('DELETE');
    });

    test('should filter audit log by table_name', async () => {
      const response = await request(app)
        .get('/api/audit?table=projects')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.forEach(entry => {
        expect(entry.table_name).toBe('projects');
      });
    });

    test('should filter audit log by action', async () => {
      const response = await request(app)
        .get('/api/audit?action=CREATE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.forEach(entry => {
        expect(entry.action).toBe('CREATE');
      });
    });

    test('should include old and new values in audit entries', async () => {
      const response = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      const updateEntry = response.body.find(e =>
        e.action === 'UPDATE' && e.table_name === 'projects'
      );

      if (updateEntry) {
        expect(updateEntry.old_values).toBeTruthy();
        expect(updateEntry.new_values).toBeTruthy();

        const oldValues = JSON.parse(updateEntry.old_values);
        const newValues = JSON.parse(updateEntry.new_values);

        expect(oldValues.name).toBe('Audit Test Project');
        expect(newValues.name).toBe('Updated Audit Test Project');
      }
    });

    test('should include user information in audit entries', async () => {
      const response = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      const userEntries = response.body.filter(e => e.user_email);
      expect(userEntries.length).toBeGreaterThan(0);

      userEntries.forEach(entry => {
        expect(entry.user_email).toMatch(/@/);
      });
    });

    test('should order audit log by timestamp descending', async () => {
      const response = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      for (let i = 0; i < response.body.length - 1; i++) {
        const current = new Date(response.body[i].timestamp);
        const next = new Date(response.body[i + 1].timestamp);
        expect(current >= next).toBe(true);
      }
    });
  });

  describe('Audit log completeness', () => {
    test('should log user registration', async () => {
      await request(app).post('/api/auth/register').send({
        name: 'New Audit User',
        email: 'newaudit@test.com',
        password: 'password123'
      });

      const response = await request(app)
        .get('/api/audit?table=users&action=CREATE')
        .set('Authorization', `Bearer ${adminToken}`);

      const registrationEntry = response.body.find(e =>
        e.new_values && JSON.parse(e.new_values).email === 'newaudit@test.com'
      );

      expect(registrationEntry).toBeDefined();
    });

    test('should log project creation', async () => {
      const projectName = 'Audit Logged Project';
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: projectName,
          description: 'For audit testing'
        });

      const response = await request(app)
        .get('/api/audit?table=projects&action=CREATE')
        .set('Authorization', `Bearer ${adminToken}`);

      const projectEntry = response.body.find(e =>
        e.new_values && JSON.parse(e.new_values).name === projectName
      );

      expect(projectEntry).toBeDefined();
    });

    test('should include description in audit entries', async () => {
      const response = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      const entriesWithDescription = response.body.filter(e => e.description);
      expect(entriesWithDescription.length).toBeGreaterThan(0);

      entriesWithDescription.forEach(entry => {
        expect(typeof entry.description).toBe('string');
        expect(entry.description.length).toBeGreaterThan(0);
      });
    });
  });
});
