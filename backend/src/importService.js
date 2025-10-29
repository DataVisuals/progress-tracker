const ExcelJS = require('exceljs');
const path = require('path');
const { dbGet, dbAll, dbRun } = require('./db');

/**
 * Import Template Format (Prescriptive):
 *
 * Sheet 1: "Import_Data" (REQUIRED - case sensitive)
 * ===================================================
 * Columns (exact names, case sensitive):
 * - Project Name (TEXT, required)
 * - Description (TEXT, optional)
 * - Initiative Manager (TEXT, optional)
 * - Metric Name (TEXT, required)
 * - Reporting Date (DATE, required, format: YYYY-MM-DD)
 * - Expected (NUMBER, required)
 * - Target (NUMBER, required)
 * - Complete (NUMBER, required)
 * - Owner Email (TEXT, optional)
 *
 * Rules:
 * 1. First row MUST be headers (exact names above)
 * 2. Data starts from row 2
 * 3. Dates must be in YYYY-MM-DD format
 * 4. Numbers cannot be negative
 * 5. Project Name and Metric Name are case-sensitive for matching
 * 6. Empty rows are skipped
 * 7. If Owner Email doesn't exist, metric owner will be null
 */

/**
 * Validation errors structure
 */
class ImportValidationError extends Error {
  constructor(errors) {
    super('Import validation failed');
    this.errors = errors;
    this.name = 'ImportValidationError';
  }
}

/**
 * Validate Excel file structure and data
 */
async function validateImportFile(workbook) {
  const errors = [];

  // Check for required sheet
  const sheet = workbook.getWorksheet('Import_Data');
  if (!sheet) {
    errors.push({
      row: 0,
      column: 'N/A',
      error: 'Missing required sheet "Import_Data" (case sensitive)'
    });
    throw new ImportValidationError(errors);
  }

  // Check headers
  const requiredHeaders = [
    'Project Name',
    'Description',
    'Initiative Manager',
    'Metric Name',
    'Reporting Date',
    'Expected',
    'Target',
    'Complete',
    'Owner Email'
  ];

  const headerRow = sheet.getRow(1);
  const actualHeaders = [];

  for (let i = 1; i <= 9; i++) {
    const cell = headerRow.getCell(i);
    actualHeaders.push(cell.value);
  }

  // Validate all headers are present and in correct order
  requiredHeaders.forEach((header, index) => {
    if (actualHeaders[index] !== header) {
      errors.push({
        row: 1,
        column: index + 1,
        error: `Header mismatch: expected "${header}", got "${actualHeaders[index]}"`
      });
    }
  });

  if (errors.length > 0) {
    throw new ImportValidationError(errors);
  }

  // Validate data rows
  const dataRows = [];
  let rowNum = 2;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const projectName = row.getCell(1).value;
    const description = row.getCell(2).value || '';
    const initiativeManager = row.getCell(3).value || '';
    const metricName = row.getCell(4).value;
    const reportingDate = row.getCell(5).value;
    const expected = row.getCell(6).value;
    const target = row.getCell(7).value;
    const complete = row.getCell(8).value;
    const ownerEmail = row.getCell(9).value || '';

    // Skip completely empty rows
    if (!projectName && !metricName && !reportingDate) {
      return;
    }

    const rowErrors = [];

    // Required field validation
    if (!projectName || typeof projectName !== 'string' || projectName.trim() === '') {
      rowErrors.push(`Project Name is required and must be text`);
    }

    if (!metricName || typeof metricName !== 'string' || metricName.trim() === '') {
      rowErrors.push(`Metric Name is required and must be text`);
    }

    // Date validation
    let parsedDate;
    if (!reportingDate) {
      rowErrors.push(`Reporting Date is required`);
    } else {
      // Handle Excel date serial numbers
      if (reportingDate instanceof Date) {
        parsedDate = reportingDate.toISOString().split('T')[0];
      } else if (typeof reportingDate === 'number') {
        // Excel serial date
        const date = new Date((reportingDate - 25569) * 86400 * 1000);
        parsedDate = date.toISOString().split('T')[0];
      } else if (typeof reportingDate === 'string') {
        // Check format YYYY-MM-DD
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(reportingDate)) {
          rowErrors.push(`Reporting Date must be in YYYY-MM-DD format`);
        } else {
          parsedDate = reportingDate;
        }
      } else {
        rowErrors.push(`Reporting Date has invalid format`);
      }
    }

    // Number validation
    const validateNumber = (value, fieldName) => {
      if (value === null || value === undefined || value === '') {
        rowErrors.push(`${fieldName} is required`);
        return null;
      }
      const num = Number(value);
      if (isNaN(num)) {
        rowErrors.push(`${fieldName} must be a number`);
        return null;
      }
      if (num < 0) {
        rowErrors.push(`${fieldName} cannot be negative`);
        return null;
      }
      return num;
    };

    const expectedNum = validateNumber(expected, 'Expected');
    const targetNum = validateNumber(target, 'Target');
    const completeNum = validateNumber(complete, 'Complete');

    if (rowErrors.length > 0) {
      rowErrors.forEach(err => {
        errors.push({
          row: rowNumber,
          column: 'Multiple',
          error: err
        });
      });
    } else {
      dataRows.push({
        rowNumber,
        projectName: projectName.trim(),
        description: description ? String(description).trim() : '',
        initiativeManager: initiativeManager ? String(initiativeManager).trim() : '',
        metricName: metricName.trim(),
        reportingDate: parsedDate,
        expected: expectedNum,
        target: targetNum,
        complete: completeNum,
        ownerEmail: ownerEmail ? String(ownerEmail).trim() : ''
      });
    }

    rowNum++;
  });

  if (errors.length > 0) {
    throw new ImportValidationError(errors);
  }

  if (dataRows.length === 0) {
    throw new ImportValidationError([{
      row: 2,
      column: 'N/A',
      error: 'No data rows found in Import_Data sheet'
    }]);
  }

  return dataRows;
}

