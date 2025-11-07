const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;
const { dbAll } = require('./db');

const EXPORTS_DIR = path.join(__dirname, '../exports');
const MAX_EXPORTS = 10;

/**
 * Generate a dated filename for the export
 * Format: progress-tracker-YYYY-MM-DD.xlsx
 */
function getExportFilename() {
  const date = new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `progress-tracker-${year}-${month}-${day}.xlsx`;
}

/**
 * Clean up old export files, keeping only the most recent MAX_EXPORTS files
 */
async function cleanupOldExports() {
  try {
    const files = await fs.readdir(EXPORTS_DIR);
    const exportFiles = files
      .filter(f => f.startsWith('progress-tracker-') && f.endsWith('.xlsx'))
      .map(f => ({
        name: f,
        path: path.join(EXPORTS_DIR, f),
        time: fs.stat(path.join(EXPORTS_DIR, f)).then(stats => stats.mtime)
      }));

    // Wait for all stat calls to complete
    const filesWithStats = await Promise.all(
      exportFiles.map(async (file) => ({
        name: file.name,
        path: file.path,
        time: await file.time
      }))
    );

    // Sort by modification time, newest first
    filesWithStats.sort((a, b) => b.time - a.time);

    // Delete files beyond MAX_EXPORTS
    if (filesWithStats.length > MAX_EXPORTS) {
      const filesToDelete = filesWithStats.slice(MAX_EXPORTS);
      for (const file of filesToDelete) {
        await fs.unlink(file.path);
        console.log(`Deleted old export: ${file.name}`);
      }
    }
  } catch (err) {
    console.error('Error cleaning up old exports:', err);
  }
}

/**
 * Export all project data to an Excel file with multiple tabs
 */
async function exportAllData() {
  try {
    console.log('Starting daily data export...');

    // Get all projects
    const projects = await dbAll('SELECT * FROM projects ORDER BY name');

    if (projects.length === 0) {
      console.log('No projects to export');
      return;
    }

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Progress Tracker';
    workbook.created = new Date();

    // Create a tab for each project
    for (const project of projects) {
      // Get all data for this project
      const data = await dbAll(`
        SELECT
          mp.reporting_date,
          m.name as metric,
          mp.expected,
          mp.target as final_target,
          mp.complete,
          u.name as owner,
          p.initiative_manager
        FROM metric_periods mp
        JOIN metrics m ON mp.metric_id = m.id
        JOIN projects p ON m.project_id = p.id
        LEFT JOIN users u ON m.owner_id = u.id
        WHERE m.project_id = ?
        ORDER BY m.name, mp.reporting_date
      `, [project.id]);

      if (data.length === 0) {
        continue; // Skip projects with no data
      }

      // Create worksheet (truncate project name if too long for Excel sheet names)
      const sheetName = project.name.substring(0, 31); // Excel limit is 31 chars
      const worksheet = workbook.addWorksheet(sheetName);

      // Add project info header
      worksheet.addRow(['Project:', project.name]);
      worksheet.addRow(['Description:', project.description || '']);
      worksheet.addRow(['Initiative Manager:', project.initiative_manager || '']);
      worksheet.addRow([]); // Empty row

      // Define columns
      worksheet.columns = [
        { header: 'Date', key: 'reporting_date', width: 12 },
        { header: 'Metric', key: 'metric', width: 25 },
        { header: 'Expected', key: 'expected', width: 12 },
        { header: 'Target', key: 'final_target', width: 12 },
        { header: 'Complete', key: 'complete', width: 12 },
        { header: 'Owner', key: 'owner', width: 20 }
      ];

      // Style the header row
      const headerRow = worksheet.getRow(5);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

      // Add data rows
      data.forEach(row => {
        worksheet.addRow({
          reporting_date: row.reporting_date,
          metric: row.metric,
          expected: row.expected,
          final_target: row.final_target,
          complete: row.complete,
          owner: row.owner
        });
      });

      // Auto-filter on header row
      worksheet.autoFilter = {
        from: { row: 5, column: 1 },
        to: { row: 5, column: 6 }
      };

      // Freeze header rows
      worksheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 5 }
      ];
    }

    // Create summary sheet
    const summarySheet = workbook.addWorksheet('Summary', { state: 'visible' });
    summarySheet.addRow(['Progress Tracker Export Summary']);
    summarySheet.addRow(['Export Date:', new Date().toISOString()]);
    summarySheet.addRow(['Total Projects:', projects.length]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Project Name', 'Description', 'Initiative Manager']);

    const summaryHeaderRow = summarySheet.getRow(5);
    summaryHeaderRow.font = { bold: true };
    summaryHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    summaryHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    projects.forEach(project => {
      summarySheet.addRow([
        project.name,
        project.description || '',
        project.initiative_manager || ''
      ]);
    });

    summarySheet.columns = [
      { width: 30 },
      { width: 50 },
      { width: 25 }
    ];

    // Move summary sheet to first position
    workbook.worksheets.unshift(workbook.worksheets.pop());

    // Save the file
    const filename = getExportFilename();
    const filepath = path.join(EXPORTS_DIR, filename);
    await workbook.xlsx.writeFile(filepath);

    console.log(`✅ Export completed: ${filename}`);

    // Clean up old exports
    await cleanupOldExports();

    return filepath;
  } catch (err) {
    console.error('❌ Error during data export:', err);
    throw err;
  }
}

module.exports = {
  exportAllData,
  cleanupOldExports,
  getExportFilename
};
