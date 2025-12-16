const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-space-admin-perms.db');

let app, dbRun, dbGet;
let systemAdminToken, regularAdminToken, pmToken;
let systemAdminId, regularAdminId, pmUserId;
let space1Id, space2Id;
let portfolio1Id, portfolio2Id;
let project1Id, project2Id;

describe('Space-Scoped Admin Permissions Tests', () => {
  beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.NODE_ENV = 'test';
    const { createApp } = require('../server');
    const result = createApp(TEST_DB_PATH);
    app = result.app;
    dbRun = result.dbRun;
    dbGet = result.dbGet;

    // Create and setup system admin user
    await request(app).post('/api/auth/register').send({
      name: 'System Admin',
      email: 'sysadmin@test.com',
      password: 'sysadmin123'
    });
    const sysAdminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['sysadmin@test.com']);
    systemAdminId = sysAdminUser.id;
    await dbRun('UPDATE users SET role = ?, is_system_admin = 1 WHERE id = ?', ['admin', systemAdminId]);
    const sysAdminLogin = await request(app).post('/api/auth/login').send({
      email: 'sysadmin@test.com',
      password: 'sysadmin123'
    });
    systemAdminToken = sysAdminLogin.body.token;

    // Create regular admin user
    await request(app).post('/api/auth/register').send({
      name: 'Regular Admin',
      email: 'regadmin@test.com',
      password: 'regadmin123'
    });
    const regAdminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['regadmin@test.com']);
    regularAdminId = regAdminUser.id;
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', regularAdminId]);
    const regAdminLogin = await request(app).post('/api/auth/login').send({
      email: 'regadmin@test.com',
      password: 'regadmin123'
    });
    regularAdminToken = regAdminLogin.body.token;

    // Create PM user
    await request(app).post('/api/auth/register').send({
      name: 'PM User',
      email: 'pm@test.com',
      password: 'pm123'
    });
    const pmUser = await dbGet('SELECT * FROM users WHERE email = ?', ['pm@test.com']);
    pmUserId = pmUser.id;
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['pm', pmUserId]);
    const pmLogin = await request(app).post('/api/auth/login').send({
      email: 'pm@test.com',
      password: 'pm123'
    });
    pmToken = pmLogin.body.token;

    // Create two spaces
    const space1Response = await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send({ name: 'Space One', description: 'First space' });
    space1Id = space1Response.body.id;

    const space2Response = await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send({ name: 'Space Two', description: 'Second space' });
    space2Id = space2Response.body.id;

    // Create portfolios in each space
    const portfolio1Response = await request(app)
      .post('/api/portfolios')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send({ name: 'Portfolio in Space 1', space_id: space1Id });
    portfolio1Id = portfolio1Response.body.id;

    const portfolio2Response = await request(app)
      .post('/api/portfolios')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send({ name: 'Portfolio in Space 2', space_id: space2Id });
    portfolio2Id = portfolio2Response.body.id;

    // Create projects in each portfolio
    const project1Response = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send({
        name: 'Project in Space 1',
        description: 'Project 1 description',
        portfolio_id: portfolio1Id,
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      });
    project1Id = project1Response.body.id;

    const project2Response = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send({
        name: 'Project in Space 2',
        description: 'Project 2 description',
        portfolio_id: portfolio2Id,
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      });
    project2Id = project2Response.body.id;

    // Assign regular admin to Space 1 only
    await request(app)
      .post('/api/space-admin-assignments')
      .set('Authorization', `Bearer ${systemAdminToken}`)
      .send({ user_id: regularAdminId, space_id: space1Id });
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('System Admin Permissions', () => {
    test('system admin can access all spaces', async () => {
      const response = await request(app)
        .get('/api/my-admin-spaces')
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      const spaceIds = response.body.map(s => s.id);
      expect(spaceIds).toContain(space1Id);
      expect(spaceIds).toContain(space2Id);
    });

    test('system admin can edit project in Space 1', async () => {
      const response = await request(app)
        .put(`/api/projects/${project1Id}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({ name: 'Updated by System Admin', description: 'Test update' });

      expect(response.status).toBe(200);
    });

    test('system admin can edit project in Space 2', async () => {
      const response = await request(app)
        .put(`/api/projects/${project2Id}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({ name: 'Updated by System Admin 2', description: 'Test update' });

      expect(response.status).toBe(200);
    });

    test('system admin can delete project in any space', async () => {
      // Create a temporary project to delete
      const createResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          name: 'Temp Project to Delete',
          description: 'Will be deleted',
          portfolio_id: portfolio2Id,
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });

      const tempProjectId = createResponse.body.id;

      const deleteResponse = await request(app)
        .delete(`/api/projects/${tempProjectId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(deleteResponse.status).toBe(200);
    });
  });

  describe('Regular Admin Space Restrictions', () => {
    let restrictionTestProjectId;

    beforeAll(async () => {
      // Create a fresh project in Space 2 for restriction testing
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          name: 'Restriction Test Project',
          description: 'For testing admin restrictions',
          portfolio_id: portfolio2Id,
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });
      restrictionTestProjectId = response.body.id;
    });

    test('regular admin can only access assigned spaces', async () => {
      const response = await request(app)
        .get('/api/my-admin-spaces')
        .set('Authorization', `Bearer ${regularAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe(space1Id);
    });

    test('regular admin can edit project in assigned Space 1', async () => {
      const response = await request(app)
        .put(`/api/projects/${project1Id}`)
        .set('Authorization', `Bearer ${regularAdminToken}`)
        .send({ name: 'Updated by Regular Admin', description: 'Test update' });

      expect(response.status).toBe(200);
    });

    test('regular admin CANNOT edit project in unassigned Space 2', async () => {
      const response = await request(app)
        .put(`/api/projects/${restrictionTestProjectId}`)
        .set('Authorization', `Bearer ${regularAdminToken}`)
        .send({ name: 'Should Not Work', description: 'Test update' });

      expect(response.status).toBe(403);
    });

    test('regular admin CANNOT delete project in unassigned Space 2', async () => {
      const response = await request(app)
        .delete(`/api/projects/${restrictionTestProjectId}`)
        .set('Authorization', `Bearer ${regularAdminToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Space Admin Assignment Management', () => {
    test('system admin can view all space assignments', async () => {
      const response = await request(app)
        .get('/api/space-admin-assignments')
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('system admin can assign admin to space', async () => {
      // Assign regular admin to Space 2
      const response = await request(app)
        .post('/api/space-admin-assignments')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({ user_id: regularAdminId, space_id: space2Id });

      expect(response.status).toBe(201);

      // Now regular admin should be able to edit project in Space 2
      const editResponse = await request(app)
        .put(`/api/projects/${project2Id}`)
        .set('Authorization', `Bearer ${regularAdminToken}`)
        .send({ name: 'Now Can Edit', description: 'After assignment' });

      expect(editResponse.status).toBe(200);
    });

    test('system admin can revoke space assignment', async () => {
      // Create a test project for this specific test
      const testProjectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          name: 'Revoke Test Project',
          description: 'For testing revocation',
          portfolio_id: portfolio2Id,
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });
      const revokeTestProjectId = testProjectResponse.body.id;

      // Revoke regular admin's access to Space 2
      const revokeResponse = await request(app)
        .delete(`/api/space-admin-assignments/${regularAdminId}/${space2Id}`)
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(revokeResponse.status).toBe(200);

      // Regular admin should no longer be able to edit project in Space 2
      const editResponse = await request(app)
        .put(`/api/projects/${revokeTestProjectId}`)
        .set('Authorization', `Bearer ${regularAdminToken}`)
        .send({ name: 'Should Fail Now', description: 'After revocation' });

      expect(editResponse.status).toBe(403);
    });

    test('regular admin CANNOT assign other admins to spaces', async () => {
      // Create another admin
      await request(app).post('/api/auth/register').send({
        name: 'Another Admin',
        email: 'anotheradmin@test.com',
        password: 'another123'
      });
      const anotherAdmin = await dbGet('SELECT * FROM users WHERE email = ?', ['anotheradmin@test.com']);
      await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', anotherAdmin.id]);

      const response = await request(app)
        .post('/api/space-admin-assignments')
        .set('Authorization', `Bearer ${regularAdminToken}`)
        .send({ user_id: anotherAdmin.id, space_id: space1Id });

      expect(response.status).toBe(403);
    });

    test('PM user CANNOT manage space assignments', async () => {
      const response = await request(app)
        .post('/api/space-admin-assignments')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ user_id: regularAdminId, space_id: space2Id });

      expect(response.status).toBe(403);
    });

    test('rejects duplicate space assignment', async () => {
      // Try to assign regular admin to Space 1 again (already assigned)
      const response = await request(app)
        .post('/api/space-admin-assignments')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({ user_id: regularAdminId, space_id: space1Id });

      expect(response.status).toBe(400);
    });
  });

  describe('System Admin Status Management', () => {
    test('system admin can promote user to system admin', async () => {
      // Create a user to promote
      await request(app).post('/api/auth/register').send({
        name: 'To Promote',
        email: 'topromote@test.com',
        password: 'promote123'
      });
      const toPromote = await dbGet('SELECT * FROM users WHERE email = ?', ['topromote@test.com']);
      await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', toPromote.id]);

      const response = await request(app)
        .put(`/api/users/${toPromote.id}/system-admin`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({ is_system_admin: true });

      expect(response.status).toBe(200);

      // Verify the user is now a system admin
      const updatedUser = await dbGet('SELECT * FROM users WHERE id = ?', [toPromote.id]);
      expect(updatedUser.is_system_admin).toBe(1);
    });

    test('system admin can demote another system admin', async () => {
      const toPromote = await dbGet('SELECT * FROM users WHERE email = ?', ['topromote@test.com']);

      const response = await request(app)
        .put(`/api/users/${toPromote.id}/system-admin`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({ is_system_admin: false });

      expect(response.status).toBe(200);

      // Verify the user is no longer a system admin
      const updatedUser = await dbGet('SELECT * FROM users WHERE id = ?', [toPromote.id]);
      expect(updatedUser.is_system_admin).toBe(0);
    });

    test('regular admin CANNOT change system admin status', async () => {
      const response = await request(app)
        .put(`/api/users/${pmUserId}/system-admin`)
        .set('Authorization', `Bearer ${regularAdminToken}`)
        .send({ is_system_admin: true });

      expect(response.status).toBe(403);
    });

    test('PM CANNOT change system admin status', async () => {
      const response = await request(app)
        .put(`/api/users/${regularAdminId}/system-admin`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ is_system_admin: true });

      expect(response.status).toBe(403);
    });

    test('CANNOT promote non-admin user to system admin', async () => {
      const response = await request(app)
        .put(`/api/users/${pmUserId}/system-admin`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({ is_system_admin: true });

      expect(response.status).toBe(400);
    });
  });

  describe('User Space Assignments Endpoint', () => {
    test('get space assignments for a user', async () => {
      const response = await request(app)
        .get(`/api/users/${regularAdminId}/space-assignments`)
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0]).toHaveProperty('space_id');
      expect(response.body[0]).toHaveProperty('space_name');
    });

    test('non-system admin cannot view other user space assignments', async () => {
      const response = await request(app)
        .get(`/api/users/${systemAdminId}/space-assignments`)
        .set('Authorization', `Bearer ${regularAdminToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Spaces for Assignment Endpoint', () => {
    test('system admin can get list of spaces for assignment', async () => {
      const response = await request(app)
        .get('/api/spaces-for-assignment')
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    test('non-system admin cannot access spaces for assignment', async () => {
      const response = await request(app)
        .get('/api/spaces-for-assignment')
        .set('Authorization', `Bearer ${regularAdminToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Project Access Verification', () => {
    let accessTestProjectId;

    beforeAll(async () => {
      // Create a fresh project in Space 2 for access testing
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          name: 'Access Test Project',
          description: 'For testing access restrictions',
          portfolio_id: portfolio2Id,
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });
      accessTestProjectId = response.body.id;
    });

    test('system admin can view all projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(response.status).toBe(200);
      // Should have at least project1Id and accessTestProjectId
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    test('regular admin can view all projects but only edit assigned spaces', async () => {
      // Ensure regular admin is only assigned to Space 1
      await request(app)
        .delete(`/api/space-admin-assignments/${regularAdminId}/${space2Id}`)
        .set('Authorization', `Bearer ${systemAdminToken}`);

      // Can view all projects
      const viewResponse = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${regularAdminToken}`);

      expect(viewResponse.status).toBe(200);

      // Can edit project in Space 1
      const editSpace1 = await request(app)
        .put(`/api/projects/${project1Id}`)
        .set('Authorization', `Bearer ${regularAdminToken}`)
        .send({ name: 'Edited by Regular Admin Again', description: 'Test' });

      expect(editSpace1.status).toBe(200);

      // Cannot edit project in Space 2
      const editSpace2 = await request(app)
        .put(`/api/projects/${accessTestProjectId}`)
        .set('Authorization', `Bearer ${regularAdminToken}`)
        .send({ name: 'Should Fail', description: 'Test' });

      expect(editSpace2.status).toBe(403);
    });
  });
});
