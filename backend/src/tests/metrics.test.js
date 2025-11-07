const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-metrics.db');

let app, adminToken;
let testProjectId, testMetricId;

describe('Metrics API Tests', () => {
  beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.NODE_ENV = 'test';
    process.env.DB_PATH = TEST_DB_PATH;
    app = require('../server');

    // Create admin user
    await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      email: 'admin@metrics.test',
      password: 'admin123'
    });

    const { dbRun, dbGet } = require('../db');
    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@metrics.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@metrics.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create a test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Project for Metrics',
        description: 'A project to test metrics',
        initiative_manager: 'Admin User',
        start_date: '2024-01-01',
        end_date: '2024-12-31'
      });

    testProjectId = projectResponse.body.id;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('POST /api/projects/:projectId/metrics', () => {
    test('should create a metric', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Metric',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 100,
          amber_tolerance: 5.0,
          red_tolerance: 10.0,
          metric_type: 'lead'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      testMetricId = response.body.id;
    });

    test('should reject metric creation without authentication', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .send({
          name: 'Unauthorized Metric',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          frequency: 'monthly'
        });

      expect(response.status).toBe(401);
    });

    test('should reject metric creation for non-existent project', async () => {
      const response = await request(app)
        .post('/api/projects/99999/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Metric',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          frequency: 'monthly'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/projects/:projectId/metrics', () => {
    test('should retrieve all metrics for a project', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/metrics`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      const metric = response.body[0];
      expect(metric.name).toBe('Test Metric');
      expect(metric.frequency).toBe('monthly');
    });

    test('should return empty array for project with no metrics', async () => {
      // Create a new project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Project Without Metrics',
          description: 'No metrics here'
        });

      const response = await request(app)
        .get(`/api/projects/${projectResponse.body.id}/metrics`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('PUT /api/metrics/:id', () => {
    test('should update metric properties', async () => {
      const response = await request(app)
        .put(`/api/metrics/${testMetricId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Metric Name',
          amber_tolerance: 7.5,
          red_tolerance: 15.0,
          final_target: 150,
          metric_type: 'lag'
        });

      expect(response.status).toBe(200);

      // Verify the update
      const getResponse = await request(app)
        .get(`/api/projects/${testProjectId}/metrics`);

      const metric = getResponse.body.find(m => m.id === testMetricId);
      expect(metric.name).toBe('Updated Metric Name');
      expect(metric.amber_tolerance).toBe(7.5);
      expect(metric.metric_type).toBe('lag');
    });

    test('should reject update without fields', async () => {
      const response = await request(app)
        .put(`/api/metrics/${testMetricId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    test('should reject update of non-existent metric', async () => {
      const response = await request(app)
        .put('/api/metrics/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Non-existent'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/metrics/:metricId/periods', () => {
    test('should retrieve all periods for a metric', async () => {
      const response = await request(app)
        .get(`/api/metrics/${testMetricId}/periods`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // Should have 12 periods for monthly frequency over a year
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/metrics/:id', () => {
    test('should delete a metric', async () => {
      const response = await request(app)
        .delete(`/api/metrics/${testMetricId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify deletion
      const getResponse = await request(app)
        .get(`/api/projects/${testProjectId}/metrics`);

      const metric = getResponse.body.find(m => m.id === testMetricId);
      expect(metric).toBeUndefined();
    });

    test('should reject deletion without authentication', async () => {
      const response = await request(app)
        .delete('/api/metrics/999');

      expect(response.status).toBe(401);
    });
  });
});
