import React, { useState, useEffect } from 'react';
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

const MetricChart = ({ metricName, data }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [comments, setComments] = useState({});

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

  // Transform data for the chart
  const chartData = sortedData.map(item => ({
    name: item.reporting_date,
    complete: item.complete,
    remaining: item.final_target - item.complete,
    expected: item.expected,
    final_target: item.final_target,
    id: item.id
  }));

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

    try {
      await api.createComment(period.id, { comment_text: newCommentText });

      // Reload comments for this period
      const response = await api.getPeriodComments(period.id);
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
      alert('Failed to add comment');
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

  // Get all comments sorted by reporting date (latest period first), then by created_at
  const allComments = sortedData.flatMap(item => {
    const periodComments = comments[item.id] || [];
    return periodComments.map(comment => ({
      ...comment,
      reporting_date: item.reporting_date,
      period_id: item.id
    }));
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

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 30, right: 20, left: 10, bottom: 50 }}>
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
              dataKey="final_target"
              position="top"
              style={{ fontSize: 10, fill: '#6b7280', fontWeight: 600 }}
              formatter={(value, entry, index) => {
                // Show target value if it changed from previous
                if (index === 0) return value;
                const prevValue = chartData[index - 1]?.final_target;
                return value !== prevValue ? value : '';
              }}
            />
          </Bar>
          <Line type="monotone" dataKey="expected" stroke="#10b981" strokeWidth={2} name="Expected">
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

      <div className="commentary-section">
        <div className="commentary-header">
          <h4>Commentary</h4>
          {!isAdding && (
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
                  className={`commentary-item ${index === 0 ? 'latest-comment' : ''}`}
                >
                  <div style={{ flex: 1 }}>
                    <strong>{comment.reporting_date}:</strong>{' '}
                    {comment.comment_text}
                    {comment.created_by_name && (
                      <span className="comment-author"> — {comment.created_by_name}</span>
                    )}
                  </div>
                  <button
                    className="delete-comment-btn"
                    onClick={() => handleDeleteComment(comment.id, comment.period_id)}
                    title="Delete comment"
                  >
                    ×
                  </button>
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
