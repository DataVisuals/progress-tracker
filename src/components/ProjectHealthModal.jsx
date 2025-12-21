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
// contentClarity evaluates ALL project text: descriptions, commentary, recovery plans, risks, issues
// projectLinks can be an array of links OR a number (link_count from API)
// craids is an optional array of risks/issues for content clarity analysis
export const calculateHealthScores = (project, projectData, metrics, recoveryPlans = [], projectLinks = [], craids = []) => {
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

  // 2. Metrics Described Score (metric-level documentation only)
  // This dimension is purely about documentation quality, not metric status
  let metricsDescribedScore = 0;
  if (metrics.length > 0) {
    const metricsWithDesc = metrics.filter(m => m.description && m.description.trim().length > 5).length;
    metricsDescribedScore = Math.round((metricsWithDesc / metrics.length) * 100);
  } else {
    metricsDescribedScore = 100; // No metrics = full points
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
  // Measures whether red metrics have recovery plans
  // Neutral if no red metrics (not rewarded, not penalized)
  // Only penalized if red metrics exist WITHOUT recovery plans
  let projectControlScore = 100; // Default: no action needed
  const redMetricsList = getRedMetrics(projectData, metrics);
  if (redMetricsList.length > 0) {
    const activeRecoveryPlans = recoveryPlans.filter(p => p.status === 'active');
    const redMetricsWithPlans = redMetricsList.filter(m =>
      activeRecoveryPlans.some(p => p.metric_id === m.id)
    ).length;
    // Score based on recovery plan coverage of red metrics
    projectControlScore = Math.round((redMetricsWithPlans / redMetricsList.length) * 100);
  }

  // 5. Content Clarity Score
  // Evaluate clarity of ALL text: descriptions, commentary, recovery plans, risks, issues
  let contentClarityScore = 50; // Default if no text to analyze
  const textToAnalyze = [];

  // Include project description
  if (project.description && project.description.trim().length > 10) {
    textToAnalyze.push(project.description);
  }

  // Include metric descriptions
  metrics.forEach(metric => {
    if (metric.description && metric.description.trim().length > 10) {
      textToAnalyze.push(metric.description);
    }
  });

  // Include period commentary
  projectData.forEach(period => {
    if (period.commentary && period.commentary.trim().length > 10) {
      textToAnalyze.push(period.commentary);
    }
  });

  // Include recovery plan descriptions
  recoveryPlans.forEach(plan => {
    if (plan.title && plan.title.trim().length > 5) {
      textToAnalyze.push(plan.title);
    }
    if (plan.description && plan.description.trim().length > 10) {
      textToAnalyze.push(plan.description);
    }
  });

  // Include risks and issues (CRAIDs)
  craids.forEach(craid => {
    if (craid.title && craid.title.trim().length > 5) {
      textToAnalyze.push(craid.title);
    }
    if (craid.description && craid.description.trim().length > 10) {
      textToAnalyze.push(craid.description);
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
export const calculateHealthScore = (project, projectData, metrics, recoveryPlans = [], projectLinks = [], craids = []) => {
  return calculateHealthScores(project, projectData, metrics, recoveryPlans, projectLinks, craids).overall;
};

const ProjectHealthModal = ({
  project,
  projectData,
  metrics,
  recoveryPlans = [],
  projectLinks = [],
  craids = [],
  onClose
}) => {
  // Use the shared calculation function to ensure consistency
  const healthScores = useMemo(() => {
    const scores = calculateHealthScores(project, projectData, metrics, recoveryPlans, projectLinks, craids);
    return {
      projectDescribed: scores.projectDescribed,
      metricsDescribed: scores.metricsDescribed,
      metricCoverage: scores.metricCoverage,
      metricManagement: scores.metricManagement,
      projectControl: scores.projectControl,
      contentClarity: scores.contentClarity
    };
  }, [project, projectData, metrics, recoveryPlans, projectLinks, craids]);

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
              ? 'No metrics defined yet.'
              : `Each metric should have a description explaining what it measures. ${metricsWithDesc}/${metrics.length} metrics have descriptions.`
          },
          {
            label: 'Clear explanation of each metric',
            met: metricsWithDesc === (metrics?.length || 0),
            tooltip: 'Descriptions help stakeholders understand what each metric tracks and why it matters.'
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
        const redMetricsForControl = getRedMetrics(projectData, metrics);
        const activePlansForControl = recoveryPlans.filter(p => p.status === 'active');
        const coveredRedMetrics = redMetricsForControl.filter(m =>
          activePlansForControl.some(p => p.metric_id === m.id)
        ).length;
        return [
          {
            label: redMetricsForControl.length === 0
              ? 'No recovery plans required'
              : `Recovery plans (${coveredRedMetrics}/${redMetricsForControl.length} red metrics)`,
            met: redMetricsForControl.length === 0 || coveredRedMetrics === redMetricsForControl.length,
            tooltip: redMetricsForControl.length === 0
              ? 'No metrics currently need recovery plans.'
              : `${redMetricsForControl.length} metric${redMetricsForControl.length !== 1 ? 's are' : ' is'} red. ${coveredRedMetrics} ${coveredRedMetrics !== 1 ? 'have' : 'has'} active recovery plans.`
          },
          {
            label: 'Issues being actively managed',
            met: healthScores.projectControl >= 80,
            tooltip: 'Red metrics should have recovery plans explaining how they will get back on track.'
          }
        ];
      case 'Content Clarity':
        return [
          {
            label: 'All project text evaluated',
            met: healthScores.contentClarity >= 60,
            tooltip: 'Analyzes: project description, metric descriptions, period commentary, recovery plans, risks, and issues. Rewards clear, concise writing.'
          },
          {
            label: 'Plain language, minimal jargon',
            met: healthScores.contentClarity >= 80,
            tooltip: 'Penalizes business jargon (synergy, leverage, etc.) and unexplained abbreviations. Rewards short sentences (10-20 words) and plain language.'
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
              <div className="score-gauge">
                <svg viewBox="0 0 36 36" className="score-gauge-svg">
                  <circle
                    className="score-gauge-bg"
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    strokeWidth="3"
                  />
                  <circle
                    className="score-gauge-progress"
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    strokeWidth="3"
                    stroke={getStatusColor(overallScore)}
                    strokeDasharray={`${(overallScore / 100) * 97.4} 97.4`}
                    strokeLinecap="round"
                    transform="rotate(-90 18 18)"
                  />
                </svg>
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
