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

  // Helper to calculate RAG status for a metric
  const getRAGStatus = (metricName) => {
    const metricDataPoints = projectData.filter(item => item.metric === metricName);
    if (metricDataPoints.length === 0) return null;

    // Get the most recent data point
    const sortedData = [...metricDataPoints].sort((a, b) =>
      new Date(b.reporting_date) - new Date(a.reporting_date)
    );
    const latest = sortedData[0];

    // Check if we have the necessary data
    if (latest.complete === null || latest.complete === undefined ||
        latest.expected === null || latest.expected === undefined) return null;

    const complete = parseFloat(latest.complete);
    const expected = parseFloat(latest.expected);

    // Calculate variance percentage
    const variance = expected - complete;
    const variancePercent = Math.abs((variance / expected) * 100);

    // Get tolerances from the first data point that has them, or use defaults
    const amberTolerance = parseFloat(latest.amber_tolerance) || 5.0;
    const redTolerance = parseFloat(latest.red_tolerance) || 10.0;

    // Determine RAG status
    if (expected === 0) return 'grey'; // No expected value
    if (variance < 0) return 'green'; // Ahead of schedule
    if (variancePercent > redTolerance) return 'red';
    if (variancePercent > amberTolerance) return 'amber';
    return 'green';
  };

  // Helper to detect if trajectory is flat (no significant change)
  const isFlatTrajectory = (metricName) => {
    const metricDataPoints = projectData.filter(item => item.metric === metricName);
    if (metricDataPoints.length < 3) return false; // Need at least 3 points

    // Get the last 3 data points
    const sortedData = [...metricDataPoints]
      .sort((a, b) => new Date(b.reporting_date) - new Date(a.reporting_date))
      .slice(0, 3);

    // Calculate the change between consecutive points
    const changes = [];
    for (let i = 0; i < sortedData.length - 1; i++) {
      const curr = parseFloat(sortedData[i].complete) || 0;
      const prev = parseFloat(sortedData[i + 1].complete) || 0;
      if (prev !== 0) {
        changes.push(Math.abs(((curr - prev) / prev) * 100));
      }
    }

    // If all changes are less than 2%, consider it flat
    return changes.length > 0 && changes.every(change => change < 2);
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
          const ragStatus = getRAGStatus(metric);
          const isFlat = isFlatTrajectory(metric);

          // Override RAG status to grey if trajectory is flat
          const displayStatus = isFlat ? 'grey' : ragStatus;

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
                  {displayStatus && (
                    <span
                      className={`metric-rag-marker ${displayStatus}`}
                      title={
                        isFlat ? 'Flat trajectory (minimal change)' :
                        displayStatus === 'green' ? 'On track or ahead' :
                        displayStatus === 'amber' ? 'At risk' :
                        displayStatus === 'red' ? 'Behind schedule' :
                        'No data'
                      }
                    />
                  )}
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