/**
 * Import data from validated Excel file
 * - Creates projects if they don't exist
 * - Creates metrics if they don't exist
 * - Updates or creates metric periods
 * - Avoids duplication
 */
async function importDataFromFile(filePath, userId) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Validate file structure and data
  const dataRows = await validateImportFile(workbook);

  const results = {
    projectsCreated: 0,
    projectsUpdated: 0,
    metricsCreated: 0,
    periodsCreated: 0,
    periodsUpdated: 0,
    errors: []
  };

  // Group data by project
  const projectsMap = new Map();

  dataRows.forEach(row => {
    if (!projectsMap.has(row.projectName)) {
      projectsMap.set(row.projectName, {
        name: row.projectName,
        description: row.description,
        initiativeManager: row.initiativeManager,
        metrics: new Map()
      });
    }

    const project = projectsMap.get(row.projectName);

    // Update project description/manager if provided and not empty
    if (row.description && !project.description) {
      project.description = row.description;
    }
    if (row.initiativeManager && !project.initiativeManager) {
      project.initiativeManager = row.initiativeManager;
    }

    // Group by metric
    if (!project.metrics.has(row.metricName)) {
      project.metrics.set(row.metricName, {
        name: row.metricName,
        ownerEmail: row.ownerEmail,
        periods: []
      });
    }

    const metric = project.metrics.get(row.metricName);
    metric.periods.push({
      reportingDate: row.reportingDate,
      expected: row.expected,
      target: row.target,
      complete: row.complete
    });
  });

  // Process each project
  for (const [projectName, projectData] of projectsMap) {
    try {
      // Check if project exists
      let project = await dbGet('SELECT * FROM projects WHERE name = ?', [projectName]);

      if (!project) {
        // Create new project
        const result = await dbRun(
          'INSERT INTO projects (name, description, initiative_manager) VALUES (?, ?, ?)',
          [projectName, projectData.description, projectData.initiativeManager]
        );
        project = {
          id: result.lastID,
          name: projectName,
          description: projectData.description,
          initiative_manager: projectData.initiativeManager
        };
        results.projectsCreated++;
        console.log(`✅ Created project: ${projectName}`);
      } else {
        // Update project if description or manager provided
        let needsUpdate = false;
        const updates = [];
        const values = [];

        if (projectData.description && projectData.description !== project.description) {
          updates.push('description = ?');
          values.push(projectData.description);
          needsUpdate = true;
        }

        if (projectData.initiativeManager && projectData.initiativeManager !== project.initiative_manager) {
          updates.push('initiative_manager = ?');
          values.push(projectData.initiativeManager);
          needsUpdate = true;
        }

        if (needsUpdate) {
          values.push(project.id);
          await dbRun(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values);
          results.projectsUpdated++;
          console.log(`✅ Updated project: ${projectName}`);
        }
      }

      // Process metrics for this project
      for (const [metricName, metricData] of projectData.metrics) {
        // Check if metric exists
        let metric = await dbGet(
          'SELECT * FROM metrics WHERE project_id = ? AND name = ?',
          [project.id, metricName]
        );

        if (!metric) {
          // Need to create metric - determine frequency and date range from periods
          const periods = metricData.periods.sort((a, b) =>
            new Date(a.reportingDate) - new Date(b.reportingDate)
          );

          const startDate = periods[0].reportingDate;
          const endDate = periods[periods.length - 1].reportingDate;

          // Detect frequency from period intervals
          let frequency = 'monthly'; // default
          if (periods.length >= 2) {
            const date1 = new Date(periods[0].reportingDate);
            const date2 = new Date(periods[1].reportingDate);
            const daysDiff = (date2 - date1) / (1000 * 60 * 60 * 24);

            if (daysDiff <= 10) frequency = 'weekly';
            else if (daysDiff >= 80) frequency = 'quarterly';
          }

          const finalTarget = Math.max(...periods.map(p => p.target));

          // Resolve owner ID from email
          let ownerId = userId; // default to importing user
          if (metricData.ownerEmail) {
            const owner = await dbGet('SELECT id FROM users WHERE email = ?', [metricData.ownerEmail]);
            if (owner) {
              ownerId = owner.id;
            }
          }

          const result = await dbRun(
            `INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [project.id, metricName, ownerId, startDate, endDate, frequency, 'linear', finalTarget]
          );

          metric = {
            id: result.lastID,
            project_id: project.id,
            name: metricName
          };
          results.metricsCreated++;
          console.log(`✅ Created metric: ${metricName} for project ${projectName}`);
        }

        // Process periods for this metric
        for (const periodData of metricData.periods) {
          // Check if period exists
          const existingPeriod = await dbGet(
            'SELECT * FROM metric_periods WHERE metric_id = ? AND reporting_date = ?',
            [metric.id, periodData.reportingDate]
          );

          if (!existingPeriod) {
            // Create new period
            await dbRun(
              `INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete)
               VALUES (?, ?, ?, ?, ?)`,
              [metric.id, periodData.reportingDate, periodData.expected, periodData.target, periodData.complete]
            );
            results.periodsCreated++;
          } else {
            // Update existing period
            await dbRun(
              `UPDATE metric_periods
               SET expected = ?, target = ?, complete = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [periodData.expected, periodData.target, periodData.complete, existingPeriod.id]
            );
            results.periodsUpdated++;
          }
        }
      }

    } catch (err) {
      console.error(`Error processing project ${projectName}:`, err);
      results.errors.push({
        project: projectName,
        error: err.message
      });
    }
  }

  return results;
}

