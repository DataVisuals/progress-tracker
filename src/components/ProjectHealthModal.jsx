import React, { useMemo } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { MdClose, MdCheckCircle, MdWarning, MdError, MdInfo } from 'react-icons/md';
import { calculateClarityScore } from '../utils/clarityScore';
import './ProjectHealthModal.css';

// Helper to calculate when a period ends based on its start date and frequency
// A period should only be evaluated after it has ended
const getPeriodEndDate = (reportingDate, frequency) => {
  const startDate = new Date(reportingDate);
  startDate.setHours(0, 0, 0, 0);

  switch (frequency) {
    case 'weekly':
      return new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'fortnightly':
      return new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    case 'monthly':
      // Period ends at start of next month
      return new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
    case 'quarterly':
      // Period ends at start of next quarter
      return new Date(startDate.getFullYear(), startDate.getMonth() + 3, 1);
    default:
      // Default to monthly if unknown
      return new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
  }
};

// Check if a period has ended (should have data by now)
const hasPeriodEnded = (reportingDate, frequency, today) => {
  const periodEnd = getPeriodEndDate(reportingDate, frequency);
  return today >= periodEnd;
};

// Helper function to get red metrics (used by both exported function and modal)
// Only considers periods that have ENDED (based on frequency) - not current active periods
const getRedMetrics = (data, metricsList) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return metricsList.filter(metric => {
    const metricPeriods = data.filter(p => p.metric_id === metric.id);
    const sortedPeriods = [...metricPeriods].sort((a, b) =>
      new Date(a.reporting_date) - new Date(b.reporting_date)
    );

    // Find the most recent ENDED period (not just any period <= today)
    let currentPeriod = null;
    for (let i = sortedPeriods.length - 1; i >= 0; i--) {
      const period = sortedPeriods[i];
      const frequency = period.frequency || 'monthly';
      if (hasPeriodEnded(period.reporting_date, frequency, today)) {
        currentPeriod = period;
        break;
      }
    }

    if (!currentPeriod) return false;

    // Only check variance if complete value has actually been entered
    if (currentPeriod.complete === null || currentPeriod.complete === undefined || currentPeriod.complete === '') {
      return false;
    }

    const complete = parseFloat(currentPeriod.complete) || 0;
    const expected = parseFloat(currentPeriod.expected) || 0;

    if (expected === 0) return false;

    const variance = complete - expected;
    const variancePercent = Math.abs((variance / expected) * 100);
    const redTolerance = parseFloat(currentPeriod.red_tolerance) || 10.0;

    return variance < 0 && variancePercent > redTolerance;
  });
};

