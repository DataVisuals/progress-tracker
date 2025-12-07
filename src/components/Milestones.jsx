import React, { useState, useEffect } from 'react';
import { MdAdd, MdEdit, MdDelete, MdCheck, MdClose, MdFlag, MdCheckCircle } from 'react-icons/md';
import { api } from '../api/client';
import ProjectTimelineBar from './ProjectTimelineBar';
import './Milestones.css';

const Milestones = ({ projectId, currentUser, onMilestonesChange, startDate, endDate }) => {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    target_date: ''
  });

  useEffect(() => {
    if (projectId) {
      loadMilestones();
    }
  }, [projectId]);

  const loadMilestones = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/milestones?project_id=${projectId}`);
      setMilestones(response.data);
      if (onMilestonesChange) {
        onMilestonesChange();
      }
    } catch (err) {
      console.error('Failed to load milestones:', err);
      setError('Failed to load milestones');
      setMilestones([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/milestones/${editingId}`, formData);
      } else {
        await api.post('/milestones', { ...formData, project_id: projectId });
      }
      await loadMilestones();
      resetForm();
    } catch (err) {
      console.error('Failed to save milestone:', err);
      setError('Failed to save milestone');
    }
  };

  const handleEdit = (milestone) => {
    setEditingId(milestone.id);
    setFormData({
      title: milestone.title,
      description: milestone.description || '',
      target_date: milestone.target_date
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) {
      return;
    }
    try {
      await api.delete(`/milestones/${id}`);
      await loadMilestones();
    } catch (err) {
      console.error('Failed to delete milestone:', err);
      setError('Failed to delete milestone');
    }
  };

  const handleToggleComplete = async (milestone) => {
    try {
      await api.put(`/milestones/${milestone.id}`, {
        ...milestone,
        completed: milestone.completed ? 0 : 1,
        completed_date: milestone.completed ? null : new Date().toISOString().split('T')[0]
      });
      await loadMilestones();
    } catch (err) {
      console.error('Failed to toggle milestone completion:', err);
      setError('Failed to update milestone');
    }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', target_date: '' });
    setShowAddForm(false);
    setEditingId(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getMilestoneStatus = (milestone) => {
    if (milestone.completed) return 'completed';
    const today = new Date();
    const targetDate = new Date(milestone.target_date);
    if (targetDate < today) return 'overdue';
    return 'upcoming';
  };

  if (loading) {
    return <div className="milestones-loading">Loading milestones...</div>;
  }

  return (
    <div className="milestones-container">
      <div className="milestones-header">
        <h2>Project Milestones</h2>
        {currentUser?.role !== 'viewer' && (
          <button
            className="add-milestone-btn"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? <MdClose /> : <MdAdd />}
            {showAddForm ? 'Cancel' : 'Add Milestone'}
          </button>
        )}
      </div>

      <div className="milestones-info-banner">
        <p>
          <strong>Note:</strong> Don't add your milestones here if you are already tracking in another tool.
          Integrations are in development. This is for initiatives not already milestone tracking elsewhere.
        </p>
      </div>

      {error && <div className="milestones-error">{error}</div>}

      {showAddForm && (
        <form className="milestone-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="e.g., Beta Launch"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details about this milestone..."
              rows="3"
            />
          </div>
          <div className="form-group">
            <label>Target Date *</label>
            <input
              type="date"
              value={formData.target_date}
              onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="save-btn">
              <MdCheck /> {editingId ? 'Update' : 'Create'} Milestone
            </button>
            <button type="button" className="cancel-btn" onClick={resetForm}>
              <MdClose /> Cancel
            </button>
          </div>
        </form>
      )}

      {milestones.length === 0 ? (
        <div className="no-milestones">
          <MdFlag className="no-milestones-icon" />
          <p>No milestones yet</p>
          <p className="no-milestones-subtitle">Add milestones to track important project dates</p>
        </div>
      ) : (
        <>
          {/* Horizontal Timeline View */}
          <ProjectTimelineBar
            milestones={milestones}
            startDate={startDate}
            endDate={endDate}
          />

          {/* Compact Milestone List */}
          <div className="milestones-list">
            <h3>Milestone Details</h3>
            {milestones.map((milestone) => {
              const status = getMilestoneStatus(milestone);
              return (
                <div key={milestone.id} className={`milestone-item ${status}`}>
                  <div className="milestone-header">
                    <div className="milestone-info">
                      {milestone.completed ? (
                        <MdCheckCircle className="milestone-status-icon completed" />
                      ) : (
                        <MdFlag className={`milestone-status-icon ${status}`} />
                      )}
                      <h4>{milestone.title}</h4>
                      <span className="milestone-date">{formatDate(milestone.target_date)}</span>
                    </div>
                    <div className="milestone-actions">
                      {currentUser?.role !== 'viewer' && (
                        <>
                          <button
                            className={`action-btn complete-btn ${milestone.completed ? 'completed' : ''}`}
                            onClick={() => handleToggleComplete(milestone)}
                            title={milestone.completed ? 'Mark as incomplete' : 'Mark as complete'}
                          >
                            <MdCheck />
                          </button>
                          <button
                            className="action-btn edit-btn"
                            onClick={() => handleEdit(milestone)}
                            title="Edit"
                          >
                            <MdEdit />
                          </button>
                          <button
                            className="action-btn delete-btn"
                            onClick={() => handleDelete(milestone.id)}
                            title="Delete"
                          >
                            <MdDelete />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {milestone.description && (
                    <p className="milestone-description">{milestone.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default Milestones;
