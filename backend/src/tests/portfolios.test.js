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
    process.env.DB_PATH = TEST_DB_PATH;
    app = require('../server');

    // Create admin user
    await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      email: 'admin@portfolio.test',
      password: 'admin123'
    });

    // Set admin role in database manually (as register doesn't set role)
    const { dbRun, dbGet } = require('../db');
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
});
