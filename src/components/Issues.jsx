import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { api } from '../api/client';
import { selectStyles } from './SelectStyles';
import './FormInputs.css';
import './Issues.css';

const Issues = ({ projectId, canEdit = false }) => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
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
        setIssues([]);
        setPeriods([]);
        setLoading(false);
        return;
      }

      try {
        // Load CRAIDs filtered for issues and project data (to get periods)
        const [craidsResponse, dataResponse] = await Promise.all([
          api.getProjectCRAIDs(projectId),
          api.getProjectData(projectId)
        ]);

        // Filter to only show issues
        const issueItems = craidsResponse.data.filter(item => item.type === 'issue');
        setIssues(issueItems);

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
        console.error('Failed to load issues:', err);
        setIssues([]);
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
    setEditingIssue(null);
    setShowAddModal(true);
  };

  const handleStartEdit = (issue) => {
    setFormData({
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      period_id: issue.period_id
    });
    setEditingIssue(issue);
    setShowAddModal(true);
  };

  const handleSaveIssue = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a title');
      return;
    }

    try {
      const issueData = { ...formData, type: 'issue' };

      if (editingIssue) {
        // Update existing issue
        await api.updateCRAID(editingIssue.id, issueData);
      } else {
        // Create new issue
        await api.createCRAID(projectId, issueData);
      }

      // Reload issues
      const response = await api.getProjectCRAIDs(projectId);
      const issueItems = response.data.filter(item => item.type === 'issue');
      setIssues(issueItems);
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to save issue:', err);
      alert('Failed to save issue');
    }
  };

  const handleDeleteIssue = async (issueId) => {
    if (!confirm('Are you sure you want to delete this issue?')) {
      return;
    }

    try {
      await api.deleteCRAID(issueId);

      // Reload issues
      const response = await api.getProjectCRAIDs(projectId);
      const issueItems = response.data.filter(item => item.type === 'issue');
      setIssues(issueItems);
    } catch (err) {
      console.error('Failed to delete issue:', err);
      alert('Failed to delete issue');
    }
  };

  if (loading) {
    return <div className="issues-loading">Loading...</div>;
  }

  // Group by status
  const openIssues = issues.filter(i => i.status === 'open' || i.status === 'in_progress');
  const closedIssues = issues.filter(i => i.status === 'closed' || i.status === 'resolved');

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
      case 'in_progress': return 'In Progress';
      case 'closed': return 'Closed';
      case 'resolved': return 'Resolved';
      default: return 'Open';
    }
  };

  return (
    <div className="issues-container">
      {canEdit && (
        <div className="issues-header">
          <button className="add-issue-btn" onClick={handleStartAdd}>
            + Add Issue
          </button>
        </div>
      )}

      {issues.length === 0 ? (
        <div className="issues-empty">
          <span className="empty-icon">✓</span>
          <p>No issues recorded for this project</p>
          {canEdit && <p className="empty-hint">Click "Add Issue" to log a new issue</p>}
        </div>
      ) : (
        <div className="issues-sections">
          {openIssues.length > 0 && (
            <div className="issues-section">
              <h4 className="section-title">Open Issues ({openIssues.length})</h4>
              <div className="issues-list">
                {openIssues.map((issue) => (
                  <div key={issue.id} className={`issue-item priority-${issue.priority}`}>
                    <div className="issue-header">
                      <div className="issue-priority" style={{ backgroundColor: getPriorityColor(issue.priority) }}>
                        {issue.priority}
                      </div>
                      <div className="issue-title">{issue.title}</div>
                      <div className="issue-status" data-status={issue.status}>
                        {getStatusLabel(issue.status)}
                      </div>
                      {canEdit && (
                        <div className="issue-actions">
                          <button className="edit-issue-btn" onClick={() => handleStartEdit(issue)} title="Edit">
                            ✏️
                          </button>
                          <button className="delete-issue-btn" onClick={() => handleDeleteIssue(issue.id)} title="Delete">
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                    {issue.description && (
                      <div className="issue-description">{issue.description}</div>
                    )}
                    <div className="issue-meta">
                      {issue.reporting_date && (
                        <span className="issue-period">Raised: {issue.reporting_date}</span>
                      )}
                      {issue.owner_name && (
                        <span className="issue-owner">Owner: {issue.owner_name}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {closedIssues.length > 0 && (
            <div className="issues-section closed-section">
              <h4 className="section-title">Closed Issues ({closedIssues.length})</h4>
              <div className="issues-list">
                {closedIssues.map((issue) => (
                  <div key={issue.id} className="issue-item closed">
                    <div className="issue-header">
                      <div className="issue-priority closed" style={{ backgroundColor: '#9ca3af' }}>
                        {issue.priority}
                      </div>
                      <div className="issue-title">{issue.title}</div>
                      <div className="issue-status" data-status={issue.status}>{getStatusLabel(issue.status)}</div>
                      {canEdit && (
                        <div className="issue-actions">
                          <button className="edit-issue-btn" onClick={() => handleStartEdit(issue)} title="Edit">
                            ✏️
                          </button>
                          <button className="delete-issue-btn" onClick={() => handleDeleteIssue(issue.id)} title="Delete">
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                    {issue.description && (
                      <div className="issue-description">{issue.description}</div>
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
          <div className="modal-content issue-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingIssue ? 'Edit Issue' : 'Add New Issue'}</h2>
            <div className="form-group">
              <label htmlFor="issue-title">Issue Title:</label>
              <input
                id="issue-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief description of the issue..."
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="issue-description">Description / Resolution Plan:</label>
              <textarea
                id="issue-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description and resolution plan..."
                rows={3}
              />
            </div>
            <div className="form-group">
              <label htmlFor="issue-priority">Priority:</label>
              <Select
                id="issue-priority"
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
              <label htmlFor="issue-status">Status:</label>
              <Select
                id="issue-status"
                value={{
                  value: formData.status,
                  label: getStatusLabel(formData.status)
                }}
                onChange={(option) => setFormData({ ...formData, status: option.value })}
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'closed', label: 'Resolved' }
                ]}
                styles={selectStyles}
              />
            </div>
            <div className="form-group">
              <label htmlFor="issue-period">Period Raised (optional):</label>
              <Select
                id="issue-period"
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
            <div className="issue-tip">
              <span className="tip-icon">💡</span>
              <span className="tip-text">
                <strong>Tip:</strong> Issues are problems that have already occurred.
                Consider adding details about root cause and resolution timeline.
              </span>
            </div>
            <div className="modal-actions">
              <button className="save-btn" onClick={handleSaveIssue}>
                {editingIssue ? 'Update' : 'Create'}
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

export default Issues;
