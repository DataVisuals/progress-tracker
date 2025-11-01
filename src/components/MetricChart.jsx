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
  ReferenceArea,
  Cell
} from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../api/client';
import './MetricChart.css';

// Helper function to format numbers with commas
const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  // Check if the number is a whole number
  const isWholeNumber = num % 1 === 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: isWholeNumber ? 0 : 1,
    maximumFractionDigits: 1
  });
};

// Helper function to calculate if text should be white or black based on background color
const getContrastColor = (hexColor) => {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

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
const CustomTooltip = ({ active, payload, label, amberTolerance, redTolerance }) => {
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
    const variancePercent = expected > 0 ? Math.abs((variance / expected) * 100).toFixed(1) : 0;

    // Determine variance status
    let varianceStatus = null;
    let varianceIcon = null;
    if (variance < 0) { // Behind schedule
      if (variancePercent > redTolerance) {
        varianceStatus = 'Red';
        varianceIcon = '🔴';
      } else if (variancePercent > amberTolerance) {
        varianceStatus = 'Amber';
        varianceIcon = '🟡';
      }
    }

    return (
      <div className="custom-tooltip">
        <div className="tooltip-header">{formattedDate}</div>
        <div className="tooltip-body">
          <div className="tooltip-row">
            <span className="tooltip-label">Complete:</span>
            <span className="tooltip-value complete">{formatNumber(complete)}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Remaining:</span>
            <span className="tooltip-value">{formatNumber(remaining)}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Total Target:</span>
            <span className="tooltip-value">{formatNumber(total)}</span>
          </div>
          <div className="tooltip-divider"></div>
          <div className="tooltip-row">
            <span className="tooltip-label">Expected:</span>
            <span className="tooltip-value">{formatNumber(expected)}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Variance:</span>
            <span className={`tooltip-value ${variance >= 0 ? 'positive' : 'negative'}`}>
              {variance >= 0 ? '+' : ''}{formatNumber(variance)} ({variance >= 0 ? '+' : '-'}{variancePercent}%)
            </span>
          </div>
          {varianceStatus && (
            <div className="tooltip-row">
              <span className="tooltip-label">Status:</span>
              <span className={`tooltip-value ${varianceStatus.toLowerCase()}`}>
                {varianceIcon} {varianceStatus} (tol: {varianceStatus === 'Red' ? redTolerance : amberTolerance}%)
              </span>
            </div>
          )}
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

const MetricChart = ({ metricName, data, canEdit = false, onDataChange, amberTolerance = 5.0, redTolerance = 10.0, timeTravelTimestamp = null }) => {
  console.log('MetricChart rendered with canEdit:', canEdit);

  const [isAdding, setIsAdding] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [comments, setComments] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPoint, setDraggedPoint] = useState(null);
  const [highlightedSeries, setHighlightedSeries] = useState(null);
  const chartContainerRef = useRef(null);

  // Sort data by date always for consistency
  const sortedData = [...data].sort((a, b) => {
    return new Date(a.reporting_date) - new Date(b.reporting_date);
  });

  // Get metric metadata from first data point (all periods have same metric metadata)
  const metricMetadata = sortedData.length > 0 ? {
    start_date: sortedData[0].start_date,
    end_date: sortedData[0].end_date,
    frequency: sortedData[0].frequency
  } : null;

  // Calculate duration in days and months if metadata is available
  const calculateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) return null;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Calculate months (approximate)
    const diffMonths = Math.round(diffDays / 30.44); // Average days per month

    // Calculate weeks
    const diffWeeks = Math.round(diffDays / 7);

    return { days: diffDays, months: diffMonths, weeks: diffWeeks };
  };

  const duration = metricMetadata ? calculateDuration(metricMetadata.start_date, metricMetadata.end_date) : null;

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

  const handleEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.comment_text);
  };

  const handleSaveComment = async (commentId, periodId) => {
    if (!editingCommentText.trim()) {
      alert('Comment cannot be empty');
      return;
    }

    try {
      await api.updateComment(commentId, { comment_text: editingCommentText });

      // Reload comments for this period
      const response = await api.getPeriodComments(periodId);
      setComments(prev => ({
        ...prev,
        [periodId]: response.data
      }));

      setEditingCommentId(null);
      setEditingCommentText('');
    } catch (err) {
      console.error('Failed to update comment:', err);
      alert('Failed to update comment');
    }
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
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

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Determine best duration display based on frequency
  const getDurationDisplay = () => {
    if (!duration || !metricMetadata) return '';

    const { frequency } = metricMetadata;
    const { days, months, weeks } = duration;

    if (frequency === 'weekly') {
      return `${weeks} week${weeks !== 1 ? 's' : ''} (${days} days)`;
    } else if (frequency === 'monthly') {
      return `${months} month${months !== 1 ? 's' : ''} (${days} days)`;
    } else if (frequency === 'quarterly') {
      const quarters = Math.round(months / 3);
      return `${quarters} quarter${quarters !== 1 ? 's' : ''} (${months} months)`;
    } else {
      return `${days} days`;
    }
  };

  // Export chart as image
  const handleExportChart = async () => {
    if (!chartContainerRef.current) return;

    try {
      const canvas = await html2canvas(chartContainerRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${metricName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_chart.png`;
        link.click();
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Failed to export chart:', error);
    }
  };

  // Export as PDF
  const handleExportPDF = async () => {
    if (!chartContainerRef.current) return;

    try {
      const canvas = await html2canvas(chartContainerRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');

      // Add title
      pdf.setFontSize(16);
      pdf.setTextColor(0, 60, 113);
      pdf.text(metricName, 15, 15);

      // Add date range if available
      if (metricMetadata) {
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Period: ${formatDate(metricMetadata.start_date)} → ${formatDate(metricMetadata.end_date)}`, 15, 22);
      }

      // Add chart image
      const imgWidth = 270;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 15, 30, imgWidth, imgHeight);

      // Add data table
      const tableData = chartData.map((item, index) => {
        const date = new Date(item.name);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedDate = monthNames[date.getMonth()];
        const variance = item.complete - item.expected;
        const variancePercent = item.expected > 0 ? ((variance / item.expected) * 100) : 0;

        return [
          formattedDate,
          item.complete?.toFixed(1) || '0.0',
          item.expected?.toFixed(1) || '0.0',
          `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}`,
          `${variancePercent >= 0 ? '+' : ''}${variancePercent.toFixed(1)}%`
        ];
      });

      autoTable(pdf, {
        startY: imgHeight + 35,
        head: [['Period', 'Complete', 'Expected', 'Variance', 'Variance %']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [0, 174, 239],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold' },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' }
        }
      });

      // Add tolerances info
      const finalY = pdf.lastAutoTable?.finalY || imgHeight + 35;
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Tolerances: Amber >${amberTolerance}%, Red >${redTolerance}%`, 15, finalY + 10);

      pdf.save(`${metricName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.pdf`);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  return (
    <div className="metric-chart-container">
      {metricMetadata && (
        <div className="metric-header-row">
          <div className="metric-date-range">
            <div className="date-range-item">
              <span className="date-label">Metric Period:</span>
              <span className="date-value">{formatDate(metricMetadata.start_date)}</span>
            </div>
            <div className="date-range-separator">→</div>
            <div className="date-range-item">
              <span className="date-value">{formatDate(metricMetadata.end_date)}</span>
            </div>
            {duration && (
              <>
                <div className="date-range-separator">•</div>
                <div className="date-range-item">
                  <span className="date-value duration">{getDurationDisplay()}</span>
                </div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="export-chart-button"
              onClick={handleExportChart}
              title="Export chart as PNG image"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1V11M8 11L11 8M8 11L5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 11V14H2V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              PNG
            </button>
            <button
              className="export-chart-button"
              onClick={handleExportPDF}
              title="Export full report as PDF"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 1H10L13 4V14C13 14.5523 12.5523 15 12 15H3C2.44772 15 2 14.5523 2 14V2C2 1.44772 2.44772 1 3 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 1V4H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              PDF
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        <div ref={chartContainerRef} style={{ position: 'relative', flex: 1 }}>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
              >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            height={80}
            tick={<CustomXAxisTick data={chartData} />}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => formatNumber(value)}
          />
          <Tooltip content={<CustomTooltip amberTolerance={amberTolerance} redTolerance={redTolerance} />} />
          <Bar dataKey="complete" stackId="a" name="Complete" animationDuration={800} animationBegin={0}>
            {chartData.map((entry, index) => {
              // Calculate variance for this period
              const variance = entry.complete - entry.expected;
              const variancePercent = entry.expected > 0 ? Math.abs((variance / entry.expected) * 100) : 0;

              // Determine color based on variance and tolerances
              let barColor = '#539668'; // Green - on track or ahead
              let barCategory = 'green';

              // Check if period is in the past (should have data)
              const cutoffDate = timeTravelTimestamp ? new Date(timeTravelTimestamp) : new Date();
              const periodDate = new Date(entry.name);
              const isPastOrCurrent = periodDate <= cutoffDate;

              if (isPastOrCurrent && variance < 0) { // Behind schedule
                if (variancePercent > redTolerance) {
                  barColor = '#D0704d'; // Red
                  barCategory = 'red';
                } else if (variancePercent > amberTolerance) {
                  barColor = '#f5ad5b'; // Amber
                  barCategory = 'amber';
                }
              }

              // Apply opacity based on highlightedSeries
              const opacity = highlightedSeries === null || highlightedSeries === barCategory ? 1 : 0.3;

              return <Cell key={`cell-${index}`} fill={barColor} fillOpacity={opacity} />;
            })}
            <LabelList
              content={({ x, y, width, index }) => {
                const item = chartData[index];
                if (!item) return null;

                // Check if this is the current period
                const isCurrentPeriod = currentPeriodX1 === item.name;
                if (!isCurrentPeriod) return null;

                return (
                  <text
                    x={x + width / 2}
                    y={y - 10}
                    fill="#ef4444"
                    textAnchor="middle"
                    fontSize="20"
                  >
                    ▼
                  </text>
                );
              }}
            />
          </Bar>
          <Bar
            dataKey="remaining"
            stackId="a"
            fill="#d1d5db"
            name="Remaining"
            animationDuration={800}
            animationBegin={200}
            fillOpacity={highlightedSeries === null || highlightedSeries === 'remaining' ? 1 : 0.3}
          >
            <LabelList
              content={({ x, y, width, value, index }) => {
                const item = chartData[index];
                if (!item) return null;

                // Show target value at top of bar
                const targetLabel = formatNumber(item.final_target);

                // Calculate variance percentage
                const variance = item.complete - item.expected;
                const variancePercent = item.expected > 0 ? Math.abs((variance / item.expected) * 100) : 0;

                // Determine the cutoff date (time travel timestamp or current date)
                const cutoffDate = timeTravelTimestamp ? new Date(timeTravelTimestamp) : new Date();
                const periodDate = new Date(item.name);
                const isPastOrCurrent = periodDate <= cutoffDate;

                // Show scope change if it exists
                const scopeChange = item.scopeChange;
                let scopeLabel = null;
                let scopeColor = null;

                if (scopeChange > 0) {
                  scopeLabel = `+${formatNumber(scopeChange)}`;
                  scopeColor = '#ef4444'; // Red for scope increase
                } else if (scopeChange < 0) {
                  scopeLabel = formatNumber(scopeChange);
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
            animationDuration={1000}
            animationBegin={400}
            strokeOpacity={highlightedSeries === null || highlightedSeries === 'expected' ? 1 : 0.3}
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
          />
        </ComposedChart>
      </ResponsiveContainer>
          </div>

          {/* Data Table - Excel-style horizontal layout */}
          <div className="data-table-section">
        <table className="data-table">
          <thead>
            <tr>
              <th className="row-header"></th>
              {chartData.map((item, index) => {
                // Format date to match chart X-axis
                const date = new Date(item.name);
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const formattedDate = monthNames[date.getMonth()];

                return (
                  <th key={index} className="period-header">{formattedDate}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Complete Row */}
            <tr className="data-row">
              <td className="row-label">Complete</td>
              {chartData.map((item, index) => {
                const variance = item.complete - item.expected;
                const variancePercent = item.expected > 0 ? Math.abs((variance / item.expected) * 100) : 0;
                const cutoffDate = timeTravelTimestamp ? new Date(timeTravelTimestamp) : new Date();
                const periodDate = new Date(item.name);
                const isPastOrCurrent = periodDate <= cutoffDate;

                let statusClass = '';
                if (isPastOrCurrent && variance < 0) {
                  if (variancePercent > redTolerance) {
                    statusClass = 'status-red';
                  } else if (variancePercent > amberTolerance) {
                    statusClass = 'status-amber';
                  } else {
                    statusClass = 'status-green';
                  }
                } else if (isPastOrCurrent) {
                  statusClass = 'status-green';
                }

                return (
                  <td key={index} className={`number-cell ${statusClass}`}>
                    {formatNumber(item.complete)}
                  </td>
                );
              })}
            </tr>

            {/* Expected Row */}
            <tr className="data-row">
              <td className="row-label">Expected</td>
              {chartData.map((item, index) => (
                <td key={index} className="number-cell">
                  {formatNumber(item.expected)}
                </td>
              ))}
            </tr>

            {/* Variance Row */}
            <tr className="data-row">
              <td className="row-label">Variance</td>
              {chartData.map((item, index) => {
                const variance = item.complete - item.expected;
                const arrow = variance > 0 ? '↑' : variance < 0 ? '↓' : '•';

                return (
                  <td key={index} className={`number-cell variance-cell ${variance >= 0 ? 'positive' : 'negative'}`}>
                    <span className="variance-arrow">{arrow}</span> {variance >= 0 ? '+' : ''}{formatNumber(variance)}
                  </td>
                );
              })}
            </tr>

            {/* Variance % Row */}
            <tr className="data-row">
              <td className="row-label">Variance %</td>
              {chartData.map((item, index) => {
                const variance = item.complete - item.expected;
                const variancePercent = item.expected > 0 ? ((variance / item.expected) * 100) : 0;
                const arrow = variance > 0 ? '↑' : variance < 0 ? '↓' : '•';

                return (
                  <td key={index} className={`number-cell variance-cell ${variance >= 0 ? 'positive' : 'negative'}`}>
                    <span className="variance-arrow">{arrow}</span> {variancePercent >= 0 ? '+' : ''}{variancePercent.toFixed(1)}%
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
          </div>
        </div>

        {/* Custom Legend */}
        <div className="custom-legend">
          <div className="legend-title">Legend</div>

          <div className="legend-items">
            <div
              className={`legend-item ${highlightedSeries === 'green' ? 'active' : ''}`}
              onMouseEnter={() => setHighlightedSeries('green')}
              onMouseLeave={() => setHighlightedSeries(null)}
            >
              <div className="legend-indicator" style={{ backgroundColor: '#539668' }}></div>
              <span className="legend-text">Green: On track or ahead</span>
            </div>
            <div
              className={`legend-item ${highlightedSeries === 'amber' ? 'active' : ''}`}
              onMouseEnter={() => setHighlightedSeries('amber')}
              onMouseLeave={() => setHighlightedSeries(null)}
            >
              <div className="legend-indicator" style={{ backgroundColor: '#f5ad5b' }}></div>
              <span className="legend-text">Amber: &gt;{amberTolerance}% behind</span>
            </div>
            <div
              className={`legend-item ${highlightedSeries === 'red' ? 'active' : ''}`}
              onMouseEnter={() => setHighlightedSeries('red')}
              onMouseLeave={() => setHighlightedSeries(null)}
            >
              <div className="legend-indicator" style={{ backgroundColor: '#D0704d' }}></div>
              <span className="legend-text">Red: &gt;{redTolerance}% behind</span>
            </div>
            <div
              className={`legend-item ${highlightedSeries === 'remaining' ? 'active' : ''}`}
              onMouseEnter={() => setHighlightedSeries('remaining')}
              onMouseLeave={() => setHighlightedSeries(null)}
            >
              <div className="legend-indicator" style={{ backgroundColor: '#d1d5db' }}></div>
              <span className="legend-text">Remaining</span>
            </div>
            <div
              className={`legend-item ${highlightedSeries === 'expected' ? 'active' : ''}`}
              onMouseEnter={() => setHighlightedSeries('expected')}
              onMouseLeave={() => setHighlightedSeries(null)}
            >
              <div className="legend-indicator line" style={{ backgroundColor: '#10b981' }}></div>
              <span className="legend-text">Expected</span>
            </div>
          </div>
        </div>
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
                  {editingCommentId === comment.id ? (
                    <>
                      <div style={{ flex: 1 }}>
                        <strong>{comment.reporting_date}:</strong>
                        <textarea
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          style={{ width: '100%', marginTop: '8px', padding: '8px', fontSize: '14px', minHeight: '60px' }}
                          autoFocus
                        />
                      </div>
                      <button
                        className="edit-comment-btn"
                        onClick={() => handleSaveComment(comment.id, comment.period_id)}
                        title="Save comment"
                        style={{ marginRight: '4px' }}
                      >
                        ✓
                      </button>
                      <button
                        className="delete-comment-btn"
                        onClick={handleCancelEdit}
                        title="Cancel editing"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <>
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
                        <>
                          <button
                            className="edit-comment-btn"
                            onClick={() => handleEditComment(comment)}
                            title="Edit comment"
                            style={{ marginRight: '4px' }}
                          >
                            ✎
                          </button>
                          <button
                            className="delete-comment-btn"
                            onClick={() => handleDeleteComment(comment.id, comment.period_id)}
                            title="Delete comment"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </>
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
