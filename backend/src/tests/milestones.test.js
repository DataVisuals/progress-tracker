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
        description: 'Project for milestone testing',
        start_date: '2025-01-01',
        end_date: '2025-12-31'
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
        .get(`/api/milestones?project_id=${testProjectId}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should require project_id', async () => {
      await request(app)
        .get('/api/milestones')
        .expect(400);
    });

    it('should filter milestones by project', async () => {
      // Create a milestone first
      await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          project_id: testProjectId,
          title: 'Test Milestone',
          target_date: '2024-06-01',
          description: 'Test milestone description'
        });

      const response = await request(app)
        .get(`/api/milestones?project_id=${testProjectId}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].project_id).toBe(testProjectId);
    });

    it('should return milestones with correct structure', async () => {
      const response = await request(app)
        .get(`/api/milestones?project_id=${testProjectId}`)
        .expect(200);

      if (response.body.length > 0) {
        const milestone = response.body[0];
        expect(milestone).toHaveProperty('id');
        expect(milestone).toHaveProperty('project_id');
        expect(milestone).toHaveProperty('title');
        expect(milestone).toHaveProperty('target_date');
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
          project_id: testProjectId,
          title: 'New Milestone',
          target_date: '2024-07-15',
          description: 'Milestone description'
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('New Milestone');
      expect(response.body.target_date).toBe('2024-07-15');
      expect(response.body.description).toBe('Milestone description');
      testMilestoneId = response.body.id;
    });

    it('should create milestone with admin token', async () => {
      const response = await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project_id: testProjectId,
          title: 'Admin Milestone',
          target_date: '2024-08-01',
          description: 'Created by admin'
        })
        .expect(200);

      expect(response.body.title).toBe('Admin Milestone');
    });

    it('should allow milestone creation with viewer token', async () => {
      // Server allows any authenticated user to create milestones
      const response = await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          project_id: testProjectId,
          title: 'Viewer Milestone',
          target_date: '2024-09-01'
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
    });

    it('should reject milestone creation without authentication', async () => {
      await request(app)
        .post('/api/milestones')
        .send({
          project_id: testProjectId,
          title: 'Unauthorized Milestone',
          target_date: '2024-10-01'
        })
        .expect(401);
    });

    it('should validate required fields', async () => {
      // Missing name
      await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          project_id: testProjectId,
          target_date: '2024-11-01'
        })
        .expect(400);

      // Missing target_date
      await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          project_id: testProjectId,
          title: 'No Date Milestone'
        })
        .expect(400);

      // Missing project_id
      await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          title: 'No Project Milestone',
          target_date: '2024-12-01'
        })
        .expect(400);
    });

    it('should accept date string without strict validation', async () => {
      // Server stores date as string without strict format validation
      const response = await request(app)
        .post('/api/milestones')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          project_id: testProjectId,
          title: 'Date Test Milestone',
          target_date: '2024-12-25'
        })
        .expect(200);

      expect(response.body.target_date).toBe('2024-12-25');
    });
  });

  describe('PUT /api/milestones/:id', () => {
    it('should update milestone with PM token', async () => {
      const response = await request(app)
        .put(`/api/milestones/${testMilestoneId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          title: 'Updated Milestone',
          target_date: '2024-07-20',
          description: 'Updated description'
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Milestone');
      expect(response.body.target_date).toBe('2024-07-20');
      expect(response.body.description).toBe('Updated description');
    });

    it('should update milestone with admin token', async () => {
      const response = await request(app)
        .put(`/api/milestones/${testMilestoneId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Admin Updated Milestone'
        })
        .expect(200);

      expect(response.body.title).toBe('Admin Updated Milestone');
    });

    it('should allow update with viewer token', async () => {
      // Server allows any authenticated user to update milestones
      const response = await request(app)
        .put(`/api/milestones/${testMilestoneId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Viewer Update'
        })
        .expect(200);

      expect(response.body.title).toBe('Viewer Update');
    });

    it('should reject update without authentication', async () => {
      await request(app)
        .put(`/api/milestones/${testMilestoneId}`)
        .send({
          title: 'Unauthorized Update'
        })
        .expect(401);
    });

    it('should handle non-existent milestone', async () => {
      await request(app)
        .put('/api/milestones/99999')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          title: 'Update Non-existent'
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
      expect(response.body.title).toBeTruthy(); // Title should remain unchanged
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
          project_id: testProjectId,
          title: 'Milestone to Delete',
          target_date: '2024-12-31'
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
        .get(`/api/milestones?project_id=${testProjectId}`);
      const deleted = milestones.body.find(m => m.id === deleteMilestoneId);
      expect(deleted).toBeUndefined();
    });

    it('should delete milestone with admin token', async () => {
      await request(app)
        .delete(`/api/milestones/${deleteMilestoneId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should allow deletion with viewer token', async () => {
      // Server allows any authenticated user to delete milestones
      await request(app)
        .delete(`/api/milestones/${deleteMilestoneId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);
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
            project_id: testProjectId,
            title: `Milestone ${i + 1}`,
            target_date: dates[i]
          });
      }
    });

    it('should return milestones ordered by date', async () => {
      const response = await request(app)
        .get(`/api/milestones?project_id=${testProjectId}`)
        .expect(200);

      // Check that milestones are ordered by target_date
      for (let i = 1; i < response.body.length; i++) {
        const prevDate = new Date(response.body[i - 1].target_date);
        const currDate = new Date(response.body[i].target_date);
        expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
      }
    });
  });
});