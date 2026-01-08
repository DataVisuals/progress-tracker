import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { api } from '../api/client';
import { selectStyles } from './SelectStyles';
import InfoPopup from './InfoPopup';
import PortfolioManager from './PortfolioManager';
import UserSelector from './UserSelector';
import './FormInputs.css';
import './ProjectSetup.css';

// Benefits options
const BENEFITS_OPTIONS = [
  { value: 'automation', label: 'Automation and Process Optimisation' },
  { value: 'capability', label: 'Capability Development' },
  { value: 'cost', label: 'Cost Optimisation' },
  { value: 'technology', label: 'Technology Modernisation' },
  { value: 'risk', label: 'Risk and Controls' }
];

const ProjectSetup = ({ onComplete, onCancel, backlogMode = false, initialData = null }) => {
  const [projectName, setProjectName] = useState(initialData?.name || '');
  const [projectManager, setProjectManager] = useState(null);
  const [secondaryPM, setSecondaryPM] = useState(null);
  const [projectDesc, setProjectDesc] = useState(initialData?.description || '');
  const [portfolioId, setPortfolioId] = useState(initialData?.portfolio_id || null);
  const [benefits, setBenefits] = useState(() => {
    if (!initialData?.benefits) return [];
    // Handle comma-separated string from database
    if (typeof initialData.benefits === 'string') {
      return initialData.benefits.split(',').filter(Boolean);
    }
    return Array.isArray(initialData.benefits) ? initialData.benefits : [];
  });
  const [priority, setPriority] = useState(initialData?.priority || 'medium');
  const [users, setUsers] = useState([]);
  const [portfolios, setPortfolios] = useState([]);

  // Calculate default dates: start = first of next month, end = 6 months later
  const [projectStartDate, setProjectStartDate] = useState(() => {
    if (initialData?.start_date) return initialData.start_date;
    if (backlogMode) return ''; // No default date for backlog
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return nextMonth.toISOString().split('T')[0];
  });

  const [projectEndDate, setProjectEndDate] = useState(() => {
    if (initialData?.end_date) return initialData.end_date;
    if (backlogMode) return ''; // No default date for backlog
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const sixMonthsLater = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 6, 0);
    return sixMonthsLater.toISOString().split('T')[0];
  });

  const [metrics, setMetrics] = useState(() => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const sixMonthsLater = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 6, 0);
    return [{
      name: '',
      description: '',
      target: '',
      progression: 'linear',
      amberTolerance: 5.0,
      redTolerance: 10.0,
      startDate: nextMonth.toISOString().split('T')[0],
      endDate: sixMonthsLater.toISOString().split('T')[0],
      frequency: 'monthly'
    }];
  });
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

      // Set initiative manager from initialData if present
      if (initialData?.initiative_manager && usersResponse.data) {
        const matchingUser = usersResponse.data.find(u => u.name === initialData.initiative_manager);
        if (matchingUser) {
          setProjectManager({ value: matchingUser.id, label: matchingUser.name });
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const addMetric = () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const sixMonthsLater = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 6, 0);
    setMetrics([...metrics, {
      name: '',
      description: '',
      target: '',
      progression: 'linear',
      amberTolerance: 5.0,
      redTolerance: 10.0,
      startDate: nextMonth.toISOString().split('T')[0],
      endDate: sixMonthsLater.toISOString().split('T')[0],
      frequency: 'monthly'
    }]);
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

    // Backlog mode: relaxed validation, different API
    if (backlogMode) {
      // Description is required for backlog items
      if (!projectDesc.trim()) {
        alert('Please enter a description for this backlog item');
        return;
      }
      // Portfolio is required for backlog items (determines space)
      if (!portfolioId) {
        alert('Please select a Portfolio');
        return;
      }
      // Date validation only if dates are provided
      if (projectStartDate && projectEndDate && new Date(projectStartDate) >= new Date(projectEndDate)) {
        alert('Project end date must be after start date');
        return;
      }

      try {
        const backlogData = {
          name: projectName,
          description: projectDesc || null,
          portfolio_id: portfolioId,
          initiative_manager: projectManager ? projectManager.label : null,
          priority: priority,
          start_date: projectStartDate || null,
          end_date: projectEndDate || null
        };

        if (initialData?.id) {
          // Update existing backlog item
          await api.updateBacklogItem(initialData.id, backlogData);
        } else {
          // Create new backlog item
          await api.createBacklogItem(backlogData);
        }
        onComplete();
      } catch (err) {
        console.error('Failed to save backlog item:', err);
        alert('Failed to save backlog item: ' + (err.response?.data?.error || err.message));
      }
      return;
    }

    // Regular project mode: full validation
    if (!projectDesc.trim()) {
      alert('Please enter a project description');
      return;
    }
    if (!projectManager) {
      alert('Please select a Primary Initiative Manager');
      return;
    }
    if (!portfolioId) {
      alert('Please select a Portfolio');
      return;
    }
    if (!benefits || benefits.length === 0) {
      alert('Please select at least one Benefits category');
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
        portfolio_id: portfolioId,
        benefits: benefits.join(',')
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

  const isPromoting = !backlogMode && initialData;

  return (
    <div className="project-setup-container">
      <h2>{backlogMode ? (initialData ? 'Edit Backlog Item' : 'New Backlog Item') : (isPromoting ? 'Promote to Project' : 'Create New Project')}</h2>
      <p className="setup-subtitle">
        {backlogMode
          ? 'Add a project idea to the backlog. Metrics can be added later when you promote it to a project.'
          : (isPromoting ? 'Complete the project setup by adding metrics and targets.' : 'Set up your project with metrics and target values')}
      </p>

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
            <label htmlFor="project-desc">Description *</label>
            <input
              id="project-desc"
              type="text"
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              placeholder="Add a description of what the project will achieve..."
              maxLength={250}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="project-manager">Primary Initiative Manager{!backlogMode && ' *'}</label>
            <UserSelector
              users={users}
              selectedUser={projectManager}
              onUserChange={(option) => setProjectManager(option)}
              placeholder="Select primary initiative manager..."
            />
          </div>
          <div className="form-group">
            <label htmlFor="secondary-pm">Secondary Initiative Manager</label>
            <UserSelector
              users={users}
              selectedUser={secondaryPM}
              onUserChange={(option) => setSecondaryPM(option)}
              placeholder="Select secondary IM (optional)..."
            />
          </div>
        </div>
        <div className="form-row three-col">
          <div className="form-group">
            <label htmlFor="portfolio">Portfolio *</label>
            <Select
              id="portfolio"
              value={portfolioId ? { value: portfolioId, label: portfolios.find(p => p.id === portfolioId)?.name } : null}
              onChange={handlePortfolioChange}
              options={[
                ...portfolios.map(p => ({ value: p.id, label: p.name })),
                { value: '__create__', label: '+ Create New Portfolio...' }
              ]}
              styles={selectStyles}
              placeholder="Select portfolio..."
            />
          </div>
          <div className="form-group">
            <label htmlFor="benefits">Benefits{!backlogMode && ' *'}</label>
            <Select
              id="benefits"
              isMulti
              value={BENEFITS_OPTIONS.filter(b => benefits.includes(b.value))}
              onChange={(options) => setBenefits(options ? options.map(o => o.value) : [])}
              options={BENEFITS_OPTIONS}
              styles={selectStyles}
              placeholder="Select benefits..."
            />
          </div>
          <div className="form-group">
            <label htmlFor="project-start-date">Project Start Date{!backlogMode && ' *'}</label>
            <input
              id="project-start-date"
              type="date"
              value={projectStartDate}
              onChange={(e) => setProjectStartDate(e.target.value)}
            />
          </div>
        </div>
        <div className="form-row three-col">
          <div className="form-group">
            <label htmlFor="project-end-date">Project End Date{!backlogMode && ' *'}</label>
            <input
              id="project-end-date"
              type="date"
              value={projectEndDate}
              onChange={(e) => setProjectEndDate(e.target.value)}
            />
          </div>
          <div className="form-group" />
          <div className="form-group" />
        </div>
        {backlogMode && (
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="priority">Priority</label>
              <Select
                id="priority"
                value={{ value: priority, label: priority.charAt(0).toUpperCase() + priority.slice(1) }}
                onChange={(option) => setPriority(option.value)}
                options={[
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' }
                ]}
                styles={selectStyles}
              />
            </div>
          </div>
        )}
      </div>

      {!backlogMode && (
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
      )}

      {!backlogMode && (
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
      )}

      <div className="modal-actions">
        <button className="save-btn" onClick={handleSubmit}>
          {backlogMode
            ? (initialData ? 'Save Changes' : 'Add to Backlog')
            : (isPromoting
                ? `Promote with ${metrics.filter(m => m.name.trim()).length} Metric${metrics.filter(m => m.name.trim()).length !== 1 ? 's' : ''}`
                : `Create Project with ${metrics.filter(m => m.name.trim()).length} Metric${metrics.filter(m => m.name.trim()).length !== 1 ? 's' : ''}`)
          }
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
