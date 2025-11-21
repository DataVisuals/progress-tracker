import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { api } from '../api/client';
import { selectStyles } from './SelectStyles';
import InfoPopup from './InfoPopup';
import PortfolioManager from './PortfolioManager';
import UserSelector from './UserSelector';
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
  const [projectManager, setProjectManager] = useState(null);
  const [secondaryPM, setSecondaryPM] = useState(null);
  const [projectDesc, setProjectDesc] = useState('');
  const [portfolioId, setPortfolioId] = useState(null);
  const [users, setUsers] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [projectStartDate, setProjectStartDate] = useState(defaultDates.start);
  const [projectEndDate, setProjectEndDate] = useState(defaultDates.end);
  const [metrics, setMetrics] = useState([
    { name: '', description: '', target: '', progression: 'linear', amberTolerance: 5.0, redTolerance: 10.0, startDate: defaultDates.start, endDate: defaultDates.end, frequency: 'monthly' }
  ]);
  const [links, setLinks] = useState([
    { label: '', url: '' }
  ]);
  const [showPortfolioManager, setShowPortfolioManager] = useState(false);

  // Load users and portfolios on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersResponse, portfoliosResponse] = await Promise.all([
        api.getUsers(),
        api.get('/portfolios')
      ]);
      setUsers(usersResponse.data);
      setPortfolios(portfoliosResponse.data);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const addMetric = () => {
    setMetrics([...metrics, { name: '', description: '', target: '', progression: 'linear', amberTolerance: 5.0, redTolerance: 10.0, startDate: defaultDates.start, endDate: defaultDates.end, frequency: 'monthly' }]);
  };

  const removeMetric = (index) => {
    setMetrics(metrics.filter((_, i) => i !== index));
  };

  const updateMetric = (index, field, value) => {
    const newMetrics = [...metrics];
    newMetrics[index][field] = value;
    setMetrics(newMetrics);
  };

  const addLink = () => {
    setLinks([...links, { label: '', url: '' }]);
  };

  const removeLink = (index) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const updateLink = (index, field, value) => {
    const newLinks = [...links];
    newLinks[index][field] = value;
    setLinks(newLinks);
  };

  const handlePortfolioChange = (option) => {
    if (option && option.value === '__create__') {
      setShowPortfolioManager(true);
      return;
    }
    setPortfolioId(option ? option.value : null);
  };

  const handlePortfolioCreated = async () => {
    await loadData();
    setShowPortfolioManager(false);
  };

  const handleSubmit = async () => {
    // Validation
    if (!projectName.trim()) {
      alert('Please enter a project name');
      return;
    }
    if (!projectStartDate || !projectEndDate) {
      alert('Please select project start and end dates');
      return;
    }
    if (new Date(projectStartDate) >= new Date(projectEndDate)) {
      alert('Project end date must be after start date');
      return;
    }
    const validMetrics = metrics.filter(m => m.name.trim() && m.target);
    if (validMetrics.length === 0) {
      alert('Please add at least one metric with a name and target value');
      return;
    }
    // Validate each metric has dates
    for (let i = 0; i < validMetrics.length; i++) {
      const metric = validMetrics[i];
      if (!metric.startDate || !metric.endDate) {
        alert(`Please set start and end dates for metric "${metric.name}"`);
        return;
      }
      if (new Date(metric.startDate) >= new Date(metric.endDate)) {
        alert(`End date must be after start date for metric "${metric.name}"`);
        return;
      }
    }

    try {
      // 1. Create project
      const projectResponse = await api.createProject({
        name: projectName,
        description: projectDesc,
        initiative_manager: projectManager ? projectManager.label : '',
        secondary_pm: secondaryPM ? secondaryPM.label : '',
        start_date: projectStartDate,
        end_date: projectEndDate,
        portfolio_id: portfolioId
      });
      const projectId = projectResponse.data.id;

      // 2. Create metrics and generate periods for each
      for (const metric of validMetrics) {
        const metricResponse = await api.createMetric(projectId, {
          name: metric.name,
          description: metric.description || null,
          start_date: metric.startDate,
          end_date: metric.endDate,
          frequency: metric.frequency,
          progression_type: metric.progression,
          final_target: parseInt(metric.target),
          amber_tolerance: metric.amberTolerance,
          red_tolerance: metric.redTolerance
        });

        // The backend will automatically generate periods based on the metric configuration
      }

      // 3. Create project links
      const validLinks = links.filter(l => l.label.trim() && l.url.trim());
      for (let i = 0; i < validLinks.length; i++) {
        const link = validLinks[i];
        await api.createProjectLink(projectId, {
          label: link.label,
          url: link.url,
          display_order: i
        });
      }

      // 4. Complete setup
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
            <label htmlFor="project-manager">Primary Initiative Manager</label>
            <UserSelector
              users={users}
              selectedUser={projectManager}
              onUserChange={(option) => setProjectManager(option)}
              placeholder="Select primary initiative manager..."
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="secondary-pm">Secondary Initiative Manager</label>
            <UserSelector
              users={users}
              selectedUser={secondaryPM}
              onUserChange={(option) => setSecondaryPM(option)}
              placeholder="Select secondary IM (optional)..."
            />
          </div>
          <div className="form-group">
            <label htmlFor="project-desc">Description</label>
            <input
              id="project-desc"
              type="text"
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              placeholder="Add a description of what the project will achieve here..."
              maxLength={250}
            />
          </div>
          <div className="form-group">
            <label htmlFor="portfolio">Portfolio</label>
            <Select
              id="portfolio"
              value={portfolioId ? { value: portfolioId, label: portfolios.find(p => p.id === portfolioId)?.name } : null}
              onChange={handlePortfolioChange}
              options={[
                ...portfolios.map(p => ({ value: p.id, label: p.name })),
                { value: '__create__', label: '+ Create New Portfolio...' }
              ]}
              styles={selectStyles}
              placeholder="Select portfolio (optional)..."
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="project-start-date">Project Start Date *</label>
            <input
              id="project-start-date"
              type="date"
              value={projectStartDate}
              onChange={(e) => setProjectStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="project-end-date">Project End Date *</label>
            <input
              id="project-end-date"
              type="date"
              value={projectEndDate}
              onChange={(e) => setProjectEndDate(e.target.value)}
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
            <div key={index} className="metric-card">
              <div className="metric-card-header">
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

              <div className="metric-description-row">
                <div className="form-group metric-description">
                  <label>Description</label>
                  <input
                    type="text"
                    value={metric.description}
                    onChange={(e) => updateMetric(index, 'description', e.target.value)}
                    placeholder="Brief description of what this metric measures..."
                    maxLength={500}
                  />
                </div>
              </div>

              <div className="metric-card-row">
                <div className="metric-card-section">
                  <h4>Timeline & Frequency</h4>
                  <div className="metric-fields-row">
                    <div className="form-group">
                      <label>Start Date *</label>
                      <input
                        type="date"
                        value={metric.startDate}
                        onChange={(e) => updateMetric(index, 'startDate', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>End Date *</label>
                      <input
                        type="date"
                        value={metric.endDate}
                        onChange={(e) => updateMetric(index, 'endDate', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Frequency *</label>
                      <Select
                        value={{ value: metric.frequency, label: metric.frequency.charAt(0).toUpperCase() + metric.frequency.slice(1) }}
                        onChange={(option) => updateMetric(index, 'frequency', option.value)}
                        options={[
                          { value: 'weekly', label: 'Weekly' },
                          { value: 'fortnightly', label: 'Fortnightly' },
                          { value: 'monthly', label: 'Monthly' },
                          { value: 'quarterly', label: 'Quarterly' }
                        ]}
                        styles={selectStyles}
                      />
                    </div>
                  </div>
                </div>

                <div className="metric-card-section">
                  <h4>Target & Progression</h4>
                  <div className="metric-fields-row">
                    <div className="form-group">
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
                      <label>
                        Progression Curve
                        <InfoPopup>
                          <strong>Progression Curves:</strong>
                          <ul>
                            <li><strong>Linear:</strong> Equal progress in each period</li>
                            <li><strong>Exponential (Back-loaded):</strong> Slow start, then rapid acceleration at the end</li>
                            <li><strong>S-curve:</strong> Slow start, fast middle, slow end</li>
                            <li><strong>Logarithmic (Front-loaded):</strong> Fast start, gradually slowing down</li>
                          </ul>
                        </InfoPopup>
                      </label>
                      <Select
                        value={{
                          value: metric.progression,
                          label: metric.progression === 'linear' ? 'Linear' :
                                 metric.progression === 'exponential' ? 'Exponential (Back-loaded)' :
                                 metric.progression === 's-curve' ? 'S-curve' :
                                 'Logarithmic (Front-loaded)'
                        }}
                        onChange={(option) => updateMetric(index, 'progression', option.value)}
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
                </div>

                <div className="metric-card-section">
                  <h4>Tolerances</h4>
                  <div className="metric-fields-row">
                    <div className="form-group metric-tolerance">
                      <label><span className="tolerance-indicator amber">●</span> Amber %</label>
                      <input
                        type="number"
                        value={metric.amberTolerance}
                        onChange={(e) => updateMetric(index, 'amberTolerance', parseFloat(e.target.value))}
                        placeholder="5.0"
                        min="0"
                        step="0.1"
                      />
                    </div>
                    <div className="form-group metric-tolerance">
                      <label><span className="tolerance-indicator red">●</span> Red %</label>
                      <input
                        type="number"
                        value={metric.redTolerance}
                        onChange={(e) => updateMetric(index, 'redTolerance', parseFloat(e.target.value))}
                        placeholder="10.0"
                        min="0"
                        step="0.1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <div className="section-header">
          <h3>External Links (Optional)</h3>
          <button className="add-metric-btn" onClick={addLink}>
            + Add Link
          </button>
        </div>
        <div className="metrics-list">
          {links.map((link, index) => (
            <div key={index} className="link-row">
              <div className="form-group">
                <label>
                  Label
                  {index === 0 && (
                    <InfoPopup>
                      <strong>External Links</strong>
                      <p style={{ margin: '8px 0 0 0' }}>
                        Add links to external tools like JIRA, Confluence, or SharePoint.
                        These will appear as buttons at the top of the project view.
                      </p>
                    </InfoPopup>
                  )}
                </label>
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => updateLink(index, 'label', e.target.value)}
                  placeholder="e.g., JIRA, Confluence, SharePoint"
                />
              </div>
              <div className="form-group">
                <label>URL</label>
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(index, 'url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
              {links.length > 1 && (
                <button
                  className="remove-metric-btn"
                  onClick={() => removeLink(index)}
                  title="Remove link"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="modal-actions">
        <button className="save-btn" onClick={handleSubmit}>
          Create Project with {metrics.filter(m => m.name.trim()).length} Metric{metrics.filter(m => m.name.trim()).length !== 1 ? 's' : ''}
        </button>
        <button className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {showPortfolioManager && (
        <div className="modal-overlay" onClick={() => setShowPortfolioManager(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <PortfolioManager
              onClose={() => setShowPortfolioManager(false)}
              onPortfolioCreated={handlePortfolioCreated}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectSetup;
