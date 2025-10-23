import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './CRAIDs.css';

const CRAIDIcon = ({ type }) => {
  const icons = {
    risk: '⚠️',
    issue: '⚡',
    dependency: '🔗',
    action: '✓'
  };
  return <span className={`craid-icon craid-icon-${type}`}>{icons[type] || '•'}</span>;
};

const CRAIDs = ({ projectId }) => {
  const [craids, setCraids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCRAID, setEditingCRAID] = useState(null);
  const [formData, setFormData] = useState({
    type: 'risk',
    title: '',
    description: '',
    status: 'open',
    priority: 'medium',
    period_id: null
  });

  useEffect(() => {
    const loadData = async () => {
      if (!projectId) {
        setCraids([]);
        setPeriods([]);
        setLoading(false);
        return;
      }

      try {
        // Load CRAIDs and project data (to get periods)
        const [craidsResponse, dataResponse] = await Promise.all([
          api.getProjectCRAIDs(projectId),
          api.getProjectData(projectId)
        ]);

        setCraids(craidsResponse.data);

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
        console.error('Failed to load CRAIDs:', err);
        setCraids([]);
        setPeriods([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId]);

  const handleStartAdd = () => {
    setFormData({
      type: 'risk',
      title: '',
      description: '',
      status: 'open',
      priority: 'medium',
      period_id: null
    });
    setEditingCRAID(null);
    setShowAddModal(true);
  };

  const handleStartEdit = (craid) => {
    setFormData({
      type: craid.type,
      title: craid.title,
      description: craid.description,
      status: craid.status,
      priority: craid.priority,
      period_id: craid.period_id
    });
    setEditingCRAID(craid);
    setShowAddModal(true);
  };

  const handleSaveCRAID = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a title');
      return;
    }

    try {
      if (editingCRAID) {
        // Update existing CRAID
        await api.updateCRAID(editingCRAID.id, formData);
      } else {
        // Create new CRAID
        await api.createCRAID(projectId, formData);
      }

      // Reload CRAIDs
      const response = await api.getProjectCRAIDs(projectId);
      setCraids(response.data);
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to save CRAID:', err);
      alert('Failed to save CRAID');
    }
  };

  const handleDeleteCRAID = async (craidId) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      await api.deleteCRAID(craidId);

      // Reload CRAIDs
      const response = await api.getProjectCRAIDs(projectId);
      setCraids(response.data);
    } catch (err) {
      console.error('Failed to delete CRAID:', err);
      alert('Failed to delete CRAID');
    }
  };

  if (loading) {
    return <div className="craids-loading">Loading...</div>;
  }

  // Group by type
  const groupedCRAIDs = craids.reduce((acc, craid) => {
    if (!acc[craid.type]) {
      acc[craid.type] = [];
    }
    acc[craid.type].push(craid);
    return acc;
  }, {});

  const typeLabels = {
    risk: 'Risks',
    action: 'Actions',
    dependency: 'Dependencies'
  };

  // Filter out issues - they should be metrics instead
  const filteredGroupedCRAIDs = Object.entries(groupedCRAIDs)
    .filter(([type]) => type !== 'issue')
    .reduce((acc, [type, items]) => {
      acc[type] = items;
      return acc;
    }, {});

  // Check if a CRAID is aged (more than 3 periods old for actions only)
  const isAged = (craid) => {
    if (!craid.period_id || !periods.length) return false;
    if (craid.type !== 'action') return false;

    // Find the index of the CRAID's period
    const craidPeriodIndex = periods.findIndex(p => p.id === craid.period_id);
    if (craidPeriodIndex === -1) return false;

    // Find the latest period index
    const latestPeriodIndex = periods.length - 1;

    // Check if it's more than 3 periods old
    return (latestPeriodIndex - craidPeriodIndex) > 3;
  };

  return (
    <div className="craids-container">
      <div className="craids-header">
        <h3 className="craids-title">Risks and Dependencies</h3>
        <button className="add-craid-btn" onClick={handleStartAdd}>
          Add
        </button>
      </div>
      <div className="craids-grid">
        {Object.entries(filteredGroupedCRAIDs).map(([type, items]) => (
          <div key={type} className="craids-section">
            <h4 className="craids-section-title">
              <CRAIDIcon type={type} />
              {typeLabels[type] || type}
            </h4>
            <div className="craids-list">
              {items.map((craid) => (
                <div key={craid.id} className={`craid-item craid-${craid.status} priority-${craid.priority} ${isAged(craid) ? 'aged' : ''}`}>
                  <div className="craid-header">
                    <div className="craid-title">
                      {craid.title}
                      {isAged(craid) && <span className="aged-indicator" title="More than 3 periods old">⏰</span>}
                    </div>
                    <div className="craid-actions">
                      <div className="craid-badges">
                        <span className={`priority-badge priority-${craid.priority}`}>
                          {craid.priority}
                        </span>
                        <span className={`status-badge status-${craid.status}`}>
                          {craid.status.replace('_', ' ')}
                        </span>
                      </div>
                      <button className="edit-craid-btn" onClick={() => handleStartEdit(craid)} title="Edit">
                        ✏️
                      </button>
                      <button className="delete-craid-btn" onClick={() => handleDeleteCRAID(craid.id)} title="Delete">
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="craid-description">{craid.description}</div>
                  <div className="craid-meta">
                    {craid.reporting_date && (
                      <span className="craid-period">Period: {craid.reporting_date}</span>
                    )}
                    {craid.owner_name && (
                      <span className="craid-owner">Owner: {craid.owner_name}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content craid-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingCRAID ? 'Edit Item' : 'Add New Risk/Action/Dependency'}</h2>
            <div className="form-group">
              <label htmlFor="craid-type">Type:</label>
              <select
                id="craid-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="risk">Risk</option>
                <option value="action">Action</option>
                <option value="dependency">Dependency</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="craid-title">Title:</label>
              <input
                id="craid-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter title..."
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="craid-description">Description:</label>
              <textarea
                id="craid-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description..."
                rows={3}
              />
            </div>
            <div className="form-group">
              <label htmlFor="craid-priority">Priority:</label>
              <select
                id="craid-priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="craid-status">Status:</label>
              <select
                id="craid-status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="craid-period">Period (optional):</label>
              <select
                id="craid-period"
                value={formData.period_id || ''}
                onChange={(e) => setFormData({ ...formData, period_id: e.target.value ? parseInt(e.target.value) : null })}
              >
                <option value="">Not linked to a specific period</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.date}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="save-btn" onClick={handleSaveCRAID}>
                {editingCRAID ? 'Update' : 'Create'}
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

export default CRAIDs;
