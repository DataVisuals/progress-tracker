const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-feedback.db');

let app, adminToken, pmToken, viewerToken;
let testFeedbackId;

describe('Feedback API Tests', () => {
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
      email: 'admin@feedback.test',
      password: 'admin123'
    });

    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@feedback.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@feedback.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create PM user
    await request(app).post('/api/auth/register').send({
      name: 'PM User',
      email: 'pm@feedback.test',
      password: 'pm123'
    });
    const pmUser = await dbGet('SELECT * FROM users WHERE email = ?', ['pm@feedback.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['pm', pmUser.id]);

    const pmLogin = await request(app).post('/api/auth/login').send({
      email: 'pm@feedback.test',
      password: 'pm123'
    });
    pmToken = pmLogin.body.token;

    // Create viewer user
    await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@feedback.test',
      password: 'viewer123'
    });
    const viewerUser = await dbGet('SELECT * FROM users WHERE email = ?', ['viewer@feedback.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['viewer', viewerUser.id]);

    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: 'viewer@feedback.test',
      password: 'viewer123'
    });
    viewerToken = viewerLogin.body.token;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/feedback', () => {
    test('should retrieve all feedback without authentication', async () => {
      const response = await request(app).get('/api/feedback');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should filter feedback by status', async () => {
      const response = await request(app).get('/api/feedback?status=open');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/feedback', () => {
    test('should create feedback as authenticated user', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          text: 'This is a test feedback'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.text).toBe('This is a test feedback');
      expect(response.body.status).toBe('open');
      testFeedbackId = response.body.id;
    });

    test('should reject feedback creation without authentication', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({
          text: 'Unauthenticated Feedback'
        });

      expect(response.status).toBe(401);
    });

    test('should reject feedback creation without text', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    test('should reject feedback creation with empty text', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          text: '   '
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/feedback/:id/respond', () => {
    test('should allow PM to respond to feedback', async () => {
      const response = await request(app)
        .put(`/api/feedback/${testFeedbackId}/respond`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          pm_response: 'Thank you for your feedback. We are looking into this.'
        });

      expect(response.status).toBe(200);
      expect(response.body.pm_response).toBe('Thank you for your feedback. We are looking into this.');
      expect(response.body).toHaveProperty('responded_by');
      expect(response.body).toHaveProperty('responded_at');
    });

    test('should allow admin to respond to feedback', async () => {
      // Create another feedback
      const feedbackResponse = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          text: 'Testing admin response to feedback'
        });

      const response = await request(app)
        .put(`/api/feedback/${feedbackResponse.body.id}/respond`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pm_response: 'Admin response here'
        });

      expect(response.status).toBe(200);
      expect(response.body.pm_response).toBe('Admin response here');
    });

    test('should reject viewer attempting to respond', async () => {
      const response = await request(app)
        .put(`/api/feedback/${testFeedbackId}/respond`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          pm_response: 'Viewer trying to respond'
        });

      expect(response.status).toBe(403);
    });

    test('should reject response without authentication', async () => {
      const response = await request(app)
        .put(`/api/feedback/${testFeedbackId}/respond`)
        .send({
          pm_response: 'Unauthenticated response'
        });

      expect(response.status).toBe(401);
    });

    test('should reject response without response text', async () => {
      const response = await request(app)
        .put(`/api/feedback/${testFeedbackId}/respond`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    test('should return 404 for non-existent feedback', async () => {
      const response = await request(app)
        .put('/api/feedback/99999/respond')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          pm_response: 'Response to non-existent feedback'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/feedback/:id/resolve', () => {
    test('should allow PM to resolve feedback', async () => {
      const response = await request(app)
        .put(`/api/feedback/${testFeedbackId}/resolve`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          resolved: true
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('resolved');
      expect(response.body).toHaveProperty('resolved_by');
      expect(response.body).toHaveProperty('resolved_at');
    });

    test('should allow PM to reopen feedback', async () => {
      const response = await request(app)
        .put(`/api/feedback/${testFeedbackId}/resolve`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          resolved: false
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('open');
    });

    test('should allow admin to resolve feedback', async () => {
      const response = await request(app)
        .put(`/api/feedback/${testFeedbackId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resolved: true
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('resolved');
    });

    test('should reject viewer attempting to resolve', async () => {
      const response = await request(app)
        .put(`/api/feedback/${testFeedbackId}/resolve`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          resolved: true
        });

      expect(response.status).toBe(403);
    });

    test('should reject resolve without authentication', async () => {
      const response = await request(app)
        .put(`/api/feedback/${testFeedbackId}/resolve`)
        .send({
          resolved: true
        });

      expect(response.status).toBe(401);
    });

    test('should return 404 for non-existent feedback', async () => {
      const response = await request(app)
        .put('/api/feedback/99999/resolve')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          resolved: true
        });

      expect(response.status).toBe(404);
    });
  });

  describe('Feedback Workflow Integration', () => {
    test('should complete full feedback lifecycle', async () => {
      // 1. Viewer creates feedback
      const createResponse = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          text: 'Testing complete workflow for feedback'
        });

      expect(createResponse.status).toBe(201);
      const feedbackId = createResponse.body.id;

      // 2. Get all feedback and verify it's there
      const getAllResponse = await request(app).get('/api/feedback');
      expect(getAllResponse.status).toBe(200);
      const feedback = getAllResponse.body.find(f => f.id === feedbackId);
      expect(feedback).toBeDefined();
      expect(feedback.status).toBe('open');

      // 3. PM responds
      const respondResponse = await request(app)
        .put(`/api/feedback/${feedbackId}/respond`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          pm_response: 'Great suggestion! We will consider this.'
        });

      expect(respondResponse.status).toBe(200);
      expect(respondResponse.body.pm_response).toBe('Great suggestion! We will consider this.');

      // 4. PM resolves
      const resolveResponse = await request(app)
        .put(`/api/feedback/${feedbackId}/resolve`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          resolved: true
        });

      expect(resolveResponse.status).toBe(200);
      expect(resolveResponse.body.status).toBe('resolved');

      // 5. Filter by resolved status
      const filterResponse = await request(app).get('/api/feedback?status=resolved');
      expect(filterResponse.status).toBe(200);
      const resolvedFeedback = filterResponse.body.find(f => f.id === feedbackId);
      expect(resolvedFeedback).toBeDefined();
      expect(resolvedFeedback.status).toBe('resolved');
    });
  });
});
