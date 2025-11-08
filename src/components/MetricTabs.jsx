import React, { useState } from 'react';
import './MetricTabs.css';

const MetricTabs = ({ metrics, projectData, selectedMetric, onMetricChange, onMetricRename, canEdit }) => {
  const [editingMetric, setEditingMetric] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Helper to calculate RAG status for a metric
  const getRAGStatus = (metricName) => {
    const metricDataPoints = projectData.filter(item => item.metric === metricName);
    if (metricDataPoints.length === 0) return null;

    // Get the current period (most recent date <= today)
    const today = new Date();
    const currentPeriodData = [...metricDataPoints]
      .filter(item => new Date(item.reporting_date) <= today)
      .sort((a, b) => new Date(b.reporting_date) - new Date(a.reporting_date));

    // If no current period data, use the most recent available
    const latest = currentPeriodData.length > 0
      ? currentPeriodData[0]
      : [...metricDataPoints].sort((a, b) => new Date(b.reporting_date) - new Date(a.reporting_date))[0];

    // Check if we have the necessary data
    if (latest.complete === null || latest.complete === undefined ||
        latest.expected === null || latest.expected === undefined) return null;

    const complete = parseFloat(latest.complete);
    const expected = parseFloat(latest.expected);

    // Calculate variance percentage (complete - expected, matches MetricChart.jsx)
    const variance = complete - expected;
    const variancePercent = expected > 0 ? Math.abs((variance / expected) * 100) : 0;

    // Get tolerances from the first data point that has them, or use defaults
    const amberTolerance = parseFloat(latest.amber_tolerance) || 5.0;
    const redTolerance = parseFloat(latest.red_tolerance) || 10.0;

    // Determine RAG status
    if (expected === 0) return 'grey'; // No expected value
    if (variance >= 0) return 'green'; // On track or ahead of schedule
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
                  title={canEdit ? 'Double-click to rename' : ''}
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
