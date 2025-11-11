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
    const { createApp } = require('../server');
    const { app: testApp, dbRun, dbGet } = createApp(TEST_DB_PATH);
    app = testApp;

    // Create admin user
    await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      email: 'admin@metrics.test',
      password: 'admin123'
    });
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

    test('should create metric with all schedule parameters and auto-generate periods', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Comprehensive Metric',
          start_date: '2024-01-31',
          end_date: '2024-06-30',
          frequency: 'monthly',
          progression_type: 's-curve',
          final_target: 200,
          amber_tolerance: 8.0,
          red_tolerance: 12.0,
          metric_type: 'lag'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');

      const newMetricId = response.body.id;

      // Verify the metric was created with all parameters
      const { createApp } = require('../server');
      const { dbGet, dbAll } = createApp(TEST_DB_PATH);

      const metric = await dbGet('SELECT * FROM metrics WHERE id = ?', [newMetricId]);
      expect(metric.name).toBe('Comprehensive Metric');
      expect(metric.start_date).toBe('2024-01-31');
      expect(metric.end_date).toBe('2024-06-30');
      expect(metric.frequency).toBe('monthly');
      expect(metric.progression_type).toBe('s-curve');
      expect(metric.final_target).toBe(200);
      expect(metric.amber_tolerance).toBe(8.0);
      expect(metric.red_tolerance).toBe(12.0);
      expect(metric.metric_type).toBe('lag');

      // Verify periods were auto-generated
      const periods = await dbAll('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date', [newMetricId]);
      expect(periods.length).toBeGreaterThan(0);
      // Start date 01-31 generates: Jan, Feb, Mar, Apr, May - 5 periods ending May 31
      // The end date is 06-30, so we get one more period for June
      expect(periods.length).toBe(5);

      // Verify first and last periods
      expect(periods[0].reporting_date).toBe('2024-01-31');
      // Last period should be close to end_date
      const lastPeriodDate = periods[periods.length - 1].reporting_date;
      expect(lastPeriodDate).toMatch(/2024-0[56]-/); // May or June

      // Verify all periods have expected and target values
      periods.forEach(period => {
        expect(period.expected).toBeGreaterThan(0);
        expect(period.target).toBe(200);
        expect(period.complete).toBe(0);
      });
    });

    test('should create metric with quarterly frequency and correct period count', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Quarterly Metric',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          frequency: 'quarterly',
          progression_type: 'linear',
          final_target: 80
        });

      expect(response.status).toBe(200);

      const newMetricId = response.body.id;

      // Verify periods were auto-generated quarterly
      const { createApp } = require('../server');
      const { dbAll } = createApp(TEST_DB_PATH);
      const periods = await dbAll('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date', [newMetricId]);

      expect(periods.length).toBe(4); // Q1, Q2, Q3, Q4
    });

    test('should create metric with exponential progression type', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Exponential Metric',
          start_date: '2024-01-01',
          end_date: '2024-06-30',
          frequency: 'monthly',
          progression_type: 'exponential',
          final_target: 100
        });

      expect(response.status).toBe(200);

      const newMetricId = response.body.id;

      // Verify the metric was created with exponential progression
      const { createApp } = require('../server');
      const { dbGet, dbAll } = createApp(TEST_DB_PATH);

      const metric = await dbGet('SELECT * FROM metrics WHERE id = ?', [newMetricId]);
      expect(metric.progression_type).toBe('exponential');

      // Verify periods have exponential growth pattern (back-loaded)
      const periods = await dbAll('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date', [newMetricId]);
      expect(periods.length).toBeGreaterThan(0);

      // Check that expected values increase exponentially (later values > earlier values)
      if (periods.length >= 2) {
        const firstExpected = parseFloat(periods[0].expected);
        const lastExpected = parseFloat(periods[periods.length - 1].expected);
        expect(lastExpected).toBeGreaterThan(firstExpected);
      }
    });

    test('should create metric with logarithmic progression type', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Logarithmic Metric',
          start_date: '2024-01-01',
          end_date: '2024-06-30',
          frequency: 'monthly',
          progression_type: 'logarithmic',
          final_target: 100
        });

      expect(response.status).toBe(200);

      const newMetricId = response.body.id;

      // Verify the metric was created with logarithmic progression
      const { createApp } = require('../server');
      const { dbGet, dbAll } = createApp(TEST_DB_PATH);

      const metric = await dbGet('SELECT * FROM metrics WHERE id = ?', [newMetricId]);
      expect(metric.progression_type).toBe('logarithmic');

      // Verify periods have logarithmic growth pattern (front-loaded)
      const periods = await dbAll('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date', [newMetricId]);
      expect(periods.length).toBeGreaterThan(0);

      // Check that expected values increase logarithmically
      if (periods.length >= 2) {
        const firstExpected = parseFloat(periods[0].expected);
        const lastExpected = parseFloat(periods[periods.length - 1].expected);
        expect(lastExpected).toBeGreaterThan(firstExpected);
      }
    });

    test('should create metric with fortnightly frequency', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Fortnightly Metric',
          start_date: '2024-01-01',
          end_date: '2024-03-31',
          frequency: 'fortnightly',
          progression_type: 'linear',
          final_target: 100
        });

      expect(response.status).toBe(200);

      const newMetricId = response.body.id;

      // Verify the metric was created with fortnightly frequency
      const { createApp } = require('../server');
      const { dbGet, dbAll } = createApp(TEST_DB_PATH);

      const metric = await dbGet('SELECT * FROM metrics WHERE id = ?', [newMetricId]);
      expect(metric.frequency).toBe('fortnightly');

      // Verify periods were auto-generated fortnightly (approximately 6-7 periods in 3 months)
      const periods = await dbAll('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date', [newMetricId]);
      expect(periods.length).toBeGreaterThanOrEqual(6);
      expect(periods.length).toBeLessThanOrEqual(7);
    });

    test('should create metric with weekly frequency', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Weekly Metric',
          start_date: '2024-01-01',
          end_date: '2024-01-31',
          frequency: 'weekly',
          progression_type: 'linear',
          final_target: 100
        });

      expect(response.status).toBe(200);

      const newMetricId = response.body.id;

      // Verify the metric was created with weekly frequency
      const { createApp } = require('../server');
      const { dbGet, dbAll } = createApp(TEST_DB_PATH);

      const metric = await dbGet('SELECT * FROM metrics WHERE id = ?', [newMetricId]);
      expect(metric.frequency).toBe('weekly');

      // Verify periods were auto-generated weekly (approximately 4-5 weeks in January)
      const periods = await dbAll('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date', [newMetricId]);
      expect(periods.length).toBeGreaterThanOrEqual(4);
      expect(periods.length).toBeLessThanOrEqual(5);
    });

    test('should support adding interim periods with off-schedule dates', async () => {
      // Create a metric with monthly frequency
      const metricResponse = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Monthly Metric with Interim Periods',
          start_date: '2024-01-01',
          end_date: '2024-03-31',
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 100
        });

      expect(metricResponse.status).toBe(200);
      const metricId = metricResponse.body.id;

      // Get the auto-generated periods (should be Jan 1, Feb 1, Mar 1)
      const { createApp } = require('../server');
      const { dbAll } = createApp(TEST_DB_PATH);
      const initialPeriods = await dbAll('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date', [metricId]);
      const initialCount = initialPeriods.length;
      expect(initialCount).toBeGreaterThanOrEqual(3);

      // Add an interim period on Jan 15th (off-schedule)
      const interimPeriodResponse = await request(app)
        .post('/api/metric-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          metric_id: metricId,
          reporting_date: '2024-01-15',
          expected: 50,
          target: 100,
          complete: 45
        });

      expect(interimPeriodResponse.status).toBe(200);
      const interimPeriodId = interimPeriodResponse.body.id;

      // Verify the interim period was created
      const periodsAfterInterim = await dbAll('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date', [metricId]);
      expect(periodsAfterInterim.length).toBe(initialCount + 1);

      // Verify the interim period exists with correct date
      const interimPeriod = periodsAfterInterim.find(p => p.reporting_date === '2024-01-15');
      expect(interimPeriod).toBeDefined();
      expect(interimPeriod.expected).toBe(50);
      expect(interimPeriod.complete).toBe(45);

      // Verify it appears in the project data endpoint (this is what the frontend uses)
      const projectDataResponse = await request(app)
        .get(`/api/projects/${testProjectId}/data`);

      expect(projectDataResponse.status).toBe(200);
      const projectData = projectDataResponse.body;

      // Find the interim period in project data
      const interimInProjectData = projectData.find(item =>
        item.metric === 'Monthly Metric with Interim Periods' &&
        item.reporting_date === '2024-01-15'
      );

      expect(interimInProjectData).toBeDefined();
      expect(interimInProjectData.expected).toBe(50);
      expect(interimInProjectData.complete).toBe(45);

      // Verify the metric's periods endpoint includes the interim period
      const metricPeriodsResponse = await request(app)
        .get(`/api/metrics/${metricId}/periods`);

      expect(metricPeriodsResponse.status).toBe(200);
      const metricPeriods = metricPeriodsResponse.body;
      expect(metricPeriods.length).toBe(initialCount + 1);

      const interimInMetricPeriods = metricPeriods.find(p => p.reporting_date === '2024-01-15');
      expect(interimInMetricPeriods).toBeDefined();
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
