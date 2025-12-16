const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-dependencies.db');

let app, adminToken, pmToken, viewerToken, dbGet, dbRun;
let testProjectId, dependentProjectId;

describe('Project Dependencies API Tests', () => {
  beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.NODE_ENV = 'test';
    const { createApp } = require('../server');
    const result = createApp(TEST_DB_PATH);
    app = result.app;
    dbGet = result.dbGet;
    dbRun = result.dbRun;

    // Create users
    await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      email: 'admin@dependencies.test',
      password: 'admin123'
    });

    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@dependencies.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@dependencies.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create PM user
    await request(app).post('/api/auth/register').send({
      name: 'PM User',
      email: 'pm@dependencies.test',
      password: 'pm123'
    });

    const pmUser = await dbGet('SELECT * FROM users WHERE email = ?', ['pm@dependencies.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['pm', pmUser.id]);

    const pmLogin = await request(app).post('/api/auth/login').send({
      email: 'pm@dependencies.test',
      password: 'pm123'
    });
    pmToken = pmLogin.body.token;

    // Create viewer user
    await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@dependencies.test',
      password: 'viewer123'
    });

    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: 'viewer@dependencies.test',
      password: 'viewer123'
    });
    viewerToken = viewerLogin.body.token;

    // Create test projects
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        name: 'Main Project',
        description: 'Project with dependencies',
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      });
    testProjectId = projectResponse.body.id;

    const dependentResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        name: 'Dependent Project',
        description: 'This project depends on main project',
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      });
    dependentProjectId = dependentResponse.body.id;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/projects/:projectId/dependencies', () => {
    it('should return empty array for project without dependencies', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/dependencies`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it('should return dependencies after creation', async () => {
      // Create a dependency first
      await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          depends_on_project_id: dependentProjectId
        });

      const response = await request(app)
        .get(`/api/projects/${testProjectId}/dependencies`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('depends_on_project_id');
      expect(response.body[0]).toHaveProperty('project_name');
    });

    it('should include project names and portfolio info in response', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/dependencies`)
        .expect(200);

      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('project_name');
        // Portfolio fields may be null if project has no portfolio
        expect(response.body[0]).toHaveProperty('portfolio_name');
      }
    });
  });

  describe('POST /api/projects/:projectId/dependencies', () => {
    it('should create dependency with PM token', async () => {
      // Create another project for this test
      const newProjectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'New Dependent Project',
          description: 'Another dependent project',
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });

      const response = await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          depends_on_project_id: newProjectResponse.body.id
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('id');
    });

    it('should create dependency with admin token', async () => {
      const newProjectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Dependent Project',
          description: 'Created by admin',
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });

      const response = await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          depends_on_project_id: newProjectResponse.body.id
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject creation with viewer token', async () => {
      await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          depends_on_project_id: dependentProjectId
        })
        .expect(403);
    });

    it('should reject creation without authentication', async () => {
      await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .send({
          depends_on_project_id: dependentProjectId
        })
        .expect(401);
    });

    it('should prevent self-dependency', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          depends_on_project_id: testProjectId
        })
        .expect(400);

      expect(response.body.error).toContain('cannot depend on itself');
    });

    it('should prevent duplicate dependencies', async () => {
      // Create a new project for this test
      const newProject = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'Duplicate Test Project',
          description: 'For duplicate test',
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });

      // Create first dependency
      await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          depends_on_project_id: newProject.body.id
        })
        .expect(200);

      // Attempt to create duplicate
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          depends_on_project_id: newProject.body.id
        })
        .expect(400);

      expect(response.body.error).toContain('already exists');
    });

    it('should validate required field depends_on_project_id', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toContain('depends_on_project_id is required');
    });

    it('should handle non-existent dependent project', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          depends_on_project_id: 99999
        })
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('DELETE /api/projects/:projectId/dependencies/:dependencyId', () => {
    let deleteDependencyId;

    beforeEach(async () => {
      // Create a new project and dependency for each test
      const newProject = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: `Delete Test Project ${Date.now()}`,
          description: 'For deletion test',
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });

      const depResponse = await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          depends_on_project_id: newProject.body.id
        });
      deleteDependencyId = depResponse.body.id;
    });

    it('should delete dependency with PM token', async () => {
      await request(app)
        .delete(`/api/projects/${testProjectId}/dependencies/${deleteDependencyId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .expect(200);

      // Verify deletion
      const deps = await request(app)
        .get(`/api/projects/${testProjectId}/dependencies`);
      const deleted = deps.body.find(d => d.id === deleteDependencyId);
      expect(deleted).toBeUndefined();
    });

    it('should delete dependency with admin token', async () => {
      await request(app)
        .delete(`/api/projects/${testProjectId}/dependencies/${deleteDependencyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should reject deletion with viewer token', async () => {
      await request(app)
        .delete(`/api/projects/${testProjectId}/dependencies/${deleteDependencyId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });

    it('should reject deletion without authentication', async () => {
      await request(app)
        .delete(`/api/projects/${testProjectId}/dependencies/${deleteDependencyId}`)
        .expect(401);
    });

    it('should handle deletion of non-existent dependency', async () => {
      await request(app)
        .delete(`/api/projects/${testProjectId}/dependencies/99999`)
        .set('Authorization', `Bearer ${pmToken}`)
        .expect(404);
    });

    it('should handle mismatched project and dependency', async () => {
      // Try to delete dependency using wrong project ID
      await request(app)
        .delete(`/api/projects/${dependentProjectId}/dependencies/${deleteDependencyId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .expect(404);
    });
  });
});