// Exported helper to calculate health scores for all dimensions
// Returns { overall, projectDescribed, metricsDescribed, metricCoverage, metricManagement, projectControl, contentClarity }
// contentClarity evaluates project description, metric descriptions, and period commentary
// projectLinks can be an array of links OR a number (link_count from API)
export const calculateHealthScores = (project, projectData, metrics, recoveryPlans = [], projectLinks = []) => {
  if (!project || !projectData || !metrics) {
    return {
      overall: 0,
      projectDescribed: 0,
      metricsDescribed: 0,
      metricCoverage: 0,
      metricManagement: 0,
      projectControl: 0,
      contentClarity: 0
    };
  }

  // Calculate link count - handle both array and number (link_count from API)
  let linkCount = 0;
  if (typeof projectLinks === 'number') {
    linkCount = projectLinks;
  } else if (Array.isArray(projectLinks) && projectLinks.length > 0) {
    linkCount = projectLinks.length;
  } else if (project.links && Array.isArray(project.links)) {
    linkCount = project.links.length;
  } else if (typeof project.link_count === 'number') {
    linkCount = project.link_count;
  }

  // 1. Project Described Score (project-level documentation)
  let projectDescribedScore = 0;
  if (project.description && project.description.trim().length > 10) {
    projectDescribedScore += 50;
  }
  if (linkCount >= 3) {
    projectDescribedScore += 50;
  } else if (linkCount > 0) {
    projectDescribedScore += Math.round((linkCount / 3) * 50);
  }

  // 2. Metrics Described Score (metric-level documentation)
  let metricsDescribedScore = 0;
  if (metrics.length > 0) {
    const metricsWithDesc = metrics.filter(m => m.description && m.description.trim().length > 5).length;
    metricsDescribedScore += Math.round((metricsWithDesc / metrics.length) * 50);
  } else {
    metricsDescribedScore += 50; // No metrics = full points for this part
  }
  const redMetrics = getRedMetrics(projectData, metrics);
  if (redMetrics.length > 0) {
    const activeRecoveryPlans = recoveryPlans.filter(p => p.status === 'active');
    const redMetricsWithPlans = redMetrics.filter(m =>
      activeRecoveryPlans.some(p => p.metric_id === m.id)
    ).length;
    metricsDescribedScore += Math.round((redMetricsWithPlans / redMetrics.length) * 50);
  } else {
    metricsDescribedScore += 50;
  }

  // 2. Metric Coverage Score
  let metricCoverageScore = 0;
  const metricCount = metrics.length;
  if (metricCount === 0) {
    metricCoverageScore = 0;
  } else if (metricCount >= 3 && metricCount <= 6) {
    metricCoverageScore = 100;
  } else if (metricCount < 3) {
    metricCoverageScore = Math.round((metricCount / 3) * 100);
  } else {
    metricCoverageScore = Math.max(70, 100 - (metricCount - 6) * 5);
  }

  // 3. Metric Management Score
  // Only evaluate periods that have ENDED (based on frequency) - active periods are not penalized
  let metricManagementScore = 0;
  if (metrics.length > 0 && projectData.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalScore = 0;
    let scoreCount = 0;

    metrics.forEach(metric => {
      const metricPeriods = projectData.filter(p => p.metric_id === metric.id);
      if (metricPeriods.length === 0) return;

      const sortedPeriods = [...metricPeriods].sort((a, b) =>
        new Date(a.reporting_date) - new Date(b.reporting_date)
      );

      // Only include periods that have ENDED based on their frequency
      const endedPeriods = sortedPeriods.filter(p => {
        const frequency = p.frequency || 'monthly';
        return hasPeriodEnded(p.reporting_date, frequency, today);
      });

      if (endedPeriods.length > 0) {
        const filledPeriods = endedPeriods.filter(p =>
          p.complete !== null && p.complete !== undefined && p.complete !== ''
        ).length;

        const fillRate = filledPeriods / endedPeriods.length;
        totalScore += fillRate * 100;
        scoreCount++;
      }
    });

    metricManagementScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 50;
  }

  // 4. Project Control Score
  // Only evaluate periods that have ENDED and have data entered
  let projectControlScore = 100;
  if (metrics.length > 0 && projectData.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalPeriods = 0;
    let greenPeriods = 0;
    let amberPeriods = 0;
    let redPeriods = 0;

    metrics.forEach(metric => {
      const metricPeriods = projectData.filter(p => p.metric_id === metric.id);
      // Only include periods that have ENDED and have complete data
      const endedPeriods = metricPeriods.filter(p => {
        const frequency = p.frequency || 'monthly';
        return hasPeriodEnded(p.reporting_date, frequency, today) &&
               p.complete !== null && p.complete !== undefined;
      });

      endedPeriods.forEach(period => {
        const complete = parseFloat(period.complete) || 0;
        const expected = parseFloat(period.expected) || 0;

        if (expected === 0) return;

        const variance = complete - expected;
        const variancePercent = Math.abs((variance / expected) * 100);
        const redTolerance = parseFloat(period.red_tolerance) || 10.0;
        const amberTolerance = parseFloat(period.amber_tolerance) || 5.0;

        totalPeriods++;

        if (variance >= 0 || variancePercent <= amberTolerance) {
          greenPeriods++;
        } else if (variancePercent <= redTolerance) {
          amberPeriods++;
        } else {
          redPeriods++;
        }
      });
    });

    if (totalPeriods > 0) {
      projectControlScore = Math.round(
        ((greenPeriods * 100) + (amberPeriods * 50) + (redPeriods * 0)) / totalPeriods
      );
    }
  }

  // 5. Content Clarity Score
  // Evaluate clarity of project description, metric descriptions, and period commentary
  let contentClarityScore = 50; // Default if no commentary
  const textToAnalyze = [];

  // Include project description
  if (project.description && project.description.trim().length > 10) {
    textToAnalyze.push(project.description);
  }

  // Include period commentary
  projectData.forEach(period => {
    if (period.commentary && period.commentary.trim().length > 10) {
      textToAnalyze.push(period.commentary);
    }
  });

  // Include metric descriptions
  metrics.forEach(metric => {
    if (metric.description && metric.description.trim().length > 10) {
      textToAnalyze.push(metric.description);
    }
  });

  if (textToAnalyze.length > 0) {
    // Calculate average clarity score across all text
    const clarityScores = textToAnalyze.map(text => calculateClarityScore(text).score);
    const avgClarity = clarityScores.reduce((sum, s) => sum + s, 0) / clarityScores.length;
    // Convert 1-5 scale to 0-100
    contentClarityScore = Math.round((avgClarity / 5) * 100);
  }

  // Calculate overall score (average of all 6 dimensions)
  const overall = Math.round((projectDescribedScore + metricsDescribedScore + metricCoverageScore + metricManagementScore + projectControlScore + contentClarityScore) / 6);

  return {
    overall,
    projectDescribed: projectDescribedScore,
    metricsDescribed: metricsDescribedScore,
    metricCoverage: metricCoverageScore,
    metricManagement: metricManagementScore,
    projectControl: projectControlScore,
    contentClarity: contentClarityScore
  };
};

