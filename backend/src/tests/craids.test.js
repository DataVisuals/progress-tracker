const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-craids.db');

let app, adminToken;
let testProjectId, testCraidId;

describe('CRAIDs API Tests', () => {
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
      email: 'admin@craids.test',
      password: 'admin123'
    });
    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@craids.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@craids.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Project for CRAIDs',
        description: 'Testing CRAIDs'
      });
    testProjectId = projectResponse.body.id;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/projects/:projectId/craids', () => {
    test('should retrieve all CRAIDs for a project', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/craids`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return empty array for project with no CRAIDs', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/craids`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(0);
    });
  });

  describe('POST /api/projects/:projectId/craids', () => {
    test('should create a CRAID item', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/craids`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'risk',
          title: 'Test risk item',
          description: 'Detailed description of the risk',
          status: 'open',
          priority: 'high'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      testCraidId = response.body.id;

      // Verify CRAID was created
      const craidsResponse = await request(app)
        .get(`/api/projects/${testProjectId}/craids`);

      expect(craidsResponse.body.length).toBe(1);
      expect(craidsResponse.body[0].title).toBe('Test risk item');
    });

    test('should create CRAIDs of different types', async () => {
      const types = ['constraint', 'assumption', 'issue', 'dependency'];

      for (const type of types) {
        const response = await request(app)
          .post(`/api/projects/${testProjectId}/craids`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            type: type,
            title: `Test ${type} item`,
            description: `Detailed description of ${type}`,
            status: 'open',
            priority: 'medium'
          });

        expect(response.status).toBe(200);
      }

      // Verify all CRAIDs were created
      const craidsResponse = await request(app)
        .get(`/api/projects/${testProjectId}/craids`);

      expect(craidsResponse.body.length).toBe(5);
    });

    test('should reject CRAID without type', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/craids`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'No type specified'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Type');
    });

    test('should reject CRAID without title', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/craids`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'risk',
          description: 'No title provided'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Title');
    });

    test('should reject CRAID creation without authentication', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/craids`)
        .send({
          type: 'risk',
          description: 'Unauthorized CRAID'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/craids/:id', () => {
    test('should update CRAID item', async () => {
      const response = await request(app)
        .put(`/api/craids/${testCraidId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'risk',
          title: 'Updated risk title',
          description: 'Updated risk description',
          status: 'in_progress',
          priority: 'critical'
        });

      expect(response.status).toBe(200);

      // Verify update
      const craidsResponse = await request(app)
        .get(`/api/projects/${testProjectId}/craids`);

      const craid = craidsResponse.body.find(c => c.id === testCraidId);
      expect(craid.title).toBe('Updated risk title');
      expect(craid.description).toBe('Updated risk description');
      expect(craid.priority).toBe('critical');
      expect(craid.status).toBe('in_progress');
    });

    test('should reject update without title', async () => {
      const response = await request(app)
        .put(`/api/craids/${testCraidId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '',  // Empty title should be rejected
          description: 'Missing title'
        });

      expect(response.status).toBe(400);
    });

    test('should reject update of non-existent CRAID', async () => {
      const response = await request(app)
        .put('/api/craids/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'risk',
          description: 'Should fail'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/craids/:id', () => {
    test('should delete CRAID item', async () => {
      const response = await request(app)
        .delete(`/api/craids/${testCraidId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify deletion
      const craidsResponse = await request(app)
        .get(`/api/projects/${testProjectId}/craids`);

      const craid = craidsResponse.body.find(c => c.id === testCraidId);
      expect(craid).toBeUndefined();
    });

    test('should reject deletion without authentication', async () => {
      const response = await request(app)
        .delete('/api/craids/999');

      expect(response.status).toBe(401);
    });

    test('should handle deleting non-existent CRAID', async () => {
      const response = await request(app)
        .delete('/api/craids/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });
});
