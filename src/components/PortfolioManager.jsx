import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './PortfolioManager.css';

export default function PortfolioManager({ onClose, onPortfolioCreated }) {
  const [portfolios, setPortfolios] = useState([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    display_order: 0
  });
  const [error, setError] = useState('');

  const colorOptions = [
    { value: '#3b82f6', label: 'Blue' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Orange' },
    { value: '#ef4444', label: 'Red' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#84cc16', label: 'Lime' }
  ];

  // Get first unused color
  const getUnusedColor = () => {
    const usedColors = portfolios.map(p => p.color);
    const unusedColor = colorOptions.find(option => !usedColors.includes(option.value));
    return unusedColor ? unusedColor.value : colorOptions[0].value;
  };

  useEffect(() => {
    loadPortfolios();
  }, []);

  // Update form color when opening new form or when portfolios change
  useEffect(() => {
    if (showNewForm && !editingId && portfolios.length > 0) {
      setFormData(prev => ({
        ...prev,
        color: getUnusedColor()
      }));
    }
  }, [showNewForm, editingId, portfolios]);

  const loadPortfolios = async () => {
    try {
      const response = await api.get('/portfolios');
      setPortfolios(response.data);
    } catch (err) {
      setError('Failed to load portfolios');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingId) {
        await api.put(`/portfolios/${editingId}`, formData);
      } else {
        await api.post('/portfolios', formData);
      }

      await loadPortfolios();
      resetForm();
      if (onPortfolioCreated) onPortfolioCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save portfolio');
    }
  };

  const handleEdit = (portfolio) => {
    setFormData({
      name: portfolio.name,
      description: portfolio.description || '',
      color: portfolio.color || '#3b82f6',
      display_order: portfolio.display_order || 0
    });
    setEditingId(portfolio.id);
    setShowNewForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this portfolio? Projects in this portfolio will not be deleted.')) {
      return;
    }

    try {
      await api.delete(`/portfolios/${id}`);
      await loadPortfolios();
      if (onPortfolioCreated) onPortfolioCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete portfolio');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: getUnusedColor(),
      display_order: 0
    });
    setEditingId(null);
    setShowNewForm(false);
  };

  return (
    <div className="portfolio-manager-overlay">
      <div className="portfolio-manager">
        <div className="portfolio-manager-header">
          <h2>Manage Portfolios</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="portfolio-manager-content">
          {!showNewForm ? (
            <>
              <button
                className="btn-primary mb-3"
                onClick={() => setShowNewForm(true)}
              >
                + New Portfolio
              </button>

              <div className="portfolios-list">
                {portfolios.length === 0 ? (
                  <p className="text-muted">No portfolios yet. Create one to organize your projects.</p>
                ) : (
                  portfolios.map(portfolio => (
                    <div key={portfolio.id} className="portfolio-item">
                      <div className="portfolio-info">
                        <div
                          className="portfolio-color-indicator"
                          style={{ backgroundColor: portfolio.color }}
                        />
                        <div className="portfolio-details">
                          <h3>{portfolio.name}</h3>
                          {portfolio.description && (
                            <p className="portfolio-description">{portfolio.description}</p>
                          )}
                          <span className="portfolio-order">Order: {portfolio.display_order}</span>
                        </div>
                      </div>
                      <div className="portfolio-actions">
                        <button
                          className="btn-secondary"
                          onClick={() => handleEdit(portfolio)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-danger"
                          onClick={() => handleDelete(portfolio.id)}
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
              <h3>{editingId ? 'Edit Portfolio' : 'New Portfolio'}</h3>

              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Digital Transformation"
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
                <label>Color</label>
                <div className="color-picker">
                  {colorOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={`color-option ${formData.color === option.value ? 'selected' : ''}`}
                      style={{ backgroundColor: option.value }}
                      onClick={() => setFormData({ ...formData, color: option.value })}
                      title={option.label}
                    />
                  ))}
                </div>
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
