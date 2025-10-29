import React, { useState } from 'react';
import { api } from '../api/client';
import './ImportData.css';

const ImportData = ({ onClose, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.downloadImportTemplate();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'progress-tracker-import-template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download template: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.xlsx')) {
        setError('Please select an Excel file (.xlsx)');
        return;
      }
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setError(null);
      setValidationErrors([]);
      setResults(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Please select a file to import');
      return;
    }

    setImporting(true);
    setError(null);
    setValidationErrors([]);
    setResults(null);

    try {
      const response = await api.importData(selectedFile);
      setResults(response.data.results);

      // Notify parent of success
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err) {
      console.error('Import error:', err);

      if (err.response?.data?.validationErrors) {
        setValidationErrors(err.response.data.validationErrors);
        setError('Import validation failed. Please fix the errors below and try again.');
      } else {
        setError(err.response?.data?.error || err.message || 'Import failed');
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import Project Data</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="import-content">
          {/* Instructions */}
          <div className="import-section">
            <h3>📋 Instructions</h3>
            <ol className="import-instructions">
              <li>Download the Excel template using the button below</li>
              <li>Fill in your project data following the template format exactly</li>
              <li>Do NOT modify column headers or sheet names</li>
              <li>Dates must be in YYYY-MM-DD format</li>
              <li>Upload your completed file to import data</li>
            </ol>
          </div>

          {/* Template Download */}
          <div className="import-section">
            <h3>📥 Step 1: Download Template</h3>
            <button
              className="template-btn"
              onClick={handleDownloadTemplate}
            >
              Download Excel Template
            </button>
            <p className="help-text">
              The template includes example data and detailed instructions
            </p>
          </div>

          {/* File Upload */}
          <div className="import-section">
            <h3>📤 Step 2: Upload Completed File</h3>
            <div className="file-upload">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileSelect}
                disabled={importing}
                id="file-input"
                style={{ display: 'none' }}
              />
              <label htmlFor="file-input" className="file-label">
                {selectedFile ? selectedFile.name : 'Choose Excel file (.xlsx)'}
              </label>
              {selectedFile && (
                <div className="file-info">
                  ✅ Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          </div>

          {/* Import Button */}
          <div className="import-actions">
            <button
              className="import-btn"
              onClick={handleImport}
              disabled={!selectedFile || importing}
            >
              {importing ? 'Importing...' : 'Import Data'}
            </button>
            <button
              className="cancel-btn"
              onClick={onClose}
              disabled={importing}
            >
              Cancel
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="import-error">
              <strong>❌ Error:</strong> {error}
            </div>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="validation-errors">
              <h4>Validation Errors:</h4>
              <div className="errors-table-wrapper">
                <table className="errors-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Column</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationErrors.slice(0, 20).map((err, idx) => (
                      <tr key={idx}>
                        <td>{err.row}</td>
                        <td>{err.column}</td>
                        <td>{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validationErrors.length > 20 && (
                  <p className="more-errors">
                    ... and {validationErrors.length - 20} more errors
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Success Results */}
          {results && (
            <div className="import-success">
              <h3>✅ Import Completed Successfully!</h3>
              <div className="results-grid">
                <div className="result-item">
                  <div className="result-label">Projects Created</div>
                  <div className="result-value">{results.projectsCreated}</div>
                </div>
                <div className="result-item">
                  <div className="result-label">Projects Updated</div>
                  <div className="result-value">{results.projectsUpdated}</div>
                </div>
                <div className="result-item">
                  <div className="result-label">Metrics Created</div>
                  <div className="result-value">{results.metricsCreated}</div>
                </div>
                <div className="result-item">
                  <div className="result-label">Periods Created</div>
                  <div className="result-value">{results.periodsCreated}</div>
                </div>
                <div className="result-item">
                  <div className="result-label">Periods Updated</div>
                  <div className="result-value">{results.periodsUpdated}</div>
                </div>
              </div>
              {results.errors && results.errors.length > 0 && (
                <div className="partial-errors">
                  <h4>⚠️ Some records had errors:</h4>
                  <ul>
                    {results.errors.map((err, idx) => (
                      <li key={idx}>
                        {err.project}: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* What Gets Imported */}
          <div className="import-section info-section">
            <h3>ℹ️ What Gets Imported?</h3>
            <ul className="info-list">
              <li>✨ <strong>New Projects:</strong> Created if they don't exist</li>
              <li>🔄 <strong>Existing Projects:</strong> Updated with new description/manager</li>
              <li>📊 <strong>New Metrics:</strong> Created within projects</li>
              <li>📈 <strong>Existing Metrics:</strong> Matched by name within project</li>
              <li>📅 <strong>New Periods:</strong> Created for each date</li>
              <li>✏️ <strong>Existing Periods:</strong> Updated if metric + date matches</li>
              <li>🛡️ <strong>No Data Deleted:</strong> Only creates or updates</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportData;
