const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-metric-periods.db');

let app, dbRun, dbGet;
let adminToken, pmToken, viewerToken;
let testProjectId, testMetricId, testPeriodId;

describe('Metric Periods API Tests', () => {
  beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.NODE_ENV = 'test';
    const { createApp } = require('../server');
    const result = createApp(TEST_DB_PATH);
    app = result.app;
    dbRun = result.dbRun;
    dbGet = result.dbGet;

    // Create admin user
    await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      email: 'admin@periods.test',
      password: 'admin123'
    });

    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@periods.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@periods.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create PM user
    await request(app).post('/api/auth/register').send({
      name: 'PM User',
      email: 'pm@periods.test',
      password: 'pm123'
    });
    const pmUser = await dbGet('SELECT * FROM users WHERE email = ?', ['pm@periods.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['pm', pmUser.id]);

    const pmLogin = await request(app).post('/api/auth/login').send({
      email: 'pm@periods.test',
      password: 'pm123'
    });
    pmToken = pmLogin.body.token;

    // Create viewer user
    await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@periods.test',
      password: 'viewer123'
    });
    const viewerUser = await dbGet('SELECT * FROM users WHERE email = ?', ['viewer@periods.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['viewer', viewerUser.id]);

    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: 'viewer@periods.test',
      password: 'viewer123'
    });
    viewerToken = viewerLogin.body.token;

    // Create a test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Project',
        description: 'Test project for metric periods',
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      });
    testProjectId = projectResponse.body.id;

    // Create a test metric
    const metricResponse = await request(app)
      .post(`/api/projects/${testProjectId}/metrics`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Metric',
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        final_target: 100,
        progression_type: 'linear',
        frequency: 'monthly'
      });

    if (metricResponse.status !== 201 && metricResponse.status !== 200) {
      console.error('Failed to create metric:', metricResponse.status, metricResponse.body);
    }
    testMetricId = metricResponse.body.id;

    if (!testMetricId) {
      throw new Error('Failed to create test metric - testMetricId is undefined');
    }
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/metrics/:metricId/periods', () => {
    test('should retrieve periods for a metric', async () => {
      const response = await request(app)
        .get(`/api/metrics/${testMetricId}/periods`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return empty array for metric with no periods', async () => {
      // Create a new metric without periods
      const metricResponse = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Empty Metric',
          start_date: '2025-01-01',
          end_date: '2025-03-31',
          final_target: 50,
          progression_type: 'linear',
          frequency: 'monthly'
        });

      // Delete auto-generated periods
      await dbRun('DELETE FROM metric_periods WHERE metric_id = ?', [metricResponse.body.id]);

      const response = await request(app)
        .get(`/api/metrics/${metricResponse.body.id}/periods`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('should return periods ordered by reporting_date', async () => {
      const response = await request(app)
        .get(`/api/metrics/${testMetricId}/periods`);

      expect(response.status).toBe(200);

      if (response.body.length > 1) {
        for (let i = 1; i < response.body.length; i++) {
          const prevDate = new Date(response.body[i - 1].reporting_date);
          const currDate = new Date(response.body[i].reporting_date);
          expect(currDate >= prevDate).toBe(true);
        }
      }
    });
  });

  describe('POST /api/metric-periods', () => {
    test('should create a new period as admin', async () => {
      const response = await request(app)
        .post('/api/metric-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          metric_id: testMetricId,
          reporting_date: '2025-06-15',
          expected: 50,
          target: 100,
          complete: 45
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.success).toBe(true);
      testPeriodId = response.body.id;
    });

    test('should reject period creation without authentication', async () => {
      const response = await request(app)
        .post('/api/metric-periods')
        .send({
          metric_id: testMetricId,
          reporting_date: '2025-07-01',
          expected: 60,
          target: 100
        });

      expect(response.status).toBe(401);
    });

    test('should reject period creation for non-existent metric', async () => {
      const response = await request(app)
        .post('/api/metric-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          metric_id: 99999,
          reporting_date: '2025-07-01',
          expected: 60,
          target: 100
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Metric not found');
    });

    test('should default complete to 0 if not provided', async () => {
      const response = await request(app)
        .post('/api/metric-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          metric_id: testMetricId,
          reporting_date: '2025-07-15',
          expected: 65,
          target: 100
        });

      expect(response.status).toBe(200);

      // Verify the period was created with complete = 0
      const period = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [response.body.id]);
      expect(period.complete).toBe(0);
    });

    test('should reject period creation by user without project permission', async () => {
      // Viewer doesn't have permission to edit the project
      const response = await request(app)
        .post('/api/metric-periods')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          metric_id: testMetricId,
          reporting_date: '2025-08-01',
          expected: 70,
          target: 100
        });

      expect(response.status).toBe(403);
    });

    test('should create audit log entry for period creation', async () => {
      const response = await request(app)
        .post('/api/metric-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          metric_id: testMetricId,
          reporting_date: '2025-08-15',
          expected: 75,
          target: 100,
          complete: 70
        });

      expect(response.status).toBe(200);

      // Check audit log
      const auditEntry = await dbGet(
        'SELECT * FROM audit_log WHERE table_name = ? AND record_id = ? AND action = ?',
        ['metric_periods', response.body.id, 'CREATE']
      );
      expect(auditEntry).toBeTruthy();
      expect(auditEntry.new_values).toContain('"expected":75');
    });
  });

  describe('PUT /api/metric-periods/:id', () => {
    test('should update period complete value', async () => {
      const response = await request(app)
        .put(`/api/metric-periods/${testPeriodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complete: 55
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify update
      const period = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [testPeriodId]);
      expect(period.complete).toBe(55);
    });

    test('should update period expected value', async () => {
      const response = await request(app)
        .put(`/api/metric-periods/${testPeriodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          expected: 52
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify update
      const period = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [testPeriodId]);
      expect(period.expected).toBe(52);
    });

    test('should update period target value', async () => {
      const response = await request(app)
        .put(`/api/metric-periods/${testPeriodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          target: 110
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify update
      const period = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [testPeriodId]);
      expect(period.target).toBe(110);
    });

    test('should update multiple fields at once', async () => {
      const response = await request(app)
        .put(`/api/metric-periods/${testPeriodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complete: 60,
          expected: 55,
          target: 105
        });

      expect(response.status).toBe(200);

      // Verify all updates
      const period = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [testPeriodId]);
      expect(period.complete).toBe(60);
      expect(period.expected).toBe(55);
      expect(period.target).toBe(105);
    });

    test('should reject update for non-existent period', async () => {
      const response = await request(app)
        .put('/api/metric-periods/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complete: 50
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Period not found');
    });

    test('should reject update without authentication', async () => {
      const response = await request(app)
        .put(`/api/metric-periods/${testPeriodId}`)
        .send({
          complete: 50
        });

      expect(response.status).toBe(401);
    });

    test('should reject update by user without project permission', async () => {
      const response = await request(app)
        .put(`/api/metric-periods/${testPeriodId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          complete: 50
        });

      expect(response.status).toBe(403);
    });

    test('should create audit log entry for period update', async () => {
      const response = await request(app)
        .put(`/api/metric-periods/${testPeriodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complete: 99
        });

      expect(response.status).toBe(200);

      // Check audit log - get by id DESC to get the most recent
      const auditEntry = await dbGet(
        'SELECT * FROM audit_log WHERE table_name = ? AND record_id = ? AND action = ? ORDER BY id DESC LIMIT 1',
        ['metric_periods', testPeriodId, 'UPDATE']
      );
      expect(auditEntry).toBeTruthy();
      expect(auditEntry.new_values).toContain('"complete":99');
    });
  });

  describe('PUT /api/metric-periods/:id - Historic Edit Restrictions', () => {
    let historicPeriodId;

    beforeAll(async () => {
      // Create a period with a past date
      const result = await dbRun(
        'INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete) VALUES (?, ?, ?, ?, ?)',
        [testMetricId, '2024-01-01', 10, 100, 8]
      );
      historicPeriodId = result.lastID;
    });

    test('should allow admin to make historic edits', async () => {
      const response = await request(app)
        .put(`/api/metric-periods/${historicPeriodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complete: 12
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.isHistoricEdit).toBe(true);
    });

    test('should allow PM to make historic edits', async () => {
      // First grant PM permission to the project
      await request(app)
        .post(`/api/projects/${testProjectId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: (await dbGet('SELECT id FROM users WHERE email = ?', ['pm@periods.test'])).id,
          can_edit: true
        });

      const response = await request(app)
        .put(`/api/metric-periods/${historicPeriodId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          complete: 15
        });

      expect(response.status).toBe(200);
      expect(response.body.isHistoricEdit).toBe(true);
    });

    test('should mark current period edits as non-historic', async () => {
      // Create a period for today (current, not historic)
      const today = new Date().toISOString().split('T')[0];
      const result = await dbRun(
        'INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete) VALUES (?, ?, ?, ?, ?)',
        [testMetricId, today, 50, 100, 45]
      );
      const currentPeriodId = result.lastID;

      const response = await request(app)
        .put(`/api/metric-periods/${currentPeriodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complete: 48
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Current period edits should not be flagged as historic
      expect(response.body.isHistoricEdit).toBeFalsy();
    });
  });

  describe('PATCH /api/metric-periods/:id', () => {
    test('should update only complete value', async () => {
      const response = await request(app)
        .patch(`/api/metric-periods/${testPeriodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complete: 70
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify update
      const period = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [testPeriodId]);
      expect(period.complete).toBe(70);
    });

    test('should reject patch for non-existent period', async () => {
      const response = await request(app)
        .patch('/api/metric-periods/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complete: 50
        });

      expect(response.status).toBe(404);
    });

    test('should reject patch without authentication', async () => {
      const response = await request(app)
        .patch(`/api/metric-periods/${testPeriodId}`)
        .send({
          complete: 50
        });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/metric-periods/:id', () => {
    let periodToDelete;
    let deleteTestCounter = 0;

    beforeEach(async () => {
      // Create a period to delete with unique date
      deleteTestCounter++;
      const uniqueDate = `2025-09-${String(deleteTestCounter).padStart(2, '0')}`;
      const result = await dbRun(
        'INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete) VALUES (?, ?, ?, ?, ?)',
        [testMetricId, uniqueDate, 80, 100, 75]
      );
      periodToDelete = result.lastID;
    });

    test('should delete a period as admin', async () => {
      const response = await request(app)
        .delete(`/api/metric-periods/${periodToDelete}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deletion
      const period = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [periodToDelete]);
      expect(period).toBeUndefined();
    });

    test('should reject delete for non-existent period', async () => {
      const response = await request(app)
        .delete('/api/metric-periods/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Period not found');
    });

    test('should reject delete without authentication', async () => {
      const response = await request(app)
        .delete(`/api/metric-periods/${periodToDelete}`);

      expect(response.status).toBe(401);
    });

    test('should reject delete by user without project permission', async () => {
      // Create a new viewer without any permissions
      await request(app).post('/api/auth/register').send({
        name: 'No Perm User',
        email: 'noperm@periods.test',
        password: 'noperm123'
      });
      const noPermLogin = await request(app).post('/api/auth/login').send({
        email: 'noperm@periods.test',
        password: 'noperm123'
      });

      const response = await request(app)
        .delete(`/api/metric-periods/${periodToDelete}`)
        .set('Authorization', `Bearer ${noPermLogin.body.token}`);

      expect(response.status).toBe(403);
    });

    test('should create audit log entry for period deletion', async () => {
      await request(app)
        .delete(`/api/metric-periods/${periodToDelete}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Check audit log
      const auditEntry = await dbGet(
        'SELECT * FROM audit_log WHERE table_name = ? AND record_id = ? AND action = ?',
        ['metric_periods', periodToDelete, 'DELETE']
      );
      expect(auditEntry).toBeTruthy();
    });
  });

  describe('Edge Cases and Validation', () => {
    test('should handle zero values correctly', async () => {
      const response = await request(app)
        .post('/api/metric-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          metric_id: testMetricId,
          reporting_date: '2025-10-01',
          expected: 0,
          target: 100,
          complete: 0
        });

      expect(response.status).toBe(200);

      const period = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [response.body.id]);
      expect(period.expected).toBe(0);
      expect(period.complete).toBe(0);
    });

    test('should handle negative values', async () => {
      // Some metrics might track decreasing values
      const response = await request(app)
        .post('/api/metric-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          metric_id: testMetricId,
          reporting_date: '2025-10-15',
          expected: -10,
          target: -100,
          complete: -5
        });

      expect(response.status).toBe(200);

      const period = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [response.body.id]);
      expect(period.expected).toBe(-10);
      expect(period.complete).toBe(-5);
    });

    test('should handle decimal values', async () => {
      const response = await request(app)
        .post('/api/metric-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          metric_id: testMetricId,
          reporting_date: '2025-11-20',
          expected: 45.5,
          target: 100.75,
          complete: 42.25
        });

      expect(response.status).toBe(200);

      const period = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [response.body.id]);
      expect(period.expected).toBe(45.5);
      expect(period.target).toBe(100.75);
      expect(period.complete).toBe(42.25);
    });

    test('should handle large values', async () => {
      const response = await request(app)
        .post('/api/metric-periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          metric_id: testMetricId,
          reporting_date: '2025-11-15',
          expected: 1000000,
          target: 10000000,
          complete: 999999
        });

      expect(response.status).toBe(200);

      const period = await dbGet('SELECT * FROM metric_periods WHERE id = ?', [response.body.id]);
      expect(period.expected).toBe(1000000);
      expect(period.target).toBe(10000000);
    });
  });
});
