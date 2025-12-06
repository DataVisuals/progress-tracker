const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-spaces.db');

let app, adminToken, pmToken, viewerToken;
let testSpaceId;

describe('Spaces API Tests', () => {
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
      email: 'admin@spaces.test',
      password: 'admin123'
    });

    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@spaces.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@spaces.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create PM user
    await request(app).post('/api/auth/register').send({
      name: 'PM User',
      email: 'pm@spaces.test',
      password: 'pm123'
    });
    const pmUser = await dbGet('SELECT * FROM users WHERE email = ?', ['pm@spaces.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['pm', pmUser.id]);

    const pmLogin = await request(app).post('/api/auth/login').send({
      email: 'pm@spaces.test',
      password: 'pm123'
    });
    pmToken = pmLogin.body.token;

    // Create viewer user
    await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@spaces.test',
      password: 'viewer123'
    });

    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: 'viewer@spaces.test',
      password: 'viewer123'
    });
    viewerToken = viewerLogin.body.token;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/spaces', () => {
    it('should return list of spaces', async () => {
      const response = await request(app)
        .get('/api/spaces')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return spaces with correct structure', async () => {
      // First create a space
      const createResponse = await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Space',
          description: 'Test Description'
        });

      const response = await request(app)
        .get('/api/spaces')
        .expect(200);

      const space = response.body.find(s => s.name === 'Test Space');
      expect(space).toBeDefined();
      expect(space).toHaveProperty('id');
      expect(space).toHaveProperty('name');
      expect(space).toHaveProperty('description');
      expect(space).toHaveProperty('created_at');
    });
  });

  describe('POST /api/spaces', () => {
    it('should create a new space with admin token', async () => {
      const response = await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Space',
          description: 'Space Description'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('New Space');
      expect(response.body.description).toBe('Space Description');
      testSpaceId = response.body.id;
    });

    it('should reject space creation with PM token', async () => {
      await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'PM Space',
          description: 'Should not be created'
        })
        .expect(403);
    });

    it('should reject space creation without authentication', async () => {
      await request(app)
        .post('/api/spaces')
        .send({
          name: 'Unauthorized Space',
          description: 'Should not be created'
        })
        .expect(401);
    });

    it('should reject space with duplicate name', async () => {
      await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate Space',
          description: 'First space'
        })
        .expect(201);

      await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate Space',
          description: 'Second space'
        })
        .expect(400);
    });

    it('should require space name', async () => {
      const response = await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'No name provided'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/spaces/:id', () => {
    it('should update space with admin token', async () => {
      const response = await request(app)
        .put(`/api/spaces/${testSpaceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Space',
          description: 'Updated Description'
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Space');
      expect(response.body.description).toBe('Updated Description');
    });

    it('should reject update with PM token', async () => {
      await request(app)
        .put(`/api/spaces/${testSpaceId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'PM Update',
          description: 'Should not work'
        })
        .expect(403);
    });

    it('should reject update without authentication', async () => {
      await request(app)
        .put(`/api/spaces/${testSpaceId}`)
        .send({
          name: 'Unauthorized Update'
        })
        .expect(401);
    });

    it('should handle non-existent space', async () => {
      await request(app)
        .put('/api/spaces/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Update Non-existent'
        })
        .expect(404);
    });
  });

  describe('DELETE /api/spaces/:id', () => {
    let deleteTestSpaceId;

    beforeEach(async () => {
      // Create a space to delete
      const response = await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Space to Delete',
          description: 'Will be deleted'
        });
      deleteTestSpaceId = response.body.id;
    });

    it('should delete space with admin token', async () => {
      await request(app)
        .delete(`/api/spaces/${deleteTestSpaceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify deletion
      const spaces = await request(app).get('/api/spaces');
      const deletedSpace = spaces.body.find(s => s.id === deleteTestSpaceId);
      expect(deletedSpace).toBeUndefined();
    });

    it('should reject deletion with PM token', async () => {
      await request(app)
        .delete(`/api/spaces/${deleteTestSpaceId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .expect(403);
    });

    it('should reject deletion without authentication', async () => {
      await request(app)
        .delete(`/api/spaces/${deleteTestSpaceId}`)
        .expect(401);
    });

    it('should handle deletion of non-existent space', async () => {
      await request(app)
        .delete('/api/spaces/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/auth/default-space', () => {
    it('should update user default space', async () => {
      // Create a space first
      const spaceResponse = await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Default Space Test',
          description: 'User default space'
        });

      const response = await request(app)
        .put('/api/auth/default-space')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          spaceId: spaceResponse.body.id
        })
        .expect(200);

      expect(response.body.message).toBe('Default space updated successfully');

      // Verify by getting profile
      const profile = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(profile.body.default_space_id).toBe(spaceResponse.body.id);
    });

    it('should reject update without authentication', async () => {
      await request(app)
        .put('/api/auth/default-space')
        .send({
          spaceId: 1
        })
        .expect(401);
    });

    it('should handle non-existent space', async () => {
      await request(app)
        .put('/api/auth/default-space')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          spaceId: 99999
        })
        .expect(404);
    });

    it('should require spaceId in request', async () => {
      await request(app)
        .put('/api/auth/default-space')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });
  });
});