/**
 * Generate an import template file
 */
async function generateImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Progress Tracker';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Import_Data');

  // Define columns with exact names
  sheet.columns = [
    { header: 'Project Name', key: 'project_name', width: 30 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Initiative Manager', key: 'initiative_manager', width: 25 },
    { header: 'Metric Name', key: 'metric_name', width: 30 },
    { header: 'Reporting Date', key: 'reporting_date', width: 15 },
    { header: 'Expected', key: 'expected', width: 12 },
    { header: 'Target', key: 'target', width: 12 },
    { header: 'Complete', key: 'complete', width: 12 },
    { header: 'Owner Email', key: 'owner_email', width: 25 }
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 20;

  // Add example rows
  sheet.addRow({
    project_name: 'Example Project Alpha',
    description: 'This is an example project description',
    initiative_manager: 'John Doe',
    metric_name: 'User Signups',
    reporting_date: '2024-01-31',
    expected: 100,
    target: 500,
    complete: 95,
    owner_email: 'john@example.com'
  });

  sheet.addRow({
    project_name: 'Example Project Alpha',
    description: 'This is an example project description',
    initiative_manager: 'John Doe',
    metric_name: 'User Signups',
    reporting_date: '2024-02-29',
    expected: 200,
    target: 500,
    complete: 180,
    owner_email: 'john@example.com'
  });

  sheet.addRow({
    project_name: 'Example Project Beta',
    description: 'Another example project',
    initiative_manager: 'Jane Smith',
    metric_name: 'Revenue Growth',
    reporting_date: '2024-01-31',
    expected: 50000,
    target: 200000,
    complete: 48000,
    owner_email: 'jane@example.com'
  });

  // Add instructions sheet
  const instructionsSheet = workbook.addWorksheet('Instructions');
  instructionsSheet.columns = [{ width: 80 }];

  instructionsSheet.addRow(['PROGRESS TRACKER - IMPORT INSTRUCTIONS']).font = { bold: true, size: 16 };
  instructionsSheet.addRow([]);
  instructionsSheet.addRow(['IMPORTANT: Do not rename or delete the "Import_Data" sheet!']).font = { bold: true, color: { argb: 'FFFF0000' } };
  instructionsSheet.addRow([]);

  instructionsSheet.addRow(['FORMAT REQUIREMENTS:']).font = { bold: true };
  instructionsSheet.addRow(['1. All data must be in the "Import_Data" sheet']);
  instructionsSheet.addRow(['2. Do NOT modify column headers (case sensitive)']);
  instructionsSheet.addRow(['3. Dates must be in YYYY-MM-DD format (e.g., 2024-01-31)']);
  instructionsSheet.addRow(['4. Numbers cannot be negative']);
  instructionsSheet.addRow(['5. Empty rows will be skipped']);
  instructionsSheet.addRow([]);

  instructionsSheet.addRow(['COLUMN DESCRIPTIONS:']).font = { bold: true };
  instructionsSheet.addRow(['• Project Name: (Required) Name of the project - creates new if doesn\'t exist']);
  instructionsSheet.addRow(['• Description: (Optional) Project description']);
  instructionsSheet.addRow(['• Initiative Manager: (Optional) Name of project manager']);
  instructionsSheet.addRow(['• Metric Name: (Required) Name of the metric - creates new if doesn\'t exist']);
  instructionsSheet.addRow(['• Reporting Date: (Required) Date in YYYY-MM-DD format']);
  instructionsSheet.addRow(['• Expected: (Required) Expected progress value']);
  instructionsSheet.addRow(['• Target: (Required) Target value for this period']);
  instructionsSheet.addRow(['• Complete: (Required) Actual completed value']);
  instructionsSheet.addRow(['• Owner Email: (Optional) Email of metric owner (must exist in system)']);
  instructionsSheet.addRow([]);

  instructionsSheet.addRow(['BEHAVIOR:']).font = { bold: true };
  instructionsSheet.addRow(['• Existing projects will be updated with new description/manager if provided']);
  instructionsSheet.addRow(['• Existing metrics within a project will be matched by name']);
  instructionsSheet.addRow(['• Existing periods (same metric + date) will be updated']);
  instructionsSheet.addRow(['• New periods will be created']);
  instructionsSheet.addRow(['• No data will be deleted - only created or updated']);

  return workbook;
}

module.exports = {
  importDataFromFile,
  generateImportTemplate,
  ImportValidationError
};
