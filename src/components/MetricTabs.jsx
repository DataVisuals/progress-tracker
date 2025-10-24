import React, { useState } from 'react';
import './MetricTabs.css';

const MetricTabs = ({ metrics, selectedMetric, onMetricChange, onMetricRename, canEdit }) => {
  const [editingMetric, setEditingMetric] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleDoubleClick = (metric) => {
    if (!canEdit) return;
    setEditingMetric(metric);
    setEditValue(metric);
  };

  const handleKeyDown = (e, oldName) => {
    if (e.key === 'Enter') {
      handleSave(oldName);
    } else if (e.key === 'Escape') {
      setEditingMetric(null);
    }
  };

  const handleSave = async (oldName) => {
    if (editValue.trim() && editValue !== oldName) {
      if (onMetricRename) {
        await onMetricRename(oldName, editValue.trim());
      }
    }
    setEditingMetric(null);
  };

  return (
    <div className="metric-tabs-container">
      <div className="metric-tabs">
        {metrics.map((metric) => (
          <div key={metric} className="metric-tab-wrapper">
            {editingMetric === metric ? (
              <input
                type="text"
                className="metric-tab-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, metric)}
                onBlur={() => handleSave(metric)}
                autoFocus
              />
            ) : (
              <button
                className={`metric-tab ${selectedMetric === metric ? 'active' : ''}`}
                onClick={() => onMetricChange(metric)}
                onDoubleClick={() => handleDoubleClick(metric)}
                title={canEdit ? "Double-click to rename" : undefined}
              >
                {metric}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MetricTabs;
