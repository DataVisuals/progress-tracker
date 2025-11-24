import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
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
  MdFeedback,
  MdErrorOutline
} from 'react-icons/md';
import { api } from '../api/client';
import { selectStyles } from './SelectStyles';
import './HomePage.css';
import './MetricTabs.css';

const HomePage = ({ projects, projectsData, onNavigateToProject, currentUser }) => {
  const [recentCommentary, setRecentCommentary] = useState([]);
  const [atRiskMetrics, setAtRiskMetrics] = useState([]);
  const [ragFilter, setRagFilter] = useState('all'); // 'all', 'red', 'amber'
  const [spaces, setSpaces] = useState([]); // All available spaces
  const [spaceFilter, setSpaceFilter] = useState('all'); // 'all' or space_id
  const [portfolios, setPortfolios] = useState([]); // All portfolios
  const [portfolioFilter, setPortfolioFilter] = useState('all'); // 'all' or portfolio_id
  const [randomTips, setRandomTips] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false); // Track if data is currently being loaded
  const [recoveryPlans, setRecoveryPlans] = useState([]); // Track active recovery plans
  const [inconsistencies, setInconsistencies] = useState(null); // Inconsistency report data
  const [showTipsModal, setShowTipsModal] = useState(false); // Modal for tips
  const [showWhatsNewModal, setShowWhatsNewModal] = useState(false); // Modal for what's new
  const [expandedPMs, setExpandedPMs] = useState({}); // Track which PMs are expanded in inconsistency report

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

  // Randomize tips on component mount only
  useEffect(() => {
    selectRandomTips();
  }, []); // Only run once on mount

  // Load data when projects or projectsData change
  useEffect(() => {
    const numProjects = Object.keys(projects).length;
    const numProjectData = Object.keys(projectsData).length;

    if (numProjects > 0 && numProjectData > 0) {
      if (!loadingRef.current) {
        loadHomePageData();
      }
    }
  }, [Object.keys(projects).length, Object.keys(projectsData).length]); // Re-run when counts change

  const selectRandomTips = () => {
    const shuffled = [...allTips].sort(() => 0.5 - Math.random());
    setRandomTips(shuffled.slice(0, 5));
  };

  const loadHomePageData = async () => {
    if (loadingRef.current) return; // Prevent concurrent loads

    loadingRef.current = true;
    setLoading(true);
    try {
      // Load spaces and portfolios
      try {
        const [spacesResponse, portfoliosResponse] = await Promise.all([
          api.getSpaces(),
          api.get('/portfolios')
        ]);

        setSpaces(spacesResponse.data || []);
        setPortfolios(portfoliosResponse.data || []);

        // If user has a default space, set it
        if (currentUser && currentUser.default_space_id) {
          setSpaceFilter(currentUser.default_space_id.toString());
        }
      } catch (err) {
        console.log('Could not load spaces/portfolios:', err.message);
      }

      // Get recent commentary from audit log - filter for metric_periods table
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

      // Group commentary by portfolio and sort
      const groupedCommentary = enrichedCommentary.reduce((acc, comment) => {
        const portfolio = comment.portfolioName || 'No Portfolio';
        if (!acc[portfolio]) {
          acc[portfolio] = [];
        }
        acc[portfolio].push(comment);
        return acc;
      }, {});

      // Convert to array and sort portfolios alphabetically, then flatten
      const sortedCommentary = Object.entries(groupedCommentary)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([portfolio, comments]) => comments);

      setRecentCommentary(sortedCommentary);

      // Calculate at-risk metrics (red and amber) across all projects
      const atRiskMetricsList = [];

      console.log('Calculating at-risk metrics, projectsData:', Object.keys(projectsData).length, 'projects');

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

          // Find current period (period has started but next period hasn't started yet)
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let currentPeriodIndex = -1;
          for (let i = 0; i < sortedPeriods.length; i++) {
            const periodStart = new Date(sortedPeriods[i].reporting_date);
            periodStart.setHours(0, 0, 0, 0);

            if (periodStart <= today) {
              if (i + 1 < sortedPeriods.length) {
                const nextPeriodStart = new Date(sortedPeriods[i + 1].reporting_date);
                nextPeriodStart.setHours(0, 0, 0, 0);
                if (today < nextPeriodStart) {
                  currentPeriodIndex = i;
                  break;
                }
              } else {
                currentPeriodIndex = i;
              }
            }
          }

          if (currentPeriodIndex === -1) {
            console.log(`Skipping ${metricName} - no current period found`);
            return;
          }

          let currentPeriod = sortedPeriods[currentPeriodIndex];

          // Check if we're in the current period
          const isLastPeriod = currentPeriodIndex === sortedPeriods.length - 1;
          let isInCurrentPeriod = false;

          if (isLastPeriod) {
            isInCurrentPeriod = true;
          } else {
            const nextPeriodStart = new Date(sortedPeriods[currentPeriodIndex + 1].reporting_date);
            nextPeriodStart.setHours(0, 0, 0, 0);
            isInCurrentPeriod = today < nextPeriodStart;
          }

          // If we're in the current period and complete is 0, use the previous period instead
          if (isInCurrentPeriod && currentPeriodIndex > 0) {
            const currentComplete = parseFloat(currentPeriod.complete) || 0;
            if (currentComplete === 0) {
              console.log(`${metricName}: in current period with complete=0, using previous period`);
              currentPeriod = sortedPeriods[currentPeriodIndex - 1];
            }
          }

          const complete = parseFloat(currentPeriod.complete) || 0;
          const expected = parseFloat(currentPeriod.expected) || 0;

          console.log(`${metricName}: periods=${sortedPeriods.length}, currentIdx=${currentPeriodIndex}, complete=${complete}, expected=${expected}`);

          if (expected === 0) {
            console.log(`  -> Skipping: expected=0`);
            return;
          }

          const variance = complete - expected;
          const variancePercent = Math.abs((variance / expected) * 100);
          const redTolerance = parseFloat(currentPeriod.red_tolerance) || 10.0;
          const amberTolerance = parseFloat(currentPeriod.amber_tolerance) || 5.0;

          // Determine RAG status
          let ragStatus = 'green';
          if (variance < 0) {
            if (variancePercent > redTolerance) {
              ragStatus = 'red';
            } else if (variancePercent > amberTolerance) {
              ragStatus = 'amber';
            }
          }

          console.log(`  -> variance=${variancePercent.toFixed(1)}%, amber=${amberTolerance}%, red=${redTolerance}%, status=${ragStatus}`);

          // Add to list if red or amber
          if (ragStatus === 'red' || ragStatus === 'amber') {
            atRiskMetricsList.push({
              projectId,
              projectName: projectInfo.name,
              metricId: currentPeriod.metric_id,
              metricName,
              complete,
              expected,
              variancePercent: variancePercent.toFixed(1),
              portfolioId: projectInfo.portfolio_id,
              portfolioColor: projectInfo.portfolio_color,
              portfolioName: projectInfo.portfolio_name,
              ragStatus
            });
          }
        });
      });

      // Group by portfolio and sort
      const groupedByPortfolio = atRiskMetricsList.reduce((acc, metric) => {
        const portfolio = metric.portfolioName || 'No Portfolio';
        if (!acc[portfolio]) {
          acc[portfolio] = [];
        }
        acc[portfolio].push(metric);
        return acc;
      }, {});

      // Convert to array and sort portfolios alphabetically
      const sortedAtRiskMetrics = Object.entries(groupedByPortfolio)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([portfolio, metrics]) => metrics);

      console.log('At-risk metrics found:', sortedAtRiskMetrics.length, '(red:', sortedAtRiskMetrics.filter(m => m.ragStatus === 'red').length, ', amber:', sortedAtRiskMetrics.filter(m => m.ragStatus === 'amber').length, ')');
      setAtRiskMetrics(sortedAtRiskMetrics);

      // Load recovery plans for all projects to check which red metrics have active plans
      let recoveryPlansList = [];
      try {
        const allProjectIds = Object.keys(projects);
        const planPromises = allProjectIds.map(async (projectId) => {
          try {
            const response = await api.get(`/recovery-plans?project_id=${projectId}`);
            return response.data || [];
          } catch (err) {
            console.log(`Could not load recovery plans for project ${projectId}:`, err.message);
            return [];
          }
        });
        const allPlansArrays = await Promise.all(planPromises);
        recoveryPlansList = allPlansArrays.flat();
      } catch (err) {
        console.log('Could not load recovery plans:', err.message);
      }
      setRecoveryPlans(recoveryPlansList);

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

      // Fetch inconsistency report
      try {
        const inconsistencyResponse = await api.get('/inconsistency-report');
        setInconsistencies(inconsistencyResponse.data);
      } catch (inconsistencyErr) {
        console.log('Could not load inconsistency report:', inconsistencyErr.message);
      }
    } catch (err) {
      console.error('Failed to load home page data:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false; // Reset loading flag
    }
  };

  const handleMetricClick = (projectId, metricName) => {
    if (onNavigateToProject) {
      onNavigateToProject(projectId, metricName);
    }
  };

  // Check if a red metric needs a recovery plan
  const needsRecoveryPlan = (metricId) => {
    return !recoveryPlans.some(plan =>
      plan.metric_id === metricId && plan.status === 'active'
    );
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


  // Get unique portfolios from at-risk metrics, filtered by space
  const portfolioMap = new Map();
  atRiskMetrics.forEach(m => {
    if (m.portfolioId && !portfolioMap.has(m.portfolioId)) {
      // Find the portfolio to check its space_id
      const portfolio = portfolios.find(p => p.id === m.portfolioId);
      // Only include if space filter matches or is 'all'
      if (spaceFilter === 'all' || (portfolio && portfolio.space_id === parseInt(spaceFilter))) {
        portfolioMap.set(m.portfolioId, {
          id: m.portfolioId,
          name: m.portfolioName || 'No Portfolio',
          spaceId: portfolio ? portfolio.space_id : null
        });
      }
    }
  });
  const portfoliosInMetrics = Array.from(portfolioMap.values());

  // Filter metrics based on space, RAG filter, and portfolio filter
  let filteredMetrics = atRiskMetrics;

  // Apply space filter
  if (spaceFilter !== 'all') {
    filteredMetrics = filteredMetrics.filter(m => {
      const portfolio = portfolios.find(p => p.id === m.portfolioId);
      return portfolio && portfolio.space_id === parseInt(spaceFilter);
    });
  }

  // Apply RAG filter
  if (ragFilter !== 'all') {
    filteredMetrics = filteredMetrics.filter(m => m.ragStatus === ragFilter);
  }

  // Apply portfolio filter
  if (portfolioFilter !== 'all') {
    filteredMetrics = filteredMetrics.filter(m => m.portfolioId === parseInt(portfolioFilter));
  }

  const redCount = atRiskMetrics.filter(m => m.ragStatus === 'red').length;
  const amberCount = atRiskMetrics.filter(m => m.ragStatus === 'amber').length;

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
            <span className="stat-value green">{metricCount - atRiskMetrics.length}</span>
            <span className="stat-label">On Track</span>
          </div>
          <div className="stat-item">
            <span className="stat-value red">{atRiskMetrics.length}</span>
            <span className="stat-label">At Risk</span>
          </div>
        </div>
      </div>

      <div className={`home-grid ${feedback.length === 0 ? 'no-feedback' : ''}`}>
        {/* Top Left - Getting Started */}
        <div className="home-quadrant summary-quadrant">
          <div className="quadrant-header">
            <MdTrendingUp className="quadrant-icon" />
            <h2>Getting Started</h2>
          </div>
          <div className="quadrant-content">
            <div className="getting-started">
              <ul>
                <li>
                  <svg className="step-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 7V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7Z" stroke="currentColor" strokeWidth="2"/>
                    <path d="M3 7L10 5H14L21 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Add a project to a portfolio giving it a description that clearly defines the business outcome</span>
                </li>
                <li>
                  <svg className="step-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 3V6M15 3V6M3 10H21M5 5H19C20.1046 5 21 5.89543 21 7V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V7C3 5.89543 3.89543 5 5 5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="15" r="1.5" fill="currentColor"/>
                  </svg>
                  <span>Define measures that move each reporting period (lead measures) and measures that demonstrate success (lag measures). Give them sensible names and describe precisely what they measure.</span>
                </li>
                <li>
                  <svg className="step-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 17L6 14L10 18L18 7L21 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span>Describe the trajectory of these measures over time as an expected curve.</span>
                </li>
                <li>
                  <svg className="step-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M4 8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
                    <path d="M4 16H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
                    <circle cx="12" cy="12" r="2" fill="currentColor"/>
                    <path d="M8 8V16M16 8V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                  </svg>
                  <span>Define tolerances for deviation from the curve.</span>
                </li>
                <li>
                  <svg className="step-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 12L9 17L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="19" cy="19" r="3" fill="currentColor"/>
                  </svg>
                  <span>Each period update the completed values for each metric. If these are out of tolerance, provide commentary and a recovery plan.</span>
                </li>
                <li>
                  <svg className="step-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span>Keep an eye on the consistency panel of the home page for data quality issues.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Top Right - Metrics at Risk */}
        <div className="home-quadrant metrics-quadrant">
          <div className="quadrant-header">
            <MdWarning className="quadrant-icon warning" />
            <h2>Metrics at Risk</h2>
            <div className="filter-controls">
              <div className="rag-filter-buttons">
                <button
                  className={`rag-filter-btn ${ragFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setRagFilter('all')}
                >
                  All ({atRiskMetrics.length})
                </button>
                <button
                  className={`rag-filter-btn red ${ragFilter === 'red' ? 'active' : ''}`}
                  onClick={() => setRagFilter('red')}
                >
                  Red ({redCount})
                </button>
                <button
                  className={`rag-filter-btn amber ${ragFilter === 'amber' ? 'active' : ''}`}
                  onClick={() => setRagFilter('amber')}
                >
                  Amber ({amberCount})
                </button>
              </div>
              {spaces.length > 0 && (
                <Select
                  className="portfolio-filter-dropdown"
                  styles={selectStyles}
                  value={
                    spaceFilter === 'all'
                      ? { value: 'all', label: 'All Spaces' }
                      : spaces.find(s => s.id === parseInt(spaceFilter))
                        ? { value: spaces.find(s => s.id === parseInt(spaceFilter)).id, label: spaces.find(s => s.id === parseInt(spaceFilter)).name }
                        : { value: 'all', label: 'All Spaces' }
                  }
                  onChange={async (option) => {
                    const newSpaceFilter = option.value.toString();
                    setSpaceFilter(newSpaceFilter);
                    setPortfolioFilter('all'); // Reset portfolio filter when space changes
                    // Save user's preference if logged in
                    if (currentUser && newSpaceFilter !== 'all') {
                      try {
                        await api.updateDefaultSpace(parseInt(newSpaceFilter));
                      } catch (err) {
                        console.log('Could not save default space:', err.message);
                      }
                    }
                  }}
                  options={[
                    { value: 'all', label: 'All Spaces' },
                    ...spaces.map(space => ({
                      value: space.id,
                      label: space.name
                    }))
                  ]}
                  isSearchable={false}
                />
              )}
              {portfoliosInMetrics.length > 1 && (
                <Select
                  className="portfolio-filter-dropdown"
                  styles={selectStyles}
                  value={
                    portfolioFilter === 'all'
                      ? { value: 'all', label: 'All Portfolios' }
                      : portfoliosInMetrics.find(p => p.id === parseInt(portfolioFilter))
                        ? { value: portfoliosInMetrics.find(p => p.id === parseInt(portfolioFilter)).id, label: portfoliosInMetrics.find(p => p.id === parseInt(portfolioFilter)).name }
                        : { value: 'all', label: 'All Portfolios' }
                  }
                  onChange={(option) => setPortfolioFilter(option.value.toString())}
                  options={[
                    { value: 'all', label: 'All Portfolios' },
                    ...portfoliosInMetrics.map(portfolio => ({
                      value: portfolio.id,
                      label: portfolio.name
                    }))
                  ]}
                  isSearchable={false}
                />
              )}
            </div>
          </div>
          <div className="quadrant-content">
            {loading ? (
              <div className="loading-state">Loading...</div>
            ) : atRiskMetrics.length === 0 ? (
              <div className="empty-state success">
                <MdTrendingUp className="empty-icon" />
                <p>All metrics on track!</p>
                <span>No metrics are currently at risk</span>
              </div>
            ) : filteredMetrics.length === 0 ? (
              <div className="empty-state success">
                <MdTrendingUp className="empty-icon" />
                <p>No {ragFilter} metrics!</p>
                <span>Try selecting a different filter</span>
              </div>
            ) : (
              <div className="metrics-list">
                {filteredMetrics.map((item, index) => {
                  // Show portfolio header if this is the first metric in the portfolio
                  const showPortfolioHeader = index === 0 ||
                    item.portfolioName !== filteredMetrics[index - 1].portfolioName;

                  return (
                    <React.Fragment key={index}>
                      {showPortfolioHeader && (
                        <div className="portfolio-group-header">
                          {item.portfolioColor && (
                            <span
                              className="portfolio-header-dot"
                              style={{ backgroundColor: item.portfolioColor }}
                            />
                          )}
                          <span className="portfolio-header-name">
                            {item.portfolioName || 'No Portfolio'}
                          </span>
                        </div>
                      )}
                      <div
                        className={`metric-item ${item.ragStatus}`}
                        onClick={() => handleMetricClick(item.projectId, item.metricName)}
                      >
                        <div className="metric-left">
                          <div className="metric-header">
                            <div className="metric-text">
                              <span className="metric-project">{item.projectName}</span>
                              <span className="metric-name">{item.metricName}</span>
                            </div>
                            {item.ragStatus === 'red' && needsRecoveryPlan(item.metricId) && (
                              <div className="recovery-plan-indicator" title="Recovery Plan Required">
                                <MdErrorOutline />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="metric-right">
                          <span className={`metric-variance ${item.ragStatus}`}>-{item.variancePercent}%</span>
                          <div className="metric-progress">
                            <span className="progress-value">{item.complete}</span>
                            <span className="progress-separator">/</span>
                            <span className="progress-expected">{item.expected}</span>
                          </div>
                          <MdArrowForward className="metric-arrow" />
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
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
                {recentCommentary.map((item, index) => {
                  // Show portfolio header if this is the first comment in the portfolio
                  const showPortfolioHeader = index === 0 ||
                    item.portfolioName !== recentCommentary[index - 1].portfolioName;

                  return (
                    <React.Fragment key={index}>
                      {showPortfolioHeader && (
                        <div className="portfolio-group-header">
                          {item.portfolioColor && (
                            <span
                              className="portfolio-header-dot"
                              style={{ backgroundColor: item.portfolioColor }}
                            />
                          )}
                          <span className="portfolio-header-name">
                            {item.portfolioName || 'No Portfolio'}
                          </span>
                        </div>
                      )}
                      <div
                        className="commentary-item"
                        onClick={() => handleMetricClick(item.projectId, item.metricName)}
                      >
                        <div className="commentary-header">
                          <div className="commentary-context">
                            {item.portfolioColor && (
                              <span
                                className="commentary-portfolio-dot"
                                style={{ backgroundColor: item.portfolioColor }}
                              />
                            )}
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
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Right - Inconsistency Report */}
        <div className="home-quadrant inconsistency-quadrant">
          <div className="quadrant-header">
            <MdWarning className="quadrant-icon warning" />
            <h2>Inconsistencies</h2>
          </div>
          <div className="quadrant-content">
            {!inconsistencies ? (
              <div className="loading-text">Loading...</div>
            ) : inconsistencies.total_inconsistencies === 0 ? (
              <div className="no-inconsistencies">
                <MdCheckCircle style={{ fontSize: '48px', color: '#10b981', marginBottom: '8px' }} />
                <p>No inconsistencies found</p>
              </div>
            ) : (
              <div className="inconsistency-list">
                {inconsistencies.summary.map((pmData, index) => {
                  const isExpanded = expandedPMs[pmData.pm_name];
                  const displayedIssues = isExpanded ? pmData.issues : pmData.issues.slice(0, 3);

                  return (
                    <div key={index} className="inconsistency-pm-item">
                      <div className="inconsistency-pm-header">
                        <div className="pm-name-wrapper">
                          <MdPeople className="pm-icon" />
                          <span className="pm-name">{pmData.pm_name}</span>
                        </div>
                        <div className="inconsistency-counts">
                          <span className="total-count">{pmData.total}</span>
                        </div>
                      </div>
                      {displayedIssues.map((issue, idx) => {
                        // Create natural title based on issue type
                        let issueTitle = '';
                        let targetEntity = '';
                        let targetProjectId = issue.project_id;

                        if (issue.type === 'missing_recovery_plan' && issue.metric_name) {
                          issueTitle = `${issue.metric_name} is ${issue.rag_status?.toUpperCase()} but has No Recovery Plan`;
                          targetEntity = issue.metric_name;
                        } else if (issue.type === 'missing_metric_description' && issue.metric_name) {
                          issueTitle = `${issue.metric_name} is Missing a Description`;
                          targetEntity = issue.metric_name;
                        } else if (issue.type === 'missing_project_description' || issue.details === 'Project missing description') {
                          issueTitle = `${issue.project_name} is Missing a Description`;
                          targetEntity = issue.project_name;
                        } else if (issue.type === 'missing_documentation') {
                          issueTitle = `${issue.project_name} has No Documentation Links`;
                          targetEntity = issue.project_name;
                        } else {
                          issueTitle = issue.details;
                          targetEntity = issue.metric_name || issue.project_name;
                        }

                        return (
                          <div
                            key={idx}
                            className="inconsistency-detail"
                            onClick={() => onNavigateToProject(targetProjectId)}
                            style={{ cursor: 'pointer' }}
                          >
                            {issue.type === 'missing_recovery_plan' && issue.rag_status && (
                              <span
                                className={`metric-rag-marker ${issue.rag_status}`}
                                title={issue.rag_status === 'red' ? 'Behind schedule' : 'At risk'}
                                style={{ marginRight: '8px', flexShrink: 0 }}
                              />
                            )}
                            <div className="issue-content">
                              <div className="issue-title">{issueTitle}</div>
                              <div className="issue-subtitle">
                                {issue.project_name}
                                {issue.age_days > 0 && (
                                  <span className="issue-age"> • {issue.age_days}d old</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {pmData.issues.length > 3 && (
                        <div
                          className="more-issues"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedPMs(prev => ({
                              ...prev,
                              [pmData.pm_name]: !prev[pmData.pm_name]
                            }));
                          }}
                        >
                          {isExpanded ? 'Show less' : `+${pmData.issues.length - 3} more`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showTipsModal && (
        <div className="modal-overlay" onClick={() => setShowTipsModal(false)}>
          <div className="modal-content tips-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <MdLightbulb className="modal-icon" />
              <h2>Tips & Best Practices</h2>
              <button className="modal-close" onClick={() => setShowTipsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {allTips.map((tip, index) => (
                <div key={index} className="modal-tip-item">
                  <div className="tip-icon-wrapper">{tip.icon}</div>
                  <div className="tip-content">
                    <h3 className="tip-title">{tip.title}</h3>
                    <p className="tip-description">{tip.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showWhatsNewModal && (
        <div className="modal-overlay" onClick={() => setShowWhatsNewModal(false)}>
          <div className="modal-content whats-new-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <MdNotifications className="modal-icon" />
              <h2>What's New</h2>
              <button className="modal-close" onClick={() => setShowWhatsNewModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="whats-new-item">
                <div className="feature-icon"><MdWarning /></div>
                <div className="feature-content">
                  <h3>Inconsistency Report</h3>
                  <p>Automatically identifies data quality issues including missing recovery plans, descriptions, and documentation. Shows issues grouped by PM with severity indicators.</p>
                </div>
              </div>
              <div className="whats-new-item">
                <div className="feature-icon"><MdBuild /></div>
                <div className="feature-content">
                  <h3>Recovery Plans</h3>
                  <p>Create and track recovery plans for red and amber metrics. Set target dates, monitor progress, and document completion.</p>
                </div>
              </div>
              <div className="whats-new-item">
                <div className="feature-icon"><MdVisibility /></div>
                <div className="feature-content">
                  <h3>Page Analytics</h3>
                  <p>Track page views and user navigation patterns. View heatmaps showing most visited pages and user engagement.</p>
                </div>
              </div>
              <div className="whats-new-item">
                <div className="feature-icon"><MdFileDownload /></div>
                <div className="feature-content">
                  <h3>Chart Export</h3>
                  <p>Export metric charts as PNG images or PDF documents. Perfect for sharing with stakeholders or including in presentations.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Section - Full Width - Only show if there's feedback */}
      {!loading && feedback.length > 0 && (
        <div className="feedback-section">
          <div className="feedback-header">
            <MdFeedback className="feedback-icon" />
            <h2>Feedback on Your Projects</h2>
          </div>
          <div className="feedback-content">
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
          </div>
        </div>
      )}

      {/* Footer Links */}
      <div className="homepage-footer">
        <button className="footer-link" onClick={() => setShowTipsModal(true)}>
          <MdLightbulb /> Tips & Best Practices
        </button>
        <button className="footer-link" onClick={() => setShowWhatsNewModal(true)}>
          <MdNotifications /> What's New
        </button>
      </div>
    </div>
  );
};

export default HomePage;
