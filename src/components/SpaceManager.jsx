import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './PortfolioManager.css'; // Reuse portfolio manager styles

export default function SpaceManager({ onClose, onSpaceCreated }) {
  const [spaces, setSpaces] = useState([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    display_order: 0
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    try {
      const response = await api.getSpaces();
      setSpaces(response.data);
    } catch (err) {
      setError('Failed to load spaces');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingId) {
        await api.updateSpace(editingId, formData);
      } else {
        await api.createSpace(formData);
      }

      await loadSpaces();
      resetForm();
      if (onSpaceCreated) onSpaceCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save space');
    }
  };

  const handleEdit = (space) => {
    setFormData({
      name: space.name,
      description: space.description || '',
      display_order: space.display_order || 0
    });
    setEditingId(space.id);
    setShowNewForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this space? Portfolios in this space will not be deleted.')) {
      return;
    }

    try {
      await api.deleteSpace(id);
      await loadSpaces();
      if (onSpaceCreated) onSpaceCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete space');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      display_order: 0
    });
    setEditingId(null);
    setShowNewForm(false);
  };

  return (
    <div className="portfolio-manager-overlay">
      <div className="portfolio-manager">
        <button className="close-btn" onClick={onClose}>×</button>
        <div className="portfolio-manager-header">
          <h2>Manage Spaces</h2>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="portfolio-manager-content">
          {!showNewForm ? (
            <>
              <button
                className="btn-primary mb-3"
                onClick={() => setShowNewForm(true)}
              >
                + New Space
              </button>

              <div className="portfolios-list">
                {spaces.length === 0 ? (
                  <p className="text-muted">No spaces yet. Create one to group your portfolios.</p>
                ) : (
                  spaces.map(space => (
                    <div key={space.id} className="portfolio-item">
                      <div className="portfolio-info">
                        <div className="portfolio-details">
                          <h3>{space.name}</h3>
                          {space.description && (
                            <p className="portfolio-description">{space.description}</p>
                          )}
                          <span className="portfolio-order">Order: {space.display_order}</span>
                        </div>
                      </div>
                      <div className="portfolio-actions">
                        <button
                          className="btn-secondary"
                          onClick={() => handleEdit(space)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-danger"
                          onClick={() => handleDelete(space.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="portfolio-form">
              <h3>{editingId ? 'Edit Space' : 'New Space'}</h3>

              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., North America, Enterprise, Innovation"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Display Order</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                  min="0"
                />
                <small className="form-hint">Lower numbers appear first</small>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
