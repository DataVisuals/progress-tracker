import React, { useState } from 'react';
import Select from 'react-select';
import { api } from '../api/client';
import { selectStyles } from './SelectStyles';
import './AddMetricModal.css';

const AddMetricModal = ({ projectId, onClose, onMetricCreated }) => {
  const [newMetricConfig, setNewMetricConfig] = useState({
    name: '',
    start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    frequency: 'monthly',
    progression_type: 'linear',
    final_target: 100,
    amber_tolerance: 5.0,
    red_tolerance: 10.0
  });

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
      const response = await api.createMetric(projectId, newMetricConfig);

      if (onMetricCreated) {
        await onMetricCreated(response.data?.name || newMetricConfig.name);
      }

      onClose();
    } catch (err) {
      console.error('Failed to create metric:', err);
      alert(`Failed to create metric: ${err.response?.data?.error || err.message}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-metric-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>
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
              type="number"
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
              type="number"
              step="0.1"
              value={newMetricConfig.amber_tolerance}
              onChange={(e) => setNewMetricConfig({...newMetricConfig, amber_tolerance: parseFloat(e.target.value) || 5.0})}
              placeholder="5.0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-metric-red-tolerance">Red Tolerance (%):</label>
            <input
              id="new-metric-red-tolerance"
              type="number"
              step="0.1"
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
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMetricModal;
