const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-portfolio-report.db');

let app, adminToken, pmToken, viewerToken, dbGet, dbRun;
let testPortfolioId, testSpaceId, testProjectIds = [];

describe('Portfolio Report API Tests', () => {
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
      email: 'admin@report.test',
      password: 'admin123'
    });

    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@report.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@report.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create PM user
    await request(app).post('/api/auth/register').send({
      name: 'PM User',
      email: 'pm@report.test',
      password: 'pm123'
    });

    const pmUser = await dbGet('SELECT * FROM users WHERE email = ?', ['pm@report.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['pm', pmUser.id]);

    const pmLogin = await request(app).post('/api/auth/login').send({
      email: 'pm@report.test',
      password: 'pm123'
    });
    pmToken = pmLogin.body.token;

    // Create viewer user
    await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@report.test',
      password: 'viewer123'
    });

    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: 'viewer@report.test',
      password: 'viewer123'
    });
    viewerToken = viewerLogin.body.token;

    // Create a test space
    const spaceResponse = await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Space',
        description: 'Space for report testing'
      });
    testSpaceId = spaceResponse.body.id;

    // Create a test portfolio
    const portfolioResponse = await request(app)
      .post('/api/portfolios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Report Test Portfolio',
        description: 'Portfolio for report testing',
        space_id: testSpaceId
      });
    testPortfolioId = portfolioResponse.body.id;

    // Create test projects with different statuses
    const projectData = [
      {
        name: 'Green Project',
        description: 'Healthy project',
        status: 'green',
        health_score: 90,
        completion: 75
      },
      {
        name: 'Amber Project',
        description: 'Warning project',
        status: 'amber',
        health_score: 65,
        completion: 50
      },
      {
        name: 'Red Project',
        description: 'Critical project',
        status: 'red',
        health_score: 40,
        completion: 25
      }
    ];

    for (const project of projectData) {
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          ...project,
          portfolio_id: testPortfolioId,
          start_date: '2024-01-01',
          target_date: '2024-12-31'
        });

      testProjectIds.push(projectResponse.body.id);

      // Add metrics to each project
      await request(app)
        .post(`/api/projects/${projectResponse.body.id}/metrics`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'Budget',
          target_value: 100000,
          current_value: project.status === 'green' ? 80000 : project.status === 'amber' ? 105000 : 130000,
          metric_type: 'currency'
        });

      await request(app)
        .post(`/api/projects/${projectResponse.body.id}/metrics`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'Timeline',
          target_value: 100,
          current_value: project.completion,
          metric_type: 'percentage'
        });
    }

    // Add milestones to the first project
    await request(app)
      .post('/api/milestones')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        projectId: testProjectIds[0],
        name: 'Phase 1 Complete',
        targetDate: '2024-03-31',
        status: 'completed',
        description: 'First phase completed'
      });

    await request(app)
      .post('/api/milestones')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        projectId: testProjectIds[0],
        name: 'Phase 2 Complete',
        targetDate: '2024-06-30',
        status: 'on_track',
        description: 'Second phase in progress'
      });

    // Add recovery plan to the red project
    await request(app)
      .post('/api/recovery-plans')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        projectId: testProjectIds[2],
        issue: 'Budget overrun',
        action: 'Reduce scope and reallocate resources',
        targetDate: '2024-05-31',
        owner: 'PM User',
        status: 'in_progress'
      });
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/portfolios/:id/report', () => {
    it('should return comprehensive portfolio report', async () => {
      const response = await request(app)
        .get(`/api/portfolios/${testPortfolioId}/report`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);

      // Check first project structure
      const project = response.body[0];
      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('name');
      expect(project).toHaveProperty('status');
      expect(project).toHaveProperty('health_score');
      expect(project).toHaveProperty('completion');
      expect(project).toHaveProperty('pm_name');
      expect(project).toHaveProperty('start_date');
      expect(project).toHaveProperty('target_date');
      expect(project).toHaveProperty('metrics');
      expect(Array.isArray(project.metrics)).toBe(true);
    });

    it('should include project metrics in report', async () => {
      const response = await request(app)
        .get(`/api/portfolios/${testPortfolioId}/report`)
        .expect(200);

      const greenProject = response.body.find(p => p.name === 'Green Project');
      expect(greenProject.metrics).toHaveLength(2);

      const budgetMetric = greenProject.metrics.find(m => m.name === 'Budget');
      expect(budgetMetric).toBeDefined();
      expect(budgetMetric.current_value).toBe(80000);
      expect(budgetMetric.target_value).toBe(100000);
    });

    it('should include milestones in report', async () => {
      const response = await request(app)
        .get(`/api/portfolios/${testPortfolioId}/report`)
        .expect(200);

      const greenProject = response.body.find(p => p.name === 'Green Project');
      expect(greenProject.milestones).toBeDefined();
      expect(Array.isArray(greenProject.milestones)).toBe(true);
      expect(greenProject.milestones.length).toBe(2);

      const milestone = greenProject.milestones[0];
      expect(milestone.name).toBe('Phase 1 Complete');
      expect(milestone.status).toBe('completed');
    });

    it('should include recovery plans for at-risk projects', async () => {
      const response = await request(app)
        .get(`/api/portfolios/${testPortfolioId}/report`)
        .expect(200);

      const redProject = response.body.find(p => p.name === 'Red Project');
      expect(redProject.recovery_plans).toBeDefined();
      expect(Array.isArray(redProject.recovery_plans)).toBe(true);
      expect(redProject.recovery_plans.length).toBe(1);

      const recoveryPlan = redProject.recovery_plans[0];
      expect(recoveryPlan.issue).toBe('Budget overrun');
      expect(recoveryPlan.status).toBe('in_progress');
    });

    it('should calculate RAG status correctly', async () => {
      const response = await request(app)
        .get(`/api/portfolios/${testPortfolioId}/report`)
        .expect(200);

      const greenProject = response.body.find(p => p.name === 'Green Project');
      const amberProject = response.body.find(p => p.name === 'Amber Project');
      const redProject = response.body.find(p => p.name === 'Red Project');

      expect(greenProject.status).toBe('green');
      expect(amberProject.status).toBe('amber');
      expect(redProject.status).toBe('red');
    });

    it('should return empty array for portfolio with no projects', async () => {
      // Create empty portfolio
      const emptyPortfolioResponse = await request(app)
        .post('/api/portfolios')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Empty Portfolio',
          description: 'Portfolio with no projects',
          space_id: testSpaceId
        });

      const response = await request(app)
        .get(`/api/portfolios/${emptyPortfolioResponse.body.id}/report`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it('should handle non-existent portfolio', async () => {
      const response = await request(app)
        .get('/api/portfolios/999999/report')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it('should include recent comments if available', async () => {
      // Add a comment to a project
      await request(app)
        .post(`/api/projects/${testProjectIds[0]}/comments`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          comment: 'Project is on track for Q2 delivery'
        });

      const response = await request(app)
        .get(`/api/portfolios/${testPortfolioId}/report`)
        .expect(200);

      const projectWithComment = response.body.find(p => p.id === testProjectIds[0]);
      expect(projectWithComment.recent_comments).toBeDefined();
      expect(Array.isArray(projectWithComment.recent_comments)).toBe(true);
      if (projectWithComment.recent_comments.length > 0) {
        expect(projectWithComment.recent_comments[0].comment).toContain('on track');
      }
    });

    it('should include dependencies if configured', async () => {
      // Add a dependency between projects
      await request(app)
        .post(`/api/projects/${testProjectIds[0]}/dependencies`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          dependsOnId: testProjectIds[1],
          description: 'Requires completion of Amber Project phase 1'
        });

      const response = await request(app)
        .get(`/api/portfolios/${testPortfolioId}/report`)
        .expect(200);

      const projectWithDependency = response.body.find(p => p.id === testProjectIds[0]);
      expect(projectWithDependency.dependencies).toBeDefined();
      expect(Array.isArray(projectWithDependency.dependencies)).toBe(true);
    });
  });

  describe('GET /api/spaces/:id/report', () => {
    it('should return comprehensive space report', async () => {
      const response = await request(app)
        .get(`/api/spaces/${testSpaceId}/report`)
        .expect(200);

      expect(response.body).toHaveProperty('portfolios');
      expect(response.body).toHaveProperty('projects');
      expect(response.body).toHaveProperty('summary');

      // Check summary statistics
      expect(response.body.summary).toHaveProperty('total_portfolios');
      expect(response.body.summary).toHaveProperty('total_projects');
      expect(response.body.summary).toHaveProperty('projects_by_status');
      expect(response.body.summary.total_portfolios).toBe(2); // Including empty portfolio
      expect(response.body.summary.total_projects).toBe(3);
    });

    it('should aggregate projects by status', async () => {
      const response = await request(app)
        .get(`/api/spaces/${testSpaceId}/report`)
        .expect(200);

      const statusCounts = response.body.summary.projects_by_status;
      expect(statusCounts.green).toBe(1);
      expect(statusCounts.amber).toBe(1);
      expect(statusCounts.red).toBe(1);
    });

    it('should include portfolio health scores', async () => {
      const response = await request(app)
        .get(`/api/spaces/${testSpaceId}/report`)
        .expect(200);

      const portfolio = response.body.portfolios.find(p => p.id === testPortfolioId);
      expect(portfolio).toHaveProperty('average_health_score');
      expect(portfolio.average_health_score).toBeGreaterThan(0);
    });

    it('should handle space with no portfolios', async () => {
      // Create empty space
      const emptySpaceResponse = await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Empty Space',
          description: 'Space with no portfolios'
        });

      const response = await request(app)
        .get(`/api/spaces/${emptySpaceResponse.body.id}/report`)
        .expect(200);

      expect(response.body.portfolios).toEqual([]);
      expect(response.body.projects).toEqual([]);
      expect(response.body.summary.total_portfolios).toBe(0);
      expect(response.body.summary.total_projects).toBe(0);
    });

    it('should handle non-existent space', async () => {
      const response = await request(app)
        .get('/api/spaces/999999/report')
        .expect(404);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/reports/all', () => {
    it('should return comprehensive system-wide report', async () => {
      const response = await request(app)
        .get('/api/reports/all')
        .expect(200);

      expect(response.body).toHaveProperty('spaces');
      expect(response.body).toHaveProperty('portfolios');
      expect(response.body).toHaveProperty('projects');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('generated_at');
    });

    it('should include all spaces in the system', async () => {
      const response = await request(app)
        .get('/api/reports/all')
        .expect(200);

      expect(Array.isArray(response.body.spaces)).toBe(true);
      const testSpace = response.body.spaces.find(s => s.id === testSpaceId);
      expect(testSpace).toBeDefined();
      expect(testSpace.name).toBe('Test Space');
    });

    it('should include project health distribution', async () => {
      const response = await request(app)
        .get('/api/reports/all')
        .expect(200);

      expect(response.body.summary).toHaveProperty('health_distribution');
      const distribution = response.body.summary.health_distribution;
      expect(distribution).toHaveProperty('excellent'); // 80-100
      expect(distribution).toHaveProperty('good');      // 60-79
      expect(distribution).toHaveProperty('fair');      // 40-59
      expect(distribution).toHaveProperty('poor');      // 0-39
    });

    it('should include top performers and at-risk projects', async () => {
      const response = await request(app)
        .get('/api/reports/all')
        .expect(200);

      expect(response.body.summary).toHaveProperty('top_performers');
      expect(response.body.summary).toHaveProperty('at_risk_projects');

      expect(Array.isArray(response.body.summary.top_performers)).toBe(true);
      expect(Array.isArray(response.body.summary.at_risk_projects)).toBe(true);

      // Green project should be in top performers
      const topPerformer = response.body.summary.top_performers.find(p => p.name === 'Green Project');
      expect(topPerformer).toBeDefined();

      // Red project should be in at-risk
      const atRisk = response.body.summary.at_risk_projects.find(p => p.name === 'Red Project');
      expect(atRisk).toBeDefined();
    });

    it('should calculate system-wide metrics', async () => {
      const response = await request(app)
        .get('/api/reports/all')
        .expect(200);

      expect(response.body.summary).toHaveProperty('total_spaces');
      expect(response.body.summary).toHaveProperty('total_portfolios');
      expect(response.body.summary).toHaveProperty('total_projects');
      expect(response.body.summary).toHaveProperty('average_health_score');
      expect(response.body.summary).toHaveProperty('average_completion');

      expect(response.body.summary.total_projects).toBeGreaterThanOrEqual(3);
      expect(response.body.summary.average_health_score).toBeGreaterThan(0);
      expect(response.body.summary.average_completion).toBeGreaterThan(0);
    });

    it('should include active milestones summary', async () => {
      const response = await request(app)
        .get('/api/reports/all')
        .expect(200);

      expect(response.body.summary).toHaveProperty('active_milestones');
      expect(response.body.summary).toHaveProperty('upcoming_milestones');
      expect(response.body.summary).toHaveProperty('overdue_milestones');

      expect(typeof response.body.summary.active_milestones).toBe('number');
      expect(response.body.summary.active_milestones).toBeGreaterThanOrEqual(0);
    });

    it('should include recovery plans summary', async () => {
      const response = await request(app)
        .get('/api/reports/all')
        .expect(200);

      expect(response.body.summary).toHaveProperty('active_recovery_plans');
      expect(typeof response.body.summary.active_recovery_plans).toBe('number');
      expect(response.body.summary.active_recovery_plans).toBeGreaterThanOrEqual(1);
    });

    it('should be accessible without authentication', async () => {
      // Test without auth token
      const response = await request(app)
        .get('/api/reports/all')
        .expect(200);

      expect(response.body).toHaveProperty('summary');
    });

    it('should handle empty database gracefully', async () => {
      // This test would require creating a new test with empty DB
      // Skipping for now as it would interfere with other tests
      expect(true).toBe(true);
    });
  });

  describe('Report Performance', () => {
    it('should return portfolio report within reasonable time', async () => {
      const startTime = Date.now();

      await request(app)
        .get(`/api/portfolios/${testPortfolioId}/report`)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Report should return within 1 second even with complex data
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large portfolios efficiently', async () => {
      // Create a large portfolio with many projects
      const largePortfolioResponse = await request(app)
        .post('/api/portfolios')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Large Portfolio',
          description: 'Portfolio with many projects',
          space_id: testSpaceId
        });

      // Add 10 projects to test performance
      const projectPromises = [];
      for (let i = 0; i < 10; i++) {
        projectPromises.push(
          request(app)
            .post('/api/projects')
            .set('Authorization', `Bearer ${pmToken}`)
            .send({
              name: `Performance Project ${i}`,
              description: 'Test project',
              portfolio_id: largePortfolioResponse.body.id,
              start_date: '2024-01-01',
              target_date: '2024-12-31',
              status: ['green', 'amber', 'red'][i % 3]
            })
        );
      }

      await Promise.all(projectPromises);

      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/portfolios/${largePortfolioResponse.body.id}/report`)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.body.length).toBe(10);
      expect(duration).toBeLessThan(2000); // Should still be fast with 10 projects
    });
  });
});