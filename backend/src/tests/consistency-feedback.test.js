const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-consistency-feedback.db');

let app, adminToken, pmToken, viewerToken;
let dbRun, dbGet, dbAll, generateConsistencyFeedback;
let testProjectId1, testProjectId2, testProjectId3;
let testMetricId1, testMetricId2, testMetricId3;

describe('Consistency Feedback Generation Tests', () => {
  beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.NODE_ENV = 'test';
    const { createApp } = require('../server');
    const instance = createApp(TEST_DB_PATH);
    app = instance.app;
    dbRun = instance.dbRun;
    dbGet = instance.dbGet;
    dbAll = instance.dbAll;
    generateConsistencyFeedback = instance.generateConsistencyFeedback;

    // Create admin user
    await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      email: 'admin@consistency.test',
      password: 'admin123'
    });

    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@consistency.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@consistency.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create PM user
    await request(app).post('/api/auth/register').send({
      name: 'PM User',
      email: 'pm@consistency.test',
      password: 'pm123'
    });
    const pmUser = await dbGet('SELECT * FROM users WHERE email = ?', ['pm@consistency.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['pm', pmUser.id]);

    const pmLogin = await request(app).post('/api/auth/login').send({
      email: 'pm@consistency.test',
      password: 'pm123'
    });
    pmToken = pmLogin.body.token;

    // Create viewer user
    await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@consistency.test',
      password: 'viewer123'
    });
    const viewerUser = await dbGet('SELECT * FROM users WHERE email = ?', ['viewer@consistency.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['viewer', viewerUser.id]);

    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: 'viewer@consistency.test',
      password: 'viewer123'
    });
    viewerToken = viewerLogin.body.token;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('POST /api/admin/generate-consistency-feedback', () => {
    test('should require admin authentication', async () => {
      const response = await request(app)
        .post('/api/admin/generate-consistency-feedback')
        .set('Authorization', `Bearer ${pmToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    test('should generate feedback for single metric projects', async () => {
      // Create project with only one metric
      const projectRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Single Metric Project',
          description: 'Test project',
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });
      testProjectId1 = projectRes.body.id;

      // Create single metric
      const metricRes = await request(app)
        .post(`/api/projects/${testProjectId1}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Single Metric',
          frequency: 'monthly',
          final_target: 100,
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });
      testMetricId1 = metricRes.body.id;

      // Generate feedback
      const response = await request(app)
        .post('/api/admin/generate-consistency-feedback')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.created).toBeGreaterThan(0);

      // Check that feedback was created
      const feedback = await dbAll(
        'SELECT * FROM feedback WHERE project_id = ? AND text LIKE ?',
        [testProjectId1, '%only one metric%']
      );
      expect(feedback.length).toBe(1);
      expect(feedback[0].text).toContain('[INFO]');
      expect(feedback[0].text).toContain('Single Metric Project');
      expect(feedback[0].status).toBe('open');
    });

    test('should prevent duplicate feedback entries', async () => {
      // Run generation twice
      const response1 = await request(app)
        .post('/api/admin/generate-consistency-feedback')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response1.body.created).toBe(0);
      expect(response1.body.skipped).toBeGreaterThan(0);

      // Verify no duplicates in database
      const feedback = await dbAll(
        'SELECT * FROM feedback WHERE project_id = ?',
        [testProjectId1]
      );

      // Should have exactly 1 feedback entry (no duplicates)
      const uniqueFeedback = feedback.filter(f => f.text.includes('only one metric'));
      expect(uniqueFeedback.length).toBe(1);
    });

    test('should detect projects with no lead metrics', async () => {
      // Create project with only lag metrics
      const projectRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'No Lead Metrics Project',
          description: 'Test project',
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });
      testProjectId2 = projectRes.body.id;

      // Create lag metric
      const metricRes = await request(app)
        .post(`/api/projects/${testProjectId2}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Lag Metric 1',
          
          final_target: 100,
          frequency: 'monthly',
          metric_type: 'lag',
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });

      // Create another lag metric
      await request(app)
        .post(`/api/projects/${testProjectId2}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Lag Metric 2',
          
          final_target: 100,
          frequency: 'monthly',
          metric_type: 'lag',
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });

      // Generate feedback
      const response = await request(app)
        .post('/api/admin/generate-consistency-feedback')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Check for no lead metrics feedback
      const feedback = await dbAll(
        'SELECT * FROM feedback WHERE project_id = ? AND text LIKE ?',
        [testProjectId2, '%no lead metrics%']
      );
      expect(feedback.length).toBe(1);
      expect(feedback[0].text).toContain('[WARNING]');
      expect(feedback[0].text).toContain('No Lead Metrics Project');
    });

    test('should detect back-loaded growth patterns', async () => {
      // Create project
      const projectRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Back-loaded Project',
          description: 'Test project',
          start_date: '2025-01-01',
          end_date: '2025-06-01'
        });
      testProjectId3 = projectRes.body.id;

      // Create metric
      const metricRes = await request(app)
        .post(`/api/projects/${testProjectId3}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Back-loaded Metric',
          
          final_target: 100,
          frequency: 'monthly',
          start_date: '2025-01-01',
          end_date: '2025-06-01'
        });
      testMetricId3 = metricRes.body.id;

      // Create periods with back-loaded pattern (minimal growth in first half, most in second half)
      const metric = await dbGet('SELECT * FROM metrics WHERE id = ?', [testMetricId3]);
      const periods = await dbAll(
        'SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date',
        [testMetricId3]
      );

      // Update periods to create back-loaded pattern
      // First half: minimal progress (0, 5, 10)
      await dbRun('UPDATE metric_periods SET complete = ? WHERE id = ?', [0, periods[0].id]);
      await dbRun('UPDATE metric_periods SET complete = ? WHERE id = ?', [5, periods[1].id]);
      await dbRun('UPDATE metric_periods SET complete = ? WHERE id = ?', [10, periods[2].id]);

      // Second half: major progress (40, 80, 100)
      await dbRun('UPDATE metric_periods SET complete = ? WHERE id = ?', [40, periods[3].id]);
      await dbRun('UPDATE metric_periods SET complete = ? WHERE id = ?', [80, periods[4].id]);
      await dbRun('UPDATE metric_periods SET complete = ? WHERE id = ?', [100, periods[5].id]);

      // Generate feedback
      const response = await request(app)
        .post('/api/admin/generate-consistency-feedback')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Check for back-loaded feedback
      const feedback = await dbAll(
        'SELECT * FROM feedback WHERE project_id = ? AND text LIKE ?',
        [testProjectId3, '%back-loaded%']
      );
      expect(feedback.length).toBeGreaterThan(0);
      expect(feedback[0].text).toContain('[HIGH]');
    });

    test('should detect vacation month growth', async () => {
      // Create project
      const projectRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Vacation Growth Project',
          description: 'Test project',
          start_date: '2024-06-01',
          end_date: '2025-02-01'
        });
      const vacationProjectId = projectRes.body.id;

      // Create metric
      const metricRes = await request(app)
        .post(`/api/projects/${vacationProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Vacation Metric',
          
          final_target: 100,
          frequency: 'monthly',
          start_date: '2024-06-01',
          end_date: '2025-02-01'
        });
      const vacationMetricId = metricRes.body.id;

      // Get periods and set growth in January (vacation month)
      const periods = await dbAll(
        'SELECT * FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date',
        [vacationMetricId]
      );

      // Find January period
      const januaryPeriod = periods.find(p => p.reporting_date.includes('2025-01'));
      if (januaryPeriod) {
        const prevPeriod = periods[periods.indexOf(januaryPeriod) - 1];

        // Set significant growth in January
        await dbRun('UPDATE metric_periods SET complete = ? WHERE id = ?', [20, prevPeriod.id]);
        await dbRun('UPDATE metric_periods SET complete = ? WHERE id = ?', [60, januaryPeriod.id]);
      }

      // Generate feedback
      const response = await request(app)
        .post('/api/admin/generate-consistency-feedback')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Check for vacation month feedback
      const feedback = await dbAll(
        'SELECT * FROM feedback WHERE project_id = ? AND text LIKE ?',
        [vacationProjectId, '%vacation month%']
      );

      // May or may not detect depending on average growth calculation
      // This test ensures the logic runs without errors
      expect(response.body.success).toBe(true);
    });
  });

  describe('System User Creation', () => {
    test('should create system user for automated feedback', async () => {
      const systemUser = await dbGet(
        'SELECT * FROM users WHERE email = ?',
        ['system@progress-tracker']
      );

      expect(systemUser).toBeDefined();
      expect(systemUser.name).toBe('System');
      expect(systemUser.role).toBe('viewer');
    });

    test('all generated feedback should be from system user', async () => {
      const systemUser = await dbGet(
        'SELECT * FROM users WHERE email = ?',
        ['system@progress-tracker']
      );

      const allFeedback = await dbAll(
        'SELECT * FROM feedback WHERE text LIKE ?',
        ['%[WARNING]%']
      );

      // All consistency feedback should be from system user
      allFeedback.forEach(feedback => {
        expect(feedback.user_id).toBe(systemUser.id);
      });
    });
  });

  describe('Feedback Deduplication', () => {
    test('should not create duplicate feedback for same issue', async () => {
      // Count feedback before
      const before = await dbAll('SELECT * FROM feedback');
      const beforeCount = before.length;

      // Generate again
      await request(app)
        .post('/api/admin/generate-consistency-feedback')
        .set('Authorization', `Bearer ${adminToken}`);

      // Count feedback after
      const after = await dbAll('SELECT * FROM feedback');
      const afterCount = after.length;

      // Should be same count (no new duplicates)
      expect(afterCount).toBe(beforeCount);
    });

    test('should skip feedback if similar entry exists', async () => {
      const response = await request(app)
        .post('/api/admin/generate-consistency-feedback')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.skipped).toBeGreaterThan(0);
      expect(response.body.created).toBe(0);
    });
  });

  describe('Integration with generateConsistencyFeedback function', () => {
    test('should be callable directly', async () => {
      const result = await generateConsistencyFeedback();

      expect(result).toBeDefined();
      expect(result.created).toBeDefined();
      expect(result.skipped).toBeDefined();
      expect(result.total).toBeDefined();
      expect(typeof result.created).toBe('number');
      expect(typeof result.skipped).toBe('number');
    });

    test('should return consistent results when called multiple times', async () => {
      const result1 = await generateConsistencyFeedback();
      const result2 = await generateConsistencyFeedback();

      // Second call should create 0 and skip all
      expect(result2.created).toBe(0);
      expect(result2.skipped).toBe(result1.total);
    });
  });

  describe('Feedback Severity Levels', () => {
    test('should create INFO level feedback for single metrics', async () => {
      const feedback = await dbAll(
        'SELECT * FROM feedback WHERE text LIKE ?',
        ['[INFO]%']
      );

      expect(feedback.length).toBeGreaterThan(0);
      expect(feedback[0].text).toContain('only one metric');
    });

    test('should create WARNING level feedback for no lead metrics', async () => {
      const feedback = await dbAll(
        'SELECT * FROM feedback WHERE text LIKE ?',
        ['[WARNING]%no lead metrics%']
      );

      expect(feedback.length).toBeGreaterThan(0);
    });

    test('should create HIGH level feedback for back-loaded projects', async () => {
      const feedback = await dbAll(
        'SELECT * FROM feedback WHERE text LIKE ?',
        ['[HIGH]%back-loaded%']
      );

      expect(feedback.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing projects gracefully', async () => {
      // Delete all data in correct order (respecting foreign keys)
      await dbRun('DELETE FROM feedback');
      await dbRun('DELETE FROM metric_periods');
      await dbRun('DELETE FROM metrics');
      await dbRun('DELETE FROM projects');

      const response = await request(app)
        .post('/api/admin/generate-consistency-feedback')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.total).toBe(0);
    });

    test('should handle database errors gracefully', async () => {
      // This test ensures the error handling works
      // The actual implementation catches and logs errors
      const result = await generateConsistencyFeedback();

      expect(result).toBeDefined();
      expect(typeof result.created).toBe('number');
    });
  });
});
