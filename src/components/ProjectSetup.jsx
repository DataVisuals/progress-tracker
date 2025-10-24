import React, { useState } from 'react';
import Select from 'react-select';
import { api } from '../api/client';
import { selectStyles } from './SelectStyles';
import './FormInputs.css';
import './ProjectSetup.css';

const ProjectSetup = ({ onComplete, onCancel }) => {
  // Calculate default dates: start = first of next month, end = 6 months later
  const getDefaultDates = () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const sixMonthsLater = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 6, 0); // Last day of month 6 months later

    return {
      start: nextMonth.toISOString().split('T')[0],
      end: sixMonthsLater.toISOString().split('T')[0]
    };
  };

  const defaultDates = getDefaultDates();

  const [projectName, setProjectName] = useState('');
  const [projectManager, setProjectManager] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  const [frequency, setFrequency] = useState('monthly');
  const [metrics, setMetrics] = useState([
    { name: '', target: '', progression: 'linear' }
  ]);

  const addMetric = () => {
    setMetrics([...metrics, { name: '', target: '', progression: 'linear' }]);
  };

  const removeMetric = (index) => {
    setMetrics(metrics.filter((_, i) => i !== index));
  };

  const updateMetric = (index, field, value) => {
    const newMetrics = [...metrics];
    newMetrics[index][field] = value;
    setMetrics(newMetrics);
  };

  const handleSubmit = async () => {
    // Validation
    if (!projectName.trim()) {
      alert('Please enter a project name');
      return;
    }
    if (!startDate || !endDate) {
      alert('Please select start and end dates');
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      alert('End date must be after start date');
      return;
    }
    const validMetrics = metrics.filter(m => m.name.trim() && m.target);
    if (validMetrics.length === 0) {
      alert('Please add at least one metric with a name and target value');
      return;
    }

    try {
      // 1. Create project
      const projectResponse = await api.createProject({
        name: projectName,
        description: projectDesc,
        initiative_manager: projectManager
      });
      const projectId = projectResponse.data.id;

      // 2. Create metrics and generate periods for each
      for (const metric of validMetrics) {
        const metricResponse = await api.createMetric(projectId, {
          name: metric.name,
          start_date: startDate,
          end_date: endDate,
          frequency: frequency,
          progression_type: metric.progression,
          final_target: parseInt(metric.target)
        });

        // The backend will automatically generate periods based on the metric configuration
      }

      // 3. Complete setup
      onComplete(projectId);
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('Failed to create project: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="project-setup-container">
      <h2>Create New Project</h2>
      <p className="setup-subtitle">Set up your project with metrics and target values</p>

      <div className="setup-section">
        <h3>Project Details</h3>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="project-name">Project Name *</label>
            <input
              id="project-name"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name..."
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="project-manager">Project Manager</label>
            <input
              id="project-manager"
              type="text"
              value={projectManager}
              onChange={(e) => setProjectManager(e.target.value)}
              placeholder="Enter project manager name..."
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="project-desc">Description</label>
          <textarea
            id="project-desc"
            value={projectDesc}
            onChange={(e) => setProjectDesc(e.target.value)}
            placeholder="Enter project description..."
            rows={2}
          />
        </div>
      </div>

      <div className="setup-section">
        <h3>Reporting Schedule</h3>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="start-date">Start Date *</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="end-date">End Date *</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="frequency">Frequency *</label>
            <Select
              id="frequency"
              value={{ value: frequency, label: frequency.charAt(0).toUpperCase() + frequency.slice(1) }}
              onChange={(option) => setFrequency(option.value)}
              options={[
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' }
              ]}
              styles={selectStyles}
            />
          </div>
        </div>
      </div>

      <div className="setup-section">
        <div className="section-header">
          <h3>Metrics & Targets</h3>
          <button className="add-metric-btn" onClick={addMetric}>
            + Add Metric
          </button>
        </div>
        <div className="metrics-list">
          {metrics.map((metric, index) => (
            <div key={index} className="metric-row">
              <div className="metric-number">{index + 1}</div>
              <div className="form-group metric-name">
                <label>Metric Name *</label>
                <input
                  type="text"
                  value={metric.name}
                  onChange={(e) => updateMetric(index, 'name', e.target.value)}
                  placeholder="e.g., User Stories Completed"
                />
              </div>
              <div className="form-group metric-target">
                <label>Target Value *</label>
                <input
                  type="number"
                  value={metric.target}
                  onChange={(e) => updateMetric(index, 'target', e.target.value)}
                  placeholder="e.g., 100"
                  min="0"
                />
              </div>
              <div className="form-group metric-progression">
                <label>Progression Curve</label>
                <Select
                  value={{
                    value: metric.progression,
                    label: metric.progression === 'linear' ? 'Linear' :
                           metric.progression === 'exponential' ? 'Exponential (S-curve)' :
                           'Logarithmic (Front-loaded)'
                  }}
                  onChange={(option) => updateMetric(index, 'progression', option.value)}
                  options={[
                    { value: 'linear', label: 'Linear' },
                    { value: 'exponential', label: 'Exponential (S-curve)' },
                    { value: 'logarithmic', label: 'Logarithmic (Front-loaded)' }
                  ]}
                  styles={selectStyles}
                />
              </div>
              {metrics.length > 1 && (
                <button
                  className="remove-metric-btn"
                  onClick={() => removeMetric(index)}
                  title="Remove metric"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="help-text">
          <strong>Progression Curves:</strong><br/>
          • Linear: Equal progress in each period<br/>
          • Exponential (S-curve): Slow start, fast middle, slow end<br/>
          • Logarithmic: Fast start, gradually slowing down
        </p>
      </div>

      <div className="modal-actions">
        <button className="save-btn" onClick={handleSubmit}>
          Create Project with {metrics.filter(m => m.name.trim()).length} Metric{metrics.filter(m => m.name.trim()).length !== 1 ? 's' : ''}
        </button>
        <button className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ProjectSetup;
