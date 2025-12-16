const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-recovery-plans.db');

let app, adminToken, pmToken, viewerToken, dbGet, dbRun;
let testProjectId, testMetricId, testRecoveryPlanId;

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
        description: 'Project for recovery plan testing',
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      });
    testProjectId = projectResponse.body.id;

    if (!testProjectId) {
      console.error('Failed to create project:', projectResponse.body);
      throw new Error('Failed to create test project');
    }

    // Create a test metric for the project using direct DB insert
    const pmUserForMetric = await dbGet('SELECT * FROM users WHERE email = ?', ['pm@recovery.test']);
    const metricResult = await dbRun(
      `INSERT INTO metrics (project_id, name, description, owner_id, start_date, end_date, frequency, progression_type, final_target, amber_tolerance, red_tolerance, metric_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testProjectId, 'Test Metric', 'Metric for recovery plan testing', pmUserForMetric.id, '2025-01-01', '2025-12-31', 'monthly', 'linear', 100, 5.0, 10.0, 'lead']
    );
    testMetricId = metricResult.lastID;
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
          metric_id: testMetricId,
          plan_text: 'Test recovery plan'
        });

      const response = await request(app)
        .get(`/api/recovery-plans?project_id=${testProjectId}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].project_id).toBe(testProjectId);
    });

    it('should return recovery plans with correct structure', async () => {
      const response = await request(app)
        .get(`/api/recovery-plans?project_id=${testProjectId}`)
        .expect(200);

      if (response.body.length > 0) {
        const plan = response.body[0];
        expect(plan).toHaveProperty('id');
        expect(plan).toHaveProperty('project_id');
        expect(plan).toHaveProperty('metric_id');
        expect(plan).toHaveProperty('plan_text');
        expect(plan).toHaveProperty('status');
        expect(plan).toHaveProperty('created_at');
        expect(plan).toHaveProperty('created_by');
      }
    });

    it('should include creator information', async () => {
      const response = await request(app)
        .get(`/api/recovery-plans?project_id=${testProjectId}`)
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
          metric_id: testMetricId,
          plan_text: 'New recovery plan with detailed steps',
          target_recovery_date: '2025-06-30'
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.plan_text).toBe('New recovery plan with detailed steps');
      expect(response.body.status).toBe('active');
      testRecoveryPlanId = response.body.id;
    });

    it('should create recovery plan with admin token', async () => {
      const response = await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project_id: testProjectId,
          metric_id: testMetricId,
          plan_text: 'Admin created recovery plan'
        })
        .expect(200);

      expect(response.body.plan_text).toBe('Admin created recovery plan');
    });

    it('should reject creation with viewer token', async () => {
      await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          project_id: testProjectId,
          metric_id: testMetricId,
          plan_text: 'Should not be created'
        })
        .expect(403);
    });

    it('should reject creation without authentication', async () => {
      await request(app)
        .post('/api/recovery-plans')
        .send({
          project_id: testProjectId,
          metric_id: testMetricId,
          plan_text: 'Unauthorized plan'
        })
        .expect(401);
    });

    it('should validate required fields', async () => {
      // Missing plan_text
      const res1 = await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          project_id: testProjectId,
          metric_id: testMetricId
        })
        .expect(400);

      expect(res1.body.error).toContain('required');

      // Missing metric_id
      const res2 = await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          project_id: testProjectId,
          plan_text: 'No metric'
        })
        .expect(400);

      expect(res2.body.error).toContain('required');

      // Missing project_id
      const res3 = await request(app)
        .post('/api/recovery-plans')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          metric_id: testMetricId,
          plan_text: 'No project'
        })
        .expect(400);

      expect(res3.body.error).toContain('required');
    });
  });

  describe('PUT /api/recovery-plans/:id', () => {
    it('should update recovery plan with PM token', async () => {
      const response = await request(app)
        .put(`/api/recovery-plans/${testRecoveryPlanId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          plan_text: 'Updated recovery plan',
          status: 'completed',
          completion_notes: 'Successfully completed'
        })
        .expect(200);

      expect(response.body.plan_text).toBe('Updated recovery plan');
      expect(response.body.status).toBe('completed');
      expect(response.body.completion_notes).toBe('Successfully completed');
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
          plan_text: 'Viewer update'
        })
        .expect(403);
    });

    it('should reject update without authentication', async () => {
      await request(app)
        .put(`/api/recovery-plans/${testRecoveryPlanId}`)
        .send({
          plan_text: 'Unauthorized update'
        })
        .expect(401);
    });

    it('should handle non-existent recovery plan', async () => {
      await request(app)
        .put('/api/recovery-plans/99999')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          plan_text: 'Update non-existent'
        })
        .expect(404);
    });

    it('should allow partial updates', async () => {
      const response = await request(app)
        .put(`/api/recovery-plans/${testRecoveryPlanId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          target_recovery_date: '2025-12-31'
        })
        .expect(200);

      expect(response.body.target_recovery_date).toBe('2025-12-31');
      expect(response.body.plan_text).toBeTruthy(); // Plan text should remain unchanged
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
          metric_id: testMetricId,
          plan_text: 'Plan to delete'
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
        .get(`/api/recovery-plans?project_id=${testProjectId}`);
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
          metric_id: testMetricId,
          plan_text: 'Workflow test plan'
        });
      workflowPlanId = response.body.id;
    });

    it('should transition from active to completed', async () => {
      const response = await request(app)
        .put(`/api/recovery-plans/${workflowPlanId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          status: 'completed',
          completion_notes: 'Plan successfully completed'
        })
        .expect(200);

      expect(response.body.status).toBe('completed');
      expect(response.body.completed_at).toBeTruthy();
    });

    it('should allow cancellation', async () => {
      const response = await request(app)
        .put(`/api/recovery-plans/${workflowPlanId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          status: 'cancelled',
          completion_notes: 'Plan no longer needed'
        })
        .expect(200);

      expect(response.body.status).toBe('cancelled');
      expect(response.body.completed_at).toBeTruthy();
    });
  });
});
