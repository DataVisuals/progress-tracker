import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { api } from '../api/client';
import { selectStyles } from './SelectStyles';
import './DataGrid.css';

const DataGrid = ({ data, metrics, projectMetrics = [], onDataChange, onClose, projectId, onMetricCreated, onPeriodDeleted }) => {
  const [selectedMetric, setSelectedMetric] = useState('');
  const [editedData, setEditedData] = useState([]);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showNewMetric, setShowNewMetric] = useState(false);
  const [newMetricName, setNewMetricName] = useState('');
  const [newMetricConfig, setNewMetricConfig] = useState({
    name: '',
    start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year from now
    frequency: 'monthly',
    progression_type: 'linear',
    final_target: 100,
    amber_tolerance: 5.0,
    red_tolerance: 10.0
  });
  const [bulkConfig, setBulkConfig] = useState({
    startDate: '2024-01-31',
    numPeriods: 10,
    frequency: 'monthly', // weekly, monthly, quarterly
    metric: selectedMetric || '',
    final_target: 100
  });

  const [newRow, setNewRow] = useState({
    reporting_date: '',
    metric: selectedMetric || '',
    expected: '',
    final_target: '',
    complete: '',
    commentary: ''
  });

  useEffect(() => {
    if (selectedMetric) {
      const filteredData = data.filter(item => item.metric === selectedMetric);
      setEditedData(filteredData);
    } else {
      setEditedData([]);
    }
  }, [data, selectedMetric]);

  useEffect(() => {
    if (selectedMetric) {
      setBulkConfig(prev => ({ ...prev, metric: selectedMetric }));
      setNewRow(prev => ({ ...prev, metric: selectedMetric }));
    }
  }, [selectedMetric]);

  // Auto-select first metric when component mounts
  useEffect(() => {
    if (metrics.length > 0 && !selectedMetric) {
      setSelectedMetric(metrics[0]);
    }
  }, [metrics, selectedMetric]);

  const handleCellChange = (id, field, value) => {
    setEditedData(prev => {
      // If changing the target value, propagate to all subsequent periods
      if (field === 'final_target') {
        // Find the index of the current row
        const currentIndex = prev.findIndex(row => row.id === id);

        // Sort by date to ensure we're working with chronological order
        const sorted = [...prev].sort((a, b) =>
          new Date(a.reporting_date) - new Date(b.reporting_date)
        );

        const sortedIndex = sorted.findIndex(row => row.id === id);

        // Update current row and all subsequent rows
        return prev.map(row => {
          const rowSortedIndex = sorted.findIndex(r => r.id === row.id);
          if (rowSortedIndex >= sortedIndex) {
            return { ...row, final_target: value };
          }
          return row;
        });
      }

      // For other fields, just update the single row
      return prev.map(row =>
        row.id === id ? { ...row, [field]: value } : row
      );
    });
  };

  // Auto-save a single cell when it loses focus
  const handleCellBlur = async (id, field) => {
    const row = editedData.find(r => r.id === id);
    if (!row) return;

    // Find the original row to check if it actually changed
    const original = data.find(p => p.id === row.id && p.metric_id === row.metric_id);
    if (!original) return; // New rows aren't auto-saved, only edited existing rows

    // Check if this field actually changed
    if (original[field] === row[field]) return;

    try {
      // Save just this row's changes
      await api.updatePeriod(row.id, {
        reporting_date: row.reporting_date,
        complete: row.complete,
        expected: row.expected,
        target: row.final_target
      });

      // Refresh all data by calling the parent's onDataChange with current state
      // This will trigger loadProjectData() and loadProjectMetrics() in App.jsx
      onDataChange(editedData);
    } catch (err) {
      console.error('Auto-save failed:', err);
      // Revert the change on error
      setEditedData(prev => prev.map(r =>
        r.id === id ? { ...r, [field]: original[field] } : r
      ));

      if (err.response?.data?.isHistoricEdit) {
        alert(err.response.data.error + '\n\nOnly administrators can edit completion values for past periods.');
      } else {
        alert('Failed to save changes: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleSave = () => {
    console.log('DataGrid.handleSave - Saving', editedData.length, 'periods');
    console.log('Periods being saved:', editedData.map(d => ({
      id: d.id,
      date: d.reporting_date,
      metric: d.metric,
      metric_id: d.metric_id,
      expected: d.expected,
      complete: d.complete
    })));
    onDataChange(editedData);
    onClose();
  };

  const handleAddRow = () => {
    if (newRow.reporting_date && newRow.metric) {
      const newId = Math.max(...editedData.map(r => r.id), 0) + 1;

      // Get metric_id from editedData if available, otherwise look it up from projectMetrics
      let metric_id = editedData.length > 0 ? editedData[0].metric_id : null;
      if (!metric_id) {
        const metricInfo = projectMetrics.find(m => m.name === newRow.metric);
        metric_id = metricInfo ? metricInfo.id : null;
      }

      if (!metric_id) {
        console.error('Failed to add row: metric_id is null', {
          selectedMetric,
          newRow,
          projectMetrics,
          editedData
        });
        alert('Error: Could not determine metric ID. Please try reopening the Data Grid.');
        return;
      }

      const rowToAdd = {
        ...newRow,
        id: newId,
        metric_id: metric_id,
        expected: parseFloat(newRow.expected) || 0,
        final_target: parseFloat(newRow.final_target) || 0,
        complete: parseFloat(newRow.complete) || 0,
      };
      console.log('DataGrid.handleAddRow - Adding new row:', rowToAdd);
      setEditedData([...editedData, rowToAdd]);
      setNewRow({
        reporting_date: '',
        metric: selectedMetric || '',
        expected: '',
        final_target: '',
        complete: '',
        commentary: ''
      });
    }
  };

  const handleBulkAdd = () => {
    if (!bulkConfig.metric || !bulkConfig.numPeriods) return;

    const newRows = [];
    const startId = Math.max(...editedData.map(r => r.id), 0) + 1;
    const startDate = new Date(bulkConfig.startDate);

    // Get metric_id from editedData if available, otherwise look it up from projectMetrics
    let metric_id = editedData.length > 0 ? editedData[0].metric_id : null;
    if (!metric_id) {
      const metricInfo = projectMetrics.find(m => m.name === bulkConfig.metric);
      metric_id = metricInfo ? metricInfo.id : null;
    }

    for (let i = 0; i < bulkConfig.numPeriods; i++) {
      let date = new Date(startDate);

      // Add the appropriate interval based on frequency
      if (bulkConfig.frequency === 'weekly') {
        date.setDate(startDate.getDate() + (i * 7));
      } else if (bulkConfig.frequency === 'monthly') {
        date.setMonth(startDate.getMonth() + i);
      } else if (bulkConfig.frequency === 'quarterly') {
        date.setMonth(startDate.getMonth() + (i * 3));
      }

      const reporting_date = date.toISOString().split('T')[0];

      // Calculate linear plan progression
      const expectedValue = Math.round((bulkConfig.final_target / bulkConfig.numPeriods) * (i + 1));

      newRows.push({
        id: startId + i,
        reporting_date,
        metric: bulkConfig.metric,
        metric_id: metric_id,
        expected: expectedValue,
        final_target: bulkConfig.final_target,
        complete: 0,
        commentary: ''
      });
    }

    setEditedData([...editedData, ...newRows]);
    setShowBulkAdd(false);
    setBulkConfig({
      startDate: '2024-01-31',
      numPeriods: 10,
      frequency: 'monthly',
      metric: selectedMetric || '',
      final_target: 100
    });
  };

  const handleDeleteRow = async (id) => {
    try {
      // Call API to delete the period from the database
      await api.deletePeriod(id);

      // Update local state to remove the row
      setEditedData(prev => prev.filter(row => row.id !== id));

      // Reload metrics list in case this was the last period for a metric
      if (onPeriodDeleted) {
        await onPeriodDeleted();
      }
    } catch (err) {
      console.error('Failed to delete period:', err);
      alert(`Failed to delete period: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleCreateMetric = async () => {
    if (!newMetricConfig.name.trim()) {
      alert('Please enter a metric name');
      return;
    }

    if (!newMetricConfig.start_date || !newMetricConfig.end_date) {
      alert('Please enter start and end dates');
      return;
    }

    if (newMetricConfig.final_target <= 0) {
      alert('Please enter a valid final target value');
      return;
    }

    try {
      console.log('Creating metric with projectId:', projectId);
      const response = await api.createMetric(projectId, newMetricConfig);

      console.log('Metric created successfully:', response);

      // Reset form and close modal
      setNewMetricConfig({
        name: '',
        start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        frequency: 'monthly',
        progression_type: 'linear',
        final_target: 100,
        amber_tolerance: 5.0,
        red_tolerance: 10.0
      });
      setShowNewMetric(false);

      // Call the callback to refresh data and select the new metric
      if (onMetricCreated) {
        onMetricCreated(newMetricConfig.name);
      }

      // Close the data grid to show the new metric
      onClose();
    } catch (err) {
      console.error('Failed to create metric - Full error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      alert(`Failed to create metric: ${err.response?.data?.error || err.message}`);
    }
  };

  return (
    <div className="data-grid-overlay">
      <div className="data-grid-modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <div className="data-grid-header">
          <h2>Edit Project Data</h2>
          <div className="header-actions">
            <Select
              value={selectedMetric ? { value: selectedMetric, label: selectedMetric } : null}
              onChange={(option) => setSelectedMetric(option ? option.value : '')}
              options={metrics.map(m => ({ value: m, label: m }))}
              styles={selectStyles}
              placeholder="-- Select a Metric --"
              isClearable={true}
              className="metric-selector-inline"
            />
            <button className="new-metric-btn" onClick={() => setShowNewMetric(true)}>
              + Add Metric
            </button>
            {selectedMetric && (
              <button className="bulk-add-btn" onClick={() => setShowBulkAdd(!showBulkAdd)}>
                {showBulkAdd ? 'Hide' : 'Bulk Add'}
              </button>
            )}
          </div>
        </div>

        {selectedMetric && showBulkAdd && (
          <div className="bulk-add-section">
            <div className="bulk-add-form">
              <div className="bulk-field">
                <label>Start Date:</label>
                <input
                  type="date"
                  value={bulkConfig.startDate}
                  onChange={(e) => setBulkConfig({...bulkConfig, startDate: e.target.value})}
                />
              </div>
              <div className="bulk-field">
                <label>Frequency:</label>
                <select
                  value={bulkConfig.frequency}
                  onChange={(e) => setBulkConfig({...bulkConfig, frequency: e.target.value})}
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div className="bulk-field">
                <label># Periods:</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={bulkConfig.numPeriods}
                  min="1"
                  max="52"
                  onChange={(e) => setBulkConfig({...bulkConfig, numPeriods: parseInt(e.target.value) || 1})}
                />
              </div>
              <div className="bulk-field">
                <label>Metric:</label>
                <input
                  type="text"
                  value={bulkConfig.metric}
                  readOnly
                  style={{backgroundColor: '#f0f0f0', cursor: 'not-allowed'}}
                />
              </div>
              <div className="bulk-field">
                <label>Target:</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={bulkConfig.final_target}
                  onChange={(e) => setBulkConfig({...bulkConfig, final_target: parseInt(e.target.value) || 0})}
                />
              </div>
              <button className="bulk-create-btn" onClick={handleBulkAdd}>
                Create {bulkConfig.numPeriods} Rows
              </button>
            </div>
          </div>
        )}

        {selectedMetric && (
          <>
            <div className="data-grid-container">
              <table className="data-grid-table">
              <thead>
                <tr>
                  <th style={{width: '110px'}}>Date</th>
                  <th style={{width: '120px'}}>Metric</th>
                  <th style={{width: '70px'}}>Expected</th>
                  <th style={{width: '70px'}}>Target</th>
                  <th style={{width: '70px'}}>Complete</th>
                  <th style={{width: '80px'}}>Actions</th>
                </tr>
              </thead>
            <tbody>
              {editedData.map(row => {
                // Check if this period is in the future
                const periodDate = new Date(row.reporting_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isFuture = periodDate > today;

                return (
                <tr key={row.id}>
                  <td>
                    <input
                      type="date"
                      value={row.reporting_date}
                      onChange={(e) => handleCellChange(row.id, 'reporting_date', e.target.value)}
                      onBlur={() => handleCellBlur(row.id, 'reporting_date')}
                      style={{width: '100%'}}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.metric}
                      readOnly
                      className="readonly-input"
                      style={{width: '100%'}}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={row.expected}
                      onChange={(e) => handleCellChange(row.id, 'expected', parseFloat(e.target.value) || 0)}
                      onBlur={() => handleCellBlur(row.id, 'expected')}
                      style={{width: '100%'}}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={row.final_target}
                      onChange={(e) => handleCellChange(row.id, 'final_target', parseFloat(e.target.value) || 0)}
                      onBlur={() => handleCellBlur(row.id, 'final_target')}
                      style={{width: '100%'}}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={row.complete}
                      onChange={(e) => handleCellChange(row.id, 'complete', parseFloat(e.target.value) || 0)}
                      onBlur={() => handleCellBlur(row.id, 'complete')}
                      className={isFuture ? 'readonly-input future-period' : ''}
                      style={{width: '100%'}}
                      readOnly={isFuture}
                      disabled={isFuture}
                      title={isFuture ? 'Future periods cannot have completion values until the period has started' : ''}
                      placeholder={isFuture ? 'Future' : ''}
                    />
                  </td>
                  <td>
                    <button className="delete-row-btn" onClick={() => handleDeleteRow(row.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
                );
              })}
              <tr className="new-row">
                <td>
                  <input
                    type="date"
                    value={newRow.reporting_date}
                    onChange={(e) => setNewRow({ ...newRow, reporting_date: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={newRow.metric}
                    readOnly
                    className="readonly-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={newRow.expected}
                    onChange={(e) => setNewRow({ ...newRow, expected: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={newRow.final_target}
                    onChange={(e) => setNewRow({ ...newRow, final_target: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={newRow.complete}
                    onChange={(e) => setNewRow({ ...newRow, complete: e.target.value })}
                  />
                </td>
                <td>
                  <button className="add-row-btn" onClick={handleAddRow}>
                    Add
                  </button>
                </td>
              </tr>
              </tbody>
            </table>
          </div>

          <div className="data-grid-actions">
            <div className="row-count">{editedData.length} rows</div>
            <div>
              <button className="cancel-btn" onClick={onClose}>Cancel</button>
              <button className="save-btn" onClick={handleSave}>Save Changes</button>
            </div>
          </div>
          </>
        )}

        {showNewMetric && (
          <div className="modal-overlay" onClick={() => setShowNewMetric(false)}>
            <div className="modal-content metric-creation-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '16px' }}>
              <h2>Create New Metric</h2>

              <div className="form-group">
                <label htmlFor="new-metric-name">Metric Name: *</label>
                <input
                  id="new-metric-name"
                  type="text"
                  value={newMetricConfig.name}
                  onChange={(e) => setNewMetricConfig({...newMetricConfig, name: e.target.value})}
                  placeholder="Enter metric name..."
                  autoFocus
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="new-metric-start-date">Start Date: *</label>
                  <input
                    id="new-metric-start-date"
                    type="date"
                    value={newMetricConfig.start_date}
                    onChange={(e) => setNewMetricConfig({...newMetricConfig, start_date: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="new-metric-end-date">End Date: *</label>
                  <input
                    id="new-metric-end-date"
                    type="date"
                    value={newMetricConfig.end_date}
                    onChange={(e) => setNewMetricConfig({...newMetricConfig, end_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="new-metric-frequency">Frequency: *</label>
                  <Select
                    id="new-metric-frequency"
                    value={{ value: newMetricConfig.frequency, label: newMetricConfig.frequency.charAt(0).toUpperCase() + newMetricConfig.frequency.slice(1) }}
                    onChange={(option) => setNewMetricConfig({...newMetricConfig, frequency: option.value})}
                    options={[
                      { value: 'weekly', label: 'Weekly' },
                      { value: 'fortnightly', label: 'Fortnightly' },
                      { value: 'monthly', label: 'Monthly' },
                      { value: 'quarterly', label: 'Quarterly' }
                    ]}
                    styles={selectStyles}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="new-metric-target">Final Target: *</label>
                  <input
                    id="new-metric-target"
                    type="text"
                    inputMode="numeric"
                    value={newMetricConfig.final_target}
                    onChange={(e) => setNewMetricConfig({...newMetricConfig, final_target: parseFloat(e.target.value) || 0})}
                    placeholder="100"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="new-metric-progression">Progression: *</label>
                  <Select
                    id="new-metric-progression"
                    value={{
                      value: newMetricConfig.progression_type,
                      label: newMetricConfig.progression_type === 'linear' ? 'Linear' :
                             newMetricConfig.progression_type === 'exponential' ? 'Exponential (Back-loaded)' :
                             newMetricConfig.progression_type === 's-curve' ? 'S-curve' :
                             'Logarithmic (Front-loaded)'
                    }}
                    onChange={(option) => setNewMetricConfig({...newMetricConfig, progression_type: option.value})}
                    options={[
                      { value: 'linear', label: 'Linear' },
                      { value: 'exponential', label: 'Exponential (Back-loaded)' },
                      { value: 's-curve', label: 'S-curve' },
                      { value: 'logarithmic', label: 'Logarithmic (Front-loaded)' }
                    ]}
                    styles={selectStyles}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="new-metric-amber-tolerance">Amber Tolerance (%):</label>
                  <input
                    id="new-metric-amber-tolerance"
                    type="text"
                    inputMode="decimal"
                    value={newMetricConfig.amber_tolerance}
                    onChange={(e) => setNewMetricConfig({...newMetricConfig, amber_tolerance: parseFloat(e.target.value) || 5.0})}
                    placeholder="5.0"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="new-metric-red-tolerance">Red Tolerance (%):</label>
                  <input
                    id="new-metric-red-tolerance"
                    type="text"
                    inputMode="decimal"
                    value={newMetricConfig.red_tolerance}
                    onChange={(e) => setNewMetricConfig({...newMetricConfig, red_tolerance: parseFloat(e.target.value) || 10.0})}
                    placeholder="10.0"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button className="save-btn" onClick={handleCreateMetric}>
                  Create Metric
                </button>
                <button className="cancel-btn" onClick={() => setShowNewMetric(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataGrid;
