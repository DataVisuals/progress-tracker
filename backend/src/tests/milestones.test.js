const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-milestones.db');

let app, adminToken, pmToken, viewerToken, dbGet, dbRun;
let testProjectId, testMilestoneId;

describe('Milestones API Tests', () => {
  beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.NODE_ENV = 'test';
    const { createApp } = require('../server');
    const result = createApp(TEST_DB_PATH);
    app = result.app;
    dbGet = result.dbGet;
    dbRun = result.dbRun;

    // Create users
    await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      email: 'admin@milestones.test',
      password: 'admin123'
    });

    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@milestones.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@milestones.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create PM user
    await request(app).post('/api/auth/register').send({
      name: 'PM User',
      email: 'pm@milestones.test',
      password: 'pm123'
    });

    const pmUser = await dbGet('SELECT * FROM users WHERE email = ?', ['pm@milestones.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['pm', pmUser.id]);

    const pmLogin = await request(app).post('/api/auth/login').send({
      email: 'pm@milestones.test',
      password: 'pm123'
    });
    pmToken = pmLogin.body.token;

    // Create viewer user
    await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@milestones.test',
      password: 'viewer123'
    });

    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: 'viewer@milestones.test',
      password: 'viewer123'
    });
    viewerToken = viewerLogin.body.token;

    // Create a test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        name: 'Milestone Test Project',
        description: 'Project for milestone testing'
      });
    testProjectId = projectResponse.body.id;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/milestones', () => {
    it('should return list of milestones', async () => {
      const response = await request(app)
        .get('/api/milestones')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter milestones by project', async () => {
      // Create a milestone first
      await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          projectId: testProjectId,
          name: 'Test Milestone',
          date: '2024-06-01',
          description: 'Test milestone description'
        });

      const response = await request(app)
        .get(`/api/milestones?projectId=${testProjectId}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].project_id).toBe(testProjectId);
    });

    it('should return milestones with correct structure', async () => {
      const response = await request(app)
        .get(`/api/milestones?projectId=${testProjectId}`)
        .expect(200);

      if (response.body.length > 0) {
        const milestone = response.body[0];
        expect(milestone).toHaveProperty('id');
        expect(milestone).toHaveProperty('project_id');
        expect(milestone).toHaveProperty('name');
        expect(milestone).toHaveProperty('date');
        expect(milestone).toHaveProperty('description');
        expect(milestone).toHaveProperty('created_at');
      }
    });
  });

  describe('POST /api/milestones', () => {
    it('should create milestone with PM token', async () => {
      const response = await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          projectId: testProjectId,
          name: 'New Milestone',
          date: '2024-07-15',
          description: 'Milestone description'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('New Milestone');
      expect(response.body.date).toBe('2024-07-15');
      expect(response.body.description).toBe('Milestone description');
      testMilestoneId = response.body.id;
    });

    it('should create milestone with admin token', async () => {
      const response = await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId: testProjectId,
          name: 'Admin Milestone',
          date: '2024-08-01',
          description: 'Created by admin'
        })
        .expect(201);

      expect(response.body.name).toBe('Admin Milestone');
    });

    it('should reject milestone creation with viewer token', async () => {
      await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          projectId: testProjectId,
          name: 'Viewer Milestone',
          date: '2024-09-01'
        })
        .expect(403);
    });

    it('should reject milestone creation without authentication', async () => {
      await request(app)
        .post('/api/milestones')
        .send({
          projectId: testProjectId,
          name: 'Unauthorized Milestone',
          date: '2024-10-01'
        })
        .expect(401);
    });

    it('should validate required fields', async () => {
      // Missing name
      await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          projectId: testProjectId,
          date: '2024-11-01'
        })
        .expect(400);

      // Missing date
      await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          projectId: testProjectId,
          name: 'No Date Milestone'
        })
        .expect(400);

      // Missing projectId
      await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'No Project Milestone',
          date: '2024-12-01'
        })
        .expect(400);
    });

    it('should validate date format', async () => {
      await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          projectId: testProjectId,
          name: 'Invalid Date Milestone',
          date: 'invalid-date'
        })
        .expect(400);
    });
  });

  describe('PUT /api/milestones/:id', () => {
    it('should update milestone with PM token', async () => {
      const response = await request(app)
        .put(`/api/milestones/${testMilestoneId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'Updated Milestone',
          date: '2024-07-20',
          description: 'Updated description'
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Milestone');
      expect(response.body.date).toBe('2024-07-20');
      expect(response.body.description).toBe('Updated description');
    });

    it('should update milestone with admin token', async () => {
      const response = await request(app)
        .put(`/api/milestones/${testMilestoneId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Updated Milestone'
        })
        .expect(200);

      expect(response.body.name).toBe('Admin Updated Milestone');
    });

    it('should reject update with viewer token', async () => {
      await request(app)
        .put(`/api/milestones/${testMilestoneId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          name: 'Viewer Update'
        })
        .expect(403);
    });

    it('should reject update without authentication', async () => {
      await request(app)
        .put(`/api/milestones/${testMilestoneId}`)
        .send({
          name: 'Unauthorized Update'
        })
        .expect(401);
    });

    it('should handle non-existent milestone', async () => {
      await request(app)
        .put('/api/milestones/99999')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'Update Non-existent'
        })
        .expect(404);
    });

    it('should allow partial updates', async () => {
      const response = await request(app)
        .put(`/api/milestones/${testMilestoneId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          description: 'Only updating description'
        })
        .expect(200);

      expect(response.body.description).toBe('Only updating description');
      expect(response.body.name).toBeTruthy(); // Name should remain unchanged
    });
  });

  describe('DELETE /api/milestones/:id', () => {
    let deleteMilestoneId;

    beforeEach(async () => {
      // Create a milestone to delete
      const response = await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          projectId: testProjectId,
          name: 'Milestone to Delete',
          date: '2024-12-31'
        });
      deleteMilestoneId = response.body.id;
    });

    it('should delete milestone with PM token', async () => {
      await request(app)
        .delete(`/api/milestones/${deleteMilestoneId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .expect(200);

      // Verify deletion
      const milestones = await request(app)
        .get(`/api/milestones?projectId=${testProjectId}`);
      const deleted = milestones.body.find(m => m.id === deleteMilestoneId);
      expect(deleted).toBeUndefined();
    });

    it('should delete milestone with admin token', async () => {
      await request(app)
        .delete(`/api/milestones/${deleteMilestoneId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should reject deletion with viewer token', async () => {
      await request(app)
        .delete(`/api/milestones/${deleteMilestoneId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });

    it('should reject deletion without authentication', async () => {
      await request(app)
        .delete(`/api/milestones/${deleteMilestoneId}`)
        .expect(401);
    });

    it('should handle deletion of non-existent milestone', async () => {
      await request(app)
        .delete('/api/milestones/99999')
        .set('Authorization', `Bearer ${pmToken}`)
        .expect(404);
    });
  });

  describe('Milestone ordering and filtering', () => {
    beforeAll(async () => {
      // Create multiple milestones with different dates
      const dates = ['2024-01-15', '2024-03-01', '2024-02-10', '2024-04-20'];
      for (let i = 0; i < dates.length; i++) {
        await request(app)
          .post('/api/milestones')
          .set('Authorization', `Bearer ${pmToken}`)
          .send({
            projectId: testProjectId,
            name: `Milestone ${i + 1}`,
            date: dates[i]
          });
      }
    });

    it('should return milestones ordered by date', async () => {
      const response = await request(app)
        .get(`/api/milestones?projectId=${testProjectId}`)
        .expect(200);

      // Check that milestones are ordered by date
      for (let i = 1; i < response.body.length; i++) {
        const prevDate = new Date(response.body[i - 1].date);
        const currDate = new Date(response.body[i].date);
        expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
      }
    });
  });
});