const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-comments.db');

let app, adminToken, editorToken;
let testProjectId, testMetricId, testPeriodId, testCommentId;

describe('Comments API Tests', () => {
  beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.NODE_ENV = 'test';
    process.env.DB_PATH = TEST_DB_PATH;
    app = require('../server');

    const { dbRun, dbGet } = require('../db');

    // Create admin user
    await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      email: 'admin@comments.test',
      password: 'admin123'
    });
    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@comments.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@comments.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create editor user
    await request(app).post('/api/auth/register').send({
      name: 'Editor User',
      email: 'editor@comments.test',
      password: 'editor123'
    });
    const editorUser = await dbGet('SELECT * FROM users WHERE email = ?', ['editor@comments.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['editor', editorUser.id]);
    const editorLogin = await request(app).post('/api/auth/login').send({
      email: 'editor@comments.test',
      password: 'editor123'
    });
    editorToken = editorLogin.body.token;

    // Create test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Project for Comments',
        description: 'Testing comments'
      });
    testProjectId = projectResponse.body.id;

    // Create test metric
    const metricResponse = await request(app)
      .post(`/api/projects/${testProjectId}/metrics`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Metric',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        frequency: 'monthly',
        final_target: 100
      });
    testMetricId = metricResponse.body.id;

    // Create a test period manually
    const periodResponse = await request(app)
      .post('/api/metric-periods')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        metric_id: testMetricId,
        reporting_date: '2024-01-01',
        expected: 10,
        target: 10,
        complete: 8
      });
    testPeriodId = periodResponse.body.id;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/periods/:periodId/comments', () => {
    test('should retrieve comments for a period', async () => {
      const response = await request(app)
        .get(`/api/periods/${testPeriodId}/comments`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return empty array for period with no comments', async () => {
      const response = await request(app)
        .get(`/api/periods/${testPeriodId}/comments`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(0);
    });
  });

  describe('POST /api/periods/:periodId/comments', () => {
    test('should create a comment', async () => {
      const response = await request(app)
        .post(`/api/periods/${testPeriodId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          comment_text: 'This is a test comment'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      testCommentId = response.body.id;

      // Verify comment was created
      const commentsResponse = await request(app)
        .get(`/api/periods/${testPeriodId}/comments`);

      expect(commentsResponse.body.length).toBe(1);
      expect(commentsResponse.body[0].comment_text).toBe('This is a test comment');
    });

    test('should reject comment without text', async () => {
      const response = await request(app)
        .post(`/api/periods/${testPeriodId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(500); // API returns 500 when comment_text is null
    });

    test('should reject comment without authentication', async () => {
      const response = await request(app)
        .post(`/api/periods/${testPeriodId}/comments`)
        .send({
          comment_text: 'Unauthorized comment'
        });

      expect(response.status).toBe(401);
    });

    test('should create comment with different types', async () => {
      const comments = ['First comment', 'Second comment', 'Third comment'];

      for (const commentText of comments) {
        const response = await request(app)
          .post(`/api/periods/${testPeriodId}/comments`)
          .set('Authorization', `Bearer ${editorToken}`)
          .send({
            comment_text: commentText
          });

        expect(response.status).toBe(200);
      }

      // Verify all comments were created
      const commentsResponse = await request(app)
        .get(`/api/periods/${testPeriodId}/comments`);

      expect(commentsResponse.body.length).toBeGreaterThanOrEqual(4); // 1 from first test + 3 from this test
    });
  });

  describe('PUT /api/comments/:id', () => {
    test('should update own comment', async () => {
      const response = await request(app)
        .put(`/api/comments/${testCommentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          comment_text: 'Updated comment text'
        });

      expect(response.status).toBe(200);

      // Verify update
      const commentsResponse = await request(app)
        .get(`/api/periods/${testPeriodId}/comments`);

      const comment = commentsResponse.body.find(c => c.id === testCommentId);
      expect(comment.comment_text).toBe('Updated comment text');
    });

    test('should reject update without text', async () => {
      const response = await request(app)
        .put(`/api/comments/${testCommentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    test('should reject update of non-existent comment', async () => {
      const response = await request(app)
        .put('/api/comments/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          comment_text: 'Should fail'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/comments/:id', () => {
    let commentToDelete;

    beforeAll(async () => {
      const response = await request(app)
        .post(`/api/periods/${testPeriodId}/comments`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          comment_text: 'Comment to be deleted'
        });
      commentToDelete = response.body.id;
    });

    test('should delete own comment', async () => {
      const response = await request(app)
        .delete(`/api/comments/${commentToDelete}`)
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(200);

      // Verify deletion
      const commentsResponse = await request(app)
        .get(`/api/periods/${testPeriodId}/comments`);

      const comment = commentsResponse.body.find(c => c.id === commentToDelete);
      expect(comment).toBeUndefined();
    });

    test('should reject deletion without authentication', async () => {
      const response = await request(app)
        .delete(`/api/comments/${testCommentId}`);

      expect(response.status).toBe(401);
    });

    test('should handle deleting non-existent comment', async () => {
      const response = await request(app)
        .delete('/api/comments/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });
});
