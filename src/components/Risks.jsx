import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { api } from '../api/client';
import { selectStyles } from './SelectStyles';
import './FormInputs.css';
import './Risks.css';

const Risks = ({ projectId, canEdit = false }) => {
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRisk, setEditingRisk] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'open',
    priority: 'significant',
    period_id: null
  });

  useEffect(() => {
    const loadData = async () => {
      if (!projectId) {
        setRisks([]);
        setPeriods([]);
        setLoading(false);
        return;
      }

      try {
        // Load CRAIDs filtered for risks and project data (to get periods)
        const [craidsResponse, dataResponse] = await Promise.all([
          api.getProjectCRAIDs(projectId),
          api.getProjectData(projectId)
        ]);

        // Filter to only show risks
        const riskItems = craidsResponse.data.filter(item => item.type === 'risk');
        setRisks(riskItems);

        // Extract unique periods sorted by date
        const uniqueDates = new Set();
        const allPeriods = dataResponse.data
          .filter(item => {
            if (uniqueDates.has(item.reporting_date)) {
              return false;
            }
            uniqueDates.add(item.reporting_date);
            return true;
          })
          .map(item => ({ id: item.id, date: item.reporting_date }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        setPeriods(allPeriods);
      } catch (err) {
        console.error('Failed to load risks:', err);
        setRisks([]);
        setPeriods([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId]);

  const handleStartAdd = () => {
    setFormData({
      title: '',
      description: '',
      status: 'open',
      priority: 'significant',
      period_id: null
    });
    setEditingRisk(null);
    setShowAddModal(true);
  };

  const handleStartEdit = (risk) => {
    setFormData({
      title: risk.title,
      description: risk.description,
      status: risk.status,
      priority: risk.priority,
      period_id: risk.period_id
    });
    setEditingRisk(risk);
    setShowAddModal(true);
  };

  const handleSaveRisk = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a title');
      return;
    }

    try {
      const riskData = { ...formData, type: 'risk' };

      if (editingRisk) {
        // Update existing risk
        await api.updateCRAID(editingRisk.id, riskData);
      } else {
        // Create new risk
        await api.createCRAID(projectId, riskData);
      }

      // Reload risks
      const response = await api.getProjectCRAIDs(projectId);
      const riskItems = response.data.filter(item => item.type === 'risk');
      setRisks(riskItems);
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to save risk:', err);
      alert('Failed to save risk');
    }
  };

  const handleDeleteRisk = async (riskId) => {
    if (!confirm('Are you sure you want to delete this risk?')) {
      return;
    }

    try {
      await api.deleteCRAID(riskId);

      // Reload risks
      const response = await api.getProjectCRAIDs(projectId);
      const riskItems = response.data.filter(item => item.type === 'risk');
      setRisks(riskItems);
    } catch (err) {
      console.error('Failed to delete risk:', err);
      alert('Failed to delete risk');
    }
  };

  if (loading) {
    return <div className="risks-loading">Loading...</div>;
  }

  // Group by status
  const openRisks = risks.filter(r => r.status === 'open' || r.status === 'in_progress');
  const closedRisks = risks.filter(r => r.status === 'closed' || r.status === 'resolved');

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'blocker': return '#dc2626';
      case 'critical': return '#D0704d';
      case 'significant': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'in_progress': return 'Mitigating';
      case 'closed': return 'Closed';
      case 'resolved': return 'Resolved';
      default: return 'Open';
    }
  };

  return (
    <div className="risks-container">
      {canEdit && (
        <div className="risks-header">
          <button className="add-risk-btn" onClick={handleStartAdd}>
            + Add Risk
          </button>
        </div>
      )}

      {risks.length === 0 ? (
        <div className="risks-empty">
          <span className="empty-icon">✓</span>
          <p>No risks recorded for this project</p>
          {canEdit && <p className="empty-hint">Click "Add Risk" to log a new risk</p>}
        </div>
      ) : (
        <div className="risks-sections">
          {openRisks.length > 0 && (
            <div className="risks-section">
              <h4 className="section-title">Open Risks ({openRisks.length})</h4>
              <div className="risks-list">
                {openRisks.map((risk) => (
                  <div key={risk.id} className={`risk-item priority-${risk.priority}`}>
                    <div className="risk-header">
                      <div className="risk-priority" style={{ backgroundColor: getPriorityColor(risk.priority) }}>
                        {risk.priority}
                      </div>
                      <div className="risk-title">{risk.title}</div>
                      <div className="risk-status" data-status={risk.status}>
                        {getStatusLabel(risk.status)}
                      </div>
                      {canEdit && (
                        <div className="risk-actions">
                          <button className="edit-risk-btn" onClick={() => handleStartEdit(risk)} title="Edit">
                            ✏️
                          </button>
                          <button className="delete-risk-btn" onClick={() => handleDeleteRisk(risk.id)} title="Delete">
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                    {risk.description && (
                      <div className="risk-description">{risk.description}</div>
                    )}
                    <div className="risk-meta">
                      {risk.reporting_date && (
                        <span className="risk-period">Raised: {risk.reporting_date}</span>
                      )}
                      {risk.owner_name && (
                        <span className="risk-owner">Owner: {risk.owner_name}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {closedRisks.length > 0 && (
            <div className="risks-section closed-section">
              <h4 className="section-title">Closed Risks ({closedRisks.length})</h4>
              <div className="risks-list">
                {closedRisks.map((risk) => (
                  <div key={risk.id} className="risk-item closed">
                    <div className="risk-header">
                      <div className="risk-priority closed" style={{ backgroundColor: '#9ca3af' }}>
                        {risk.priority}
                      </div>
                      <div className="risk-title">{risk.title}</div>
                      <div className="risk-status" data-status={risk.status}>{getStatusLabel(risk.status)}</div>
                      {canEdit && (
                        <div className="risk-actions">
                          <button className="edit-risk-btn" onClick={() => handleStartEdit(risk)} title="Edit">
                            ✏️
                          </button>
                          <button className="delete-risk-btn" onClick={() => handleDeleteRisk(risk.id)} title="Delete">
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                    {risk.description && (
                      <div className="risk-description">{risk.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content risk-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingRisk ? 'Edit Risk' : 'Add New Risk'}</h2>
            <div className="form-group">
              <label htmlFor="risk-title">Risk Title:</label>
              <input
                id="risk-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief description of the risk..."
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="risk-description">Description / Mitigation:</label>
              <textarea
                id="risk-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description and mitigation strategy..."
                rows={3}
              />
            </div>
            <div className="form-group">
              <label htmlFor="risk-priority">Priority:</label>
              <Select
                id="risk-priority"
                value={{ value: formData.priority, label: formData.priority.charAt(0).toUpperCase() + formData.priority.slice(1) }}
                onChange={(option) => setFormData({ ...formData, priority: option.value })}
                options={[
                  { value: 'blocker', label: 'Blocker' },
                  { value: 'critical', label: 'Critical' },
                  { value: 'significant', label: 'Significant' }
                ]}
                styles={selectStyles}
              />
            </div>
            <div className="form-group">
              <label htmlFor="risk-status">Status:</label>
              <Select
                id="risk-status"
                value={{
                  value: formData.status,
                  label: getStatusLabel(formData.status)
                }}
                onChange={(option) => setFormData({ ...formData, status: option.value })}
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'in_progress', label: 'Mitigating' },
                  { value: 'closed', label: 'Closed' }
                ]}
                styles={selectStyles}
              />
            </div>
            <div className="form-group">
              <label htmlFor="risk-period">Period Raised (optional):</label>
              <Select
                id="risk-period"
                value={
                  formData.period_id
                    ? { value: formData.period_id, label: periods.find(p => p.id === formData.period_id)?.date }
                    : null
                }
                onChange={(option) => setFormData({ ...formData, period_id: option ? option.value : null })}
                options={periods.map(period => ({ value: period.id, label: period.date }))}
                styles={selectStyles}
                isClearable
                placeholder="Not linked to a specific period"
              />
            </div>
            <div className="risk-tip">
              <span className="tip-icon">💡</span>
              <span className="tip-text">
                <strong>Tip:</strong> Consider adding a metric to monitor this risk.
                For example, if dependent on another team, track their task burndown or milestone completion.
              </span>
            </div>
            <div className="modal-actions">
              <button className="save-btn" onClick={handleSaveRisk}>
                {editingRisk ? 'Update' : 'Create'}
              </button>
              <button className="cancel-btn" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Risks;
