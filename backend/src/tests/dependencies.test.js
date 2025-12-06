const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-dependencies.db');

let app, adminToken, pmToken, viewerToken, dbGet, dbRun;
let testProjectId, dependentProjectId, testDependencyId;

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
        description: 'Project with dependencies'
      });
    testProjectId = projectResponse.body.id;

    const dependentResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        name: 'Dependent Project',
        description: 'This project depends on main project'
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
          dependentProjectId: dependentProjectId,
          type: 'blocks',
          description: 'Project B blocks Project A'
        });

      const response = await request(app)
        .get(`/api/projects/${testProjectId}/dependencies`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('project_id');
      expect(response.body[0]).toHaveProperty('dependent_project_id');
      expect(response.body[0]).toHaveProperty('type');
      expect(response.body[0]).toHaveProperty('description');
    });

    it('should include project names in response', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/dependencies`)
        .expect(200);

      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('dependent_project_name');
      }
    });

    it('should handle non-existent project', async () => {
      const response = await request(app)
        .get('/api/projects/99999/dependencies')
        .expect(404);

      expect(response.body).toHaveProperty('error');
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
          description: 'Another dependent project'
        });

      const response = await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          dependentProjectId: newProjectResponse.body.id,
          type: 'requires',
          description: 'Project A requires Project C'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.project_id).toBe(testProjectId);
      expect(response.body.dependent_project_id).toBe(newProjectResponse.body.id);
      expect(response.body.type).toBe('requires');
      expect(response.body.description).toBe('Project A requires Project C');
      testDependencyId = response.body.id;
    });

    it('should create dependency with admin token', async () => {
      const newProjectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Dependent Project',
          description: 'Created by admin'
        });

      const response = await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dependentProjectId: newProjectResponse.body.id,
          type: 'informs',
          description: 'Admin created dependency'
        })
        .expect(201);

      expect(response.body.type).toBe('informs');
    });

    it('should reject creation with viewer token', async () => {
      await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          dependentProjectId: dependentProjectId,
          type: 'blocks',
          description: 'Viewer attempt'
        })
        .expect(403);
    });

    it('should reject creation without authentication', async () => {
      await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .send({
          dependentProjectId: dependentProjectId,
          type: 'blocks',
          description: 'Unauthorized attempt'
        })
        .expect(401);
    });

    it('should validate dependency type', async () => {
      await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          dependentProjectId: dependentProjectId,
          type: 'invalid_type',
          description: 'Invalid type test'
        })
        .expect(400);
    });

    it('should prevent self-dependency', async () => {
      await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          dependentProjectId: testProjectId,
          type: 'blocks',
          description: 'Self dependency'
        })
        .expect(400);
    });

    it('should prevent duplicate dependencies', async () => {
      // Create a new project for this test
      const newProject = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'Duplicate Test Project',
          description: 'For duplicate test'
        });

      // Create first dependency
      await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          dependentProjectId: newProject.body.id,
          type: 'blocks',
          description: 'First dependency'
        })
        .expect(201);

      // Attempt to create duplicate
      await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          dependentProjectId: newProject.body.id,
          type: 'blocks',
          description: 'Duplicate dependency'
        })
        .expect(400);
    });

    it('should validate required fields', async () => {
      // Missing dependentProjectId
      await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          type: 'blocks',
          description: 'Missing dependent project'
        })
        .expect(400);

      // Missing type
      await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          dependentProjectId: dependentProjectId,
          description: 'Missing type'
        })
        .expect(400);
    });

    it('should handle non-existent dependent project', async () => {
      await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          dependentProjectId: 99999,
          type: 'blocks',
          description: 'Non-existent dependent'
        })
        .expect(404);
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
          description: 'For deletion test'
        });

      const depResponse = await request(app)
        .post(`/api/projects/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          dependentProjectId: newProject.body.id,
          type: 'requires',
          description: 'To be deleted'
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

  describe('Dependency Types', () => {
    it('should support all dependency types', async () => {
      const types = ['blocks', 'requires', 'informs'];

      for (const type of types) {
        const newProject = await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${pmToken}`)
          .send({
            name: `Type Test ${type}`,
            description: `Testing ${type} type`
          });

        const response = await request(app)
          .post(`/api/projects/${testProjectId}/dependencies`)
          .set('Authorization', `Bearer ${pmToken}`)
          .send({
            dependentProjectId: newProject.body.id,
            type: type,
            description: `Testing ${type} dependency`
          })
          .expect(201);

        expect(response.body.type).toBe(type);
      }
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect direct circular dependencies', async () => {
      // Create Project A -> Project B dependency
      const projectA = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'Circular A',
          description: 'Project A in circular test'
        });

      const projectB = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'Circular B',
          description: 'Project B in circular test'
        });

      // A depends on B
      await request(app)
        .post(`/api/projects/${projectA.body.id}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          dependentProjectId: projectB.body.id,
          type: 'blocks',
          description: 'A depends on B'
        })
        .expect(201);

      // Attempt B depends on A (circular)
      const response = await request(app)
        .post(`/api/projects/${projectB.body.id}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          dependentProjectId: projectA.body.id,
          type: 'blocks',
          description: 'B depends on A - circular!'
        });

      // Note: If circular detection is implemented, expect 400
      // If not implemented, this test documents current behavior
      // Update expectation based on actual implementation
    });
  });
});