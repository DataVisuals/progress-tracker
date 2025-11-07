const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-links.db');

let app, adminToken, editorToken;
let testProjectId, testLinkId;

describe('Project Links API Tests', () => {
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
      email: 'admin@links.test',
      password: 'admin123'
    });
    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@links.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@links.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create editor user
    await request(app).post('/api/auth/register').send({
      name: 'Editor User',
      email: 'editor@links.test',
      password: 'editor123'
    });
    const editorUser = await dbGet('SELECT * FROM users WHERE email = ?', ['editor@links.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['editor', editorUser.id]);
    const editorLogin = await request(app).post('/api/auth/login').send({
      email: 'editor@links.test',
      password: 'editor123'
    });
    editorToken = editorLogin.body.token;

    // Create test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Project for Links',
        description: 'Testing project links'
      });
    testProjectId = projectResponse.body.id;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/projects/:projectId/links', () => {
    test('should retrieve all links for a project', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/links`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return empty array for project with no links', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/links`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(0);
    });
  });

  describe('POST /api/projects/:projectId/links', () => {
    test('should create a project link', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/links`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          label: 'GitHub Repository',
          url: 'https://github.com/test/repo',
          display_order: 0
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('id');
      testLinkId = response.body.id;

      // Verify link was created
      const linksResponse = await request(app)
        .get(`/api/projects/${testProjectId}/links`);

      expect(linksResponse.body.length).toBe(1);
      expect(linksResponse.body[0].label).toBe('GitHub Repository');
      expect(linksResponse.body[0].url).toBe('https://github.com/test/repo');
    });

    test('should create multiple links with different labels', async () => {
      const links = [
        { label: 'Jira Board', url: 'https://jira.example.com/board/1' },
        { label: 'Documentation', url: 'https://docs.example.com' },
        { label: 'Slack Channel', url: 'https://slack.com/channel/123' }
      ];

      for (let i = 0; i < links.length; i++) {
        const response = await request(app)
          .post(`/api/projects/${testProjectId}/links`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            ...links[i],
            display_order: i + 1
          });

        expect(response.status).toBe(200);
      }

      // Verify all links were created
      const linksResponse = await request(app)
        .get(`/api/projects/${testProjectId}/links`);

      expect(linksResponse.body.length).toBe(4);
    });

    test('should reject link without label', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/links`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          url: 'https://example.com'
        });

      expect(response.status).toBe(400);
    });

    test('should reject link without URL', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/links`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          label: 'Missing URL'
        });

      expect(response.status).toBe(400);
    });

    test('should reject link creation without authentication', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/links`)
        .send({
          label: 'Unauthorized Link',
          url: 'https://example.com'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/project-links/:id', () => {
    test('should update project link', async () => {
      const response = await request(app)
        .put(`/api/project-links/${testLinkId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          label: 'Updated GitHub Repository',
          url: 'https://github.com/test/new-repo',
          display_order: 5
        });

      expect(response.status).toBe(200);

      // Verify update
      const linksResponse = await request(app)
        .get(`/api/projects/${testProjectId}/links`);

      const link = linksResponse.body.find(l => l.id === testLinkId);
      expect(link.label).toBe('Updated GitHub Repository');
      expect(link.url).toBe('https://github.com/test/new-repo');
      expect(link.display_order).toBe(5);
    });

    test('should reject update of non-existent link', async () => {
      const response = await request(app)
        .put('/api/project-links/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          label: 'Should fail',
          url: 'https://example.com'
        });

      expect(response.status).toBe(404);
    });

    test('should reject update without authentication', async () => {
      const response = await request(app)
        .put(`/api/project-links/${testLinkId}`)
        .send({
          label: 'Should fail',
          url: 'https://example.com'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/project-links/:id', () => {
    test('should delete project link', async () => {
      const response = await request(app)
        .delete(`/api/project-links/${testLinkId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify deletion
      const linksResponse = await request(app)
        .get(`/api/projects/${testProjectId}/links`);

      const link = linksResponse.body.find(l => l.id === testLinkId);
      expect(link).toBeUndefined();
    });

    test('should reject deletion without authentication', async () => {
      const response = await request(app)
        .delete('/api/project-links/999');

      expect(response.status).toBe(401);
    });

    test('should handle deleting non-existent link', async () => {
      const response = await request(app)
        .delete('/api/project-links/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Link ordering', () => {
    test('should maintain display_order for multiple links', async () => {
      // Clean up existing links first
      const existingLinksResponse = await request(app)
        .get(`/api/projects/${testProjectId}/links`);

      for (const link of existingLinksResponse.body) {
        await request(app)
          .delete(`/api/project-links/${link.id}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }

      // Create links with specific order
      const orderedLinks = [
        { label: 'First Link', url: 'https://first.com', display_order: 1 },
        { label: 'Second Link', url: 'https://second.com', display_order: 2 },
        { label: 'Third Link', url: 'https://third.com', display_order: 3 }
      ];

      for (const link of orderedLinks) {
        await request(app)
          .post(`/api/projects/${testProjectId}/links`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(link);
      }

      // Verify links are ordered
      const linksResponse = await request(app)
        .get(`/api/projects/${testProjectId}/links`);

      const sortedLinks = linksResponse.body.sort((a, b) => a.display_order - b.display_order);
      expect(sortedLinks[0].label).toBe('First Link');
      expect(sortedLinks[1].label).toBe('Second Link');
      expect(sortedLinks[2].label).toBe('Third Link');
    });
  });
});
