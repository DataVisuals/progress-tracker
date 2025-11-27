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
import './ProjectHealthModal.css';

// Exported helper to calculate overall health score
export const calculateHealthScore = (project, projectData, metrics, recoveryPlans = []) => {
  if (!project || !projectData || !metrics) {
    return 0;
  }

  // Helper to get red metrics
  const getRedMetrics = (data, metricsList) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return metricsList.filter(metric => {
      const metricPeriods = data.filter(p => p.metric_id === metric.id);
      const sortedPeriods = [...metricPeriods].sort((a, b) =>
        new Date(a.reporting_date) - new Date(b.reporting_date)
      );

      let currentPeriod = null;
      for (let i = sortedPeriods.length - 1; i >= 0; i--) {
        const periodDate = new Date(sortedPeriods[i].reporting_date);
        if (periodDate <= today) {
          currentPeriod = sortedPeriods[i];
          break;
        }
      }

      if (!currentPeriod) return false;

      const complete = parseFloat(currentPeriod.complete) || 0;
      const expected = parseFloat(currentPeriod.expected) || 0;

      if (expected === 0) return false;

      const variance = complete - expected;
      const variancePercent = Math.abs((variance / expected) * 100);
      const redTolerance = parseFloat(currentPeriod.red_tolerance) || 10.0;

      return variance < 0 && variancePercent > redTolerance;
    });
  };

  // 1. Well Described Score
  let wellDescribedScore = 0;
  if (project.description && project.description.trim().length > 10) {
    wellDescribedScore += 25;
  }
  if (project.links && project.links.length >= 3) {
    wellDescribedScore += 25;
  } else if (project.links && project.links.length > 0) {
    wellDescribedScore += Math.round((project.links.length / 3) * 25);
  }
  if (metrics.length > 0) {
    const metricsWithDesc = metrics.filter(m => m.description && m.description.trim().length > 5).length;
    wellDescribedScore += Math.round((metricsWithDesc / metrics.length) * 25);
  }
  const redMetrics = getRedMetrics(projectData, metrics);
  if (redMetrics.length > 0) {
    const activeRecoveryPlans = recoveryPlans.filter(p => p.status === 'active');
    const redMetricsWithPlans = redMetrics.filter(m =>
      activeRecoveryPlans.some(p => p.metric_id === m.id)
    ).length;
    wellDescribedScore += Math.round((redMetricsWithPlans / redMetrics.length) * 25);
  } else {
    wellDescribedScore += 25;
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

      const pastPeriods = sortedPeriods.filter(p => new Date(p.reporting_date) <= today);

      if (pastPeriods.length > 0) {
        const filledPeriods = pastPeriods.filter(p =>
          p.complete !== null && p.complete !== undefined && p.complete !== ''
        ).length;

        const fillRate = filledPeriods / pastPeriods.length;
        totalScore += fillRate * 100;
        scoreCount++;
      }
    });

    metricManagementScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 50;
  }

  // 4. Project Control Score
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
      const pastPeriods = metricPeriods.filter(p => {
        const periodDate = new Date(p.reporting_date);
        return periodDate <= today && p.complete !== null && p.complete !== undefined;
      });

      pastPeriods.forEach(period => {
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

  // Calculate overall score (average of all 4 dimensions)
  return Math.round((wellDescribedScore + metricCoverageScore + metricManagementScore + projectControlScore) / 4);
};

const ProjectHealthModal = ({
  project,
  projectData,
  metrics,
  recoveryPlans = [],
  onClose
}) => {
  // Calculate health scores for each dimension (0-100)
  const healthScores = useMemo(() => {
    if (!project || !projectData || !metrics) {
      return {
        wellDescribed: 0,
        metricCoverage: 0,
        metricManagement: 0,
        projectControl: 0
      };
    }

    // 1. Well Described Score
    // - Project has description
    // - Metrics have descriptions
    // - Red/amber metrics have recovery plans
    let wellDescribedScore = 0;
    let wellDescribedFactors = 0;

    // Project description (25 points)
    if (project.description && project.description.trim().length > 10) {
      wellDescribedScore += 25;
    }
    wellDescribedFactors++;

    // Project has documentation links (25 points) - need 3+ for full points
    if (project.links && project.links.length >= 3) {
      wellDescribedScore += 25;
    } else if (project.links && project.links.length > 0) {
      wellDescribedScore += Math.round((project.links.length / 3) * 25);
    }
    wellDescribedFactors++;

    // Metric descriptions (25 points)
    if (metrics.length > 0) {
      const metricsWithDesc = metrics.filter(m => m.description && m.description.trim().length > 5).length;
      wellDescribedScore += Math.round((metricsWithDesc / metrics.length) * 25);
    }
    wellDescribedFactors++;

    // Recovery plans for red metrics (25 points)
    const redMetrics = getRedMetrics(projectData, metrics);
    if (redMetrics.length > 0) {
      const activeRecoveryPlans = recoveryPlans.filter(p => p.status === 'active');
      const redMetricsWithPlans = redMetrics.filter(m =>
        activeRecoveryPlans.some(p => p.metric_id === m.id)
      ).length;
      wellDescribedScore += Math.round((redMetricsWithPlans / redMetrics.length) * 25);
    } else {
      wellDescribedScore += 25; // No red metrics = full points
    }
    wellDescribedFactors++;

    // 2. Metric Coverage Score
    // Based on number of metrics (ideal: 3-6 metrics)
    let metricCoverageScore = 0;
    const metricCount = metrics.length;
    if (metricCount === 0) {
      metricCoverageScore = 0;
    } else if (metricCount >= 3 && metricCount <= 6) {
      metricCoverageScore = 100;
    } else if (metricCount < 3) {
      metricCoverageScore = Math.round((metricCount / 3) * 100);
    } else {
      // More than 6 metrics - slightly penalize for complexity
      metricCoverageScore = Math.max(70, 100 - (metricCount - 6) * 5);
    }

    // 3. Metric Management Score
    // - Frequency of updates
    // - Timeliness (are we keeping up with reporting periods?)
    let metricManagementScore = 0;

    if (metrics.length > 0 && projectData.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let totalScore = 0;
      let metricCount = 0;

      metrics.forEach(metric => {
        const metricPeriods = projectData.filter(p => p.metric_id === metric.id);
        if (metricPeriods.length === 0) return;

        // Sort by date
        const sortedPeriods = [...metricPeriods].sort((a, b) =>
          new Date(a.reporting_date) - new Date(b.reporting_date)
        );

        // Find current/past periods
        const pastPeriods = sortedPeriods.filter(p => new Date(p.reporting_date) <= today);

        if (pastPeriods.length > 0) {
          // Check how many past periods have been filled in
          const filledPeriods = pastPeriods.filter(p =>
            p.complete !== null && p.complete !== undefined && p.complete !== ''
          ).length;

          const fillRate = filledPeriods / pastPeriods.length;
          totalScore += fillRate * 100;
          metricCount++;
        }
      });

      metricManagementScore = metricCount > 0 ? Math.round(totalScore / metricCount) : 50;
    }

    // 4. Project Control Score
    // - How often do we drift into red/amber?
    // - Based on recent history
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
        const pastPeriods = metricPeriods.filter(p => {
          const periodDate = new Date(p.reporting_date);
          return periodDate <= today && p.complete !== null && p.complete !== undefined;
        });

        pastPeriods.forEach(period => {
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
        // Weight: green=100, amber=50, red=0
        projectControlScore = Math.round(
          ((greenPeriods * 100) + (amberPeriods * 50) + (redPeriods * 0)) / totalPeriods
        );
      }
    }

    return {
      wellDescribed: wellDescribedScore,
      metricCoverage: metricCoverageScore,
      metricManagement: metricManagementScore,
      projectControl: projectControlScore
    };
  }, [project, projectData, metrics, recoveryPlans]);

  // Helper function to get red metrics
  function getRedMetrics(data, metricsList) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return metricsList.filter(metric => {
      const metricPeriods = data.filter(p => p.metric_id === metric.id);
      const sortedPeriods = [...metricPeriods].sort((a, b) =>
        new Date(a.reporting_date) - new Date(b.reporting_date)
      );

      // Find current period
      let currentPeriod = null;
      for (let i = sortedPeriods.length - 1; i >= 0; i--) {
        const periodDate = new Date(sortedPeriods[i].reporting_date);
        if (periodDate <= today) {
          currentPeriod = sortedPeriods[i];
          break;
        }
      }

      if (!currentPeriod) return false;

      const complete = parseFloat(currentPeriod.complete) || 0;
      const expected = parseFloat(currentPeriod.expected) || 0;

      if (expected === 0) return false;

      const variance = complete - expected;
      const variancePercent = Math.abs((variance / expected) * 100);
      const redTolerance = parseFloat(currentPeriod.red_tolerance) || 10.0;

      return variance < 0 && variancePercent > redTolerance;
    });
  }

  // Prepare data for radar chart
  const radarData = [
    {
      dimension: 'Well Described',
      score: healthScores.wellDescribed,
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
    }
  ];

  // Calculate overall health score (average)
  const overallScore = Math.round(
    (healthScores.wellDescribed +
     healthScores.metricCoverage +
     healthScores.metricManagement +
     healthScores.projectControl) / 4
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
    switch (dimension) {
      case 'Well Described':
        return [
          { label: 'Project description', met: project?.description?.trim().length > 10 },
          { label: 'Documentation links', met: project?.links?.length >= 2 },
          { label: 'Metric descriptions', met: metrics?.filter(m => m.description?.trim().length > 5).length === metrics?.length },
          { label: 'Recovery plans for red metrics', met: getRedMetrics(projectData, metrics).length === 0 || recoveryPlans.filter(p => p.status === 'active').length > 0 }
        ];
      case 'Metric Coverage':
        const count = metrics?.length || 0;
        return [
          { label: `${count} metric${count !== 1 ? 's' : ''} defined`, met: count >= 3 },
          { label: 'Ideal range: 3-6 metrics', met: count >= 3 && count <= 6 }
        ];
      case 'Metric Management':
        return [
          { label: 'Regular updates', met: healthScores.metricManagement >= 80 },
          { label: 'Keeping up with reporting periods', met: healthScores.metricManagement >= 60 }
        ];
      case 'Project Control':
        return [
          { label: 'Metrics staying on track', met: healthScores.projectControl >= 80 },
          { label: 'Minimal red/amber periods', met: healthScores.projectControl >= 60 }
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
                <span className="score-value">{overallScore}</span>
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
                    <div key={idx} className="detail-item">
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
