import React, { useState, useRef, useEffect } from 'react';
import { MdGridView, MdDragIndicator } from 'react-icons/md';
import './MetricTabs.css';

const MetricTabs = ({ metrics, projectData, selectedMetric, onMetricChange, onMetricRename, onMetricDelete, canEdit, onAddMetric, onGridView, onMetricReorder, projectMetrics }) => {
  const [editingMetric, setEditingMetric] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [draggedMetric, setDraggedMetric] = useState(null);
  const [dragOverMetric, setDragOverMetric] = useState(null);
  const dropdownRef = useRef(null);
  const menuButtonRefs = useRef({});

  // Helper to check if a period has ended based on frequency
  const hasPeriodEnded = (reportingDate, frequency, today) => {
    const startDate = new Date(reportingDate);
    startDate.setHours(0, 0, 0, 0);
    let periodEnd;
    switch (frequency) {
      case 'weekly':
        periodEnd = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'fortnightly':
        periodEnd = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        periodEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
        break;
      case 'quarterly':
        periodEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 3, 1);
        break;
      default:
        periodEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
    }
    return today >= periodEnd;
  };

  // Helper to calculate RAG status for a metric
  // Only shows red/amber when:
  // 1. We have a complete value that's behind, OR
  // 2. The period has ended and there's no value (missing data)
  const getRAGStatus = (metricName) => {
    const metricDataPoints = projectData.filter(item => item.metric === metricName);
    if (metricDataPoints.length === 0) return null;

    // Sort all periods by date
    const sortedPeriods = [...metricDataPoints].sort((a, b) =>
      new Date(a.reporting_date) - new Date(b.reporting_date)
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Helper function to calculate RAG for a specific period
    const calculateRAGForPeriod = (period, periodEnded) => {
      const hasCompleteValue = period.complete !== null &&
                               period.complete !== undefined &&
                               period.complete !== '';

      // If no complete value and period hasn't ended, return grey (not at risk yet)
      if (!hasCompleteValue && !periodEnded) {
        return 'grey';
      }

      const complete = parseFloat(period.complete) || 0;
      const expected = parseFloat(period.expected) || 0;

      if (expected === 0) return 'grey';

      const variance = complete - expected;
      const variancePercent = expected > 0 ? Math.abs((variance / expected) * 100) : 0;
      const amberTolerance = parseFloat(period.amber_tolerance) || 5.0;
      const redTolerance = parseFloat(period.red_tolerance) || 10.0;

      if (variance >= 0) return 'green';
      if (variancePercent > redTolerance) return 'red';
      if (variancePercent > amberTolerance) return 'amber';
      return 'green';
    };

    // Find the current period (period has started but next period hasn't started yet)
    let currentPeriodIndex = -1;
    for (let i = 0; i < sortedPeriods.length; i++) {
      const periodStart = new Date(sortedPeriods[i].reporting_date);
      periodStart.setHours(0, 0, 0, 0);

      if (periodStart <= today) {
        if (i + 1 < sortedPeriods.length) {
          const nextPeriodStart = new Date(sortedPeriods[i + 1].reporting_date);
          nextPeriodStart.setHours(0, 0, 0, 0);
          if (today < nextPeriodStart) {
            currentPeriodIndex = i;
            break;
          }
        } else {
          currentPeriodIndex = i;
        }
      }
    }

    // If no current period found (all periods are in the future), return grey
    if (currentPeriodIndex === -1) return 'grey';

    const currentPeriod = sortedPeriods[currentPeriodIndex];
    const frequency = currentPeriod.frequency || 'monthly';
    const periodEnded = hasPeriodEnded(currentPeriod.reporting_date, frequency, today);

    // Check if current period has a value entered
    // Note: complete defaults to 0 in database, so we treat 0 as "no value" for periods that haven't ended
    const completeValue = currentPeriod.complete;
    const hasCurrentValue = completeValue !== null &&
                            completeValue !== undefined &&
                            completeValue !== '' &&
                            completeValue !== 0;

    // If current period has a value, use it
    if (hasCurrentValue) {
      return calculateRAGForPeriod(currentPeriod, periodEnded);
    }

    // Current period has no value
    if (periodEnded) {
      // Period ended with no value = red (missing data)
      return calculateRAGForPeriod(currentPeriod, true);
    }

    // Period hasn't ended and no value - carry forward previous period's status
    if (currentPeriodIndex > 0) {
      const previousPeriod = sortedPeriods[currentPeriodIndex - 1];
      // Previous period has ended, so pass true
      return calculateRAGForPeriod(previousPeriod, true);
    }

    // No previous period, no current value, period not ended = grey
    return 'grey';
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

  const handleDelete = async (metricName) => {
    if (!onMetricDelete) return;

    const confirmed = window.confirm(`Are you sure you want to delete the metric "${metricName}"? This will also delete all associated data and cannot be undone.`);
    if (confirmed) {
      await onMetricDelete(metricName);
    }
    setShowDropdown(null);
  };

  const handleRename = (metricName) => {
    setEditingMetric(metricName);
    setEditValue(metricName);
    setShowDropdown(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(null);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  // Drag and drop handlers
  const handleDragStart = (e, metric) => {
    if (!canEdit || !onMetricReorder || !projectMetrics || projectMetrics.length === 0) {
      e.preventDefault();
      return;
    }
    setDraggedMetric(metric);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', metric);
  };

  const handleDragEnd = () => {
    setDraggedMetric(null);
    setDragOverMetric(null);
  };

  const handleDragOver = (e, metric) => {
    e.preventDefault();
    if (!draggedMetric || draggedMetric === metric) return;
    setDragOverMetric(metric);
  };

  const handleDragLeave = () => {
    setDragOverMetric(null);
  };

  const handleDrop = async (e, targetMetric) => {
    e.preventDefault();
    if (!draggedMetric || draggedMetric === targetMetric || !onMetricReorder || !projectMetrics || projectMetrics.length === 0) return;

    // Calculate new order
    const draggedIndex = metrics.indexOf(draggedMetric);
    const targetIndex = metrics.indexOf(targetMetric);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Create new order array
    const newOrder = [...metrics];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedMetric);

    // Get metric IDs in new order
    const metricIds = newOrder.map(metricName => {
      const metricObj = projectMetrics.find(m => m.name === metricName);
      return metricObj?.id;
    }).filter(Boolean);

    // Call reorder callback
    await onMetricReorder(metricIds);

    setDraggedMetric(null);
    setDragOverMetric(null);
  };

  return (
    <div className="metric-tabs-container">
      <div className="metric-tabs">
        {metrics.map((metric) => {
          const ragStatus = getRAGStatus(metric);
          const isFlat = isFlatTrajectory(metric);

          // Override RAG status to grey if trajectory is flat
          const displayStatus = isFlat ? 'grey' : ragStatus;

          const isDraggable = canEdit && onMetricReorder && projectMetrics && projectMetrics.length > 0;

          return (
            <div
              key={metric}
              className={`metric-tab-wrapper ${dragOverMetric === metric ? 'drag-over' : ''} ${draggedMetric === metric ? 'dragging' : ''}`}
              draggable={isDraggable && editingMetric !== metric}
              onDragStart={(e) => handleDragStart(e, metric)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, metric)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, metric)}
            >
              {isDraggable && editingMetric !== metric && metrics.length > 1 && (
                <span className="drag-handle" title="Drag to reorder">
                  <MdDragIndicator />
                </span>
              )}
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
                <>
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
                  {canEdit && (
                    <div className="metric-tab-menu">
                      <button
                        ref={el => menuButtonRefs.current[metric] = el}
                        className="metric-menu-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (showDropdown === metric) {
                            setShowDropdown(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setDropdownPosition({
                              top: rect.bottom + 4,
                              left: rect.right - 160 // Align to right edge of button
                            });
                            setShowDropdown(metric);
                          }
                        }}
                        title="Metric options"
                      >
                        ⋮
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        {canEdit && onAddMetric && (
          <button
            className="metric-tab add-metric-tab"
            onClick={onAddMetric}
            title="Add new metric"
          >
            <span className="add-metric-plus">+</span>
          </button>
        )}
        {onGridView && metrics.length > 1 && (
          <button
            className="metric-tab grid-view-tab"
            onClick={onGridView}
            title="View all metrics in grid"
          >
            <MdGridView />
          </button>
        )}
      </div>

      {/* Fixed position dropdown portal */}
      {showDropdown && (
        <div
          className="metric-dropdown-portal"
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 9999
          }}
        >
          <div className="metric-dropdown">
            <button onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleRename(showDropdown);
            }}>
              Rename Metric
            </button>
            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleDelete(showDropdown);
              }}
              className="delete-option"
            >
              Delete Metric
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricTabs;
