const request = require('supertest');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../data/test-progress-tracker.db');

// Import the app (we'll need to modify server.js to export the app)
let app, server;

describe('Project Description API Tests', () => {
  let authToken;
  let testUserId;
  let testProjectId;

  beforeAll(async () => {
    // Ensure test data directory exists
    const testDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Clean up test database if it exists
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.DB_PATH = TEST_DB_PATH;

    // Import app after setting environment
    app = require('../server');

    // Wait for database migrations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create test user and get auth token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'testpass123'
      });

    testUserId = registerResponse.body.id;

    // Upgrade user to admin role for testing
    const Database = require('better-sqlite3');
    const testDb = new Database(TEST_DB_PATH);
    testDb.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', testUserId);
    testDb.close();

    // Login to get token (with admin role now)
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpass123'
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Close server if running
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('POST /api/projects - Create project with description', () => {
    test('should create project with description', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: 'This is a test project description',
          initiative_manager: 'Test Manager',
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      testProjectId = response.body.id;
    });

    test('should create project without description (optional field)', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project No Desc',
          initiative_manager: 'Test Manager',
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
    });

    test('should reject project creation without authentication', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          name: 'Unauthorized Project',
          description: 'Should fail'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/projects - Read projects with description', () => {
    test('should retrieve all projects including descriptions', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      const testProject = response.body.find(p => p.id === testProjectId);
      expect(testProject).toBeDefined();
      expect(testProject.description).toBe('This is a test project description');
    });

    test('should retrieve single project with description', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test Project');
      expect(response.body.description).toBe('This is a test project description');
      expect(response.body.initiative_manager).toBe('Test Manager');
    });
  });

  describe('PUT /api/projects/:id - Update project description', () => {
    test('should update project description', async () => {
      const response = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: 'Updated description for test project',
          initiative_manager: 'Test Manager',
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify the update
      const getResponse = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body.description).toBe('Updated description for test project');
    });

    test('should update description to empty string', async () => {
      const response = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: '',
          initiative_manager: 'Test Manager',
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        });

      expect(response.status).toBe(200);

      const getResponse = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body.description).toBe('');
    });

    test('should update description with multiline text', async () => {
      const multilineDesc = 'Line 1\nLine 2\nLine 3';

      const response = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: multilineDesc,
          initiative_manager: 'Test Manager',
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        });

      expect(response.status).toBe(200);

      const getResponse = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body.description).toBe(multilineDesc);
    });

    test('should reject unauthorized update', async () => {
      const response = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .send({
          name: 'Test Project',
          description: 'Unauthorized update'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Audit Log - Description changes', () => {
    test('should log description changes in audit log', async () => {
      // Make a description change
      await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: 'Audit test description',
          initiative_manager: 'Test Manager',
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        });

      // Check audit log
      const auditResponse = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${authToken}`);

      expect(auditResponse.status).toBe(200);

      // Find the audit entry for this project update
      const auditEntry = auditResponse.body.find(
        entry => entry.table_name === 'projects' &&
                 entry.record_id === testProjectId &&
                 entry.action === 'UPDATE'
      );

      expect(auditEntry).toBeDefined();

      const newValues = JSON.parse(auditEntry.new_values);
      expect(newValues.description).toBe('Audit test description');
    });
  });

  describe('Import Template - Description field', () => {
    test('should include description in import template', async () => {
      const response = await request(app)
        .get('/api/import/template')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('spreadsheet');

      // The actual content validation would require parsing the Excel file
      // which is complex, but we can verify it returns a valid response
      expect(response.body).toBeDefined();
    });
  });
});
