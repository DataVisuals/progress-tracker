import React from 'react';

/**
 * Sparkline component - displays a mini line chart for trend visualization
 * @param {Array} data - Array of objects with 'complete', 'expected', and optional 'date' values
 * @param {number} width - Width of the sparkline (default: 60)
 * @param {number} height - Height of the sparkline (default: 20)
 * @param {string} color - Line color (default: based on trend)
 * @param {boolean} showExpected - Show expected line (default: true)
 * @param {boolean} showTooltip - Show tooltip on hover (default: true)
 */
const Sparkline = ({
  data = [],
  width = 60,
  height = 20,
  color = null,
  showExpected = true,
  showTooltip = true
}) => {
  if (!data || data.length < 2) {
    return null;
  }

  // Extract complete and expected values
  const completeValues = data.map(d => d.complete ?? 0);
  const expectedValues = data.map(d => d.expected ?? 0);

  // Find min and max for scaling (include both complete and expected)
  const allValues = [...completeValues, ...expectedValues].filter(v => v !== null && v !== undefined);
  if (allValues.length === 0) return null;

  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;

  // Scale values to fit in the chart area with padding
  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const scaleY = (val) => {
    if (val === null || val === undefined) return null;
    return padding + chartHeight - ((val - minVal) / range) * chartHeight;
  };

  const scaleX = (idx) => padding + (idx / (data.length - 1)) * chartWidth;

  // Create path for complete line
  const completePath = completeValues
    .map((val, idx) => {
      const y = scaleY(val);
      if (y === null) return null;
      const x = scaleX(idx);
      return idx === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .filter(Boolean)
    .join(' ');

  // Create path for expected line
  const expectedPath = expectedValues
    .map((val, idx) => {
      const y = scaleY(val);
      if (y === null) return null;
      const x = scaleX(idx);
      return idx === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .filter(Boolean)
    .join(' ');

  // Determine trend color (compare last complete vs expected)
  const lastComplete = completeValues[completeValues.length - 1];
  const lastExpected = expectedValues[expectedValues.length - 1];
  const variance = lastComplete - lastExpected;

  let lineColor = color;
  if (!lineColor) {
    if (variance >= 0) {
      lineColor = '#10b981'; // green - on track or ahead
    } else {
      const variancePercent = lastExpected > 0 ? Math.abs(variance / lastExpected) * 100 : 0;
      if (variancePercent > 10) {
        lineColor = '#ef4444'; // red - significantly behind
      } else if (variancePercent > 5) {
        lineColor = '#f59e0b'; // amber - slightly behind
      } else {
        lineColor = '#10b981'; // green - within tolerance
      }
    }
  }

  // Generate tooltip text
  const generateTooltip = () => {
    if (!showTooltip) return null;

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    };

    const firstDate = data[0]?.date;
    const lastDate = data[data.length - 1]?.date;
    const dateRange = firstDate && lastDate
      ? `${formatDate(firstDate)} - ${formatDate(lastDate)}`
      : `${data.length} periods`;

    // Find when status first went red (complete < expected by >10%)
    let statusChangeInfo = '';
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const varPct = d.expected > 0 ? ((d.complete - d.expected) / d.expected) * 100 : 0;
      if (varPct < -10) {
        const changeDate = d.date ? formatDate(d.date) : `Period ${i + 1}`;
        statusChangeInfo = `\nRed since: ${changeDate}`;
        break;
      }
    }

    return `Trend: ${dateRange}${statusChangeInfo}`;
  };

  const tooltipText = generateTooltip();

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'inline-block', verticalAlign: 'middle', cursor: 'help' }}
    >
      {tooltipText && <title>{tooltipText}</title>}
      {/* Expected line (dashed, lighter) */}
      {showExpected && expectedPath && (
        <path
          d={expectedPath}
          fill="none"
          stroke="#9ca3af"
          strokeWidth="1"
          strokeDasharray="2,2"
          strokeOpacity="0.6"
        />
      )}

      {/* Complete line (solid) */}
      {completePath && (
        <path
          d={completePath}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* End dot */}
      {completePath && (
        <circle
          cx={scaleX(completeValues.length - 1)}
          cy={scaleY(lastComplete)}
          r="2"
          fill={lineColor}
        />
      )}
    </svg>
  );
};

export default Sparkline;
