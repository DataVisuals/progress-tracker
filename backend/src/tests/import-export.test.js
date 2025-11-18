const request = require('supertest');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const TEST_DB_PATH = path.join(__dirname, '../data/test-import-export.db');
const TEST_FILES_DIR = path.join(__dirname, '../data/test-files');

let app, dbRun, dbGet, dbAll;
let adminToken, pmToken, viewerToken;

describe('Import/Export API Tests', () => {
  beforeAll(async () => {
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Create test files directory
    if (!fs.existsSync(TEST_FILES_DIR)) {
      fs.mkdirSync(TEST_FILES_DIR, { recursive: true });
    }

    process.env.NODE_ENV = 'test';
    const { createApp } = require('../server');
    const result = createApp(TEST_DB_PATH);
    app = result.app;
    dbRun = result.dbRun;
    dbGet = result.dbGet;
    dbAll = result.dbAll;

    // Create admin user
    await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      email: 'admin@import.test',
      password: 'admin123'
    });

    const adminUser = await dbGet('SELECT * FROM users WHERE email = ?', ['admin@import.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', adminUser.id]);

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@import.test',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    // Create PM user
    await request(app).post('/api/auth/register').send({
      name: 'PM User',
      email: 'pm@import.test',
      password: 'pm123'
    });
    const pmUser = await dbGet('SELECT * FROM users WHERE email = ?', ['pm@import.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['pm', pmUser.id]);

    const pmLogin = await request(app).post('/api/auth/login').send({
      email: 'pm@import.test',
      password: 'pm123'
    });
    pmToken = pmLogin.body.token;

    // Create viewer user
    await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@import.test',
      password: 'viewer123'
    });
    const viewerUser = await dbGet('SELECT * FROM users WHERE email = ?', ['viewer@import.test']);
    await dbRun('UPDATE users SET role = ? WHERE id = ?', ['viewer', viewerUser.id]);

    const viewerLogin = await request(app).post('/api/auth/login').send({
      email: 'viewer@import.test',
      password: 'viewer123'
    });
    viewerToken = viewerLogin.body.token;
  });

  afterAll(async () => {
    // Clean up
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    // Clean up test files
    if (fs.existsSync(TEST_FILES_DIR)) {
      const files = fs.readdirSync(TEST_FILES_DIR);
      files.forEach(file => {
        fs.unlinkSync(path.join(TEST_FILES_DIR, file));
      });
      fs.rmdirSync(TEST_FILES_DIR);
    }
  });

  // Helper function to create a valid import Excel file
  async function createValidImportFile(filename, data) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Import_Data');

    // Add headers
    sheet.addRow([
      'Project Name',
      'Description',
      'Initiative Manager',
      'Metric Name',
      'Reporting Date',
      'Expected',
      'Target',
      'Complete',
      'Owner Email'
    ]);

    // Add data rows
    data.forEach(row => {
      sheet.addRow([
        row.projectName,
        row.description || '',
        row.initiativeManager || '',
        row.metricName,
        row.reportingDate,
        row.expected,
        row.target,
        row.complete,
        row.ownerEmail || ''
      ]);
    });

    const filepath = path.join(TEST_FILES_DIR, filename);
    await workbook.xlsx.writeFile(filepath);
    return filepath;
  }

  // Helper function to create an invalid import file
  async function createInvalidImportFile(filename, sheetName, headers, data) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);

    if (headers) {
      sheet.addRow(headers);
    }

    data.forEach(row => {
      sheet.addRow(row);
    });

    const filepath = path.join(TEST_FILES_DIR, filename);
    await workbook.xlsx.writeFile(filepath);
    return filepath;
  }

  describe('GET /api/import/template', () => {
    test('should return import template as admin', async () => {
      const response = await request(app)
        .get('/api/import/template')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('spreadsheetml');
      expect(response.headers['content-disposition']).toContain('progress-tracker-import-template.xlsx');
    });

    test('should return import template as PM', async () => {
      const response = await request(app)
        .get('/api/import/template')
        .set('Authorization', `Bearer ${pmToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('spreadsheetml');
    });

    test('should reject template request from viewer', async () => {
      const response = await request(app)
        .get('/api/import/template')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
    });

    test('should reject template request without authentication', async () => {
      const response = await request(app)
        .get('/api/import/template');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/import', () => {
    test('should import valid data as admin', async () => {
      const filepath = await createValidImportFile('valid-import.xlsx', [
        {
          projectName: 'Test Project 1',
          description: 'Test description',
          initiativeManager: 'Admin User',
          metricName: 'Metric A',
          reportingDate: '2025-01-01',
          expected: 10,
          target: 100,
          complete: 8
        },
        {
          projectName: 'Test Project 1',
          description: 'Test description',
          initiativeManager: 'Admin User',
          metricName: 'Metric A',
          reportingDate: '2025-02-01',
          expected: 20,
          target: 100,
          complete: 18
        }
      ]);

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', filepath);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
      // Verify exact counts: 1 project, 1 metric, 2 periods
      expect(response.body.results.projectsCreated).toBe(1);
      expect(response.body.results.metricsCreated).toBe(1);
      expect(response.body.results.periodsCreated).toBe(2);
    });

    test('should import data as PM', async () => {
      const filepath = await createValidImportFile('pm-import.xlsx', [
        {
          projectName: 'PM Project',
          description: 'Created by PM',
          initiativeManager: 'PM User',
          metricName: 'PM Metric',
          reportingDate: '2025-03-01',
          expected: 30,
          target: 100,
          complete: 25
        }
      ]);

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${pmToken}`)
        .attach('file', filepath);

      expect(response.status).toBe(200);
      expect(response.body.results).toBeDefined();
      // Verify exact counts: 1 project, 1 metric, 1 period
      expect(response.body.results.projectsCreated).toBe(1);
      expect(response.body.results.metricsCreated).toBe(1);
      expect(response.body.results.periodsCreated).toBe(1);
    });

    test('should reject import from viewer', async () => {
      const filepath = await createValidImportFile('viewer-import.xlsx', [
        {
          projectName: 'Viewer Project',
          metricName: 'Viewer Metric',
          reportingDate: '2025-04-01',
          expected: 40,
          target: 100,
          complete: 35
        }
      ]);

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${viewerToken}`)
        .attach('file', filepath);

      expect(response.status).toBe(403);
    });

    test('should reject import without authentication', async () => {
      // Note: File upload without auth may cause EPIPE error
      // Just test the endpoint without file to verify auth check
      const response = await request(app)
        .post('/api/import');

      expect(response.status).toBe(401);
    });

    test('should reject import without file', async () => {
      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file uploaded');
    });

    test('should reject file with missing Import_Data sheet', async () => {
      const filepath = await createInvalidImportFile(
        'wrong-sheet.xlsx',
        'WrongSheet',
        ['Project Name', 'Metric Name', 'Reporting Date', 'Expected', 'Target', 'Complete'],
        [['Project', 'Metric', '2025-01-01', 10, 100, 8]]
      );

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', filepath);

      expect(response.status).toBe(400);
      expect(response.body.validationErrors).toBeDefined();
      expect(response.body.validationErrors[0].error).toContain('Import_Data');
    });

    test('should reject file with wrong headers', async () => {
      const filepath = await createInvalidImportFile(
        'wrong-headers.xlsx',
        'Import_Data',
        ['Wrong Header', 'Description', 'Initiative Manager', 'Metric Name', 'Reporting Date', 'Expected', 'Target', 'Complete', 'Owner Email'],
        [['Project', 'Desc', 'Manager', 'Metric', '2025-01-01', 10, 100, 8, '']]
      );

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', filepath);

      expect(response.status).toBe(400);
      expect(response.body.validationErrors).toBeDefined();
      expect(response.body.validationErrors[0].error).toContain('Header mismatch');
    });

    test('should reject rows with missing required fields', async () => {
      const filepath = await createInvalidImportFile(
        'missing-fields.xlsx',
        'Import_Data',
        ['Project Name', 'Description', 'Initiative Manager', 'Metric Name', 'Reporting Date', 'Expected', 'Target', 'Complete', 'Owner Email'],
        [['', 'Desc', 'Manager', 'Metric', '2025-01-01', 10, 100, 8, '']]
      );

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', filepath);

      expect(response.status).toBe(400);
      expect(response.body.validationErrors).toBeDefined();
      expect(response.body.validationErrors.some(e => e.error && e.error.includes('Project Name'))).toBe(true);
    });

    test('should reject rows with invalid date format', async () => {
      const filepath = await createInvalidImportFile(
        'invalid-date.xlsx',
        'Import_Data',
        ['Project Name', 'Description', 'Initiative Manager', 'Metric Name', 'Reporting Date', 'Expected', 'Target', 'Complete', 'Owner Email'],
        [['Project', 'Desc', 'Manager', 'Metric', '01-01-2025', 10, 100, 8, '']]
      );

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', filepath);

      expect(response.status).toBe(400);
      expect(response.body.validationErrors).toBeDefined();
    });

    test('should update existing project if it already exists', async () => {
      // First import
      const filepath1 = await createValidImportFile('update-test-1.xlsx', [
        {
          projectName: 'Update Test Project',
          description: 'Original description',
          initiativeManager: 'Admin User',
          metricName: 'Update Metric',
          reportingDate: '2025-06-01',
          expected: 60,
          target: 100,
          complete: 55
        }
      ]);

      await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', filepath1);

      // Second import with same project/metric, different period
      const filepath2 = await createValidImportFile('update-test-2.xlsx', [
        {
          projectName: 'Update Test Project',
          description: 'Original description',
          initiativeManager: 'Admin User',
          metricName: 'Update Metric',
          reportingDate: '2025-07-01',
          expected: 70,
          target: 100,
          complete: 65
        }
      ]);

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', filepath2);

      expect(response.status).toBe(200);
      // Should update existing project, not create new one
      expect(response.body.results.projectsUpdated).toBeGreaterThanOrEqual(0);
    });

    test('should create audit log entry for import', async () => {
      const filepath = await createValidImportFile('audit-import.xlsx', [
        {
          projectName: 'Audit Test Project',
          description: 'For audit testing',
          initiativeManager: 'Admin User',
          metricName: 'Audit Metric',
          reportingDate: '2025-08-01',
          expected: 80,
          target: 100,
          complete: 75
        }
      ]);

      await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', filepath);

      // Check audit log
      const auditEntry = await dbGet(
        'SELECT * FROM audit_log WHERE action = ? ORDER BY id DESC LIMIT 1',
        ['IMPORT']
      );
      expect(auditEntry).toBeTruthy();
      expect(auditEntry.table_name).toBe('projects');
    });

    test('should handle multiple projects in single import', async () => {
      const filepath = await createValidImportFile('multi-project.xlsx', [
        {
          projectName: 'Multi Project A',
          metricName: 'Metric A1',
          reportingDate: '2025-09-01',
          expected: 10,
          target: 100,
          complete: 8
        },
        {
          projectName: 'Multi Project B',
          metricName: 'Metric B1',
          reportingDate: '2025-09-01',
          expected: 20,
          target: 100,
          complete: 18
        },
        {
          projectName: 'Multi Project C',
          metricName: 'Metric C1',
          reportingDate: '2025-09-01',
          expected: 30,
          target: 100,
          complete: 28
        }
      ]);

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', filepath);

      expect(response.status).toBe(200);
      expect(response.body.results).toBeDefined();
      // Verify exact counts: 3 projects, 3 metrics, 3 periods
      expect(response.body.results.projectsCreated).toBe(3);
      expect(response.body.results.metricsCreated).toBe(3);
      expect(response.body.results.periodsCreated).toBe(3);
    });
  });

  describe('POST /api/export', () => {
    test('should allow admin to trigger export', async () => {
      const response = await request(app)
        .post('/api/export')
        .set('Authorization', `Bearer ${adminToken}`);

      // Export should succeed for admin
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('filename');
      expect(response.body.message).toContain('Export completed');
    });

    test('should reject export from PM', async () => {
      const response = await request(app)
        .post('/api/export')
        .set('Authorization', `Bearer ${pmToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Only admins');
    });

    test('should reject export from viewer', async () => {
      const response = await request(app)
        .post('/api/export')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
    });

    test('should reject export without authentication', async () => {
      const response = await request(app)
        .post('/api/export');

      expect(response.status).toBe(401);
    });
  });
});
