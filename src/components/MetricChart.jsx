import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  ReferenceArea
} from 'recharts';
import { api } from '../api/client';
import './MetricChart.css';

// Custom X-Axis tick component
const CustomXAxisTick = ({ x, y, payload, index, visibleTicksCount, data }) => {
  const date = new Date(payload.value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  // Month abbreviations
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[date.getMonth()];

  // Detect if data is monthly by checking if all dates are on similar day of month
  // and intervals are roughly 30 days
  let isMonthly = false;
  if (data && data.length > 1) {
    const dates = data.map(d => new Date(d.name));
    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
      const diff = (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24); // days
      intervals.push(diff);
    }
    // Check if average interval is between 28-31 days (monthly)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    isMonthly = avgInterval >= 25 && avgInterval <= 35;
  }

  // Show year on first tick or when year changes
  const showYear = index === 0 || index === visibleTicksCount - 1;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="middle"
        fill="#666"
        fontSize={11}
        fontWeight={500}
      >
        {isMonthly ? monthName : `${day}/${month}`}
      </text>
      {showYear && (
        <text
          x={0}
          y={0}
          dy={28}
          textAnchor="middle"
          fill="#999"
          fontSize={9}
        >
          {year}
        </text>
      )}
    </g>
  );
};

// Custom draggable dot for expected line
const CustomExpectedDot = (props) => {
  const { cx, cy, payload, index, canEdit, onMouseDown, key, ...rest } = props;
  console.log('CustomExpectedDot render', { cx, cy, payload, index, canEdit, hasOnMouseDown: !!onMouseDown });

  if (!canEdit) {
    console.log('CustomExpectedDot: canEdit is false, returning null');
    return null;
  }

  const handleMouseDown = (e) => {
    console.log('Circle onMouseDown fired', { index, payload });
    e.preventDefault();
    e.stopPropagation();
    if (onMouseDown) {
      onMouseDown(e, payload, index);
    }
  };

  return (
    <circle
      cx={cx}
      cy={cy}
      r={8}
      fill="#10b981"
      stroke="#fff"
      strokeWidth={2}
      style={{ cursor: 'ns-resize' }}
      onMouseDown={handleMouseDown}
      onPointerDown={handleMouseDown}
    />
  );
};

