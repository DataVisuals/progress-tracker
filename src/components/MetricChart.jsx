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
import { RAG_COLORS } from '../constants/colors';
import TimeTravel from './TimeTravel';
import Feedback from './Feedback';
import RecoveryPlans from './RecoveryPlans';
// import CRAIDs from './CRAIDs'; // DISABLED: CRAIDs feature hidden
import Lottie from 'lottie-react';
import fixingAnimation from '../assets/fixing-animation.json';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ClarityIndicator from './ClarityIndicator';
import './MetricChart.css';

// Barclays blue color for expected line
const BARCLAYS_BLUE = '#00aeef';

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
      fill={BARCLAYS_BLUE}
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

    // Check if this period is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const periodDate = new Date(label);
    periodDate.setHours(0, 0, 0, 0);
    const isFuturePeriod = periodDate > today;

    const complete = payload.find(p => p.dataKey === 'complete')?.value || 0;
    const remaining = payload.find(p => p.dataKey === 'remaining')?.value || 0;
    const expected = payload.find(p => p.dataKey === 'expected')?.value || 0;
    const total = complete + remaining;

    const progress = total > 0 ? ((complete / total) * 100).toFixed(1) : 0;
    const variance = complete - expected;
    const variancePercent = expected > 0 ? Math.abs((variance / expected) * 100).toFixed(1) : 0;

    // Determine variance status - don't show for future periods
    let varianceStatus = null;
    let varianceIcon = null;
    if (!isFuturePeriod && variance < 0) { // Behind schedule (only for past/current periods)
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

// Helper to check if HTML content from Quill is empty
const isHtmlEmpty = (html) => {
  if (!html) return true;
  // Strip HTML tags and check if there's actual content
  const textContent = html.replace(/<[^>]*>/g, '').trim();
  return textContent === '';
};

const MetricChart = ({ metricName, data, canEdit = false, canEditData, onDataChange, amberTolerance: initialAmberTolerance = 5.0, redTolerance: initialRedTolerance = 10.0, timeTravelTimestamp = null, projectId, onTimeTravelChange, onRevert, isAdmin, onToleranceChange, onTargetChange, onProgressionChange, onDescriptionChange, onDatesChange, currentUser, compactMode = false, showInPortfolioReview = true, onShowInPortfolioReviewChange, recentPeriodChanges = {} }) => {
  // canEditData is for commentary/data changes (blocked during time travel)
  // If not provided, default to canEdit for backwards compatibility
  const allowDataEdits = canEditData !== undefined ? canEditData : canEdit;

  const [amberTolerance, setAmberTolerance] = useState(initialAmberTolerance);
  const [redTolerance, setRedTolerance] = useState(initialRedTolerance);
  const [editingTolerance, setEditingTolerance] = useState(null); // 'amber' or 'red'
  const [tempToleranceValue, setTempToleranceValue] = useState('');
  const [editingProgression, setEditingProgression] = useState(false);
  const [tempProgressionValue, setTempProgressionValue] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [tempDescriptionValue, setTempDescriptionValue] = useState('');
  const [editingCell, setEditingCell] = useState(null); // { periodId, field }
  const [tempCellValue, setTempCellValue] = useState('');
  const [editingDates, setEditingDates] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');

  // Sync tolerances when props change
  useEffect(() => {
    setAmberTolerance(initialAmberTolerance);
    setRedTolerance(initialRedTolerance);
  }, [initialAmberTolerance, initialRedTolerance]);

  const handleToleranceClick = (type) => {
    if (!canEdit) return;
    setEditingTolerance(type);
    setTempToleranceValue(type === 'amber' ? amberTolerance : redTolerance);
  };

  const handleToleranceSave = async () => {
    if (!editingTolerance || !onToleranceChange) return;

    const newValue = parseFloat(tempToleranceValue);
    if (isNaN(newValue) || newValue < 0 || newValue > 100) {
      alert('Please enter a valid percentage between 0 and 100');
      return;
    }

    try {
      if (editingTolerance === 'amber') {
        await onToleranceChange(newValue, redTolerance);
        setAmberTolerance(newValue);
      } else {
        await onToleranceChange(amberTolerance, newValue);
        setRedTolerance(newValue);
      }
      setEditingTolerance(null);
    } catch (err) {
      console.error('Failed to update tolerance:', err);
      alert('Failed to update tolerance');
    }
  };

  const handleToleranceKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleToleranceSave();
    } else if (e.key === 'Escape') {
      setEditingTolerance(null);
    }
  };

  const handleProgressionClick = () => {
    if (!canEdit || !onProgressionChange) return;
    // If custom curve, show "custom" in picker, otherwise show the progression type
    const currentProgression = metricMetadata?.is_custom ? 'custom' : (metricMetadata?.progression_type || sortedData[0]?.progression_type || 'linear');
    setEditingProgression(true);
    setTempProgressionValue(currentProgression);
  };

  const handleProgressionSave = async () => {
    if (!onProgressionChange) return;

    // Check if value actually changed
    const currentValue = metricMetadata?.is_custom ? 'custom' : metricMetadata?.progression_type;
    if (tempProgressionValue === currentValue) {
      // No change, just close the editor
      setEditingProgression(false);
      return;
    }

    // Don't save if "custom" is selected - it means keep current values
    if (tempProgressionValue === 'custom') {
      setEditingProgression(false);
      return;
    }

    try {
      await onProgressionChange(tempProgressionValue);
      setEditingProgression(false);
    } catch (err) {
      console.error('Failed to update progression:', err);
      alert('Failed to update progression');
    }
  };

  const handleDescriptionClick = () => {
    if (!canEdit || !onDescriptionChange) return;
    const currentDescription = sortedData[0]?.metric_description || '';
    setEditingDescription(true);
    setTempDescriptionValue(currentDescription);
  };

  const handleDescriptionSave = async () => {
    if (!onDescriptionChange) return;

    try {
      await onDescriptionChange(tempDescriptionValue);
      setEditingDescription(false);
    } catch (err) {
      console.error('Failed to update description:', err);
      alert('Failed to update description');
    }
  };

  const handleDescriptionKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleDescriptionSave();
    } else if (e.key === 'Escape') {
      setEditingDescription(false);
    }
  };

  const handleDatesClick = () => {
    if (!canEdit || !onDatesChange) return;
    setEditingDates(true);
    setTempStartDate(metricMetadata?.start_date || '');
    setTempEndDate(metricMetadata?.end_date || '');
  };

  const handleDatesSave = async () => {
    if (!onDatesChange) return;

    // Validate dates
    if (!tempStartDate || !tempEndDate) {
      alert('Both start and end dates are required');
      return;
    }

    if (new Date(tempStartDate) >= new Date(tempEndDate)) {
      alert('End date must be after start date');
      return;
    }

    try {
      await onDatesChange(tempStartDate, tempEndDate);
      setEditingDates(false);
    } catch (err) {
      console.error('Failed to update dates:', err);
      alert('Failed to update dates');
    }
  };

  const handleDatesKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleDatesSave();
    } else if (e.key === 'Escape') {
      setEditingDates(false);
    }
  };

  const [isAdding, setIsAdding] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [comments, setComments] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [replyingToCommentId, setReplyingToCommentId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [expandedCommentThreads, setExpandedCommentThreads] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPoint, setDraggedPoint] = useState(null);
  const [highlightedSeries, setHighlightedSeries] = useState(null);
  const [isCommentaryCollapsed, setIsCommentaryCollapsed] = useState(true);
  const [isDataTableCollapsed, setIsDataTableCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('table'); // 'table', 'commentary', 'feedback', 'recovery', 'timetravel', or 'dependencies'
  const [feedbackData, setFeedbackData] = useState([]); // For checking recent feedback
  const [recoveryPlansData, setRecoveryPlansData] = useState([]); // For checking recent recovery plans
  const chartContainerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [periodsPerPage] = useState(12); // Show 12 periods at a time

  // Helper function to check if a value was recently updated (same day)
  const isRecentlyUpdated = (updatedAt) => {
    if (!updatedAt) return false;
    const today = new Date();
    const updateTime = new Date(updatedAt);
    return updateTime.toDateString() === today.toDateString();
  };

  // Check if a specific field on a period was recently changed
  const isPeriodFieldChanged = (periodId, fieldName) => {
    if (!periodId || !recentPeriodChanges) return false;
    const changes = recentPeriodChanges[periodId];
    if (!changes || !changes.fields) return false;
    return changes.fields.includes(fieldName);
  };

  // Sort data by date always for consistency
  const sortedData = [...data].sort((a, b) => {
    return new Date(a.reporting_date) - new Date(b.reporting_date);
  });

  // Helper function to calculate expected value based on progression type
  const calculateExpectedValue = (progressionType, finalTarget, periodIndex, totalPeriods) => {
    const ratio = periodIndex / totalPeriods;

    switch(progressionType) {
      case 'linear':
        return Math.round(finalTarget * ratio);
      case 's-curve':
        return Math.round(finalTarget / (1 + Math.exp(-10 * (ratio - 0.5))));
      case 'exponential':
        return Math.round(finalTarget * (Math.exp(3 * ratio) - 1) / (Math.exp(3) - 1));
      case 'logarithmic':
        return Math.round(finalTarget * Math.sqrt(ratio));
      default:
        return Math.round(finalTarget * ratio);
    }
  };

  // Get metric metadata from first data point (all periods have same metric metadata)
  // Note: Use metric_final_target (from metrics table) rather than final_target (from metric_periods.target)
  const baseMetadata = sortedData.length > 0 ? {
    start_date: sortedData[0].start_date,
    end_date: sortedData[0].end_date,
    frequency: sortedData[0].frequency,
    final_target: sortedData[0].metric_final_target || sortedData[0].final_target,
    progression_type: sortedData[0].progression_type
  } : null;

  // Check if the curve is custom (manually edited expected values)
  const isCustomCurve = baseMetadata ? (() => {
    const { progression_type, final_target } = baseMetadata;
    const totalPeriods = sortedData.length;

    // Check if any expected value differs from calculated progression
    for (let i = 0; i < sortedData.length; i++) {
      const calculatedExpected = calculateExpectedValue(progression_type, final_target, i + 1, totalPeriods);
      const actualExpected = sortedData[i].expected;

      // Allow for small rounding differences
      if (Math.abs(calculatedExpected - actualExpected) > 0.5) {
        return true;
      }
    }

    return false;
  })() : false;

  // Add is_custom flag to metadata
  const metricMetadata = baseMetadata ? {
    ...baseMetadata,
    is_custom: isCustomCurve
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

  // Calculate the last updated timestamp (max updated_at across all periods)
  const lastUpdated = sortedData.reduce((maxDate, item) => {
    if (!item.updated_at) return maxDate;
    const itemDate = new Date(item.updated_at);
    return !maxDate || itemDate > maxDate ? itemDate : maxDate;
  }, null);

  // Format relative time for last updated
  const formatRelativeTime = (date) => {
    if (!date) return null;
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

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

  // Load feedback data for checking recent items
  useEffect(() => {
    const loadFeedback = async () => {
      if (!projectId) return;
      try {
        const response = await api.get(`/feedback?project_id=${projectId}`);
        setFeedbackData(response.data);
      } catch (err) {
        console.error('Failed to load feedback for indicators:', err);
        setFeedbackData([]);
      }
    };
    loadFeedback();
  }, [projectId]);

  // Load recovery plans data for checking recent items
  useEffect(() => {
    const loadRecoveryPlans = async () => {
      if (!projectId) return;
      try {
        const response = await api.get(`/recovery-plans?project_id=${projectId}`);
        setRecoveryPlansData(response.data);
      } catch (err) {
        console.error('Failed to load recovery plans for indicators:', err);
        setRecoveryPlansData([]);
      }
    };
    loadRecoveryPlans();
  }, [projectId]);

  // Helper function to check if there are recent items (within last 24 hours)
  const hasRecentComments = () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const periodId in comments) {
      const periodComments = comments[periodId];
      if (periodComments.some(comment => new Date(comment.created_at) > twentyFourHoursAgo)) {
        return true;
      }
    }
    return false;
  };

  const hasRecentFeedback = () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return feedbackData.some(item => new Date(item.created_at) > twentyFourHoursAgo);
  };

  const hasRecentRecoveryPlans = () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return recoveryPlansData.some(item => new Date(item.created_at) > twentyFourHoursAgo);
  };

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

    // Use the period's specific target for gray bar calculation
    // This allows targets to change over time (scope changes)
    // item.final_target = period's specific target (from metric_periods.target)
    // item.metric_final_target = metric's overall target (from metrics.final_target)
    const metricFinalTarget = item.final_target;

    return {
      name: item.reporting_date,
      complete: item.complete,
      remaining: Math.max(0, metricFinalTarget - item.complete),
      expected: expectedValue,
      final_target: item.final_target,
      scopeDelta: scopeDelta,
      scopeChange: scopeChange,
      id: item.id,
      updated_at: item.updated_at
    };
  });

  // Find current period (closest date to today that is <= today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let currentPeriodIndex = -1;
  for (let i = chartData.length - 1; i >= 0; i--) {
    const periodDate = new Date(chartData[i].name);
    if (periodDate <= today) {
      currentPeriodIndex = i;
      break;
    }
  }

  // Check if today is within the metric's date range
  const metricStartDate = metricMetadata?.start_date ? new Date(metricMetadata.start_date) : null;
  const metricEndDate = metricMetadata?.end_date ? new Date(metricMetadata.end_date) : null;
  if (metricStartDate) metricStartDate.setHours(0, 0, 0, 0);
  if (metricEndDate) metricEndDate.setHours(0, 0, 0, 0);

  const isTodayInMetricRange = metricStartDate && metricEndDate &&
    today >= metricStartDate && today <= metricEndDate;

  // Calculate ReferenceArea bounds for current period highlight
  // Only show current period marker if today is within the metric's date range
  let currentPeriodX1 = null;
  let currentPeriodX2 = null;
  if (currentPeriodIndex >= 0 && isTodayInMetricRange) {
    currentPeriodX1 = chartData[currentPeriodIndex].name;
    // Highlight extends to next period or slightly beyond current if it's the last
    if (currentPeriodIndex < chartData.length - 1) {
      currentPeriodX2 = chartData[currentPeriodIndex + 1].name;
    } else {
      currentPeriodX2 = chartData[currentPeriodIndex].name;
    }
  }

  // Check if the metric needs a recovery plan (red/amber status without active plan)
  const needsRecoveryPlan = () => {
    // Don't show recovery plan requirement for historical metrics
    if (!isTodayInMetricRange) return false;

    // Get current period RAG status
    if (currentPeriodIndex < 0 || currentPeriodIndex >= sortedData.length) return false;
    const currentPeriod = sortedData[currentPeriodIndex];
    if (!currentPeriod) return false;

    // Calculate RAG status based on complete vs expected
    const complete = currentPeriod.complete || 0;
    const expected = currentPeriod.expected || 0;

    let ragStatus = 'green';
    if (complete === 0 && expected === 0) {
      ragStatus = 'grey';
    } else {
      const variance = ((complete - expected) / expected) * 100;
      if (variance < -redTolerance) {
        ragStatus = 'red';
      } else if (variance < -amberTolerance) {
        ragStatus = 'amber';
      }
    }

    // Check if red or amber and has no active recovery plan
    if (ragStatus === 'red' || ragStatus === 'amber') {
      const hasActivePlan = recoveryPlansData.some(plan => plan.status === 'active');
      return !hasActivePlan;
    }

    return false;
  };

  // Pagination calculations for data table
  const totalPeriods = chartData.length;
  const totalPages = Math.ceil(totalPeriods / periodsPerPage);
  const startIndex = currentPage * periodsPerPage;
  const endIndex = Math.min(startIndex + periodsPerPage, totalPeriods);
  const paginatedChartData = chartData.slice(startIndex, endIndex);

  // Pagination helper functions
  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToLatestPeriods = () => {
    setCurrentPage(totalPages - 1);
  };

  const goToCurrentPeriod = () => {
    if (currentPeriodIndex >= 0) {
      const pageContainingCurrentPeriod = Math.floor(currentPeriodIndex / periodsPerPage);
      setCurrentPage(pageContainingCurrentPeriod);
    }
  };

  const handleStartAdd = () => {
    setIsAdding(true);
    setSelectedDate('');
    setNewCommentText('');
  };

  const handleAddComment = async (parentCommentId = null) => {
    if (!selectedDate || isHtmlEmpty(newCommentText)) {
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
      const payload = { comment_text: newCommentText };
      if (parentCommentId) {
        payload.parent_comment_id = parentCommentId;
      }
      const createResponse = await api.createComment(period.id, payload);
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

  const handleReplyToComment = (comment) => {
    setReplyingToCommentId(comment.id);
    setReplyText('');
  };

  const handleCancelReply = () => {
    setReplyingToCommentId(null);
    setReplyText('');
  };

  const handleSubmitReply = async (parentComment) => {
    if (isHtmlEmpty(replyText)) {
      return;
    }

    try {
      await api.createComment(parentComment.period_id, {
        comment_text: replyText,
        parent_comment_id: parentComment.id
      });

      // Reload comments for this period
      const response = await api.getPeriodComments(parentComment.period_id);
      setComments(prev => ({
        ...prev,
        [parentComment.period_id]: response.data
      }));

      setReplyingToCommentId(null);
      setReplyText('');
      // Auto-expand the thread after adding a reply
      setExpandedCommentThreads(prev => ({ ...prev, [parentComment.id]: true }));
    } catch (err) {
      console.error('Failed to add reply:', err);
      alert(`Failed to add reply: ${err.response?.data?.error || err.message}`);
    }
  };

  const toggleCommentThread = (commentId) => {
    setExpandedCommentThreads(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  // Group comments: root comments and their replies
  const getGroupedComments = (commentsList) => {
    const rootComments = commentsList.filter(c => !c.parent_comment_id);
    const repliesMap = {};
    commentsList.filter(c => c.parent_comment_id).forEach(reply => {
      if (!repliesMap[reply.parent_comment_id]) {
        repliesMap[reply.parent_comment_id] = [];
      }
      repliesMap[reply.parent_comment_id].push(reply);
    });
    return { rootComments, repliesMap };
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
    if (isHtmlEmpty(editingCommentText)) {
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

  // Handle cell click to start editing
  const handleCellClick = (periodId, field, currentValue) => {
    if (!allowDataEdits) return;

    // Don't allow editing future periods' complete values
    const period = sortedData.find(p => p.id === periodId);
    if (!period) return;

    const periodDate = new Date(period.reporting_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (field === 'complete' && periodDate > today) {
      return; // Can't edit future complete values
    }

    setEditingCell({ periodId, field });
    setTempCellValue(currentValue);
  };

  // Handle cell value change
  const handleCellChange = (e) => {
    setTempCellValue(e.target.value);
  };

  // Save cell value on blur
  const handleCellBlur = async () => {
    if (!editingCell) return;

    const { periodId, field } = editingCell;
    const period = sortedData.find(p => p.id === periodId);
    if (!period) {
      setEditingCell(null);
      return;
    }

    const numericValue = parseFloat(tempCellValue);
    if (isNaN(numericValue) || tempCellValue === '') {
      // Invalid value, revert
      setEditingCell(null);
      return;
    }

    // Check if value actually changed
    if (numericValue === period[field]) {
      setEditingCell(null);
      return;
    }

    // For target changes, use the onTargetChange handler to update periods
    if (field === 'final_target' && onTargetChange) {
      setEditingCell(null);
      try {
        // Pass the period info so we know which period was edited
        const periodIndex = sortedData.findIndex(p => p.id === periodId);
        await onTargetChange(numericValue, metricMetadata?.is_custom || false, { periodId, periodIndex });
      } catch (err) {
        console.error('Failed to update target:', err);
        alert('Failed to update target');
      }
      return;
    }

    try {
      // Save the change
      await api.updatePeriod(periodId, {
        [field]: numericValue
      });

      // Refresh data to update chart
      if (onDataChange) {
        onDataChange();
      }

      setEditingCell(null);
    } catch (err) {
      console.error('Failed to save cell value:', err);
      if (err.response?.data?.isHistoricEdit) {
        alert(err.response.data.error + '\n\nOnly administrators can edit completion values for past periods.');
      } else {
        alert('Failed to save changes: ' + (err.response?.data?.error || err.message));
      }
      setEditingCell(null);
    }
  };

  // Handle Enter key to save
  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
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
    const chartHeight = 260; // Height of the ResponsiveContainer
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
        created_at: item.updated_at || item.reporting_date, // Use updated_at for highlighting, fallback to reporting_date
        updated_at: item.updated_at // Track when commentary was last updated
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

  // Determine best duration display - single unit only
  const getDurationDisplay = () => {
    if (!duration) return '';

    const { days, months, weeks } = duration;

    if (months >= 2) {
      return `${months} months`;
    } else if (weeks >= 2) {
      return `${weeks} weeks`;
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
      pdf.text(metricName, 15, 12);

      // Add date range if available
      if (metricMetadata) {
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Period: ${formatDate(metricMetadata.start_date)} - ${formatDate(metricMetadata.end_date)}`, 15, 18);
      }

      // Add chart image
      const imgWidth = 270;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 15, 24, imgWidth, imgHeight);

      // Add data table
      const tableData = chartData.map((item, index) => {
        const date = new Date(item.name);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Format date based on frequency
        let formattedDate;
        const frequency = metricMetadata?.frequency || 'monthly';

        // Check if date is valid
        if (isNaN(date.getTime())) {
          formattedDate = item.name || 'Invalid Date';
        } else if (frequency === 'weekly' || frequency === 'fortnightly') {
          // For weekly/fortnightly: show "DD MMM" format
          const day = String(date.getDate()).padStart(2, '0');
          const month = monthNames[date.getMonth()];
          formattedDate = `${day} ${month}`;
        } else if (frequency === 'monthly') {
          // For monthly: show month name
          formattedDate = monthNames[date.getMonth()];
        } else if (frequency === 'quarterly') {
          // For quarterly: show "Q1", "Q2", etc.
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          formattedDate = `Q${quarter} ${date.getFullYear()}`;
        } else {
          // Default to month name
          formattedDate = monthNames[date.getMonth()];
        }

        const variance = item.complete - item.expected;
        const variancePercent = item.expected > 0 ? ((variance / item.expected) * 100) : 0;

        // Get latest comment for this period
        const periodComments = comments[item.id] || [];
        const latestComment = periodComments.length > 0
          ? periodComments[periodComments.length - 1].comment_text
          : '';

        // Truncate comment if too long
        const truncatedComment = latestComment.length > 80
          ? latestComment.substring(0, 77) + '...'
          : latestComment;

        return [
          formattedDate,
          item.complete?.toFixed(1) || '0.0',
          item.expected?.toFixed(1) || '0.0',
          `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}`,
          `${variancePercent >= 0 ? '+' : ''}${variancePercent.toFixed(1)}%`,
          truncatedComment
        ];
      });

      autoTable(pdf, {
        startY: imgHeight + 28,
        head: [['Period', 'Complete', 'Expected', 'Variance', 'Variance %', 'Latest Comment']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [0, 174, 239],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          cellPadding: 1
        },
        styles: {
          fontSize: 8,
          cellPadding: 1,
          minCellHeight: 5
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 25 },
          1: { halign: 'center', cellWidth: 22 },
          2: { halign: 'center', cellWidth: 22 },
          3: { halign: 'center', cellWidth: 22 },
          4: { halign: 'center', cellWidth: 25 },
          5: { halign: 'left', cellWidth: 'auto' }
        }
      });

      // Add tolerances info
      const finalY = pdf.lastAutoTable?.finalY || imgHeight + 28;
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Tolerances: Amber >${amberTolerance}%, Red >${redTolerance}%`, 15, finalY + 6);

      pdf.save(`${metricName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.pdf`);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }} className={compactMode ? 'compact-mode' : ''}>
    <div className={`metric-chart-container ${compactMode ? 'compact' : ''}`}>
      {compactMode && (
        <div className="compact-metric-header">
          <div className="compact-metric-title">{metricName}</div>
          {sortedData[0]?.metric_description && (
            <div className="compact-metric-description" title={sortedData[0].metric_description}>
              {sortedData[0].metric_description}
            </div>
          )}
        </div>
      )}
      {!compactMode && metricMetadata && (
        <div className="metric-header-row">
          {editingDates ? (
            <div className="date-editor">
              <span className="date-label">Metric Period:</span>
              <input
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                onKeyDown={handleDatesKeyDown}
                autoFocus
              />
              <span className="date-range-separator">{'\u2192'}</span>
              <input
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                onKeyDown={handleDatesKeyDown}
              />
              <button className="save-btn" onClick={handleDatesSave}>Save</button>
              <button className="cancel-btn" onClick={() => setEditingDates(false)}>Cancel</button>
            </div>
          ) : (
            <div
              className={`metric-date-range ${canEdit && onDatesChange ? 'editable' : ''}`}
              onClick={canEdit && onDatesChange ? handleDatesClick : undefined}
              title={canEdit && onDatesChange ? 'Click to edit dates' : ''}
            >
              <span className="date-label">Metric Period:</span>
              <span className="date-value">{formatDate(metricMetadata.start_date)}</span>
              <span className="date-range-separator">{'\u2192'}</span>
              <span className="date-value">{formatDate(metricMetadata.end_date)}</span>
              {duration && (
                <>
                  <span className="date-range-separator">•</span>
                  <span className="date-value duration">{getDurationDisplay()}</span>
                </>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '4px' }}>
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

      {/* Metric Properties Row - hidden in compact mode */}
      {metricMetadata && !compactMode && (
        <div className="metric-properties-row" style={{ display: 'flex', gap: '12px', padding: '4px 0', borderBottom: '1px solid #e5e7eb' }}>
          <div className="metric-property">
            <span className="property-label">Progression:</span>
            {editingProgression && onProgressionChange ? (
              <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                <select
                  className="progression-select"
                  value={tempProgressionValue}
                  onChange={(e) => setTempProgressionValue(e.target.value)}
                  onBlur={handleProgressionSave}
                  autoFocus
                  style={{ fontSize: '12px', padding: '2px 6px' }}
                >
                  <option value="custom">Custom (Keep manual values)</option>
                  <option value="linear">Linear</option>
                  <option value="exponential">Exponential (Back-loaded)</option>
                  <option value="s-curve">S-curve</option>
                  <option value="logarithmic">Logarithmic (Front-loaded)</option>
                </select>
                <button onClick={handleProgressionSave} style={{ fontSize: '11px', padding: '2px 6px' }}>✓</button>
                <button onClick={() => setEditingProgression(false)} style={{ fontSize: '11px', padding: '2px 6px' }}>✕</button>
              </div>
            ) : (
              <span
                className={`property-value ${metricMetadata.is_custom ? 'custom-curve' : ''}`}
                onClick={handleProgressionClick}
                style={canEdit && onProgressionChange ? { cursor: 'pointer', textDecoration: 'underline dotted' } : {}}
                title={canEdit && onProgressionChange ? 'Click to edit progression type' : (metricMetadata.is_custom ? 'Expected values have been manually customized' : '')}
              >
                {metricMetadata.is_custom ? 'Custom' :
                 metricMetadata.progression_type === 'linear' ? 'Linear' :
                 metricMetadata.progression_type === 'exponential' ? 'Exponential' :
                 metricMetadata.progression_type === 's-curve' ? 'S-curve' :
                 metricMetadata.progression_type === 'logarithmic' ? 'Logarithmic' :
                 metricMetadata.progression_type || 'Linear'}
              </span>
            )}
          </div>
          {/* Description - inline with other properties */}
          {(sortedData[0]?.metric_description || (canEdit && onDescriptionChange)) && (
            <div className="metric-property" style={{ flex: 1 }}>
              {editingDescription && onDescriptionChange ? (
                <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', width: '100%' }}>
                  <ClarityIndicator text={tempDescriptionValue} size="sm" compact contentType="description" />
                  <input
                    type="text"
                    value={tempDescriptionValue}
                    onChange={(e) => setTempDescriptionValue(e.target.value)}
                    onKeyDown={handleDescriptionKeyDown}
                    onBlur={handleDescriptionSave}
                    placeholder="Enter metric description..."
                    autoFocus
                    style={{ flex: 1, fontSize: '12px', padding: '2px 6px' }}
                  />
                  <button onClick={handleDescriptionSave} style={{ fontSize: '11px', padding: '2px 6px' }}>✓</button>
                  <button onClick={() => setEditingDescription(false)} style={{ fontSize: '11px', padding: '2px 6px' }}>✕</button>
                </div>
              ) : (
                <div className="metric-description-wrapper" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <ClarityIndicator text={sortedData[0]?.metric_description} size="sm" compact hoverReveal contentType="description" />
                  <span
                    className={`metric-description-text ${canEdit && onDescriptionChange ? 'editable' : ''} ${sortedData[0]?.metric_description ? 'filled' : 'placeholder'}`}
                    onClick={handleDescriptionClick}
                    title={canEdit && onDescriptionChange ? 'Click to edit description' : ''}
                  >
                    {sortedData[0]?.metric_description || (canEdit && onDescriptionChange ? 'Add a description of precisely what the metric measures here...' : '')}
                  </span>
                </div>
              )}
            </div>
          )}
          {/* Portfolio Review Toggle */}
          {canEdit && onShowInPortfolioReviewChange && (
            <div className="metric-property" style={{ marginLeft: 'auto' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#6b7280' }}>
                <input
                  type="checkbox"
                  checked={showInPortfolioReview}
                  onChange={(e) => onShowInPortfolioReviewChange(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Show in Portfolio Review</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Chart and Legend Container */}
      <div className="chart-and-legend-container">
        <div ref={chartContainerRef} style={{ position: 'relative' }}>
            <ResponsiveContainer width="100%" height={compactMode ? 180 : 260}>
              <ComposedChart
                data={chartData}
                margin={compactMode ? { top: 10, right: 10, left: 10, bottom: 5 } : { top: 10, right: 20, left: 20, bottom: 5 }}
              >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            height={50}
            tick={<CustomXAxisTick data={chartData} />}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => formatNumber(value)}
            domain={[0, 'dataMax']}
          />
          <Tooltip content={<CustomTooltip amberTolerance={amberTolerance} redTolerance={redTolerance} />} />
          <Bar dataKey="complete" stackId="a" name="Complete" animationDuration={800} animationBegin={0}>
            {chartData.map((entry, index) => {
              // Calculate variance for this period
              const variance = entry.complete - entry.expected;
              const variancePercent = entry.expected > 0 ? Math.abs((variance / entry.expected) * 100) : 0;

              // Determine color based on variance and tolerances
              let barColor = RAG_COLORS.green; // Green - on track or ahead
              let barCategory = 'green';

              // Check if period has actual completion data
              const hasData = entry.complete !== null && entry.complete !== undefined && entry.complete > 0;

              // Check if this period has ended (next period has started)
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const periodDate = new Date(entry.name);
              periodDate.setHours(0, 0, 0, 0);

              // Get next period date if it exists
              const nextPeriod = chartData[index + 1];
              const periodHasEnded = nextPeriod
                ? today >= new Date(nextPeriod.name)
                : false; // Last period is considered ongoing

              // Only apply red/amber if period has ended OR if there's data showing we're behind
              // If period is still ongoing and no data, keep it green (grey would be better but we don't have that option for bars)
              if (hasData && variance < 0) { // Behind schedule with data
                if (variancePercent > redTolerance) {
                  barColor = RAG_COLORS.red; // Red
                  barCategory = 'red';
                } else if (variancePercent > amberTolerance) {
                  barColor = RAG_COLORS.amber; // Amber
                  barCategory = 'amber';
                }
              } else if (!hasData && periodHasEnded) {
                // Period has ended but no data - mark as red
                barColor = RAG_COLORS.red;
                barCategory = 'red';
              }

              // Apply opacity based on highlightedSeries
              const opacity = highlightedSeries === null || highlightedSeries === barCategory ? 1 : 0.3;

              return <Cell key={`cell-${index}`} fill={barColor} fillOpacity={opacity} />;
            })}
            <LabelList
              content={({ x, width, index }) => {
                const item = chartData[index];
                if (!item) return null;

                // Check if this is the current period
                const isCurrentPeriod = currentPeriodX1 === item.name;
                if (!isCurrentPeriod) return null;

                return (
                  <text
                    x={x + width / 2}
                    y={compactMode ? 5 : 5}
                    fill={RAG_COLORS.red}
                    textAnchor="middle"
                    fontSize={compactMode ? "14" : "20"}
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
            fillOpacity={highlightedSeries === null || highlightedSeries === 'remaining' ? 0.6 : 0.2}
          />

          <Line
            type="monotone"
            dataKey="expected"
            stroke={BARCLAYS_BLUE}
            strokeWidth={2}
            name="Expected"
            animationDuration={1000}
            animationBegin={400}
            strokeOpacity={highlightedSeries === null || highlightedSeries === 'expected' ? 1 : 0.3}
            dot={canEdit ? { r: 4, fill: BARCLAYS_BLUE, stroke: "#fff", strokeWidth: 1, cursor: 'pointer' } : compactMode ? { r: 2, fill: BARCLAYS_BLUE } : { r: 3 }}
            activeDot={canEdit ? {
              r: 12,
              fill: BARCLAYS_BLUE,
              stroke: "#fff",
              strokeWidth: 2,
              cursor: 'ns-resize',
              fillOpacity: 0.3,
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
          {/* Last updated timestamp */}
          {lastUpdated && (
            <div className="last-updated-container">
              <span className="last-updated" title={`Metrics last updated: ${lastUpdated.toLocaleString('en-GB')}`}>
                Metrics updated {formatRelativeTime(lastUpdated)}
              </span>
            </div>
          )}
        </div>

        {/* Custom Legend - compact version for multi-metric view */}
        <div className={`custom-legend ${compactMode ? 'compact-legend' : ''}`}>
          {!compactMode && <div className="legend-title">Legend</div>}

          <div className="legend-items">
            {!compactMode && (
              <div
                className={`legend-item ${highlightedSeries === 'green' ? 'active' : ''}`}
                onMouseEnter={() => setHighlightedSeries('green')}
                onMouseLeave={() => setHighlightedSeries(null)}
                title="Healthy"
              >
                <div className="legend-indicator" style={{ backgroundColor: RAG_COLORS.green }}></div>
                <span className="legend-text">Green: Healthy</span>
              </div>
            )}
            <div
              className={`legend-item ${highlightedSeries === 'amber' ? 'active' : ''}`}
              onMouseEnter={() => setHighlightedSeries('amber')}
              onMouseLeave={() => setHighlightedSeries(null)}
              title={`>${amberTolerance}% behind`}
            >
              <div className="legend-indicator" style={{ backgroundColor: RAG_COLORS.amber }}></div>
              {compactMode ? (
                <span className="legend-text">&gt;{amberTolerance}%</span>
              ) : editingTolerance === 'amber' ? (
                <span className="legend-text">
                  Amber: &gt;
                  <input
                    type="number"
                    className="tolerance-input"
                    value={tempToleranceValue}
                    onChange={(e) => setTempToleranceValue(e.target.value)}
                    onKeyDown={handleToleranceKeyDown}
                    onBlur={handleToleranceSave}
                    autoFocus
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  % behind
                </span>
              ) : (
                <span
                  className="legend-text"
                  onClick={() => handleToleranceClick('amber')}
                  style={canEdit ? { cursor: 'pointer' } : {}}
                  title={canEdit ? 'Click to edit tolerance' : ''}
                >
                  Amber: &gt;{amberTolerance}% behind
                </span>
              )}
            </div>
            <div
              className={`legend-item ${highlightedSeries === 'red' ? 'active' : ''}`}
              onMouseEnter={() => setHighlightedSeries('red')}
              onMouseLeave={() => setHighlightedSeries(null)}
              title={`>${redTolerance}% behind`}
            >
              <div className="legend-indicator" style={{ backgroundColor: RAG_COLORS.red }}></div>
              {compactMode ? (
                <span className="legend-text">&gt;{redTolerance}%</span>
              ) : editingTolerance === 'red' ? (
                <span className="legend-text">
                  Red: &gt;
                  <input
                    type="number"
                    className="tolerance-input"
                    value={tempToleranceValue}
                    onChange={(e) => setTempToleranceValue(e.target.value)}
                    onKeyDown={handleToleranceKeyDown}
                    onBlur={handleToleranceSave}
                    autoFocus
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  % behind
                </span>
              ) : (
                <span
                  className="legend-text"
                  onClick={() => handleToleranceClick('red')}
                  style={canEdit ? { cursor: 'pointer' } : {}}
                  title={canEdit ? 'Click to edit tolerance' : ''}
                >
                  Red: &gt;{redTolerance}% behind
                </span>
              )}
            </div>
            <div
              className={`legend-item ${highlightedSeries === 'remaining' ? 'active' : ''}`}
              onMouseEnter={() => setHighlightedSeries('remaining')}
              onMouseLeave={() => setHighlightedSeries(null)}
              title="Remaining"
            >
              <div className="legend-indicator" style={{ backgroundColor: '#d1d5db' }}></div>
              <span className="legend-text">Remaining</span>
            </div>
            <div
              className={`legend-item ${highlightedSeries === 'expected' ? 'active' : ''}`}
              onMouseEnter={() => setHighlightedSeries('expected')}
              onMouseLeave={() => setHighlightedSeries(null)}
              title="Expected"
            >
              <div className="legend-indicator line" style={{ backgroundColor: BARCLAYS_BLUE }}></div>
              <span className="legend-text">Expected</span>
            </div>
          </div>
        </div>

        {/* Commentary Sidebar - shows next to chart in non-compact mode */}
        {!compactMode && (
          <div className="commentary-sidebar">
            <div className="commentary-sidebar-header">
              <span className="commentary-sidebar-title">Commentary</span>
              {!isAdding && allowDataEdits && (
                <button className="add-btn-small" onClick={handleStartAdd}>
                  + Add
                </button>
              )}
            </div>
            <div className="commentary-sidebar-content">
              {isAdding ? (
                <div className="commentary-add-mode-sidebar">
                  <div className="comment-date-selector">
                    <select
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="comment-date-select"
                    >
                      <option value="">Select date...</option>
                      {sortedData.map((item) => (
                        <option key={item.id} value={item.reporting_date}>
                          {item.reporting_date}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ReactQuill
                    theme="snow"
                    value={newCommentText}
                    onChange={setNewCommentText}
                    placeholder="Add comment..."
                    className="commentary-quill-sidebar"
                    modules={{
                      toolbar: [
                        ['bold', 'italic', 'underline'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['link'],
                        ['clean']
                      ]
                    }}
                  />
                  <div className="commentary-actions-sidebar">
                    <ClarityIndicator text={newCommentText} size="sm" />
                    <div className="action-buttons">
                      <button className="save-btn-small" onClick={() => handleAddComment()}>Add</button>
                      <button className="cancel-btn-small" onClick={handleCancelAdd}>Cancel</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="commentary-list-sidebar">
                  {allComments.length > 0 ? (
                    (() => {
                      const { rootComments, repliesMap } = getGroupedComments(allComments);
                      return rootComments.map((comment, index) => {
                        const replies = repliesMap[comment.id] || [];
                        const isExpanded = expandedCommentThreads[comment.id];

                        return (
                          <div key={comment.id}>
                            <div className={`commentary-item-sidebar ${index === 0 ? 'latest' : ''} ${comment.is_system ? 'system' : ''} ${isRecentlyUpdated(comment.created_at) ? 'recently-changed-cell' : ''}`} style={{ padding: '4px 6px' }}>
                              {editingCommentId === comment.id ? (
                                <div className="editing-comment-sidebar">
                                  <ReactQuill
                                    theme="snow"
                                    value={editingCommentText}
                                    onChange={setEditingCommentText}
                                    className="commentary-quill-sidebar"
                                    modules={{
                                      toolbar: [
                                        ['bold', 'italic', 'underline'],
                                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                        ['link'],
                                        ['clean']
                                      ]
                                    }}
                                  />
                                  <div className="commentary-actions-sidebar" style={{ marginTop: '2px' }}>
                                    <ClarityIndicator text={editingCommentText} size="sm" />
                                    <div className="action-buttons">
                                      <button className="save-btn-small" onClick={() => handleSaveComment(comment.id, comment.period_id)}>Save</button>
                                      <button className="cancel-btn-small" onClick={handleCancelEdit}>Cancel</button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="comment-header-sidebar" style={{ gap: '4px', marginBottom: '1px' }}>
                                    <span className="comment-date-sidebar" style={{ fontSize: '10px' }}>{comment.reporting_date}</span>
                                    <ClarityIndicator text={comment.comment_text} size="sm" compact hoverReveal />
                                    <span className="comment-meta-sidebar" style={{ fontSize: '10px' }}>
                                      {comment.created_by_name && !comment.is_system && comment.created_by_name}
                                      {comment.is_system && 'System'}
                                      {allowDataEdits && !comment.is_system && (
                                        <button onClick={() => handleReplyToComment(comment)} title="Reply" style={{ marginRight: '2px', fontSize: '10px' }}>↩</button>
                                      )}
                                      {allowDataEdits && (isAdmin || !comment.is_system) && (
                                        <>
                                          <button onClick={() => handleEditComment(comment)} title="Edit" style={{ fontSize: '10px' }}>✎</button>
                                          <button onClick={() => handleDeleteComment(comment.id, comment.period_id)} title="Delete" style={{ fontSize: '10px' }}>×</button>
                                        </>
                                      )}
                                    </span>
                                  </div>
                                  <div className="comment-text-sidebar ql-editor" style={{ fontSize: '11px', lineHeight: '1.3', padding: '0' }} dangerouslySetInnerHTML={{ __html: comment.comment_text }} />
                                </>
                              )}
                            </div>

                            {/* Show replies count and toggle */}
                            {replies.length > 0 && (
                              <div style={{ marginLeft: '6px', marginBottom: '2px' }}>
                                <button
                                  onClick={() => toggleCommentThread(comment.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    color: '#6b7280',
                                    padding: '2px 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                >
                                  <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: '8px' }}>▶</span>
                                  {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                                </button>

                                {/* Collapsed replies */}
                                {isExpanded && (
                                  <div style={{ marginLeft: '6px', borderLeft: '2px solid #e5e7eb', paddingLeft: '6px' }}>
                                    {replies.map((reply) => (
                                      <div key={reply.id} className={`commentary-item-sidebar reply ${reply.is_system ? 'system' : ''} ${isRecentlyUpdated(reply.created_at) ? 'recently-changed-cell' : ''}`} style={{ padding: '3px 6px', fontSize: '0.9em' }}>
                                        {editingCommentId === reply.id ? (
                                          <div className="editing-comment-sidebar">
                                            <ReactQuill
                                              theme="snow"
                                              value={editingCommentText}
                                              onChange={setEditingCommentText}
                                              className="commentary-quill-sidebar"
                                              modules={{ toolbar: [['bold', 'italic', 'underline'], ['clean']] }}
                                            />
                                            <div className="commentary-actions-sidebar" style={{ marginTop: '2px' }}>
                                              <div className="action-buttons">
                                                <button className="save-btn-small" onClick={() => handleSaveComment(reply.id, reply.period_id)}>Save</button>
                                                <button className="cancel-btn-small" onClick={handleCancelEdit}>Cancel</button>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="comment-header-sidebar" style={{ gap: '3px', marginBottom: '1px' }}>
                                              <span className="comment-date-sidebar" style={{ fontSize: '9px' }}>{reply.reporting_date}</span>
                                              <span className="comment-meta-sidebar" style={{ fontSize: '9px' }}>
                                                {reply.created_by_name && !reply.is_system && reply.created_by_name}
                                                {reply.is_system && 'System'}
                                                {allowDataEdits && (isAdmin || !reply.is_system) && (
                                                  <>
                                                    <button onClick={() => handleEditComment(reply)} title="Edit" style={{ fontSize: '9px' }}>✎</button>
                                                    <button onClick={() => handleDeleteComment(reply.id, reply.period_id)} title="Delete" style={{ fontSize: '9px' }}>×</button>
                                                  </>
                                                )}
                                              </span>
                                            </div>
                                            <div className="comment-text-sidebar ql-editor" style={{ fontSize: '10px', lineHeight: '1.3', padding: '0' }} dangerouslySetInnerHTML={{ __html: reply.comment_text }} />
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Reply form */}
                            {replyingToCommentId === comment.id && (
                              <div className="reply-form-sidebar" style={{ marginLeft: '6px', marginTop: '2px', marginBottom: '4px', paddingLeft: '6px', borderLeft: '2px solid #00aeef' }}>
                                <ReactQuill
                                  theme="snow"
                                  value={replyText}
                                  onChange={setReplyText}
                                  placeholder="Write a reply..."
                                  className="commentary-quill-sidebar"
                                  modules={{ toolbar: [['bold', 'italic', 'underline'], ['clean']] }}
                                />
                                <div className="commentary-actions-sidebar" style={{ marginTop: '2px' }}>
                                  <div className="action-buttons">
                                    <button className="save-btn-small" onClick={() => handleSubmitReply(comment)}>Reply</button>
                                    <button className="cancel-btn-small" onClick={handleCancelReply}>Cancel</button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()
                  ) : (
                    <div className="no-comments-sidebar">No comments yet</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Compact Mode: Show just the latest commentary */}
      {compactMode && allComments.length > 0 && (
        <div className="compact-commentary">
          <div className="compact-commentary-text ql-editor" dangerouslySetInnerHTML={{ __html: allComments[0].comment_text }} />
          <div className="compact-commentary-date">
            {formatDate(allComments[0].reporting_date)}
          </div>
        </div>
      )}

      {/* Tabbed Section - Latest Progress, Time Travel, and Dependencies */}
      {!compactMode && <div className="tabbed-section">
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            Latest Progress
          </button>
          {projectId && onTimeTravelChange && currentUser && (
            <button
              className={`tab-button ${activeTab === 'timetravel' ? 'active' : ''}`}
              onClick={() => setActiveTab('timetravel')}
            >
              Time Travel
            </button>
          )}
          {/* DISABLED: CRAIDs/Dependencies feature hidden
          <button
            className={`tab-button ${activeTab === 'dependencies' ? 'active' : ''}`}
            onClick={() => setActiveTab('dependencies')}
          >
            Dependencies
          </button>
          */}
        </div>

        {/* Latest Progress Tab Content */}
        {activeTab === 'table' && (
          <div className="tab-content">
            <div className="data-table-header">
              {totalPeriods > periodsPerPage && (
                <div className="pagination-controls">
                  <button
                    onClick={goToCurrentPeriod}
                    disabled={currentPeriodIndex < 0 || !isTodayInMetricRange}
                    className="pagination-btn"
                    title={isTodayInMetricRange ? "Jump to current period" : "Current date is outside metric range"}
                  >
                    Current
                  </button>
                  <button
                    onClick={goToLatestPeriods}
                    disabled={currentPage === totalPages - 1}
                    className="pagination-btn"
                    title="Jump to latest periods"
                  >
                    Latest
                  </button>
                  <button
                    onClick={goToPrevPage}
                    disabled={currentPage === 0}
                    className="pagination-btn"
                  >
                    ← Previous
                  </button>
                  <span className="pagination-info">
                    {startIndex + 1}-{endIndex} of {totalPeriods}
                  </span>
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages - 1}
                    className="pagination-btn"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
            <div className="data-table-section">
        <table className="data-table">
          <thead>
            <tr>
              <th className="row-header"></th>
              {paginatedChartData.map((item, index) => {
                // Format date for table header
                const date = new Date(item.name);
                let formattedDate;

                // Check if date is valid
                if (isNaN(date.getTime())) {
                  // Log the problematic data for debugging
                  console.error('🔴 Invalid date in Latest Progress table:');
                  console.error('  - item.name:', item.name, '(type:', typeof item.name, ')');
                  console.error('  - item.id:', item.id);
                  console.error('  - Full item:', item);
                  // Display the original value so user can see what's wrong
                  formattedDate = String(item.name || 'No Date');
                } else {
                  const day = String(date.getDate()).padStart(2, '0');
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const year = date.getFullYear();
                  formattedDate = `${day}/${month}/${year}`;
                }

                return (
                  <th
                    key={index}
                    className="period-header"
                  >
                    {formattedDate}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Complete Row */}
            <tr className="data-row">
              <td className="row-label">Complete</td>
              {paginatedChartData.map((item, index) => {
                const variance = item.complete - item.expected;
                const variancePercent = item.expected > 0 ? Math.abs((variance / item.expected) * 100) : 0;
                const cutoffDate = timeTravelTimestamp ? new Date(timeTravelTimestamp) : new Date();
                const periodDate = new Date(item.name);
                const isValidDate = !isNaN(periodDate.getTime());
                const isPastOrCurrent = isValidDate ? periodDate <= cutoffDate : false;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isFuture = isValidDate ? periodDate > today : false;
                const isEditing = editingCell?.periodId === item.id && editingCell?.field === 'complete';

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

                const completeFieldChanged = isPeriodFieldChanged(item.id, 'complete_value');
                return (
                  <td
                    key={index}
                    className={`number-cell ${statusClass} ${allowDataEdits && !isFuture ? 'editable-cell' : ''} ${completeFieldChanged ? 'recently-changed-cell' : ''}`}
                    onClick={() => allowDataEdits && !isFuture && handleCellClick(item.id, 'complete', item.complete)}
                    style={allowDataEdits && !isFuture ? { cursor: 'pointer' } : {}}
                    title={completeFieldChanged ? 'Recently updated' : ''}
                  >
                    {isEditing ? (
                      <input
                        type="number"
                        value={tempCellValue}
                        onChange={handleCellChange}
                        onBlur={handleCellBlur}
                        onKeyDown={handleCellKeyDown}
                        autoFocus
                        style={{ width: '100%', textAlign: 'right' }}
                      />
                    ) : (
                      <span className={completeFieldChanged ? 'recently-changed-value' : ''}>
                        {formatNumber(item.complete)}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Expected Row */}
            <tr className="data-row">
              <td className="row-label">Expected</td>
              {paginatedChartData.map((item, index) => {
                const isEditing = editingCell?.periodId === item.id && editingCell?.field === 'expected';
                const expectedFieldChanged = isPeriodFieldChanged(item.id, 'expected');
                return (
                  <td
                    key={index}
                    className={`number-cell ${allowDataEdits ? 'editable-cell' : ''} ${expectedFieldChanged ? 'recently-changed-cell' : ''}`}
                    onClick={() => handleCellClick(item.id, 'expected', item.expected)}
                    style={allowDataEdits ? { cursor: 'pointer' } : {}}
                    title={expectedFieldChanged ? 'Recently updated' : ''}
                  >
                    {isEditing ? (
                      <input
                        type="number"
                        value={tempCellValue}
                        onChange={handleCellChange}
                        onBlur={handleCellBlur}
                        onKeyDown={handleCellKeyDown}
                        autoFocus
                        style={{ width: '100%', textAlign: 'right' }}
                      />
                    ) : (
                      <span className={expectedFieldChanged ? 'recently-changed-value' : ''}>
                        {formatNumber(item.expected)}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Target Row */}
            <tr className="data-row">
              <td className="row-label target-label">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                  <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1"/>
                  <circle cx="6" cy="6" r="3.5" stroke="currentColor" strokeWidth="1"/>
                  <circle cx="6" cy="6" r="1.5" fill="currentColor"/>
                </svg>
                Target
              </td>
              {paginatedChartData.map((item, index) => {
                const isEditing = editingCell?.periodId === item.id && editingCell?.field === 'final_target';
                const targetFieldChanged = isPeriodFieldChanged(item.id, 'final_target');
                return (
                  <td
                    key={index}
                    className={`number-cell target-cell ${allowDataEdits ? 'editable-cell' : ''} ${targetFieldChanged ? 'recently-changed-cell' : ''}`}
                    onClick={() => allowDataEdits && handleCellClick(item.id, 'final_target', item.final_target)}
                    style={allowDataEdits ? { cursor: 'pointer' } : {}}
                    title={targetFieldChanged ? 'Recently updated' : ''}
                  >
                    {isEditing ? (
                      <input
                        type="number"
                        value={tempCellValue}
                        onChange={handleCellChange}
                        onBlur={handleCellBlur}
                        onKeyDown={handleCellKeyDown}
                        autoFocus
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '4px',
                          border: '1px solid #00aeef',
                          borderRadius: '2px',
                          fontSize: '13px'
                        }}
                      />
                    ) : (
                      <span className={targetFieldChanged ? 'recently-changed-value' : ''}>
                        {formatNumber(item.final_target)}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
            </div>
          </div>
        )}

        {/* Time Travel Tab Content */}
        {activeTab === 'timetravel' && projectId && onTimeTravelChange && currentUser && (
          <div className="tab-content">
            <TimeTravel
              projectId={projectId}
              onTimeTravelChange={onTimeTravelChange}
              onRevert={onRevert}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {/* DISABLED: CRAIDs/Dependencies feature hidden
        {activeTab === 'dependencies' && projectId && (
          <div className="tab-content">
            <CRAIDs projectId={projectId} canEdit={allowDataEdits} />
          </div>
        )}
        */}
      </div>}
    </div>
    </div>
  );
};

export default MetricChart;
