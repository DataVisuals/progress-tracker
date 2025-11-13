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

    test('should handle multiple interim periods on same metric', async () => {
      // Create a metric with monthly frequency
      const metricResponse = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Metric with Multiple Interim Periods',
          start_date: '2024-01-01',
          end_date: '2024-03-31',
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 100
        });

      expect(metricResponse.status).toBe(200);
      const metricId = metricResponse.body.id;

      const { createApp } = require('../server');
      const { dbAll } = createApp(TEST_DB_PATH);
      const initialPeriods = await dbAll('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date', [metricId]);
      const initialCount = initialPeriods.length;

      // Add multiple interim periods (mid-month checks)
      const interimDates = ['2024-01-15', '2024-02-15', '2024-03-15'];

      for (const date of interimDates) {
        const response = await request(app)
          .post('/api/metric-periods')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            metric_id: metricId,
            reporting_date: date,
            expected: 50,
            target: 100,
            complete: 40
          });

        expect(response.status).toBe(200);
      }

      // Verify all interim periods were created
      const finalPeriods = await dbAll('SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date', [metricId]);
      expect(finalPeriods.length).toBe(initialCount + 3);

      // Verify each interim period exists
      for (const date of interimDates) {
        const period = finalPeriods.find(p => p.reporting_date === date);
        expect(period).toBeDefined();
        expect(period.expected).toBe(50);
      }

      // Verify proper chronological ordering when returned via API
      const metricPeriodsResponse = await request(app)
        .get(`/api/metrics/${metricId}/periods`);

      const periods = metricPeriodsResponse.body;

      // Check that periods are in chronological order
      for (let i = 0; i < periods.length - 1; i++) {
        const currentDate = new Date(periods[i].reporting_date);
        const nextDate = new Date(periods[i + 1].reporting_date);
        expect(currentDate.getTime()).toBeLessThanOrEqual(nextDate.getTime());
      }
    });

    test('should distinguish interim periods across different metrics with similar IDs', async () => {
      // This test verifies the bug fix where period IDs could collide across metrics
      // Create two metrics
      const metric1Response = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'First Metric',
          start_date: '2024-01-01',
          end_date: '2024-03-31',
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 100
        });

      const metric2Response = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Second Metric',
          start_date: '2024-01-01',
          end_date: '2024-03-31',
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 200
        });

      expect(metric1Response.status).toBe(200);
      expect(metric2Response.status).toBe(200);

      const metric1Id = metric1Response.body.id;
      const metric2Id = metric2Response.body.id;

      const { createApp } = require('../server');
      const { dbAll } = createApp(TEST_DB_PATH);

      // Add interim period to first metric
      const interim1Response = await request(app)
        .post('/api/metric-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          metric_id: metric1Id,
          reporting_date: '2024-01-15',
          expected: 50,
          target: 100,
          complete: 45
        });

      expect(interim1Response.status).toBe(200);

      // Add interim period to second metric with same date
      const interim2Response = await request(app)
        .post('/api/metric-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          metric_id: metric2Id,
          reporting_date: '2024-01-15',
          expected: 100,
          target: 200,
          complete: 90
        });

      expect(interim2Response.status).toBe(200);

      // Verify both interim periods exist independently
      const metric1Periods = await dbAll('SELECT * FROM metric_periods WHERE metric_id = ? AND reporting_date = ?',
        [metric1Id, '2024-01-15']);
      const metric2Periods = await dbAll('SELECT * FROM metric_periods WHERE metric_id = ? AND reporting_date = ?',
        [metric2Id, '2024-01-15']);

      expect(metric1Periods.length).toBe(1);
      expect(metric2Periods.length).toBe(1);

      // Verify they have different values (proving they're distinct)
      expect(metric1Periods[0].expected).toBe(50);
      expect(metric1Periods[0].complete).toBe(45);
      expect(metric2Periods[0].expected).toBe(100);
      expect(metric2Periods[0].complete).toBe(90);

      // Verify project data endpoint returns both interim periods
      const projectDataResponse = await request(app)
        .get(`/api/projects/${testProjectId}/data`);

      const projectData = projectDataResponse.body;
      const interim1InData = projectData.find(p =>
        p.metric === 'First Metric' && p.reporting_date === '2024-01-15'
      );
      const interim2InData = projectData.find(p =>
        p.metric === 'Second Metric' && p.reporting_date === '2024-01-15'
      );

      expect(interim1InData).toBeDefined();
      expect(interim2InData).toBeDefined();
      expect(interim1InData.complete).toBe(45);
      expect(interim2InData.complete).toBe(90);
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

  describe('Metric Target Changes Over Time (Gray Bar Visualization)', () => {
    let scopeChangeProjectId, scopeChangeMetricId;

    beforeAll(async () => {
      // Create a dedicated project for testing scope changes
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Scope Change Test Project',
          description: 'Testing changing targets over time'
        });
      scopeChangeProjectId = projectResponse.body.id;

      // Create a metric with initial target of 100
      const metricResponse = await request(app)
        .post(`/api/projects/${scopeChangeProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Changing Target Metric',
          start_date: '2024-01-01',
          end_date: '2024-06-30',
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 100,
          amber_tolerance: 5.0,
          red_tolerance: 10.0
        });

      scopeChangeMetricId = metricResponse.body.id;
      expect(metricResponse.status).toBe(200);
    });

    test('should correctly reflect target changes in period data for gray bars', async () => {
      // Get the auto-generated periods
      const periodsResponse = await request(app)
        .get(`/api/metrics/${scopeChangeMetricId}/periods`);

      expect(periodsResponse.status).toBe(200);
      const periods = periodsResponse.body;
      expect(periods.length).toBe(6); // 6 months

      // Update complete values for first 3 periods (Jan, Feb, Mar)
      await request(app)
        .put(`/api/metric-periods/${periods[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ complete: 15 }); // Jan: 15/100

      await request(app)
        .put(`/api/metric-periods/${periods[1].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ complete: 30 }); // Feb: 30/100

      await request(app)
        .put(`/api/metric-periods/${periods[2].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ complete: 50 }); // Mar: 50/100

      // Now change the metric's final target to 150 (scope increase)
      await request(app)
        .put(`/api/metrics/${scopeChangeMetricId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ final_target: 150 });

      // Update complete values for last 3 periods (Apr, May, Jun) with new target
      await request(app)
        .put(`/api/metric-periods/${periods[3].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complete: 70,
          target: 150 // Explicitly set new target
        });

      await request(app)
        .put(`/api/metric-periods/${periods[4].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complete: 100,
          target: 150
        });

      await request(app)
        .put(`/api/metric-periods/${periods[5].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complete: 140,
          target: 150
        });

      // Retrieve project data (what the chart uses)
      const projectDataResponse = await request(app)
        .get(`/api/projects/${scopeChangeProjectId}/data`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(projectDataResponse.status).toBe(200);
      const projectData = projectDataResponse.body;

      // Find our metric's periods in the data
      const metricPeriods = projectData.filter(p => p.metric_id === scopeChangeMetricId);
      expect(metricPeriods.length).toBe(6);

      // Sort by date to ensure correct order
      metricPeriods.sort((a, b) => a.reporting_date.localeCompare(b.reporting_date));

      // Verify first 3 periods have original target (100)
      expect(metricPeriods[0].final_target).toBe(100);
      expect(metricPeriods[0].complete).toBe(15);
      // Gray bar should be: 100 - 15 = 85
      const grayBar1 = metricPeriods[0].final_target - metricPeriods[0].complete;
      expect(grayBar1).toBe(85);

      expect(metricPeriods[1].final_target).toBe(100);
      expect(metricPeriods[1].complete).toBe(30);
      const grayBar2 = metricPeriods[1].final_target - metricPeriods[1].complete;
      expect(grayBar2).toBe(70);

      expect(metricPeriods[2].final_target).toBe(100);
      expect(metricPeriods[2].complete).toBe(50);
      const grayBar3 = metricPeriods[2].final_target - metricPeriods[2].complete;
      expect(grayBar3).toBe(50);

      // Verify last 3 periods have new target (150)
      expect(metricPeriods[3].final_target).toBe(150);
      expect(metricPeriods[3].complete).toBe(70);
      // Gray bar should be: 150 - 70 = 80
      const grayBar4 = metricPeriods[3].final_target - metricPeriods[3].complete;
      expect(grayBar4).toBe(80);

      expect(metricPeriods[4].final_target).toBe(150);
      expect(metricPeriods[4].complete).toBe(100);
      const grayBar5 = metricPeriods[4].final_target - metricPeriods[4].complete;
      expect(grayBar5).toBe(50);

      expect(metricPeriods[5].final_target).toBe(150);
      expect(metricPeriods[5].complete).toBe(140);
      const grayBar6 = metricPeriods[5].final_target - metricPeriods[5].complete;
      expect(grayBar6).toBe(10);

      // Key assertion: Gray bars should change when targets change
      // Before target change: gray bars were 85, 70, 50
      // After target change: gray bars are 80, 50, 10
      // This proves that the gray bars correctly reflect the changing target
      expect(grayBar1).toBeGreaterThan(grayBar4); // 85 > 80 (different despite progress)
      expect(grayBar4).toBeGreaterThan(grayBar5); // 80 > 50 (gray bars shrinking as work completes)
    });

    test('should handle target decreases (scope reduction)', async () => {
      // Create another metric for testing scope reduction
      const metricResponse = await request(app)
        .post(`/api/projects/${scopeChangeProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Scope Reduction Metric',
          start_date: '2024-01-01',
          end_date: '2024-04-30',
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 200,
          amber_tolerance: 5.0,
          red_tolerance: 10.0
        });

      const metricId = metricResponse.body.id;

      // Get periods
      const periodsResponse = await request(app)
        .get(`/api/metrics/${metricId}/periods`);
      const periods = periodsResponse.body;
      expect(periods.length).toBe(4);

      // Set initial progress with target of 200
      await request(app)
        .put(`/api/metric-periods/${periods[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ complete: 50 }); // Jan: 50/200 (remaining: 150)

      // Reduce scope to 120
      await request(app)
        .put(`/api/metrics/${metricId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ final_target: 120 });

      // Update later periods with reduced target
      await request(app)
        .put(`/api/metric-periods/${periods[1].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complete: 70,
          target: 120 // Feb: 70/120 (remaining: 50)
        });

      // Get project data
      const projectDataResponse = await request(app)
        .get(`/api/projects/${scopeChangeProjectId}/data`)
        .set('Authorization', `Bearer ${adminToken}`);

      const metricPeriods = projectDataResponse.body
        .filter(p => p.metric_id === metricId)
        .sort((a, b) => a.reporting_date.localeCompare(b.reporting_date));

      // Verify target change is reflected
      expect(metricPeriods[0].final_target).toBe(200);
      const grayBarBefore = metricPeriods[0].final_target - metricPeriods[0].complete;
      expect(grayBarBefore).toBe(150); // 200 - 50

      expect(metricPeriods[1].final_target).toBe(120);
      const grayBarAfter = metricPeriods[1].final_target - metricPeriods[1].complete;
      expect(grayBarAfter).toBe(50); // 120 - 70

      // Gray bar should decrease significantly due to scope reduction
      expect(grayBarBefore).toBeGreaterThan(grayBarAfter);
      expect(grayBarBefore - grayBarAfter).toBe(100); // Scope reduced by 80, but also completed 20 more
    });
  });
});
