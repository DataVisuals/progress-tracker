import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './RecoveryPlans.css';

const RecoveryPlans = ({ currentUser, projectId }) => {
  const [plans, setPlans] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // active, completed, cancelled, all
  const [showForm, setShowForm] = useState(false);
  const [planText, setPlanText] = useState('');
  const [selectedMetricId, setSelectedMetricId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editText, setEditText] = useState({});
  const [editTargetDate, setEditTargetDate] = useState({});
  const [completionNotes, setCompletionNotes] = useState({});

  const isPMOrAbove = currentUser && (currentUser.role === 'pm' || currentUser.role === 'admin');

  useEffect(() => {
    if (projectId) {
      loadPlans();
      loadMetrics();
    }
  }, [projectId]);

  const loadMetrics = async () => {
    try {
      const response = await api.get(`/projects/${projectId}/data`);
      // Extract unique metrics with their status
      const uniqueMetrics = {};
      response.data.forEach(item => {
        if (!uniqueMetrics[item.metric]) {
          uniqueMetrics[item.metric] = {
            id: item.metric_id,
            name: item.metric,
            status: item.rag_status || 'unknown'
          };
        }
      });
      setMetrics(Object.values(uniqueMetrics));
    } catch (err) {
      console.error('Failed to load metrics:', err);
      setMetrics([]);
    }
  };

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/recovery-plans?project_id=${projectId}`);
      setPlans(response.data);
    } catch (err) {
      console.error('Failed to load recovery plans:', err);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!planText.trim()) {
      alert('Please provide a recovery plan');
      return;
    }
    if (!selectedMetricId) {
      alert('Please select a metric');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/recovery-plans', {
        metric_id: parseInt(selectedMetricId),
        project_id: projectId,
        plan_text: planText,
        target_recovery_date: targetDate || null
      });
      setPlanText('');
      setSelectedMetricId('');
      setTargetDate('');
      setShowForm(false);
      loadPlans();
    } catch (err) {
      console.error('Failed to create recovery plan:', err);
      alert(err.response?.data?.error || 'Failed to create recovery plan. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPlan = async (planId) => {
    const plan_text = editText[planId];
    const target_recovery_date = editTargetDate[planId];

    if (!plan_text?.trim()) {
      alert('Please enter a recovery plan');
      return;
    }

    try {
      await api.put(`/recovery-plans/${planId}`, {
        plan_text,
        target_recovery_date: target_recovery_date || null
      });
      setEditingPlan(null);
      setEditText({ ...editText, [planId]: '' });
      setEditTargetDate({ ...editTargetDate, [planId]: '' });
      loadPlans();
    } catch (err) {
      console.error('Failed to edit recovery plan:', err);
      alert(err.response?.data?.error || 'Failed to edit plan. Please try again.');
    }
  };

  const handleUpdateStatus = async (planId, newStatus, notes = null) => {
    try {
      await api.put(`/recovery-plans/${planId}`, {
        status: newStatus,
        completion_notes: notes
      });
      setCompletionNotes({ ...completionNotes, [planId]: '' });
      loadPlans();
    } catch (err) {
      console.error('Failed to update plan status:', err);
      alert(err.response?.data?.error || 'Failed to update status. Please try again.');
    }
  };

  const handleComplete = (planId) => {
    const notes = completionNotes[planId];
    if (!notes?.trim()) {
      if (!window.confirm('Complete this plan without notes?')) {
        return;
      }
    }
    handleUpdateStatus(planId, 'completed', notes || null);
  };

  const filteredPlans = plans.filter(plan => {
    if (filter === 'all') return true;
    return plan.status === filter;
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;

    return date.toLocaleDateString();
  };

  const formatTargetDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getStatusBadge = (status) => {
    return `status-${status}`;
  };

  const getMetricName = (metricId) => {
    const metric = metrics?.find(m => m.id === metricId);
    return metric ? metric.name : 'Unknown Metric';
  };

  const getMetricStatus = (metricId) => {
    const metric = metrics?.find(m => m.id === metricId);
    return metric?.status || 'unknown';
  };

  // Get metrics that need recovery plans (red status)
  const redMetrics = metrics?.filter(m => m.status === 'red') || [];

  // Check which red metrics don't have active recovery plans
  const redMetricsWithoutPlans = redMetrics.filter(redMetric => {
    return !plans.some(plan =>
      plan.metric_id === redMetric.id && plan.status === 'active'
    );
  });

  return (
    <div className="recovery-plans-container">
      {/* Suggestion banner for red metrics without recovery plans */}
      {isPMOrAbove && redMetricsWithoutPlans.length > 0 && !showForm && (
        <div className="recovery-suggestion-banner">
          <div className="suggestion-icon">⚠️</div>
          <div className="suggestion-content">
            <div className="suggestion-title">
              {redMetricsWithoutPlans.length === 1
                ? 'Recovery Plan Required'
                : 'Recovery Plans Required'}
            </div>
            <div className="suggestion-subtitle">
              {redMetricsWithoutPlans.length === 1
                ? 'The following red metric requires a recovery plan:'
                : `The following ${redMetricsWithoutPlans.length} red metrics require recovery plans:`}
            </div>
            <div className="suggestion-metrics">
              {redMetricsWithoutPlans.map((metric, idx) => (
                <span key={metric.id} className="metric-name">
                  {metric.name}{idx < redMetricsWithoutPlans.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          </div>
          <button
            className="btn-suggestion-action"
            onClick={() => setShowForm(true)}
          >
            Create Recovery Plan
          </button>
        </div>
      )}
      <div className="recovery-plans-header">
        <div className="recovery-filters">
          <button
            className={filter === 'active' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('active')}
          >
            Active ({plans.filter(p => p.status === 'active').length})
          </button>
          <button
            className={filter === 'completed' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('completed')}
          >
            Completed ({plans.filter(p => p.status === 'completed').length})
          </button>
          <button
            className={filter === 'cancelled' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('cancelled')}
          >
            Cancelled ({plans.filter(p => p.status === 'cancelled').length})
          </button>
          <button
            className={filter === 'all' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('all')}
          >
            All ({plans.length})
          </button>
        </div>
        {isPMOrAbove && (
          <button
            className="btn-add-plan"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel' : '+ Create Recovery Plan'}
          </button>
        )}
      </div>

      {showForm && isPMOrAbove && (
        <form className="plan-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="metric-select">Metric:</label>
            <select
              id="metric-select"
              className="metric-select"
              value={selectedMetricId}
              onChange={(e) => setSelectedMetricId(e.target.value)}
              required
            >
              <option value="">Select a metric...</option>
              {redMetrics.map(metric => (
                <option key={metric.id} value={metric.id}>
                  {metric.name} (Red)
                </option>
              ))}
              {metrics?.filter(m => m.status !== 'red').map(metric => (
                <option key={metric.id} value={metric.id}>
                  {metric.name} ({metric.status})
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="plan-text">Recovery Plan:</label>
            <textarea
              id="plan-text"
              className="plan-description-input"
              value={planText}
              onChange={(e) => setPlanText(e.target.value)}
              placeholder="Describe the actions to return this metric to green..."
              rows="4"
              required
              autoFocus
            />
          </div>
          <div className="form-field">
            <label htmlFor="target-date">Target Recovery Date (optional):</label>
            <input
              id="target-date"
              type="date"
              className="date-input"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Plan'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="loading">Loading recovery plans...</div>
      ) : filteredPlans.length === 0 ? (
        <div className="no-plans">
          {filter === 'all'
            ? 'No recovery plans yet.'
            : `No ${filter} recovery plans`}
        </div>
      ) : (
        <div className="plan-threads">
          {filteredPlans.map(plan => (
            <div key={plan.id} className={`plan-thread ${plan.status}`}>
              <div className="thread-header">
                <div className="thread-meta">
                  <span className={`metric-badge metric-${getMetricStatus(plan.metric_id)}`}>
                    {getMetricName(plan.metric_id)}
                  </span>
                  <span className="thread-author">{plan.creator_name}</span>
                  <span className="thread-date">{formatDate(plan.created_at)}</span>
                  <span className={`thread-status ${getStatusBadge(plan.status)}`}>
                    {plan.status}
                  </span>
                </div>
              </div>

              <div className="thread-content">
                {editingPlan === plan.id ? (
                  <div className="edit-container">
                    <textarea
                      className="plan-edit-input"
                      value={editText[plan.id]}
                      onChange={(e) => setEditText({ ...editText, [plan.id]: e.target.value })}
                      rows="4"
                      autoFocus
                    />
                    <div className="form-field">
                      <label>Target Date:</label>
                      <input
                        type="date"
                        className="date-input"
                        value={editTargetDate[plan.id]}
                        onChange={(e) => setEditTargetDate({ ...editTargetDate, [plan.id]: e.target.value })}
                      />
                    </div>
                    <div className="edit-actions">
                      <button className="btn-respond" onClick={() => handleEditPlan(plan.id)}>
                        Save
                      </button>
                      <button className="btn-cancel" onClick={() => setEditingPlan(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="thread-description">{plan.plan_text}</p>
                    {plan.target_recovery_date && (
                      <div className="target-date">
                        Target: {formatTargetDate(plan.target_recovery_date)}
                      </div>
                    )}
                    {isPMOrAbove && plan.status === 'active' && (
                      <button
                        className="btn-edit-small"
                        onClick={() => {
                          setEditingPlan(plan.id);
                          setEditText({ ...editText, [plan.id]: plan.plan_text });
                          setEditTargetDate({ ...editTargetDate, [plan.id]: plan.target_recovery_date || '' });
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {plan.status === 'completed' && plan.completion_notes && (
                <div className="completion-section">
                  <div className="completion-header">
                    <span className="completion-label">Completion Notes:</span>
                    <span className="completion-date">{formatDate(plan.completed_at)}</span>
                  </div>
                  <p className="completion-notes">{plan.completion_notes}</p>
                </div>
              )}

              {isPMOrAbove && plan.status === 'active' && (
                <div className="thread-actions">
                  <div className="completion-input-container">
                    <textarea
                      className="completion-input"
                      placeholder="Optional completion notes..."
                      value={completionNotes[plan.id] || ''}
                      onChange={(e) => setCompletionNotes({ ...completionNotes, [plan.id]: e.target.value })}
                      rows="2"
                    />
                  </div>

                  <div className="status-actions">
                    <button
                      className="btn-complete"
                      onClick={() => handleComplete(plan.id)}
                    >
                      Mark as Completed
                    </button>
                    <button
                      className="btn-cancel-plan"
                      onClick={() => handleUpdateStatus(plan.id, 'cancelled')}
                    >
                      Cancel Plan
                    </button>
                  </div>
                </div>
              )}

              {isPMOrAbove && (plan.status === 'completed' || plan.status === 'cancelled') && (
                <div className="thread-actions">
                  <button
                    className="btn-reactivate"
                    onClick={() => handleUpdateStatus(plan.id, 'active')}
                  >
                    Reactivate Plan
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecoveryPlans;