// Backwards-compatible export that returns just the overall score
export const calculateHealthScore = (project, projectData, metrics, recoveryPlans = [], projectLinks = []) => {
  return calculateHealthScores(project, projectData, metrics, recoveryPlans, projectLinks).overall;
};

const ProjectHealthModal = ({
  project,
  projectData,
  metrics,
  recoveryPlans = [],
  projectLinks = [],
  onClose
}) => {
  // Use the shared calculation function to ensure consistency
  const healthScores = useMemo(() => {
    const scores = calculateHealthScores(project, projectData, metrics, recoveryPlans, projectLinks);
    return {
      projectDescribed: scores.projectDescribed,
      metricsDescribed: scores.metricsDescribed,
      metricCoverage: scores.metricCoverage,
      metricManagement: scores.metricManagement,
      projectControl: scores.projectControl,
      contentClarity: scores.contentClarity
    };
  }, [project, projectData, metrics, recoveryPlans, projectLinks]);

  // Prepare data for radar chart (6 dimensions)
  const radarData = [
    {
      dimension: 'Project Described',
      score: healthScores.projectDescribed,
      fullMark: 100
    },
    {
      dimension: 'Metrics Described',
      score: healthScores.metricsDescribed,
      fullMark: 100
    },
    {
      dimension: 'Metric Coverage',
      score: healthScores.metricCoverage,
      fullMark: 100
    },
    {
      dimension: 'Metric Management',
      score: healthScores.metricManagement,
      fullMark: 100
    },
    {
      dimension: 'Project Control',
      score: healthScores.projectControl,
      fullMark: 100
    },
    {
      dimension: 'Content Clarity',
      score: healthScores.contentClarity,
      fullMark: 100
    }
  ];

  // Calculate overall health score (average of 6 dimensions)
  const overallScore = Math.round(
    (healthScores.projectDescribed +
     healthScores.metricsDescribed +
     healthScores.metricCoverage +
     healthScores.metricManagement +
     healthScores.projectControl +
     healthScores.contentClarity) / 6
  );

  // Get status color based on score
  const getStatusColor = (score) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#f59e0b'; // Amber
    return '#dc2626'; // Red
  };

  const getStatusIcon = (score) => {
    if (score >= 80) return <MdCheckCircle style={{ color: '#10b981' }} />;
    if (score >= 60) return <MdWarning style={{ color: '#f59e0b' }} />;
    return <MdError style={{ color: '#dc2626' }} />;
  };

  const getStatusLabel = (score) => {
    if (score >= 80) return 'Healthy';
    if (score >= 60) return 'Needs Attention';
    return 'At Risk';
  };

  // Detailed breakdown for each dimension
  const getDimensionDetails = (dimension) => {
    const linkCount = projectLinks?.length || 0;
    const metricsWithDesc = metrics?.filter(m => m.description?.trim().length > 5).length || 0;
    const redMetricsList = getRedMetrics(projectData, metrics);
    const activeRecoveryPlans = recoveryPlans.filter(p => p.status === 'active');
    const redMetricsWithPlans = redMetricsList.filter(m =>
      activeRecoveryPlans.some(p => p.metric_id === m.id)
    ).length;

    switch (dimension) {
      case 'Project Described':
        return [
          {
            label: 'Project description',
            met: project?.description?.trim().length > 10,
            tooltip: 'Requires description > 10 characters. Worth 50 points.'
          },
          {
            label: `Documentation links (${linkCount}/3)`,
            met: linkCount >= 3,
            tooltip: `Need 3+ links for full 50 points. Current: ${linkCount} link${linkCount !== 1 ? 's' : ''} = ${linkCount >= 3 ? 50 : Math.round((linkCount / 3) * 50)} points.`
          }
        ];
      case 'Metrics Described':
        return [
          {
            label: `Metric descriptions (${metricsWithDesc}/${metrics?.length || 0})`,
            met: metrics?.length === 0 || metricsWithDesc === metrics?.length,
            tooltip: metrics?.length === 0
              ? 'No metrics defined - full 50 points awarded.'
              : `Each metric with description (>5 chars) contributes. ${metricsWithDesc}/${metrics.length} = ${Math.round((metricsWithDesc / metrics.length) * 50)} points of 50.`
          },
          {
            label: redMetricsList.length === 0
              ? 'No red metrics (full points)'
              : `Recovery plans (${redMetricsWithPlans}/${redMetricsList.length} red metrics)`,
            met: redMetricsList.length === 0 || redMetricsWithPlans === redMetricsList.length,
            tooltip: redMetricsList.length === 0
              ? 'No red metrics - full 50 points awarded.'
              : `${redMetricsList.length} red metric${redMetricsList.length !== 1 ? 's' : ''}, ${redMetricsWithPlans} with active recovery plan${redMetricsWithPlans !== 1 ? 's' : ''}. Points based on coverage.`
          }
        ];
      case 'Metric Coverage':
        const count = metrics?.length || 0;
        return [
          {
            label: `${count} metric${count !== 1 ? 's' : ''} defined`,
            met: count >= 3,
            tooltip: count >= 3 && count <= 6
              ? '3-6 metrics is ideal = 100 points'
              : count < 3
              ? `Less than 3 metrics: ${Math.round((count / 3) * 100)} points`
              : `More than 6 metrics: ${Math.max(70, 100 - (count - 6) * 5)} points (slight penalty for complexity)`
          },
          {
            label: 'Ideal range: 3-6 metrics',
            met: count >= 3 && count <= 6,
            tooltip: 'Projects work best with 3-6 tracked metrics. Too few means incomplete tracking, too many adds complexity.'
          }
        ];
      case 'Metric Management':
        return [
          {
            label: 'Regular updates',
            met: healthScores.metricManagement >= 80,
            tooltip: 'Based on how consistently metrics are updated. Scores 80+ when data is entered on time.'
          },
          {
            label: 'Keeping up with reporting periods',
            met: healthScores.metricManagement >= 60,
            tooltip: 'Checks if current periods have data entered. Missing recent data lowers score.'
          }
        ];
      case 'Project Control':
        return [
          {
            label: 'Metrics staying on track',
            met: healthScores.projectControl >= 80,
            tooltip: 'Based on variance from expected values. Green metrics = high score, red metrics = low score.'
          },
          {
            label: 'Minimal red/amber periods',
            met: healthScores.projectControl >= 60,
            tooltip: 'Fewer negative variances in recent periods improves this score.'
          }
        ];
      case 'Content Clarity':
        return [
          {
            label: 'Clear, concise writing',
            met: healthScores.contentClarity >= 80,
            tooltip: 'Evaluates project description, metric descriptions, and commentary for clarity. Rewards concise sentences (10-20 words) and plain language.'
          },
          {
            label: 'Minimal jargon & abbreviations',
            met: healthScores.contentClarity >= 60,
            tooltip: 'Penalizes business jargon (synergy, leverage, etc.) and unexplained abbreviations. Defined abbreviations like "PMO (Project Management Office)" are OK.'
          }
        ];
      default:
        return [];
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content project-health-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Project Health: {project?.name || 'Unknown Project'}</h2>
          <button className="modal-close" onClick={onClose}>
            <MdClose />
          </button>
        </div>

        <div className="health-modal-body">
          {/* Left column - score and radar */}
          <div className="health-left-column">
            {/* Overall Score */}
            <div className="overall-health-score">
              <div
                className="score-circle"
                style={{ borderColor: getStatusColor(overallScore) }}
              >
                <span className="score-value" style={{ color: getStatusColor(overallScore) }}>{overallScore}<span className="percent-sign">%</span></span>
                <span className="score-label">Overall</span>
              </div>
              <div className="score-status">
                {getStatusIcon(overallScore)}
                <span>{getStatusLabel(overallScore)}</span>
              </div>
            </div>

            {/* Radar Chart */}
            <div className="health-radar-container">
              <ResponsiveContainer width={380} height={320}>
                <RadarChart data={radarData} margin={{ top: 50, right: 80, bottom: 50, left: 80 }} outerRadius={70}>
                  <PolarGrid
                    stroke="#e5e7eb"
                    gridType="polygon"
                  />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: '#6b7280', fontSize: 11, dy: 0 }}
                    tickLine={false}
                    tickSize={20}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: '#9ca3af', fontSize: 9 }}
                    tickCount={5}
                    axisLine={false}
                  />
                  <Radar
                    name="Health Score"
                    dataKey="score"
                    stroke="#003c71"
                    fill="#003c71"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, 'Score']}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px 12px'
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right column - dimension cards */}
          <div className="health-right-column">
            {/* Dimension Breakdown */}
            <div className="health-dimensions">
            {radarData.map((item) => (
              <div key={item.dimension} className="dimension-card">
                <div className="dimension-header">
                  <span className="dimension-name">{item.dimension}</span>
                  <span
                    className="dimension-score"
                    style={{ color: getStatusColor(item.score) }}
                  >
                    {item.score}%
                  </span>
                </div>
                <div className="dimension-bar">
                  <div
                    className="dimension-bar-fill"
                    style={{
                      width: `${item.score}%`,
                      backgroundColor: getStatusColor(item.score)
                    }}
                  />
                </div>
                <div className="dimension-details">
                  {getDimensionDetails(item.dimension).map((detail, idx) => (
                    <div key={idx} className="detail-item" title={detail.tooltip}>
                      {detail.met ? (
                        <MdCheckCircle className="detail-icon met" />
                      ) : (
                        <MdInfo className="detail-icon unmet" />
                      )}
                      <span className={detail.met ? 'met' : 'unmet'}>{detail.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectHealthModal;
