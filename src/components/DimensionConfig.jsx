import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './DimensionConfig.css';

// Maximum number of dimensions for clear visual distinction in charts
const MAX_DIMENSIONS = 4;

const DimensionConfig = ({ metric, onClose, onDimensionsChanged }) => {
  const [dimensions, setDimensions] = useState([]);
  const [newDimensionName, setNewDimensionName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load existing dimensions
  useEffect(() => {
    const loadDimensions = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/metrics/${metric.id}/dimensions`);
        setDimensions(response.data || []);
      } catch (err) {
        console.error('Failed to load dimensions:', err);
        setError('Failed to load dimensions');
      } finally {
        setLoading(false);
      }
    };
    loadDimensions();
  }, [metric.id]);

  const handleAddDimension = async () => {
    if (!newDimensionName.trim()) return;

    try {
      setSaving(true);
      const response = await api.post(`/metrics/${metric.id}/dimensions`, {
        name: newDimensionName.trim(),
        display_order: dimensions.length
      });
      setDimensions([...dimensions, response.data]);
      setNewDimensionName('');

      // Enable has_dimensions flag if this is the first dimension
      if (dimensions.length === 0) {
        await api.put(`/metrics/${metric.id}`, { has_dimensions: 1 });
      }
    } catch (err) {
      console.error('Failed to add dimension:', err);
      setError('Failed to add dimension');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDimension = async (dimensionId) => {
    try {
      setSaving(true);
      await api.delete(`/metrics/${metric.id}/dimensions/${dimensionId}`);
      const newDimensions = dimensions.filter(d => d.id !== dimensionId);
      setDimensions(newDimensions);

      // Disable has_dimensions flag if no dimensions left
      if (newDimensions.length === 0) {
        await api.put(`/metrics/${metric.id}`, { has_dimensions: 0 });
      }
    } catch (err) {
      console.error('Failed to remove dimension:', err);
      setError('Failed to remove dimension');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAddDimension();
    }
  };

  const handleClose = () => {
    if (onDimensionsChanged) {
      onDimensionsChanged();
    }
    onClose();
  };

  return (
    <div className="dimension-config-overlay" onClick={handleClose}>
      <div className="dimension-config-modal" onClick={e => e.stopPropagation()}>
        <div className="dimension-config-header">
          <h3>Configure Dimensions</h3>
          <span className="dimension-config-metric-name">{metric.name}</span>
        </div>

        <div className="dimension-config-body">
          {error && <div className="dimension-config-error">{error}</div>}

          {loading ? (
            <div className="dimension-config-loading">Loading...</div>
          ) : (
            <>
              <p className="dimension-config-help">
                Add dimensions to break down the "complete" value into categories
                (e.g., by region, product, or team). Each dimension will be shown
                as a stacked segment in the chart, distinguished by opacity.
              </p>

              {dimensions.length > 0 && (
                <div className="dimension-list">
                  {dimensions.map((dim) => (
                    <div key={dim.id} className="dimension-item">
                      <span className="dimension-name">{dim.name}</span>
                      <button
                        className="dimension-remove"
                        onClick={() => handleRemoveDimension(dim.id)}
                        disabled={saving}
                        title="Remove dimension"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {dimensions.length < MAX_DIMENSIONS && (
                <div className="dimension-add">
                  <input
                    type="text"
                    value={newDimensionName}
                    onChange={(e) => setNewDimensionName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter dimension name..."
                    disabled={saving}
                    autoFocus
                  />
                  <button
                    onClick={handleAddDimension}
                    disabled={!newDimensionName.trim() || saving}
                  >
                    Add
                  </button>
                </div>
              )}

              {dimensions.length === 0 && (
                <p className="dimension-config-hint">
                  No dimensions configured. Add your first dimension above.
                </p>
              )}

              {dimensions.length >= MAX_DIMENSIONS && (
                <p className="dimension-config-hint">
                  Maximum of {MAX_DIMENSIONS} dimensions reached for clear visual distinction.
                </p>
              )}
            </>
          )}
        </div>

        <div className="dimension-config-footer">
          <button className="dimension-config-close" onClick={handleClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default DimensionConfig;
