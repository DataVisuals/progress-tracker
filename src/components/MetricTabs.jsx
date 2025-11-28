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

  // Helper to calculate RAG status for a metric
  const getRAGStatus = (metricName) => {
    const metricDataPoints = projectData.filter(item => item.metric === metricName);
    if (metricDataPoints.length === 0) return null;

    // Sort all periods by date
    const sortedPeriods = [...metricDataPoints].sort((a, b) =>
      new Date(a.reporting_date) - new Date(b.reporting_date)
    );

    // Find the current period (period has started but next period hasn't started yet)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get metric date range
    const metricStartDate = new Date(sortedPeriods[0].reporting_date);
    const metricEndDate = new Date(sortedPeriods[sortedPeriods.length - 1].reporting_date);
    metricStartDate.setHours(0, 0, 0, 0);
    metricEndDate.setHours(0, 0, 0, 0);

    // Check if metric is historical (today is past the metric's end date)
    const isHistoricalMetric = today > metricEndDate;

    // For historical metrics, show the final period's RAG status
    if (isHistoricalMetric) {
      const finalPeriod = sortedPeriods[sortedPeriods.length - 1];
      const complete = parseFloat(finalPeriod.complete) || 0;
      const expected = parseFloat(finalPeriod.expected) || 0;
      const variance = complete - expected;
      const variancePercent = expected > 0 ? Math.abs((variance / expected) * 100) : 0;
      const amberTolerance = parseFloat(finalPeriod.amber_tolerance) || 5.0;
      const redTolerance = parseFloat(finalPeriod.red_tolerance) || 10.0;

      if (expected === 0) return 'grey';
      if (variance >= 0) return 'green';
      if (variancePercent > redTolerance) return 'red';
      if (variancePercent > amberTolerance) return 'amber';
      return 'green';
    }

    let currentPeriodIndex = -1;
    for (let i = 0; i < sortedPeriods.length; i++) {
      const periodStart = new Date(sortedPeriods[i].reporting_date);
      periodStart.setHours(0, 0, 0, 0);

      // Check if this period has started
      if (periodStart <= today) {
        // Check if next period has started
        if (i + 1 < sortedPeriods.length) {
          const nextPeriodStart = new Date(sortedPeriods[i + 1].reporting_date);
          nextPeriodStart.setHours(0, 0, 0, 0);
          if (today < nextPeriodStart) {
            // We're in this period (started but next hasn't started)
            currentPeriodIndex = i;
            break;
          }
        } else {
          // This is the last period and it has started
          currentPeriodIndex = i;
        }
      }
    }

    // If no current period found (all periods are in the future), return grey
    if (currentPeriodIndex === -1) return 'grey';

    // Check if we're still in the current period (next period hasn't started yet)
    const isInCurrentPeriod = currentPeriodIndex === sortedPeriods.length - 1 ||
      today < new Date(sortedPeriods[currentPeriodIndex + 1].reporting_date);

    // Helper function to calculate RAG for a specific period
    const calculateRAGForPeriod = (period) => {
      if (period.complete === null || period.complete === undefined ||
          period.expected === null || period.expected === undefined) {
        return null;
      }

      const complete = parseFloat(period.complete);
      const expected = parseFloat(period.expected);
      const variance = complete - expected;
      const variancePercent = expected > 0 ? Math.abs((variance / expected) * 100) : 0;
      const amberTolerance = parseFloat(period.amber_tolerance) || 5.0;
      const redTolerance = parseFloat(period.red_tolerance) || 10.0;

      if (expected === 0) return 'grey';
      if (variance >= 0) return 'green';
      if (variancePercent > redTolerance) return 'red';
      if (variancePercent > amberTolerance) return 'amber';
      return 'green';
    };

    const currentPeriod = sortedPeriods[currentPeriodIndex];

    // If we're in the current period and it doesn't have data yet, use the previous period's status
    if (isInCurrentPeriod) {
      const currentComplete = parseFloat(currentPeriod.complete) || 0;
      const currentExpected = parseFloat(currentPeriod.expected) || 0;

      // If current period has no meaningful data (complete is 0 or null), use previous period
      if (currentComplete === 0 && currentPeriodIndex > 0) {
        const previousPeriod = sortedPeriods[currentPeriodIndex - 1];
        const previousRAG = calculateRAGForPeriod(previousPeriod);
        return previousRAG || 'grey';
      }

      // Current period has data - calculate its RAG
      // But if behind schedule, still show the status (user wants to see red/amber)
      return calculateRAGForPeriod(currentPeriod) || 'grey';
    }

    // For completed periods, calculate normally
    return calculateRAGForPeriod(currentPeriod) || 'grey';
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
