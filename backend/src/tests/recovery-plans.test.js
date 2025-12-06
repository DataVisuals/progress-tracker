const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-recovery-plans.db');

let app, adminToken, pmToken, viewerToken, dbGet, dbRun;
let testProjectId, testRecoveryPlanId;

describe('Recovery Plans API Tests', () => {
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
      email: 'admin@recovery.test',
      password: 'admin123'
    });

    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@recovery.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@recovery.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create PM user
    await request(app).post('/api/auth/register').send({
      name: 'PM User',
      email: 'pm@recovery.test',
      password: 'pm123'
    });

    const pmUser = await dbGet('SELECT * FROM users WHERE email = ?', ['pm@recovery.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['pm', pmUser.id]);

    const pmLogin = await request(app).post('/api/auth/login').send({
      email: 'pm@recovery.test',
      password: 'pm123'
    });
    pmToken = pmLogin.body.token;

    // Create viewer user
    await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@recovery.test',
      password: 'viewer123'
    });

    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: 'viewer@recovery.test',
      password: 'viewer123'
    });
    viewerToken = viewerLogin.body.token;

    // Create a test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        name: 'Recovery Plan Test Project',
        description: 'Project for recovery plan testing'
      });
    testProjectId = projectResponse.body.id;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/recovery-plans', () => {
    it('should return list of recovery plans without authentication', async () => {
      const response = await request(app)
        .get('/api/recovery-plans')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter recovery plans by project', async () => {
      // Create a recovery plan first
      await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          project_id: testProjectId,
          title: 'Test Recovery Plan',
          description: 'Recovery plan description',
          status: 'active'
        });

      const response = await request(app)
        .get(`/api/recovery-plans?projectId=${testProjectId}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].project_id).toBe(testProjectId);
    });

    it('should return recovery plans with correct structure', async () => {
      const response = await request(app)
        .get(`/api/recovery-plans?projectId=${testProjectId}`)
        .expect(200);

      if (response.body.length > 0) {
        const plan = response.body[0];
        expect(plan).toHaveProperty('id');
        expect(plan).toHaveProperty('project_id');
        expect(plan).toHaveProperty('title');
        expect(plan).toHaveProperty('description');
        expect(plan).toHaveProperty('status');
        expect(plan).toHaveProperty('created_at');
        expect(plan).toHaveProperty('created_by');
      }
    });

    it('should include creator information when authenticated', async () => {
      const response = await request(app)
        .get(`/api/recovery-plans?projectId=${testProjectId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .expect(200);

      if (response.body.length > 0) {
        const plan = response.body[0];
        expect(plan).toHaveProperty('creator_name');
      }
    });
  });

  describe('POST /api/recovery-plans', () => {
    it('should create recovery plan with PM token', async () => {
      const response = await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          project_id: testProjectId,
          title: 'New Recovery Plan',
          description: 'Detailed recovery plan description',
          status: 'active'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('New Recovery Plan');
      expect(response.body.description).toBe('Detailed recovery plan description');
      expect(response.body.status).toBe('active');
      testRecoveryPlanId = response.body.id;
    });

    it('should create recovery plan with admin token', async () => {
      const response = await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project_id: testProjectId,
          title: 'Admin Recovery Plan',
          description: 'Created by admin',
          status: 'pending'
        })
        .expect(201);

      expect(response.body.title).toBe('Admin Recovery Plan');
      expect(response.body.status).toBe('pending');
    });

    it('should reject creation with viewer token', async () => {
      await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          project_id: testProjectId,
          title: 'Viewer Recovery Plan',
          description: 'Should not be created',
          status: 'active'
        })
        .expect(403);
    });

    it('should reject creation without authentication', async () => {
      await request(app)
        .post('/api/recovery-plans')
        .send({
          project_id: testProjectId,
          title: 'Unauthorized Plan',
          description: 'Should not be created',
          status: 'active'
        })
        .expect(401);
    });

    it('should validate required fields', async () => {
      // Missing title
      await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          project_id: testProjectId,
          description: 'No title',
          status: 'active'
        })
        .expect(400);

      // Missing project_id
      await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          title: 'No Project',
          description: 'No project ID',
          status: 'active'
        })
        .expect(400);
    });

    it('should validate status values', async () => {
      await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          project_id: testProjectId,
          title: 'Invalid Status Plan',
          description: 'Invalid status value',
          status: 'invalid_status'
        })
        .expect(400);
    });

    it('should handle non-existent project', async () => {
      await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          project_id: 99999,
          title: 'Non-existent Project Plan',
          description: 'Project does not exist',
          status: 'active'
        })
        .expect(404);
    });
  });

  describe('PUT /api/recovery-plans/:id', () => {
    it('should update recovery plan with PM token', async () => {
      const response = await request(app)
        .put(`/api/recovery-plans/${testRecoveryPlanId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          title: 'Updated Recovery Plan',
          description: 'Updated description',
          status: 'completed'
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Recovery Plan');
      expect(response.body.description).toBe('Updated description');
      expect(response.body.status).toBe('completed');
    });

    it('should update recovery plan with admin token', async () => {
      const response = await request(app)
        .put(`/api/recovery-plans/${testRecoveryPlanId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'active'
        })
        .expect(200);

      expect(response.body.status).toBe('active');
    });

    it('should reject update with viewer token', async () => {
      await request(app)
        .put(`/api/recovery-plans/${testRecoveryPlanId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Viewer Update'
        })
        .expect(403);
    });

    it('should reject update without authentication', async () => {
      await request(app)
        .put(`/api/recovery-plans/${testRecoveryPlanId}`)
        .send({
          title: 'Unauthorized Update'
        })
        .expect(401);
    });

    it('should handle non-existent recovery plan', async () => {
      await request(app)
        .put('/api/recovery-plans/99999')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          title: 'Update Non-existent'
        })
        .expect(404);
    });

    it('should allow partial updates', async () => {
      const response = await request(app)
        .put(`/api/recovery-plans/${testRecoveryPlanId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          description: 'Only updating description'
        })
        .expect(200);

      expect(response.body.description).toBe('Only updating description');
      expect(response.body.title).toBeTruthy(); // Title should remain unchanged
    });

    it('should track updated_at timestamp', async () => {
      const before = await request(app)
        .get(`/api/recovery-plans?projectId=${testProjectId}`)
        .set('Authorization', `Bearer ${pmToken}`);

      const planBefore = before.body.find(p => p.id === testRecoveryPlanId);
      const updatedAtBefore = planBefore.updated_at;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      await request(app)
        .put(`/api/recovery-plans/${testRecoveryPlanId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          description: 'Checking timestamp update'
        });

      const after = await request(app)
        .get(`/api/recovery-plans?projectId=${testProjectId}`)
        .set('Authorization', `Bearer ${pmToken}`);

      const planAfter = after.body.find(p => p.id === testRecoveryPlanId);
      expect(planAfter.updated_at).not.toBe(updatedAtBefore);
    });
  });

  describe('DELETE /api/recovery-plans/:id', () => {
    let deletePlanId;

    beforeEach(async () => {
      // Create a recovery plan to delete
      const response = await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          project_id: testProjectId,
          title: 'Plan to Delete',
          description: 'Will be deleted',
          status: 'active'
        });
      deletePlanId = response.body.id;
    });

    it('should delete recovery plan with PM token', async () => {
      await request(app)
        .delete(`/api/recovery-plans/${deletePlanId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .expect(200);

      // Verify deletion
      const plans = await request(app)
        .get(`/api/recovery-plans?projectId=${testProjectId}`);
      const deleted = plans.body.find(p => p.id === deletePlanId);
      expect(deleted).toBeUndefined();
    });

    it('should delete recovery plan with admin token', async () => {
      await request(app)
        .delete(`/api/recovery-plans/${deletePlanId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should reject deletion with viewer token', async () => {
      await request(app)
        .delete(`/api/recovery-plans/${deletePlanId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });

    it('should reject deletion without authentication', async () => {
      await request(app)
        .delete(`/api/recovery-plans/${deletePlanId}`)
        .expect(401);
    });

    it('should handle deletion of non-existent plan', async () => {
      await request(app)
        .delete('/api/recovery-plans/99999')
        .set('Authorization', `Bearer ${pmToken}`)
        .expect(404);
    });
  });

  describe('Recovery Plan Status Workflow', () => {
    let workflowPlanId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          project_id: testProjectId,
          title: 'Workflow Test Plan',
          description: 'Testing status workflow',
          status: 'pending'
        });
      workflowPlanId = response.body.id;
    });

    it('should transition from pending to active', async () => {
      const response = await request(app)
        .put(`/api/recovery-plans/${workflowPlanId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          status: 'active'
        })
        .expect(200);

      expect(response.body.status).toBe('active');
    });

    it('should transition from active to completed', async () => {
      // First set to active
      await request(app)
        .put(`/api/recovery-plans/${workflowPlanId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          status: 'active'
        });

      // Then complete
      const response = await request(app)
        .put(`/api/recovery-plans/${workflowPlanId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          status: 'completed'
        })
        .expect(200);

      expect(response.body.status).toBe('completed');
    });

    it('should allow cancellation at any stage', async () => {
      const response = await request(app)
        .put(`/api/recovery-plans/${workflowPlanId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          status: 'cancelled'
        })
        .expect(200);

      expect(response.body.status).toBe('cancelled');
    });
  });
});