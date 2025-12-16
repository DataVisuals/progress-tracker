const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-portfolios.db');

let app, adminToken, pmToken, viewerToken;
let testPortfolioId;

describe('Portfolio Management API Tests', () => {
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
      email: 'admin@portfolio.test',
      password: 'admin123'
    });

    // Set admin role in database manually (as register doesn't set role)
    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@portfolio.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@portfolio.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create PM user
    await request(app).post('/api/auth/register').send({
      name: 'PM User',
      email: 'pm@portfolio.test',
      password: 'pm123'
    });
    const pmUser = await dbGet('SELECT * FROM users WHERE email = ?', ['pm@portfolio.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['pm', pmUser.id]);

    const pmLogin = await request(app).post('/api/auth/login').send({
      email: 'pm@portfolio.test',
      password: 'pm123'
    });
    pmToken = pmLogin.body.token;

    // Create viewer user
    await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@portfolio.test',
      password: 'viewer123'
    });
    const viewerUser = await dbGet('SELECT * FROM users WHERE email = ?', ['viewer@portfolio.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['viewer', viewerUser.id]);

    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: 'viewer@portfolio.test',
      password: 'viewer123'
    });
    viewerToken = viewerLogin.body.token;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/portfolios', () => {
    test('should retrieve all portfolios without authentication', async () => {
      const response = await request(app).get('/api/portfolios');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/portfolios', () => {
    test('should create portfolio as admin', async () => {
      const response = await request(app)
        .post('/api/portfolios')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Portfolio',
          description: 'A test portfolio',
          color: '#ff5733',
          display_order: 1
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Portfolio');
      testPortfolioId = response.body.id;
    });

    test('should reject portfolio creation as PM', async () => {
      const response = await request(app)
        .post('/api/portfolios')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'PM Portfolio',
          description: 'Should fail'
        });

      expect(response.status).toBe(403);
    });

    test('should reject portfolio creation as viewer', async () => {
      const response = await request(app)
        .post('/api/portfolios')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          name: 'Viewer Portfolio',
          description: 'Should fail'
        });

      expect(response.status).toBe(403);
    });

    test('should reject portfolio creation without name', async () => {
      const response = await request(app)
        .post('/api/portfolios')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'No name'
        });

      expect(response.status).toBe(400);
    });

    test('should reject portfolio creation without authentication', async () => {
      const response = await request(app)
        .post('/api/portfolios')
        .send({
          name: 'Unauthenticated Portfolio'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/portfolios/:id', () => {
    test('should update portfolio as admin', async () => {
      const response = await request(app)
        .put(`/api/portfolios/${testPortfolioId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Portfolio',
          description: 'Updated description',
          color: '#00ff00',
          display_order: 2
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Portfolio');

      // Verify the update
      const getResponse = await request(app).get('/api/portfolios');
      const portfolio = getResponse.body.find(p => p.id === testPortfolioId);
      expect(portfolio.description).toBe('Updated description');
    });

    test('should reject portfolio update as non-admin', async () => {
      const response = await request(app)
        .put(`/api/portfolios/${testPortfolioId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'Should Fail'
        });

      expect(response.status).toBe(403);
    });

    test('should handle non-existent portfolio', async () => {
      const response = await request(app)
        .put('/api/portfolios/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Non-existent'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/portfolios/:id', () => {
    test('should reject portfolio deletion as non-admin', async () => {
      const response = await request(app)
        .delete(`/api/portfolios/${testPortfolioId}`)
        .set('Authorization', `Bearer ${pmToken}`);

      expect(response.status).toBe(403);
    });

    test('should delete portfolio as admin', async () => {
      const response = await request(app)
        .delete(`/api/portfolios/${testPortfolioId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify deletion
      const getResponse = await request(app).get('/api/portfolios');
      const portfolio = getResponse.body.find(p => p.id === testPortfolioId);
      expect(portfolio).toBeUndefined();
    });

    test('should handle deleting non-existent portfolio', async () => {
      const response = await request(app)
        .delete('/api/portfolios/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/portfolios/:id/report', () => {
    let reportPortfolioId, testProjectId, testMetricId;

    beforeAll(async () => {
      // Create a portfolio for report testing
      const portfolioResponse = await request(app)
        .post('/api/portfolios')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Report Test Portfolio',
          description: 'Testing portfolio reports',
          color: '#ff9900'
        });
      reportPortfolioId = portfolioResponse.body.id;

      // Create a project in this portfolio
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Project',
          description: 'Test project for report',
          portfolio_id: reportPortfolioId,
          initiative_manager: 'Test Manager',
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });
      testProjectId = projectResponse.body.id;

      // Create a metric for this project
      const metricResponse = await request(app)
        .post(`/api/projects/${testProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Metric',
          start_date: '2025-01-01',
          end_date: '2025-06-30',
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 100,
          amber_tolerance: 5,
          red_tolerance: 10
        });
      testMetricId = metricResponse.body.id;
    });

    test('should return portfolio report with summary and projects', async () => {
      const response = await request(app)
        .get(`/api/portfolios/${reportPortfolioId}/report`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('portfolio');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('redProjects');
      expect(response.body).toHaveProperty('amberProjects');
      expect(response.body).toHaveProperty('greenProjects');

      expect(response.body.portfolio.id).toBe(reportPortfolioId);
      expect(response.body.portfolio.name).toBe('Report Test Portfolio');
      expect(response.body.summary).toHaveProperty('totalProjects');
      expect(response.body.summary).toHaveProperty('totalMetrics');
      expect(response.body.summary).toHaveProperty('redCount');
      expect(response.body.summary).toHaveProperty('amberCount');
      expect(response.body.summary).toHaveProperty('greenCount');
    });

    test('should return 404 for non-existent portfolio', async () => {
      const response = await request(app)
        .get('/api/portfolios/99999/report');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Portfolio not found');
    });

    test('should include metrics sorted by variance (most delinquent first)', async () => {
      const response = await request(app)
        .get(`/api/portfolios/${reportPortfolioId}/report`);

      expect(response.status).toBe(200);

      // Check if projects have metrics array
      const allProjects = [
        ...response.body.redProjects,
        ...response.body.amberProjects,
        ...response.body.greenProjects
      ];

      if (allProjects.length > 0 && allProjects[0].metrics.length > 1) {
        const metrics = allProjects[0].metrics;
        // Verify metrics are sorted by variance (ascending = most negative first)
        for (let i = 0; i < metrics.length - 1; i++) {
          expect(metrics[i].variance).toBeLessThanOrEqual(metrics[i + 1].variance);
        }
      }
    });

    test('should be accessible without authentication', async () => {
      // Test without any auth token
      const response = await request(app)
        .get(`/api/portfolios/${reportPortfolioId}/report`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('portfolio');
    });

    test('should calculate RAG status correctly', async () => {
      const response = await request(app)
        .get(`/api/portfolios/${reportPortfolioId}/report`);

      expect(response.status).toBe(200);

      const allProjects = [
        ...response.body.redProjects,
        ...response.body.amberProjects,
        ...response.body.greenProjects
      ];

      allProjects.forEach(project => {
        project.metrics.forEach(metric => {
          expect(['red', 'amber', 'green', 'grey']).toContain(metric.ragStatus);
          expect(metric).toHaveProperty('variance');
          expect(metric).toHaveProperty('variancePercent');
          expect(metric).toHaveProperty('complete');
          expect(metric).toHaveProperty('expected');
        });
      });
    });

    test('should only include latest comment for red and amber metrics', async () => {
      const response = await request(app)
        .get(`/api/portfolios/${reportPortfolioId}/report`);

      expect(response.status).toBe(200);

      response.body.redProjects.forEach(project => {
        project.metrics.forEach(metric => {
          expect(metric.ragStatus).toBe('red');
          // Red metrics should have latestComment property (can be null)
          expect(metric).toHaveProperty('latestComment');
        });
      });

      response.body.amberProjects.forEach(project => {
        project.metrics.forEach(metric => {
          expect(metric.ragStatus).toBe('amber');
          // Amber metrics should have latestComment property (can be null)
          expect(metric).toHaveProperty('latestComment');
        });
      });

      response.body.greenProjects.forEach(project => {
        project.metrics.forEach(metric => {
          expect(['green', 'grey']).toContain(metric.ragStatus);
        });
      });
    });
  });

  // Comprehensive RAG calculation tests
  describe('RAG Status Calculation Verification', () => {
    let ragPortfolioId, ragProjectId, ragMetricId;
    let dbGet, dbRun, dbAll;

    beforeAll(async () => {
      // Get database functions
      const { createApp } = require('../server');
      const result = createApp(TEST_DB_PATH);
      dbGet = result.dbGet;
      dbRun = result.dbRun;
      dbAll = result.dbAll;

      // Create a portfolio for RAG tests
      const portfolioResponse = await request(app)
        .post('/api/portfolios')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'RAG Calculation Portfolio',
          color: '#00FF00'
        });
      ragPortfolioId = portfolioResponse.body.id;
    });

    beforeEach(async () => {
      // Create a fresh project for each test
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `RAG Test Project ${Date.now()}`,
          description: 'Project for RAG calculation testing',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          portfolio_id: ragPortfolioId
        });
      ragProjectId = projectResponse.body.id;

      // Create a metric with specific tolerances and past dates
      const metricResponse = await request(app)
        .post(`/api/projects/${ragProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'RAG Calc Metric',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 100,
          amber_tolerance: 5,
          red_tolerance: 10
        });

      ragMetricId = metricResponse.body.id;
    });

    test('should return GREEN when complete >= expected', async () => {
      // Update period with complete > expected (ahead of schedule)
      // Get the periods for the metric
      const periods = await dbAll(
        'SELECT id, reporting_date FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date DESC LIMIT 1',
        [ragMetricId]
      );

      if (periods.length > 0) {
        // Set complete > expected for GREEN status
        await dbRun(
          'UPDATE metric_periods SET complete = 110, expected = 100 WHERE id = ?',
          [periods[0].id]
        );
      }

      const response = await request(app)
        .get(`/api/portfolios/${ragPortfolioId}/report`);

      expect(response.status).toBe(200);

      const allProjects = [
        ...response.body.redProjects,
        ...response.body.amberProjects,
        ...response.body.greenProjects
      ];

      const project = allProjects.find(p => p.id === ragProjectId);
      if (project && project.metrics.length > 0) {
        const metric = project.metrics.find(m => m.id === ragMetricId);
        if (metric) {
          expect(metric.ragStatus).toBe('green');
          expect(metric.variance).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test('should return GREEN when variance is within tolerance (< 5%)', async () => {
      // 3% behind (within 5% amber tolerance) = GREEN
      const periods = await dbAll(
        'SELECT id FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date DESC LIMIT 1',
        [ragMetricId]
      );

      if (periods.length > 0) {
        // complete = 97, expected = 100 → variance = -3 → 3%
        await dbRun(
          'UPDATE metric_periods SET complete = 97, expected = 100 WHERE id = ?',
          [periods[0].id]
        );
      }

      const response = await request(app)
        .get(`/api/portfolios/${ragPortfolioId}/report`);

      expect(response.status).toBe(200);

      const allProjects = [
        ...response.body.redProjects,
        ...response.body.amberProjects,
        ...response.body.greenProjects
      ];

      const project = allProjects.find(p => p.id === ragProjectId);
      if (project && project.metrics.length > 0) {
        const metric = project.metrics.find(m => m.id === ragMetricId);
        if (metric) {
          expect(metric.ragStatus).toBe('green');
          expect(metric.variancePercent).toBeLessThanOrEqual(5);
        }
      }
    });

    test('should return AMBER when variance exceeds amber tolerance (5-10%)', async () => {
      // 8% behind (exceeds 5% amber but within 10% red) = AMBER
      const periods = await dbAll(
        'SELECT id, reporting_date FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date DESC LIMIT 1',
        [ragMetricId]
      );

      if (periods.length > 0) {
        // complete = 92, expected = 100 → variance = -8 → 8%
        await dbRun(
          'UPDATE metric_periods SET complete = 92, expected = 100 WHERE id = ?',
          [periods[0].id]
        );
      }

      const response = await request(app)
        .get(`/api/portfolios/${ragPortfolioId}/report`);

      expect(response.status).toBe(200);

      const project = response.body.amberProjects.find(p => p.id === ragProjectId);
      expect(project).toBeDefined();

      if (project) {
        const metric = project.metrics.find(m => m.id === ragMetricId);
        expect(metric).toBeDefined();
        if (metric) {
          expect(metric.ragStatus).toBe('amber');
          expect(metric.variancePercent).toBeGreaterThan(5);
          expect(metric.variancePercent).toBeLessThanOrEqual(10);
        }
      }
    });

    test('should return RED when variance exceeds red tolerance (> 10%)', async () => {
      // 15% behind (exceeds 10% red) = RED
      const periods = await dbAll(
        'SELECT id FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date DESC LIMIT 1',
        [ragMetricId]
      );

      if (periods.length > 0) {
        // complete = 85, expected = 100 → variance = -15 → 15%
        await dbRun(
          'UPDATE metric_periods SET complete = 85, expected = 100 WHERE id = ?',
          [periods[0].id]
        );
      }

      const response = await request(app)
        .get(`/api/portfolios/${ragPortfolioId}/report`);

      expect(response.status).toBe(200);

      const project = response.body.redProjects.find(p => p.id === ragProjectId);
      expect(project).toBeDefined();

      if (project) {
        const metric = project.metrics.find(m => m.id === ragMetricId);
        expect(metric).toBeDefined();
        if (metric) {
          expect(metric.ragStatus).toBe('red');
          expect(metric.variancePercent).toBeGreaterThan(10);
        }
      }
    });

    test('should return GREY when expected is 0', async () => {
      const periods = await dbAll(
        'SELECT id FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date DESC LIMIT 1',
        [ragMetricId]
      );

      if (periods.length > 0) {
        // Set expected to 0
        await dbRun(
          'UPDATE metric_periods SET complete = 10, expected = 0 WHERE id = ?',
          [periods[0].id]
        );
      }

      const response = await request(app)
        .get(`/api/portfolios/${ragPortfolioId}/report`);

      expect(response.status).toBe(200);

      // With expected=0, metric should show grey status
      const allProjects = [
        ...response.body.redProjects,
        ...response.body.amberProjects,
        ...response.body.greenProjects
      ];

      const project = allProjects.find(p => p.id === ragProjectId);
      if (project && project.metrics.length > 0) {
        const metric = project.metrics.find(m => m.id === ragMetricId);
        if (metric) {
          expect(metric.ragStatus).toBe('grey');
        }
      }
    });

    test('should use previous period RAG when current period complete is null', async () => {
      // Get all periods and set up: previous period with good data, current period with null
      const periods = await dbAll(
        'SELECT id FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date DESC',
        [ragMetricId]
      );

      if (periods.length >= 2) {
        // Set the latest (current) period to null complete
        await dbRun(
          'UPDATE metric_periods SET complete = NULL, expected = 100 WHERE id = ?',
          [periods[0].id]
        );
        // Set previous period to green (on track)
        await dbRun(
          'UPDATE metric_periods SET complete = 100, expected = 100 WHERE id = ?',
          [periods[1].id]
        );
      }

      const response = await request(app)
        .get(`/api/portfolios/${ragPortfolioId}/report`);

      expect(response.status).toBe(200);

      const allProjects = [
        ...response.body.redProjects,
        ...response.body.amberProjects,
        ...response.body.greenProjects
      ];

      const project = allProjects.find(p => p.id === ragProjectId);
      if (project && project.metrics.length > 0) {
        const metric = project.metrics.find(m => m.id === ragMetricId);
        if (metric) {
          // Should use previous period's GREEN status since current has null complete
          expect(metric.ragStatus).toBe('green');
        }
      }
    });

    test('should return GREEN at exactly amber tolerance boundary (5%)', async () => {
      // Exactly 5% behind = GREEN (boundary uses >)
      const periods = await dbAll(
        'SELECT id FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date DESC LIMIT 1',
        [ragMetricId]
      );

      if (periods.length > 0) {
        // complete = 95, expected = 100 → variance = -5 → exactly 5%
        await dbRun(
          'UPDATE metric_periods SET complete = 95, expected = 100 WHERE id = ?',
          [periods[0].id]
        );
      }

      const response = await request(app)
        .get(`/api/portfolios/${ragPortfolioId}/report`);

      expect(response.status).toBe(200);

      // At exactly 5% boundary, should be green (tolerances use >)
      const greenProject = response.body.greenProjects.find(p => p.id === ragProjectId);
      expect(greenProject).toBeDefined();

      if (greenProject) {
        const metric = greenProject.metrics.find(m => m.id === ragMetricId);
        if (metric) {
          expect(metric.ragStatus).toBe('green');
          expect(metric.variancePercent).toBeCloseTo(5, 0);
        }
      }
    });

    test('should return AMBER at exactly red tolerance boundary (10%)', async () => {
      // Exactly 10% behind = AMBER (boundary uses >)
      const periods = await dbAll(
        'SELECT id FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date DESC LIMIT 1',
        [ragMetricId]
      );

      if (periods.length > 0) {
        // complete = 90, expected = 100 → variance = -10 → exactly 10%
        await dbRun(
          'UPDATE metric_periods SET complete = 90, expected = 100 WHERE id = ?',
          [periods[0].id]
        );
      }

      const response = await request(app)
        .get(`/api/portfolios/${ragPortfolioId}/report`);

      expect(response.status).toBe(200);

      // At exactly 10% boundary, should be amber (tolerances use >)
      const amberProject = response.body.amberProjects.find(p => p.id === ragProjectId);
      expect(amberProject).toBeDefined();

      if (amberProject) {
        const metric = amberProject.metrics.find(m => m.id === ragMetricId);
        if (metric) {
          expect(metric.ragStatus).toBe('amber');
          expect(metric.variancePercent).toBeCloseTo(10, 0);
        }
      }
    });

    test('should return GREY for metrics that start in the future', async () => {
      // Create a metric that starts in the future
      const futureStart = new Date();
      futureStart.setMonth(futureStart.getMonth() + 1);
      const futureEnd = new Date();
      futureEnd.setMonth(futureEnd.getMonth() + 7);

      const futureMetricResponse = await request(app)
        .post(`/api/projects/${ragProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Future Metric',
          start_date: futureStart.toISOString().split('T')[0],
          end_date: futureEnd.toISOString().split('T')[0],
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 100,
          amber_tolerance: 5,
          red_tolerance: 10
        });

      const futureMetricId = futureMetricResponse.body.id;

      const response = await request(app)
        .get(`/api/portfolios/${ragPortfolioId}/report`);

      expect(response.status).toBe(200);

      const allProjects = [
        ...response.body.redProjects,
        ...response.body.amberProjects,
        ...response.body.greenProjects
      ];

      const project = allProjects.find(p => p.id === ragProjectId);
      if (project && project.metrics.length > 0) {
        const metric = project.metrics.find(m => m.id === futureMetricId);
        if (metric) {
          // Future metrics should show grey
          expect(metric.ragStatus).toBe('grey');
        }
      }
    });

    test('should show RED for current period with data that is behind schedule', async () => {
      // Current period with data (complete > 0) should show actual RAG status
      const today = new Date();
      const startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 6);

      // Create a metric with periods spanning current date
      const currentMetricResponse = await request(app)
        .post(`/api/projects/${ragProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Current Period Metric',
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 100,
          amber_tolerance: 5,
          red_tolerance: 10
        });

      const currentMetricId = currentMetricResponse.body.id;

      // Get all periods for this metric
      const periods = await dbAll(
        'SELECT id, reporting_date FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date ASC',
        [currentMetricId]
      );

      // Find the current period (period that has started but next hasn't)
      let currentPeriodId = null;
      for (let i = 0; i < periods.length; i++) {
        const periodDate = new Date(periods[i].reporting_date);
        if (periodDate <= today) {
          if (i + 1 < periods.length) {
            const nextPeriodDate = new Date(periods[i + 1].reporting_date);
            if (today < nextPeriodDate) {
              currentPeriodId = periods[i].id;
              break;
            }
          } else {
            currentPeriodId = periods[i].id;
          }
        }
      }

      if (currentPeriodId) {
        // Set it to be 15% behind - should show RED since data exists
        await dbRun(
          'UPDATE metric_periods SET complete = 85, expected = 100 WHERE id = ?',
          [currentPeriodId]
        );

        const response = await request(app)
          .get(`/api/portfolios/${ragPortfolioId}/report`);

        expect(response.status).toBe(200);

        const allProjects = [
          ...response.body.redProjects,
          ...response.body.amberProjects,
          ...response.body.greenProjects
        ];

        const project = allProjects.find(p => p.id === ragProjectId);
        if (project && project.metrics.length > 0) {
          const metric = project.metrics.find(m => m.id === currentMetricId);
          if (metric) {
            // Current period has data (complete=85), so show RED
            expect(metric.ragStatus).toBe('red');
          }
        }
      }
    });

    test('should use previous period status when current has no data', async () => {
      // When current period has complete=0, use previous period's status
      const today = new Date();
      const startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 2);
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 6);

      // Create a metric with periods spanning current date
      const currentMetricResponse = await request(app)
        .post(`/api/projects/${ragProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Fallback Period Metric',
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 100,
          amber_tolerance: 5,
          red_tolerance: 10
        });

      const currentMetricId = currentMetricResponse.body.id;

      // Get all periods for this metric
      const periods = await dbAll(
        'SELECT id, reporting_date FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date ASC',
        [currentMetricId]
      );

      // Find the current period and previous period
      let currentPeriodId = null;
      let previousPeriodId = null;
      for (let i = 0; i < periods.length; i++) {
        const periodDate = new Date(periods[i].reporting_date);
        if (periodDate <= today) {
          if (i + 1 < periods.length) {
            const nextPeriodDate = new Date(periods[i + 1].reporting_date);
            if (today < nextPeriodDate) {
              currentPeriodId = periods[i].id;
              if (i > 0) previousPeriodId = periods[i - 1].id;
              break;
            }
          } else {
            currentPeriodId = periods[i].id;
            if (i > 0) previousPeriodId = periods[i - 1].id;
          }
        }
      }

      if (currentPeriodId && previousPeriodId) {
        // Set previous period to be 15% behind (RED)
        await dbRun(
          'UPDATE metric_periods SET complete = 85, expected = 100 WHERE id = ?',
          [previousPeriodId]
        );
        // Current period has no data (complete=0)
        await dbRun(
          'UPDATE metric_periods SET complete = 0, expected = 110 WHERE id = ?',
          [currentPeriodId]
        );

        const response = await request(app)
          .get(`/api/portfolios/${ragPortfolioId}/report`);

        expect(response.status).toBe(200);

        const allProjects = [
          ...response.body.redProjects,
          ...response.body.amberProjects,
          ...response.body.greenProjects
        ];

        const project = allProjects.find(p => p.id === ragProjectId);
        if (project && project.metrics.length > 0) {
          const metric = project.metrics.find(m => m.id === currentMetricId);
          if (metric) {
            // Current period has no data, should use previous period's RED status
            expect(metric.ragStatus).toBe('red');
          }
        }
      }
    });

    test('should classify project as RED if any metric is red', async () => {
      // Create a second metric that's green
      const greenMetricResponse = await request(app)
        .post(`/api/projects/${ragProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Green Metric',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 100,
          amber_tolerance: 5,
          red_tolerance: 10
        });

      // Set original metric to RED
      const redPeriods = await dbAll(
        'SELECT id FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date DESC LIMIT 1',
        [ragMetricId]
      );
      if (redPeriods.length > 0) {
        await dbRun(
          'UPDATE metric_periods SET complete = 85, expected = 100 WHERE id = ?',
          [redPeriods[0].id]
        );
      }

      // Set new metric to GREEN
      const greenPeriods = await dbAll(
        'SELECT id FROM metric_periods WHERE metric_id = ? ORDER BY reporting_date DESC LIMIT 1',
        [greenMetricResponse.body.id]
      );
      if (greenPeriods.length > 0) {
        await dbRun(
          'UPDATE metric_periods SET complete = 110, expected = 100 WHERE id = ?',
          [greenPeriods[0].id]
        );
      }

      const response = await request(app)
        .get(`/api/portfolios/${ragPortfolioId}/report`);

      expect(response.status).toBe(200);

      // Project should be in red projects (worst metric wins)
      const redProject = response.body.redProjects.find(p => p.id === ragProjectId);
      expect(redProject).toBeDefined();
    });
  });

  // Cascade delete verification tests
  describe('Cascade Delete Verification', () => {
    let cascadePortfolioId, cascadeProjectId, cascadeMetricId, cascadePeriodId;
    let dbGet, dbRun, dbAll;

    beforeAll(async () => {
      // Get database functions
      const { createApp } = require('../server');
      const result = createApp(TEST_DB_PATH);
      dbGet = result.dbGet;
      dbRun = result.dbRun;
      dbAll = result.dbAll;

      // Create a portfolio for cascade tests
      const portfolioResponse = await request(app)
        .post('/api/portfolios')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Cascade Test Portfolio',
          color: '#FF0000'
        });
      cascadePortfolioId = portfolioResponse.body.id;
    });

    beforeEach(async () => {
      // Create a project with full hierarchy for each test
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Cascade Test Project ${Date.now()}`,
          description: 'Project for cascade delete testing',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          portfolio_id: cascadePortfolioId
        });
      cascadeProjectId = projectResponse.body.id;

      // Create a metric
      const metricResponse = await request(app)
        .post(`/api/projects/${cascadeProjectId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Cascade Test Metric',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          frequency: 'monthly',
          progression_type: 'linear',
          final_target: 100
        });
      cascadeMetricId = metricResponse.body.id;

      // Get a period ID
      const periods = await dbAll(
        'SELECT id FROM metric_periods WHERE metric_id = ? LIMIT 1',
        [cascadeMetricId]
      );
      cascadePeriodId = periods[0]?.id;
    });

    test('should cascade delete metrics when project is deleted', async () => {
      // Verify metric exists before delete
      const metricBefore = await dbGet(
        'SELECT id FROM metrics WHERE id = ?',
        [cascadeMetricId]
      );
      expect(metricBefore).toBeDefined();

      // Delete the project
      const response = await request(app)
        .delete(`/api/projects/${cascadeProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify metric was cascade deleted
      const metricAfter = await dbGet(
        'SELECT id FROM metrics WHERE id = ?',
        [cascadeMetricId]
      );
      expect(metricAfter).toBeUndefined();
    });

    test('should cascade delete periods when project is deleted', async () => {
      // Count periods before delete
      const periodsBefore = await dbAll(
        'SELECT id FROM metric_periods WHERE metric_id = ?',
        [cascadeMetricId]
      );
      expect(periodsBefore.length).toBeGreaterThan(0);

      // Delete the project
      await request(app)
        .delete(`/api/projects/${cascadeProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify periods were cascade deleted
      const periodsAfter = await dbAll(
        'SELECT id FROM metric_periods WHERE metric_id = ?',
        [cascadeMetricId]
      );
      expect(periodsAfter.length).toBe(0);
    });

    test('should cascade delete comments when project is deleted', async () => {
      // Create a comment on a period
      await request(app)
        .post(`/api/periods/${cascadePeriodId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          comment_text: 'Test comment for cascade delete'
        });

      // Verify comment exists
      const commentBefore = await dbGet(
        'SELECT id FROM comments WHERE period_id = ?',
        [cascadePeriodId]
      );
      expect(commentBefore).toBeDefined();

      // Delete the project
      await request(app)
        .delete(`/api/projects/${cascadeProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify comment was cascade deleted
      const commentAfter = await dbGet(
        'SELECT id FROM comments WHERE period_id = ?',
        [cascadePeriodId]
      );
      expect(commentAfter).toBeUndefined();
    });

    test('should cascade delete periods when metric is deleted', async () => {
      // Count periods before delete
      const periodsBefore = await dbAll(
        'SELECT id FROM metric_periods WHERE metric_id = ?',
        [cascadeMetricId]
      );
      expect(periodsBefore.length).toBeGreaterThan(0);

      // Delete the metric
      const response = await request(app)
        .delete(`/api/metrics/${cascadeMetricId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify periods were cascade deleted
      const periodsAfter = await dbAll(
        'SELECT id FROM metric_periods WHERE metric_id = ?',
        [cascadeMetricId]
      );
      expect(periodsAfter.length).toBe(0);
    });

    test('should cascade delete comments when metric is deleted', async () => {
      // Create a comment on a period
      await request(app)
        .post(`/api/periods/${cascadePeriodId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          comment_text: 'Test comment for metric cascade'
        });

      // Verify comment exists
      const commentBefore = await dbGet(
        'SELECT id FROM comments WHERE period_id = ?',
        [cascadePeriodId]
      );
      expect(commentBefore).toBeDefined();

      // Delete the metric
      await request(app)
        .delete(`/api/metrics/${cascadeMetricId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify comment was cascade deleted
      const commentAfter = await dbGet(
        'SELECT id FROM comments WHERE period_id = ?',
        [cascadePeriodId]
      );
      expect(commentAfter).toBeUndefined();
    });

    test('should cascade delete project links when project is deleted', async () => {
      // Create a project link
      const linkResponse = await request(app)
        .post(`/api/projects/${cascadeProjectId}/links`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          label: 'JIRA',
          url: 'https://jira.example.com/browse/TEST'
        });

      const linkId = linkResponse.body.id;

      // Verify link exists
      const linkBefore = await dbGet(
        'SELECT id FROM project_links WHERE id = ?',
        [linkId]
      );
      expect(linkBefore).toBeDefined();

      // Delete the project
      await request(app)
        .delete(`/api/projects/${cascadeProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify link was cascade deleted
      const linkAfter = await dbGet(
        'SELECT id FROM project_links WHERE id = ?',
        [linkId]
      );
      expect(linkAfter).toBeUndefined();
    });

    test('should cascade delete CRAIDs when project is deleted', async () => {
      // Create a CRAID
      const craidResponse = await request(app)
        .post(`/api/projects/${cascadeProjectId}/craids`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'risk',
          title: 'Test Risk',
          description: 'Test risk for cascade delete'
        });

      const craidId = craidResponse.body.id;

      // Verify CRAID exists
      const craidBefore = await dbGet(
        'SELECT id FROM craids WHERE id = ?',
        [craidId]
      );
      expect(craidBefore).toBeDefined();

      // Delete the project
      await request(app)
        .delete(`/api/projects/${cascadeProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify CRAID was cascade deleted
      const craidAfter = await dbGet(
        'SELECT id FROM craids WHERE id = ?',
        [craidId]
      );
      expect(craidAfter).toBeUndefined();
    });

    test('should NOT cascade delete project when portfolio is deleted', async () => {
      // Create a separate portfolio and project for this test
      const testPortfolioResponse = await request(app)
        .post('/api/portfolios')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Portfolio ${Date.now()}`,
          color: '#0000FF'
        });
      const testPortfolioId = testPortfolioResponse.body.id;

      const testProjectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Project ${Date.now()}`,
          description: 'Test project',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          portfolio_id: testPortfolioId
        });
      const testProjectId = testProjectResponse.body.id;

      // Delete the portfolio
      await request(app)
        .delete(`/api/portfolios/${testPortfolioId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify project still exists (portfolio_id should be set to NULL)
      const projectAfter = await dbGet(
        'SELECT id, portfolio_id FROM projects WHERE id = ?',
        [testProjectId]
      );
      expect(projectAfter).toBeDefined();
      expect(projectAfter.portfolio_id).toBeNull();
    });

    test('should cascade delete project permissions when project is deleted', async () => {
      // Grant PM permission to the project
      const pmUser = await dbGet('SELECT id FROM users WHERE email = ?', ['pm@portfolio.test']);
      if (pmUser) {
        await dbRun(
          'INSERT OR IGNORE INTO project_permissions (project_id, user_id) VALUES (?, ?)',
          [cascadeProjectId, pmUser.id]
        );

        // Verify permission exists
        const permBefore = await dbGet(
          'SELECT id FROM project_permissions WHERE project_id = ? AND user_id = ?',
          [cascadeProjectId, pmUser.id]
        );
        expect(permBefore).toBeDefined();

        // Delete the project
        await request(app)
          .delete(`/api/projects/${cascadeProjectId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        // Verify permission was cascade deleted
        const permAfter = await dbGet(
          'SELECT id FROM project_permissions WHERE project_id = ? AND user_id = ?',
          [cascadeProjectId, pmUser.id]
        );
        expect(permAfter).toBeUndefined();
      }
    });
  });
});
