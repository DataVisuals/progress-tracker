import React, { useState, useEffect } from 'react';
import {
  MdComment,
  MdWarning,
  MdLightbulb,
  MdTrendingUp,
  MdHome,
  MdTrackChanges,
  MdTune,
  MdShowChart,
  MdTimeline,
  MdFilterList,
  MdFolderSpecial,
  MdCheckCircle,
  MdArrowForward,
  MdHistory,
  MdEdit,
  MdLink,
  MdFileDownload,
  MdAutorenew,
  MdViewWeek,
  MdSpeed,
  MdFlag,
  MdPeople,
  MdCompareArrows,
  MdAssignment,
  MdDashboard,
  MdEventNote,
  MdBuild,
  MdVisibility,
  MdNotifications,
  MdCalendarToday,
  MdFeedback
} from 'react-icons/md';
import { api } from '../api/client';
import './HomePage.css';

const HomePage = ({ projects, projectsData, onNavigateToProject, currentUser }) => {
  const [recentCommentary, setRecentCommentary] = useState([]);
  const [redMetrics, setRedMetrics] = useState([]);
  const [randomTips, setRandomTips] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tips from the TipsSplash component
  const allTips = [
    {
      icon: <MdTrackChanges />,
      title: "Use Cumulative Metrics",
      description: "Metrics should be cumulative progress towards an end goal, not per-month measurements."
    },
    {
      icon: <MdComment />,
      title: "Add Commentary for Adverse Metrics",
      description: "When metrics are red or amber, add commentary to explain why and document mitigation actions."
    },
    {
      icon: <MdTune />,
      title: "Review Your Tolerances",
      description: "Check that your amber and red thresholds are appropriate for each metric."
    },
    {
      icon: <MdShowChart />,
      title: "Choose Lead Metrics with Predictive Power",
      description: "Lead metrics should actually predict future outcomes, not just measure activity."
    },
    {
      icon: <MdLightbulb />,
      title: "Lag Measures Should Track Value",
      description: "Focus on outcomes that matter - features delivered, not code written."
    },
    {
      icon: <MdTimeline />,
      title: "Show Progress in Context",
      description: "Compare actual progress against expected trajectories, accounting for scope changes."
    },
    {
      icon: <MdFilterList />,
      title: "Focus on Metrics That Are Moving",
      description: "Filter by RAG status to prioritize attention on problem areas."
    },
    {
      icon: <MdFolderSpecial />,
      title: "Organize Projects into Portfolios",
      description: "Group related projects together for better oversight and portfolio-level views."
    },
    {
      icon: <MdCheckCircle />,
      title: "Run Consistency Checks",
      description: "Use automated consistency reports to identify anomalies and data quality issues."
    },
    {
      icon: <MdHistory />,
      title: "Use Time Travel to Review History",
      description: "View your metrics as they appeared at any past date to understand trends and changes."
    },
    {
      icon: <MdEdit />,
      title: "Click to Edit Any Value",
      description: "Click directly on any cell in the metric chart to edit values inline - no modal needed."
    },
    {
      icon: <MdLink />,
      title: "Link Related Projects",
      description: "Connect projects that depend on each other using project links to track dependencies."
    },
    {
      icon: <MdFileDownload />,
      title: "Export for Offline Analysis",
      description: "Download your data as Excel files for presentations or offline analysis."
    },
    {
      icon: <MdAutorenew />,
      title: "Adjust Targets Mid-Stream",
      description: "When scope changes, update targets while preserving historical expected values."
    },
    {
      icon: <MdViewWeek />,
      title: "Choose the Right Frequency",
      description: "Match reporting frequency to the metric's natural cadence - weekly for fast-moving, monthly for stable."
    },
    {
      icon: <MdSpeed />,
      title: "Use Progression Curves",
      description: "S-curves for ramp-up projects, linear for steady work, exponential for growth metrics."
    },
    {
      icon: <MdFlag />,
      title: "Track CRAIDs for Governance",
      description: "Log Comments, Risks, Actions, Issues, and Dependencies for complete project oversight."
    },
    {
      icon: <MdPeople />,
      title: "Assign Metric Owners",
      description: "Make metrics actionable by assigning owners who are accountable for progress."
    },
    {
      icon: <MdTrendingUp />,
      title: "Focus on Variance, Not Absolutes",
      description: "The percentage behind schedule matters more than the absolute number."
    },
    {
      icon: <MdComment />,
      title: "Keep Commentary Concise",
      description: "Good commentary explains why you're behind and what you're doing about it in 2-3 sentences."
    },
    {
      icon: <MdTimeline />,
      title: "Extend End Dates When Needed",
      description: "Click the project dates to extend timelines - periods will auto-generate to cover the new range."
    },
    {
      icon: <MdFilterList />,
      title: "Use Portfolio Filters",
      description: "Filter the consistency report by portfolio to focus on specific business areas."
    },
    {
      icon: <MdWarning />,
      title: "Don't Ignore Amber Metrics",
      description: "Amber is an early warning - address issues before they turn red."
    },
    {
      icon: <MdCompareArrows />,
      title: "Compare Projects Side by Side",
      description: "Use portfolio views to compare similar projects and identify best practices."
    },
    {
      icon: <MdAssignment />,
      title: "Document Assumptions",
      description: "Record the assumptions behind your targets - they're valuable when scope changes."
    },
    {
      icon: <MdDashboard />,
      title: "Use the Dashboard Daily",
      description: "Start your day by checking the dashboard to see what needs attention."
    },
    {
      icon: <MdEventNote />,
      title: "Update Metrics on Schedule",
      description: "Set reminders to update metrics consistently - stale data is worse than no data."
    },
    {
      icon: <MdBuild />,
      title: "Start Small, Iterate",
      description: "Begin with 2-3 key metrics per project - you can always add more later."
    },
    {
      icon: <MdVisibility />,
      title: "Make Progress Visible",
      description: "Share dashboards with stakeholders to build trust and transparency."
    },
    {
      icon: <MdNotifications />,
      title: "Set Up Alerts",
      description: "Use consistency reports to catch data issues before they become problems."
    },
    {
      icon: <MdCalendarToday />,
      title: "Match Periods to Reviews",
      description: "Align reporting periods with your governance cadence - weekly, monthly, or quarterly."
    },
    {
      icon: <MdTrendingUp />,
      title: "Celebrate Green Metrics",
      description: "Recognize success when metrics are on track - it motivates teams to maintain momentum."
    },
    {
      icon: <MdLightbulb />,
      title: "Quality Over Quantity",
      description: "A few well-chosen metrics tell a better story than many mediocre ones."
    },
    {
      icon: <MdLink />,
      title: "Link to Project Documentation",
      description: "Add links to your project's SharePoint, Confluence, or documentation hub for easy access."
    },
    {
      icon: <MdDashboard />,
      title: "Connect Power BI Dashboards",
      description: "Link to your Power BI reports and dashboards for deeper data analysis and visualization."
    },
    {
      icon: <MdAssignment />,
      title: "Link to Jira Dashboards",
      description: "Connect to your Jira boards and dashboards to see sprint progress alongside your metrics."
    },
    {
      icon: <MdTimeline />,
      title: "Add Navigator Links",
      description: "Link to your team's Navigator roadmaps to provide strategic context for your metrics."
    },
    {
      icon: <MdFolderSpecial />,
      title: "Centralize Key Resources",
      description: "Use project links to create a single source of truth for all your project's key tools and resources."
    }
  ];

  // Randomize tips on component mount
  useEffect(() => {
    selectRandomTips();
  }, []);

  // Load data when projects or projectsData change (but not on empty initial state)
  useEffect(() => {
    const projectCount = Object.keys(projects).length;
    const dataCount = Object.keys(projectsData).length;

    if (projectCount > 0 || dataCount > 0) {
      loadHomePageData();
    }
  }, [Object.keys(projects).length, Object.keys(projectsData).length]);

  const selectRandomTips = () => {
    const shuffled = [...allTips].sort(() => 0.5 - Math.random());
    setRandomTips(shuffled.slice(0, 5));
  };

  const loadHomePageData = async () => {
    setLoading(true);
    try {
      // Get recent commentary from audit log - filter for metric_periods table
      // Note: This requires authentication
      let enrichedCommentary = [];
      try {
        const commentsResponse = await api.get('/comments/recent?limit=10');

        enrichedCommentary = (commentsResponse.data || []).map(comment => {
          // Find portfolio info from projects
          const projectInfo = Object.entries(projects).find(([id]) =>
            parseInt(id) === comment.project_id
          );
          return {
            id: comment.id,
            commentary: comment.comment_text,
            timestamp: comment.created_at,
            projectId: comment.project_id,
            projectName: comment.project_name,
            metricName: comment.metric_name,
            periodName: comment.reporting_date,
            createdBy: comment.created_by_name,
            portfolioColor: projectInfo ? projectInfo[1].portfolio_color : null,
            portfolioName: projectInfo ? projectInfo[1].portfolio_name : null
          };
        });
      } catch (commentsErr) {
        console.log('Could not load recent comments:', commentsErr.message);
      }

      setRecentCommentary(enrichedCommentary);

      // Calculate red metrics across all projects
      const redMetricsList = [];

      Object.entries(projectsData).forEach(([projectId, data]) => {
        if (!data || !Array.isArray(data)) return;

        const projectInfo = projects[projectId];
        if (!projectInfo) return;

        // Group by metric
        const metricGroups = {};
        data.forEach(period => {
          if (!metricGroups[period.metric]) {
            metricGroups[period.metric] = [];
          }
          metricGroups[period.metric].push(period);
        });

        // Check each metric for red status
        Object.entries(metricGroups).forEach(([metricName, periods]) => {
          // Sort periods by date
          const sortedPeriods = [...periods].sort((a, b) =>
            new Date(a.reporting_date) - new Date(b.reporting_date)
          );

          // Find current or most recent period
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let currentPeriod = null;
          for (let i = sortedPeriods.length - 1; i >= 0; i--) {
            const periodDate = new Date(sortedPeriods[i].reporting_date);
            if (periodDate <= today) {
              currentPeriod = sortedPeriods[i];
              break;
            }
          }

          if (!currentPeriod) return;

          const complete = parseFloat(currentPeriod.complete) || 0;
          const expected = parseFloat(currentPeriod.expected) || 0;

          if (expected === 0) return;

          const variance = complete - expected;
          const variancePercent = Math.abs((variance / expected) * 100);
          const redTolerance = parseFloat(currentPeriod.red_tolerance) || 10.0;

          if (variance < 0 && variancePercent > redTolerance) {
            redMetricsList.push({
              projectId,
              projectName: projectInfo.name,
              metricName,
              complete,
              expected,
              variancePercent: variancePercent.toFixed(1),
              portfolioColor: projectInfo.portfolio_color
            });
          }
        });
      });

      setRedMetrics(redMetricsList);

      // Load feedback for current user's projects
      let feedbackList = [];
      try {
        if (currentUser) {
          // Fetch all feedback and filter on client side for user's projects
          // The backend doesn't filter by user, so we get all feedback first
          const feedbackResponse = await api.getFeedback({});

          if (feedbackResponse.data && Array.isArray(feedbackResponse.data)) {
            // Get all project IDs that belong to the current user
            const userProjectIds = Object.entries(projects)
              .filter(([id, project]) => {
                // Check if user is the initiative manager (by name comparison)
                return project.initiative_manager === currentUser.name ||
                       project.secondary_pm === currentUser.name;
              })
              .map(([id]) => parseInt(id));

            // Filter feedback for user's projects
            feedbackList = feedbackResponse.data
              .filter(fb => userProjectIds.includes(fb.project_id))
              .slice(0, 10) // Limit to 10 items
              .map(fb => ({
                ...fb,
                projectName: projects[fb.project_id]?.name || 'Unknown Project',
                feedback_text: fb.text, // Map backend 'text' field to frontend 'feedback_text'
                created_by_name: fb.user_name // Map backend 'user_name' to frontend 'created_by_name'
              }));
          }
        }
      } catch (feedbackErr) {
        console.log('Could not load feedback:', feedbackErr.message);
      }
      setFeedback(feedbackList);
    } catch (err) {
      console.error('Failed to load home page data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMetricClick = (projectId, metricName) => {
    if (onNavigateToProject) {
      onNavigateToProject(projectId, metricName);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const projectCount = Object.keys(projects).length;
  const metricCount = Object.values(projectsData).reduce((sum, data) => {
    if (!Array.isArray(data)) return sum;
    const metrics = new Set(data.map(d => d.metric));
    return sum + metrics.size;
  }, 0);

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-title">
          <MdHome className="home-icon" />
          <h1>Dashboard</h1>
        </div>
        <div className="home-stats">
          <div className="stat-item">
            <span className="stat-value">{projectCount}</span>
            <span className="stat-label">Projects</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{metricCount}</span>
            <span className="stat-label">Metrics</span>
          </div>
          <div className="stat-item">
            <span className="stat-value red">{redMetrics.length}</span>
            <span className="stat-label">At Risk</span>
          </div>
        </div>
      </div>

      <div className="home-grid">
        {/* Top Left - Quick Overview */}
        <div className="home-quadrant summary-quadrant">
          <div className="quadrant-header">
            <MdTrendingUp className="quadrant-icon" />
            <h2>Quick Overview</h2>
          </div>
          <div className="quadrant-content">
            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-number">{projectCount}</div>
                <div className="summary-label">Active Projects</div>
              </div>
              <div className="summary-card">
                <div className="summary-number">{metricCount}</div>
                <div className="summary-label">Total Metrics</div>
              </div>
              <div className="summary-card warning">
                <div className="summary-number">{redMetrics.length}</div>
                <div className="summary-label">At Risk</div>
              </div>
              <div className="summary-card success">
                <div className="summary-number">{metricCount - redMetrics.length}</div>
                <div className="summary-label">On Track</div>
              </div>
            </div>
            <div className="getting-started">
              <h3>Getting Started</h3>
              <ul>
                <li>Select a project from the dropdown above</li>
                <li>Review metrics with red or amber status</li>
                <li>Add commentary to explain variances</li>
                <li>Use the data grid for bulk updates</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Top Right - Metrics at Risk */}
        <div className="home-quadrant metrics-quadrant">
          <div className="quadrant-header">
            <MdWarning className="quadrant-icon warning" />
            <h2>Metrics at Risk</h2>
          </div>
          <div className="quadrant-content">
            {loading ? (
              <div className="loading-state">Loading...</div>
            ) : redMetrics.length === 0 ? (
              <div className="empty-state success">
                <MdTrendingUp className="empty-icon" />
                <p>All metrics on track!</p>
                <span>No metrics are currently at risk</span>
              </div>
            ) : (
              <div className="metrics-list">
                {redMetrics.map((item, index) => (
                  <div
                    key={index}
                    className="metric-item"
                    onClick={() => handleMetricClick(item.projectId, item.metricName)}
                  >
                    <div className="metric-header">
                      {item.portfolioColor && (
                        <span
                          className="portfolio-dot"
                          style={{ backgroundColor: item.portfolioColor }}
                        />
                      )}
                      <span className="metric-project">{item.projectName}</span>
                    </div>
                    <div className="metric-details">
                      <span className="metric-name">{item.metricName}</span>
                      <span className="metric-variance red">-{item.variancePercent}%</span>
                    </div>
                    <div className="metric-progress">
                      <span className="progress-value">{item.complete}</span>
                      <span className="progress-separator">/</span>
                      <span className="progress-expected">{item.expected}</span>
                    </div>
                    <MdArrowForward className="metric-arrow" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Left - Recent Commentary */}
        <div className="home-quadrant commentary-quadrant">
          <div className="quadrant-header">
            <MdComment className="quadrant-icon" />
            <h2>Recent Commentary</h2>
          </div>
          <div className="quadrant-content">
            {loading ? (
              <div className="loading-state">Loading...</div>
            ) : recentCommentary.length === 0 ? (
              <div className="empty-state">
                <MdComment className="empty-icon" />
                <p>No recent commentary</p>
                <span>Add commentary to metrics to provide context</span>
              </div>
            ) : (
              <div className="commentary-list">
                {recentCommentary.map((item, index) => (
                  <div
                    key={index}
                    className="commentary-item"
                    onClick={() => handleMetricClick(item.projectId, item.metricName)}
                  >
                    <div className="commentary-header">
                      {item.portfolioName && (
                        <div className="commentary-context">
                          <span
                            className="portfolio-dot"
                            style={{ backgroundColor: item.portfolioColor }}
                          />
                          <span className="commentary-portfolio">{item.portfolioName}</span>
                        </div>
                      )}
                      <div className="commentary-context">
                        <span className="commentary-label">Project:</span>
                        <span className="commentary-project">{item.projectName}</span>
                      </div>
                      <div className="commentary-context">
                        <span className="commentary-label">Metric:</span>
                        <span className="commentary-metric">{item.metricName}</span>
                      </div>
                      <div className="commentary-context">
                        <span className="commentary-label">Period:</span>
                        <span className="commentary-period">{item.periodName}</span>
                      </div>
                    </div>
                    <p className="commentary-text">{item.commentary}</p>
                    <div className="commentary-footer">
                      {item.createdBy && (
                        <span className="commentary-author">{item.createdBy}</span>
                      )}
                      <span className="commentary-time">{formatTimestamp(item.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Right - Tips */}
        <div className="home-quadrant tips-quadrant">
          <div className="quadrant-header">
            <MdLightbulb className="quadrant-icon tip" />
            <h2>Tips & Best Practices</h2>
          </div>
          <div className="quadrant-content">
            <div className="tips-list">
              {randomTips.map((tip, index) => (
                <div key={index} className="tip-item">
                  <div className="tip-icon-wrapper">
                    {tip.icon}
                  </div>
                  <div className="tip-content">
                    <h3 className="tip-title">{tip.title}</h3>
                    <p className="tip-description">{tip.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Section - Full Width */}
      <div className="feedback-section">
        <div className="feedback-header">
          <MdFeedback className="feedback-icon" />
          <h2>Feedback on Your Projects</h2>
        </div>
        <div className="feedback-content">
          {loading ? (
            <div className="feedback-empty">Loading...</div>
          ) : feedback.length === 0 ? (
            <div className="feedback-empty">
              No feedback yet. Feedback from stakeholders on your projects will appear here.
            </div>
          ) : (
            <div className="feedback-list">
              {feedback.map((item, index) => (
                <div
                  key={index}
                  className="feedback-item"
                  onClick={() => handleMetricClick(item.project_id, item.metric_name)}
                >
                  <div className="feedback-item-header">
                    <div className="feedback-project-info">
                      <span className="feedback-project">{item.projectName}</span>
                      {item.metric_name && (
                        <span className="feedback-metric">{item.metric_name}</span>
                      )}
                    </div>
                    <div className="feedback-meta">
                      {item.created_by_name && (
                        <span className="feedback-author">{item.created_by_name}</span>
                      )}
                      <span className="feedback-time">{formatTimestamp(item.created_at)}</span>
                    </div>
                  </div>
                  <p className="feedback-text">{item.feedback_text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