// Custom Tooltip component
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const date = new Date(label);
    const formattedDate = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const complete = payload.find(p => p.dataKey === 'complete')?.value || 0;
    const remaining = payload.find(p => p.dataKey === 'remaining')?.value || 0;
    const expected = payload.find(p => p.dataKey === 'expected')?.value || 0;
    const total = complete + remaining;

    const progress = total > 0 ? ((complete / total) * 100).toFixed(1) : 0;
    const variance = complete - expected;
    const variancePercent = expected > 0 ? ((variance / expected) * 100).toFixed(1) : 0;

    return (
      <div className="custom-tooltip">
        <div className="tooltip-header">{formattedDate}</div>
        <div className="tooltip-body">
          <div className="tooltip-row">
            <span className="tooltip-label">Complete:</span>
            <span className="tooltip-value complete">{complete}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Remaining:</span>
            <span className="tooltip-value">{remaining}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Total Target:</span>
            <span className="tooltip-value">{total}</span>
          </div>
          <div className="tooltip-divider"></div>
          <div className="tooltip-row">
            <span className="tooltip-label">Expected:</span>
            <span className="tooltip-value">{expected}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Variance:</span>
            <span className={`tooltip-value ${variance >= 0 ? 'positive' : 'negative'}`}>
              {variance >= 0 ? '+' : ''}{variance} ({variancePercent >= 0 ? '+' : ''}{variancePercent}%)
            </span>
          </div>
          <div className="tooltip-divider"></div>
          <div className="tooltip-row highlight">
            <span className="tooltip-label">Progress:</span>
            <span className="tooltip-value">{progress}%</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

const MetricChart = ({ metricName, data, canEdit = false, onDataChange }) => {
  console.log('MetricChart rendered with canEdit:', canEdit);

  const [isAdding, setIsAdding] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [comments, setComments] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPoint, setDraggedPoint] = useState(null);
  const chartContainerRef = useRef(null);

  // Sort data by date always for consistency
  const sortedData = [...data].sort((a, b) => {
    return new Date(a.reporting_date) - new Date(b.reporting_date);
  });

  // Load comments for all periods when component mounts or data changes
  useEffect(() => {
    const loadComments = async () => {
      const commentsMap = {};
      for (const item of sortedData) {
        try {
          const response = await api.getPeriodComments(item.id);
          commentsMap[item.id] = response.data;
        } catch (err) {
          console.error(`Failed to load comments for period ${item.id}:`, err);
          commentsMap[item.id] = [];
        }
      }
      setComments(commentsMap);
    };

    if (sortedData.length > 0) {
      loadComments();
    }
  }, [data]);

  // Get baseline target (first period's target)
  const baselineTarget = sortedData.length > 0 ? sortedData[0].final_target : 0;

  // Transform data for the chart
  const chartData = sortedData.map((item, index) => {
    const scopeDelta = item.final_target - baselineTarget;
    const prevTarget = index > 0 ? sortedData[index - 1].final_target : baselineTarget;
    const scopeChange = item.final_target - prevTarget;

    // Use dragged value if this point is being dragged
    const expectedValue = (draggedPoint && draggedPoint.index === index)
      ? draggedPoint.currentValue
      : item.expected;

    return {
      name: item.reporting_date,
      complete: item.complete,
      remaining: item.final_target - item.complete,
      expected: expectedValue,
      final_target: item.final_target,
      scopeDelta: scopeDelta,
      scopeChange: scopeChange,
      id: item.id
    };
  });

  // Find current period (closest date to today that is <= today)
  const today = new Date();
  let currentPeriodIndex = -1;
  for (let i = chartData.length - 1; i >= 0; i--) {
    const periodDate = new Date(chartData[i].name);
    if (periodDate <= today) {
      currentPeriodIndex = i;
      break;
    }
  }

  // Calculate ReferenceArea bounds for current period highlight
  let currentPeriodX1 = null;
  let currentPeriodX2 = null;
  if (currentPeriodIndex >= 0) {
    currentPeriodX1 = chartData[currentPeriodIndex].name;
    // Highlight extends to next period or slightly beyond current if it's the last
    if (currentPeriodIndex < chartData.length - 1) {
      currentPeriodX2 = chartData[currentPeriodIndex + 1].name;
    } else {
      currentPeriodX2 = chartData[currentPeriodIndex].name;
    }
  }

  const handleStartAdd = () => {
    setIsAdding(true);
    setSelectedDate('');
    setNewCommentText('');
  };

  const handleAddComment = async () => {
    if (!selectedDate || !newCommentText.trim()) {
      alert('Please select a date and enter a comment');
      return;
    }

    // Find the period for this date
    const period = sortedData.find(item => item.reporting_date === selectedDate);
    if (!period) {
      alert('Invalid date selected');
      return;
    }

    console.log('Adding comment to period:', period.id, 'with text:', newCommentText);

    try {
      const createResponse = await api.createComment(period.id, { comment_text: newCommentText });
      console.log('Comment created:', createResponse.data);

      // Reload comments for this period
      const response = await api.getPeriodComments(period.id);
      console.log('Reloaded comments:', response.data);
      setComments(prev => ({
        ...prev,
        [period.id]: response.data
      }));

      // Reset form
      setIsAdding(false);
      setSelectedDate('');
      setNewCommentText('');
    } catch (err) {
      console.error('Failed to add comment:', err);
      console.error('Error response:', err.response?.data);
      alert(`Failed to add comment: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteComment = async (commentId, periodId) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      await api.deleteComment(commentId);

      // Reload comments for this period
      const response = await api.getPeriodComments(periodId);
      setComments(prev => ({
        ...prev,
        [periodId]: response.data
      }));
    } catch (err) {
      console.error('Failed to delete comment:', err);
      alert('Failed to delete comment');
    }
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setSelectedDate('');
    setNewCommentText('');
  };

  // Handle dragging expected line points
  const handleExpectedDotMouseDown = (e, payload, index) => {
    console.log('handleExpectedDotMouseDown called', { canEdit, payload, index, e });
    if (!canEdit) {
      console.log('canEdit is false, returning');
      return;
    }

    // Get the actual data point from sortedData using the index
    const dataPoint = sortedData[index];
    if (!dataPoint) {
      console.error('No data point found at index', index);
      return;
    }

    console.log('Found data point:', dataPoint);

    // Handle both DOM events and Recharts events
    const clientY = e.clientY || (e.nativeEvent && e.nativeEvent.clientY) || window.event.clientY || 0;

    if (e.stopPropagation) {
      e.stopPropagation();
    }
    if (e.preventDefault) {
      e.preventDefault();
    }

    setIsDragging(true);
    setDraggedPoint({
      index,
      startY: clientY,
      startValue: dataPoint.expected,
      currentValue: dataPoint.expected
    });
    console.log('Set dragging state', { index, startY: clientY, startValue: dataPoint.expected });
  };

  const handleMouseMove = useCallback((e) => {
    if (!draggedPoint) return;

    const deltaY = draggedPoint.startY - e.clientY;
    const chartHeight = 300; // Height of the ResponsiveContainer
    const dataRange = Math.max(...sortedData.map(item => Math.max(item.final_target, item.expected)));
    const valuePerPixel = dataRange / chartHeight;
    const newValue = Math.max(0, Math.round(draggedPoint.startValue + (deltaY * valuePerPixel)));

    // Update the dragged point's current value for live preview
    setDraggedPoint(prev => prev ? { ...prev, currentValue: newValue } : null);
  }, [draggedPoint, sortedData]);

  const handleMouseUp = useCallback(async () => {
    if (!draggedPoint) return;

    // Only update if value changed
    if (draggedPoint.currentValue !== draggedPoint.startValue) {
      try {
        await api.updatePeriod(sortedData[draggedPoint.index].id, { expected: draggedPoint.currentValue });
        // Trigger parent to reload data
        if (onDataChange) {
          await onDataChange();
        }
      } catch (err) {
        console.error('Failed to update expected value:', err);
        alert('Failed to update expected value');
      }
    }

    setIsDragging(false);
    setDraggedPoint(null);
  }, [draggedPoint, sortedData, onDataChange]);

  // Add global mouse event listeners
  useEffect(() => {
    if (!isDragging) return;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Get all comments sorted by reporting date (latest period first), then by created_at
  // Combine both system commentary (from metric_periods) and user comments (from comments table)
  const allComments = sortedData.flatMap(item => {
    const periodComments = comments[item.id] || [];
    const result = [];

    // Add system commentary if it exists
    if (item.commentary) {
      result.push({
        id: `system-${item.id}`,
        comment_text: item.commentary,
        reporting_date: item.reporting_date,
        period_id: item.id,
        is_system: true,
        created_at: item.reporting_date // Use reporting date as created_at for sorting
      });
    }

    // Add user comments
    result.push(...periodComments.map(comment => ({
      ...comment,
      reporting_date: item.reporting_date,
      period_id: item.id,
      is_system: false
    })));

    return result;
  }).sort((a, b) => {
    // First sort by reporting_date descending (latest period first)
    const dateCompare = new Date(b.reporting_date) - new Date(a.reporting_date);
    if (dateCompare !== 0) return dateCompare;
    // Then by created_at descending (latest comment first)
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div className="metric-chart-container">
      <h3 className="metric-title">{metricName}</h3>

      <div ref={chartContainerRef} style={{ position: 'relative', width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 50, right: 20, left: 10, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            height={80}
            tick={<CustomXAxisTick data={chartData} />}
          />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          {currentPeriodX1 && currentPeriodX2 && (
            <ReferenceArea
              x1={currentPeriodX1}
              x2={currentPeriodX2}
              fill="#fbbf24"
              fillOpacity={0.15}
              label={{ value: 'Current Period', position: 'top', fill: '#92400e', fontSize: 11, fontWeight: 600 }}
            />
          )}
          <Bar dataKey="complete" stackId="a" fill="#00aeef" name="Complete" />
          <Bar dataKey="remaining" stackId="a" fill="#d1d5db" name="Remaining">
            <LabelList
              content={({ x, y, width, value, index }) => {
                const item = chartData[index];
                if (!item) return null;

                // Show target value at top of bar
                const targetLabel = `${item.final_target}`;

                // Show scope change if it exists
                const scopeChange = item.scopeChange;
                let scopeLabel = null;
                let scopeColor = null;

                if (scopeChange > 0) {
                  scopeLabel = `+${scopeChange}`;
                  scopeColor = '#ef4444'; // Red for scope increase
                } else if (scopeChange < 0) {
                  scopeLabel = `${scopeChange}`;
                  scopeColor = '#10b981'; // Green for scope decrease
                }

                return (
                  <g>
                    <text
                      x={x + width / 2}
                      y={y - 4}
                      textAnchor="middle"
                      fill="#6b7280"
                      fontSize={10}
                      fontWeight={600}
                    >
                      {targetLabel}
                    </text>
                    {scopeLabel && (
                      <text
                        x={x + width / 2}
                        y={y - 16}
                        textAnchor="middle"
                        fill={scopeColor}
                        fontSize={9}
                        fontWeight={700}
                      >
                        {scopeLabel}
                      </text>
                    )}
                  </g>
                );
              }}
            />
          </Bar>
          <Line
            type="monotone"
            dataKey="expected"
            stroke="#10b981"
            strokeWidth={2}
            name="Expected"
            dot={canEdit ? { r: 8, fill: "#10b981", stroke: "#fff", strokeWidth: 2, cursor: 'pointer' } : { r: 4 }}
            activeDot={canEdit ? {
              r: 10,
              fill: "#10b981",
              stroke: "#fff",
              strokeWidth: 3,
              cursor: 'ns-resize',
              onMouseDown: (e, payload) => {
                console.log('activeDot clicked!', payload);
                if (payload && payload.payload) {
                  const index = chartData.findIndex(item => item.name === payload.payload.name);
                  console.log('Found index:', index);
                  if (index !== -1) {
                    handleExpectedDotMouseDown(e, payload.payload, index);
                  }
                }
              }
            } : false}
          >
            <LabelList
              dataKey="expected"
              position="top"
              offset={12}
              style={{ fontSize: 10, fill: '#059669', fontWeight: 600 }}
              formatter={(value, entry, index) => {
                // Always show first and last, and when value changes significantly
                if (index === 0 || index === chartData.length - 1) return value;
                const prevValue = chartData[index - 1]?.expected;
                return Math.abs(value - prevValue) > (chartData[chartData.length - 1].expected * 0.1) ? value : '';
              }}
            />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
      </div>

      <div className="commentary-section">
        <div className="commentary-header">
          <h4>Commentary</h4>
          {!isAdding && canEdit && (
            <button className="add-btn" onClick={handleStartAdd}>
              Add
            </button>
          )}
        </div>

        {isAdding ? (
          <div className="commentary-add-mode">
            <div className="commentary-item-add">
              <div className="commentary-label">Add Comment</div>
              <div className="comment-date-selector">
                <label htmlFor="comment-date">Date:</label>
                <select
                  id="comment-date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="comment-date-select"
                >
                  <option value="">Select a date...</option>
                  {sortedData.map((item) => (
                    <option key={item.id} value={item.reporting_date}>
                      {item.reporting_date}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                className="commentary-textarea"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                rows={4}
                placeholder="Add comment..."
                autoFocus
              />
            </div>
            <div className="commentary-actions">
              <button className="save-btn" onClick={handleAddComment}>
                Add
              </button>
              <button className="cancel-btn" onClick={handleCancelAdd}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="commentary-view-mode">
            {allComments.length > 0 ? (
              allComments.map((comment, index) => (
                <div
                  key={comment.id}
                  className={`commentary-item ${index === 0 ? 'latest-comment' : ''} ${comment.is_system ? 'system-commentary' : ''}`}
                >
                  <div style={{ flex: 1 }}>
                    <strong>{comment.reporting_date}:</strong>{' '}
                    {comment.comment_text}
                    {comment.created_by_name && !comment.is_system && (
                      <span className="comment-author"> — {comment.created_by_name}</span>
                    )}
                    {comment.is_system && (
                      <span className="comment-author"> — System</span>
                    )}
                  </div>
                  {!comment.is_system && canEdit && (
                    <button
                      className="delete-comment-btn"
                      onClick={() => handleDeleteComment(comment.id, comment.period_id)}
                      title="Delete comment"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="commentary-item">
                <em>No comments added yet</em>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricChart;
