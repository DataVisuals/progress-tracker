const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-users.db');

let app, adminToken, pmToken, editorToken, viewerToken;
let testUserId;

describe('User Management API Tests', () => {
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
      email: 'admin@users.test',
      password: 'admin123'
    });
    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@users.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@users.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create PM user
    await request(app).post('/api/auth/register').send({
      name: 'PM User',
      email: 'pm@users.test',
      password: 'pm123'
    });
    const pmUser = await dbGet('SELECT * FROM users WHERE email = ?', ['pm@users.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['pm', pmUser.id]);
    const pmLogin = await request(app).post('/api/auth/login').send({
      email: 'pm@users.test',
      password: 'pm123'
    });
    pmToken = pmLogin.body.token;

    // Create editor user
    await request(app).post('/api/auth/register').send({
      name: 'Editor User',
      email: 'editor@users.test',
      password: 'editor123'
    });
    const editorUser = await dbGet('SELECT * FROM users WHERE email = ?', ['editor@users.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['editor', editorUser.id]);
    const editorLogin = await request(app).post('/api/auth/login').send({
      email: 'editor@users.test',
      password: 'editor123'
    });
    editorToken = editorLogin.body.token;

    // Create viewer user
    await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@users.test',
      password: 'viewer123'
    });
    const viewerUser = await dbGet('SELECT * FROM users WHERE email = ?', ['viewer@users.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['viewer', viewerUser.id]);
    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: 'viewer@users.test',
      password: 'viewer123'
    });
    viewerToken = viewerLogin.body.token;
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/users', () => {
    test('should retrieve all users as admin', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(4);

      // Verify no password hashes in response
      response.body.forEach(user => {
        expect(user).not.toHaveProperty('password_hash');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('role');
      });
    });

    test('should reject user list request as non-admin', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${pmToken}`);

      expect(response.status).toBe(403);
    });

    test('should reject user list without authentication', async () => {
      const response = await request(app)
        .get('/api/users');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/users/:id/role', () => {
    beforeAll(async () => {
      const { dbGet } = require('../db');
      const user = await dbGet('SELECT * FROM users WHERE email = ?', ['viewer@users.test']);
      testUserId = user.id;
    });

    test('should change user role as admin', async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'pm' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('updated');

      // Verify role was changed
      const usersResponse = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      const user = usersResponse.body.find(u => u.id === testUserId);
      expect(user.role).toBe('pm');
    });

    test('should reject invalid role', async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superadmin' });

      expect(response.status).toBe(400);
    });

    test('should reject role change as non-admin', async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}/role`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ role: 'admin' });

      expect(response.status).toBe(403);
    });

    test('should reject role change for non-existent user', async () => {
      const response = await request(app)
        .put('/api/users/99999/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'pm' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/users/:id', () => {
    let userToDelete;

    beforeAll(async () => {
      // Create a user to delete
      await request(app).post('/api/auth/register').send({
        name: 'User To Delete',
        email: 'delete@users.test',
        password: 'delete123'
      });

      const { dbGet } = require('../db');
      userToDelete = await dbGet('SELECT * FROM users WHERE email = ?', ['delete@users.test']);
    });

    test('should reject user deletion as non-admin', async () => {
      const response = await request(app)
        .delete(`/api/users/${userToDelete.id}`)
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(403);
    });

    test('should delete user as admin', async () => {
      const response = await request(app)
        .delete(`/api/users/${userToDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify user was deleted
      const usersResponse = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      const deletedUser = usersResponse.body.find(u => u.id === userToDelete.id);
      expect(deletedUser).toBeUndefined();
    });

    test('should handle deleting non-existent user', async () => {
      const response = await request(app)
        .delete('/api/users/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });
});
