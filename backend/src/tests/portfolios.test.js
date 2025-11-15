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
        .post('/api/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId: testProjectId,
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
});
