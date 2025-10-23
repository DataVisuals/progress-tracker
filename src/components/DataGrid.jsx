import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './DataGrid.css';

const DataGrid = ({ data, metrics, onDataChange, onClose, projectId, onMetricCreated }) => {
  const [selectedMetric, setSelectedMetric] = useState('');
  const [editedData, setEditedData] = useState([]);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showNewMetric, setShowNewMetric] = useState(false);
  const [newMetricName, setNewMetricName] = useState('');
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

  const handleCellChange = (id, field, value) => {
    setEditedData(prev =>
      prev.map(row =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const handleSave = () => {
    onDataChange(editedData);
    onClose();
  };

  const handleAddRow = () => {
    if (newRow.reporting_date && newRow.metric) {
      const newId = Math.max(...editedData.map(r => r.id), 0) + 1;
      const rowToAdd = {
        ...newRow,
        id: newId,
        expected: parseFloat(newRow.expected) || 0,
        final_target: parseFloat(newRow.final_target) || 0,
        complete: parseFloat(newRow.complete) || 0,
      };
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

    // Get metric_id from the first item in editedData (they all have the same metric)
    const metric_id = editedData.length > 0 ? editedData[0].metric_id : null;

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

  const handleDeleteRow = (id) => {
    setEditedData(prev => prev.filter(row => row.id !== id));
  };

  const handleCreateMetric = async () => {
    if (!newMetricName.trim()) {
      alert('Please enter a metric name');
      return;
    }

    try {
      // Create the metric in the database
      // Note: We need start_date, end_date, frequency, and final_target
      // For now, use defaults - the user can configure these later
      console.log('Creating metric with projectId:', projectId);
      const response = await api.createMetric(projectId, {
        name: newMetricName,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year from now
        frequency: 'monthly',
        progression_type: 'linear',
        final_target: 100
      });

      console.log('Metric created successfully:', response);

      // Close the modal and notify parent
      setNewMetricName('');
      setShowNewMetric(false);

      // Call the callback to refresh data and select the new metric
      if (onMetricCreated) {
        onMetricCreated(newMetricName);
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
        <div className="data-grid-header">
          <h2>Edit Project Data</h2>
          <div className="header-actions">
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="metric-selector-section">
          <div className="metric-selector-row">
            <div className="metric-selector-control">
              <select
                id="metric-select"
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="metric-select"
              >
                <option value="">-- Select a Metric --</option>
                {metrics.map((metric) => (
                  <option key={metric} value={metric}>
                    {metric}
                  </option>
                ))}
              </select>
            </div>
            <button className="new-metric-btn" onClick={() => setShowNewMetric(true)}>
              + Add Metric
            </button>
          </div>
        </div>

        {selectedMetric && (
          <div className="selected-metric-header">
            <h3>Editing: {selectedMetric}</h3>
            <button className="bulk-add-btn" onClick={() => setShowBulkAdd(!showBulkAdd)}>
              {showBulkAdd ? 'Hide' : 'Bulk Add'}
            </button>
          </div>
        )}

        {selectedMetric && showBulkAdd && (
          <div className="bulk-add-section">
            <h3>Bulk Add Rows</h3>
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
                  type="number"
                  value={bulkConfig.numPeriods}
                  min="1"
                  max="52"
                  onChange={(e) => setBulkConfig({...bulkConfig, numPeriods: parseInt(e.target.value)})}
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
                  type="number"
                  value={bulkConfig.final_target}
                  onChange={(e) => setBulkConfig({...bulkConfig, final_target: parseInt(e.target.value)})}
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
              {editedData.map(row => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="date"
                      value={row.reporting_date}
                      onChange={(e) => handleCellChange(row.id, 'reporting_date', e.target.value)}
                      style={{width: '100%'}}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.metric}
                      readOnly
                      style={{width: '100%', backgroundColor: '#f0f0f0', cursor: 'not-allowed'}}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.expected}
                      onChange={(e) => handleCellChange(row.id, 'expected', parseFloat(e.target.value))}
                      style={{width: '100%'}}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.final_target}
                      onChange={(e) => handleCellChange(row.id, 'final_target', parseFloat(e.target.value))}
                      style={{width: '100%'}}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.complete}
                      onChange={(e) => handleCellChange(row.id, 'complete', parseFloat(e.target.value))}
                      style={{width: '100%'}}
                    />
                  </td>
                  <td>
                    <button className="delete-row-btn" onClick={() => handleDeleteRow(row.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
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
                    style={{backgroundColor: '#f0f0f0', cursor: 'not-allowed'}}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    placeholder="0"
                    value={newRow.expected}
                    onChange={(e) => setNewRow({ ...newRow, expected: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    placeholder="0"
                    value={newRow.final_target}
                    onChange={(e) => setNewRow({ ...newRow, final_target: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
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
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Create New Metric</h2>
              <div className="form-group">
                <label htmlFor="new-metric-name">Metric Name:</label>
                <input
                  id="new-metric-name"
                  type="text"
                  value={newMetricName}
                  onChange={(e) => setNewMetricName(e.target.value)}
                  placeholder="Enter metric name..."
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button className="save-btn" onClick={handleCreateMetric}>
                  Create
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
