import React, { useState } from 'react';
import './MetricTabs.css';

const MetricTabs = ({ metrics, projectData, selectedMetric, onMetricChange, onMetricRename, canEdit }) => {
  const [editingMetric, setEditingMetric] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Helper to get metric type from projectData
  const getMetricType = (metricName) => {
    const metricData = projectData.find(item => item.metric === metricName);
    return metricData?.metric_type || 'lead';
  };

  // Helper to get metric type icon and title
  const getMetricIcon = (metricName) => {
    const metricType = getMetricType(metricName);
    if (metricType === 'lag') {
      return {
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="11" width="2" height="2" fill="currentColor" opacity="0.3"/>
            <rect x="4" y="10" width="2" height="3" fill="currentColor" opacity="0.5"/>
            <rect x="7" y="7" width="2" height="6" fill="currentColor" opacity="0.7"/>
            <rect x="10" y="2" width="2" height="11" fill="currentColor"/>
          </svg>
        ),
        title: 'Lag metric: Back-loaded, outcome measured at end'
      };
    }
    return {
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="11" width="2" height="2" fill="currentColor"/>
          <rect x="4" y="8" width="2" height="5" fill="currentColor"/>
          <rect x="7" y="5" width="2" height="8" fill="currentColor"/>
          <rect x="10" y="2" width="2" height="11" fill="currentColor"/>
        </svg>
      ),
      title: 'Lead metric: Progressive indicator throughout'
    };
  };

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
        {metrics.map((metric) => {
          const { icon, title } = getMetricIcon(metric);
          return (
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
                  title={canEdit ? `${title}\nDouble-click to rename` : title}
                >
                  <span className="metric-tab-icon">{icon}</span>
                  <span className="metric-tab-name">{metric}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MetricTabs;
