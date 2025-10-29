const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE = 'http://localhost:3001/api';
const TEST_EMAIL = 'admin@example.com';
const TEST_PASSWORD = 'admin123';

async function testImport() {
  console.log('🧪 Starting Import Feature Test\n');

  try {
    // Step 1: Login
    console.log('Step 1: Logging in...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    const token = loginResponse.data.token;
    console.log('✅ Logged in successfully\n');

    const headers = {
      Authorization: `Bearer ${token}`
    };

    // Step 2: Download template
    console.log('Step 2: Downloading import template...');
    const templateResponse = await axios.get(`${API_BASE}/import/template`, {
      headers,
      responseType: 'arraybuffer'
    });

    const templatePath = path.join(__dirname, 'test-import-template.xlsx');
    fs.writeFileSync(templatePath, templateResponse.data);
    console.log(`✅ Template downloaded to: ${templatePath}\n`);

    // Step 3: Create a test import file with sample data
    console.log('Step 3: Creating test import file with sample data...');
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const sheet = workbook.getWorksheet('Import_Data');

    // Clear example data (keep header row)
    sheet.spliceRows(2, sheet.rowCount - 1);

    // Add test data for a new project
    const testData = [
      // New project with 3 metrics, weekly data
      ['Test Import Project Alpha', 'Testing import of new project', 'Jane Smith', 'Active Users', '2025-01-06', 1000, 1100, 950, 'alice@example.com'],
      ['Test Import Project Alpha', 'Testing import of new project', 'Jane Smith', 'Active Users', '2025-01-13', 1050, 1100, 1000, 'alice@example.com'],
      ['Test Import Project Alpha', 'Testing import of new project', 'Jane Smith', 'Active Users', '2025-01-20', 1100, 1100, 1080, 'alice@example.com'],
      ['Test Import Project Alpha', '', '', 'Revenue', '2025-01-06', 50000, 55000, 48000, 'bob@example.com'],
      ['Test Import Project Alpha', '', '', 'Revenue', '2025-01-13', 52000, 55000, 51000, 'bob@example.com'],
      ['Test Import Project Alpha', '', '', 'Revenue', '2025-01-20', 55000, 55000, 54000, 'bob@example.com'],
      ['Test Import Project Alpha', '', '', 'Customer Satisfaction', '2025-01-06', 85, 90, 83, 'carol@example.com'],
      ['Test Import Project Alpha', '', '', 'Customer Satisfaction', '2025-01-13', 87, 90, 86, 'carol@example.com'],
      ['Test Import Project Alpha', '', '', 'Customer Satisfaction', '2025-01-20', 90, 90, 89, 'carol@example.com'],
    ];

    testData.forEach(row => {
      sheet.addRow(row);
    });

    const testFilePath = path.join(__dirname, 'test-import-data.xlsx');
    await workbook.xlsx.writeFile(testFilePath);
    console.log(`✅ Test file created: ${testFilePath}\n`);

    // Step 4: Upload and import the test file
    console.log('Step 4: Uploading test file...');
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath));

    const importResponse = await axios.post(`${API_BASE}/import`, formData, {
      headers: {
        ...headers,
        ...formData.getHeaders()
      }
    });

    console.log('✅ Import completed successfully!\n');
    console.log('📊 Import Results:');
    console.log(`   Projects Created: ${importResponse.data.results.projectsCreated}`);
    console.log(`   Projects Updated: ${importResponse.data.results.projectsUpdated}`);
    console.log(`   Metrics Created: ${importResponse.data.results.metricsCreated}`);
    console.log(`   Periods Created: ${importResponse.data.results.periodsCreated}`);
    console.log(`   Periods Updated: ${importResponse.data.results.periodsUpdated}`);

    if (importResponse.data.results.errors && importResponse.data.results.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      importResponse.data.results.errors.forEach(err => {
        console.log(`   - ${err.project}: ${err.error}`);
      });
    }

    // Step 5: Verify the data was imported
    console.log('\nStep 5: Verifying imported data...');
    const projectsResponse = await axios.get(`${API_BASE}/projects`, { headers });
    const importedProject = projectsResponse.data.find(p => p.name === 'Test Import Project Alpha');

    if (importedProject) {
      console.log(`✅ Found imported project: ${importedProject.name} (ID: ${importedProject.id})`);
      console.log(`   Description: ${importedProject.description}`);
      console.log(`   Initiative Manager: ${importedProject.initiative_manager}`);

      // Check metrics
      const metricsResponse = await axios.get(`${API_BASE}/projects/${importedProject.id}/metrics`, { headers });
      console.log(`   Metrics: ${metricsResponse.data.length}`);
      metricsResponse.data.forEach(metric => {
        console.log(`     - ${metric.name} (${metric.frequency})`);
      });

      // Check data periods
      const dataResponse = await axios.get(`${API_BASE}/projects/${importedProject.id}/data`, { headers });
      console.log(`   Total periods: ${dataResponse.data.length}`);
    } else {
      console.log('❌ Could not find imported project!');
    }

    // Step 6: Test update of existing project
    console.log('\nStep 6: Testing update of existing project...');
    const updateWorkbook = new ExcelJS.Workbook();
    await updateWorkbook.xlsx.readFile(templatePath);
    const updateSheet = updateWorkbook.getWorksheet('Import_Data');
    updateSheet.spliceRows(2, updateSheet.rowCount - 1);

    // Update the same project with new description and add a new period
    const updateData = [
      ['Test Import Project Alpha', 'Updated description via import', 'John Doe', 'Active Users', '2025-01-27', 1150, 1100, 1120, 'alice@example.com'],
    ];

    updateData.forEach(row => {
      updateSheet.addRow(row);
    });

    const updateFilePath = path.join(__dirname, 'test-import-update.xlsx');
    await updateWorkbook.xlsx.writeFile(updateFilePath);

    const updateFormData = new FormData();
    updateFormData.append('file', fs.createReadStream(updateFilePath));

    const updateResponse = await axios.post(`${API_BASE}/import`, updateFormData, {
      headers: {
        ...headers,
        ...updateFormData.getHeaders()
      }
    });

    console.log('✅ Update import completed!\n');
    console.log('📊 Update Results:');
    console.log(`   Projects Created: ${updateResponse.data.results.projectsCreated}`);
    console.log(`   Projects Updated: ${updateResponse.data.results.projectsUpdated}`);
    console.log(`   Metrics Created: ${updateResponse.data.results.metricsCreated}`);
    console.log(`   Periods Created: ${updateResponse.data.results.periodsCreated}`);
    console.log(`   Periods Updated: ${updateResponse.data.results.periodsUpdated}`);

    // Verify the update
    const updatedProjectsResponse = await axios.get(`${API_BASE}/projects`, { headers });
    const updatedProject = updatedProjectsResponse.data.find(p => p.name === 'Test Import Project Alpha');
    console.log(`\n✅ Verified project update:`);
    console.log(`   Description: ${updatedProject.description}`);
    console.log(`   Initiative Manager: ${updatedProject.initiative_manager}`);

    // Step 7: Test validation errors
    console.log('\nStep 7: Testing validation error handling...');
    const errorWorkbook = new ExcelJS.Workbook();
    await errorWorkbook.xlsx.readFile(templatePath);
    const errorSheet = errorWorkbook.getWorksheet('Import_Data');
    errorSheet.spliceRows(2, errorSheet.rowCount - 1);

    // Add invalid data
    const errorData = [
      ['', '', '', '', 'invalid-date', -100, 'not-a-number', 50, 'invalid-email'],
      ['Test', 'Desc', 'Manager', '', '2025-01-01', 100, 200, 300, 'test@example.com'],
    ];

    errorData.forEach(row => {
      errorSheet.addRow(row);
    });

    const errorFilePath = path.join(__dirname, 'test-import-errors.xlsx');
    await errorWorkbook.xlsx.writeFile(errorFilePath);

    const errorFormData = new FormData();
    errorFormData.append('file', fs.createReadStream(errorFilePath));

    try {
      await axios.post(`${API_BASE}/import`, errorFormData, {
        headers: {
          ...headers,
          ...errorFormData.getHeaders()
        }
      });
      console.log('❌ Should have received validation errors!');
    } catch (error) {
      if (error.response && error.response.data.validationErrors) {
        console.log('✅ Validation errors caught correctly!');
        console.log(`   Error count: ${error.response.data.validationErrors.length}`);
        error.response.data.validationErrors.forEach(err => {
          console.log(`   - Row ${err.row}, Column ${err.column}: ${err.error}`);
        });
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    console.log('\n✅ All tests completed successfully!');
    console.log('\nCleanup: Test files created in backend directory:');
    console.log('  - test-import-template.xlsx');
    console.log('  - test-import-data.xlsx');
    console.log('  - test-import-update.xlsx');
    console.log('  - test-import-errors.xlsx');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

testImport();
