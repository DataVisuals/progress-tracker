import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  MdErrorOutline,
  MdBugReport,
  MdSettings,
  MdPieChart,
  MdAccessTime,
  MdFavorite,
  MdRemove,
  MdAdd,
  MdClose,
  MdLock
} from 'react-icons/md';
import { FaDatabase } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, RadialBarChart, RadialBar, Legend, PolarAngleAxis, LabelList, Treemap, CartesianGrid, PieChart, Pie } from 'recharts';
import { api } from '../api/client';
import { trackPage } from '../hooks/usePageTracking';
import { smallSelectStyles } from './SelectStyles';
import DashboardConfigModal from './DashboardConfigModal';
import TipsModal, { getAllTips } from './TipsModal';
import UserInconsistenciesModal from './UserInconsistenciesModal';
import { PANEL_CONFIG, LAYOUT_CONFIG, DEFAULT_DASHBOARD_CONFIG } from './homePageConfig';
import { calculateHealthScore } from './ProjectHealthModal';
import './HomePage.css';
import './MetricTabs.css';

const HomePage = ({
  projects,
  projectsData,
  onNavigateToProject,
  currentUser,
  selectedSpace = 'all',
  spaces = [],
  portfolios = [],
  darkMode = false,
  onAttentionCountChange,
  showAttentionModal,
  onAttentionModalShown,
  showTipsModal = false,
  setShowTipsModal,
  setSelectedTipsCategory
}) => {

  const [recentCommentary, setRecentCommentary] = useState([]);
  const [atRiskMetrics, setAtRiskMetrics] = useState([]);
  const [ragFilter, setRagFilter] = useState('all'); // 'all', 'red', 'amber'
  const [portfolioFilter, setPortfolioFilter] = useState('all'); // 'all' or portfolio_id for metrics
  const [commentaryPortfolioFilter, setCommentaryPortfolioFilter] = useState('all'); // 'all' or portfolio_id for commentary
  const [randomTips, setRandomTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false); // Track if data is currently being loaded
  const [recoveryPlans, setRecoveryPlans] = useState([]); // Track active recovery plans
  const [inconsistencies, setInconsistencies] = useState(null); // Inconsistency report data
  const [pageHeatmap, setPageHeatmap] = useState(null); // Page heatmap data for quadrant
  const [showUserInconsistenciesModal, setShowUserInconsistenciesModal] = useState(false); // Modal for user's own inconsistencies
  const [userInconsistenciesDismissed, setUserInconsistenciesDismissed] = useState(false); // Track if user dismissed the modal
  const [expandedPMs, setExpandedPMs] = useState({}); // Track which PMs are expanded in inconsistency report
  const [userProjectFeedback, setUserProjectFeedback] = useState([]); // Unresolved feedback on user's projects
  const [viewsDays, setViewsDays] = useState(() => {
    // Initialize from localStorage with fallback to 7 days
    const stored = localStorage.getItem('mostViewedProjectsDays');
    const parsed = stored ? parseInt(stored, 10) : null;
    return [1, 7, 30, 90].includes(parsed) ? parsed : 7;
  });
  const [changesSinceLastVisit, setChangesSinceLastVisit] = useState(null); // Changes since last visit
  const [showConfigModal, setShowConfigModal] = useState(false); // Dashboard config modal
  const [auditHoveredDateIdx, setAuditHoveredDateIdx] = useState(null); // Audit log timeline hover state
  const [auditSelectedDateIdx, setAuditSelectedDateIdx] = useState(null); // Audit log timeline selected/locked state
  const [dashboardConfig, setDashboardConfig] = useState(() => {
    // Load from localStorage or use default
    const stored = localStorage.getItem('homePageDashboardConfig');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return DEFAULT_DASHBOARD_CONFIG;
      }
    }
    return DEFAULT_DASHBOARD_CONFIG;
  });
  const [auditLog, setAuditLog] = useState([]); // Audit log data for admin panel
  const [auditTimeline, setAuditTimeline] = useState([]); // Timeline counts for audit visualization
  const [auditSelectedDate, setAuditSelectedDate] = useState(null); // Selected date string for lazy loading
  const [databaseStats, setDatabaseStats] = useState(null); // Database stats for admin panel
  const [activeUsers, setActiveUsers] = useState(null); // Active users for admin panel
  const [userActivity, setUserActivity] = useState(null); // User activity data for fullscreen admin panel
  const [userActivityDays, setUserActivityDays] = useState(30); // Days for user activity report
  const [healthRankingView, setHealthRankingView] = useState('top'); // 'top' or 'bottom' for health rankings panel
  const [hideInactiveProjects, setHideInactiveProjects] = useState(true); // Filter inactive (grey) projects by default
  const [minimizedPanels, setMinimizedPanels] = useState(() => {
    // Load minimized panels from localStorage
    const stored = localStorage.getItem('homePageMinimizedPanels');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [expandedDockPanel, setExpandedDockPanel] = useState(null); // Panel ID currently expanded from dock
  const hoverTimeoutRef = useRef(null); // Timeout for hover delay

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'admin';

  // Tips from TipsModal
  const allTips = useMemo(() => getAllTips(), []);

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
  }, [Object.keys(projects).length, Object.keys(projectsData).length, selectedSpace, portfolios]); // Re-run when counts change or space/portfolios change

  // Refetch project views when viewsDays changes
  useEffect(() => {
    const fetchProjectViews = async () => {
      try {
        const spaceParam = selectedSpace !== 'all' ? `&space_id=${selectedSpace}` : '';
        const viewsResponse = await api.get(`/project-views?days=${viewsDays}${spaceParam}`);
        setPageHeatmap(viewsResponse.data);
      } catch (viewsErr) {
        setPageHeatmap({ by_path: [], error: true });
      }
    };
    // Only fetch if we have projects loaded
    if (Object.keys(projects).length > 0) {
      fetchProjectViews();
    }
  }, [viewsDays, selectedSpace]);

  const selectRandomTips = () => {
    const shuffled = [...allTips].sort(() => 0.5 - Math.random());
    setRandomTips(shuffled.slice(0, 5));
  };

  const loadHomePageData = async (panelsOverride = null) => {
    if (loadingRef.current) return; // Prevent concurrent loads

    loadingRef.current = true;
    setLoading(true);
    try {
      // Spaces and portfolios are now passed in as props from App.jsx

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
            portfolioId: projectInfo ? projectInfo[1].portfolio_id : null,
            portfolioColor: projectInfo ? projectInfo[1].portfolio_color : null,
            portfolioName: projectInfo ? projectInfo[1].portfolio_name : null
          };
        });

        // Filter by selected space (defensive: only if portfolios have space_id)
        if (selectedSpace && selectedSpace !== 'all' && portfolios && portfolios.length > 0) {
          const hasSpaceIds = portfolios.some(p => p.space_id !== undefined);
          if (hasSpaceIds) {
            const spacePortfolioIds = portfolios
              .filter(p => p.space_id === parseInt(selectedSpace))
              .map(p => p.id);
            enrichedCommentary = enrichedCommentary.filter(comment =>
              !comment.portfolioId || spacePortfolioIds.includes(comment.portfolioId)
            );
          }
        }
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
          // Get the final target from the last period (the ultimate goal)
          const lastPeriod = sortedPeriods[sortedPeriods.length - 1];
          const finalTarget = parseFloat(lastPeriod.target) || parseFloat(lastPeriod.expected) || expected;

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
              target: finalTarget,
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
      let sortedAtRiskMetrics = Object.entries(groupedByPortfolio)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([portfolio, metrics]) => metrics);

      // Filter by selected space (defensive: only if portfolios have space_id)
      if (selectedSpace && selectedSpace !== 'all' && portfolios && portfolios.length > 0) {
        const hasSpaceIds = portfolios.some(p => p.space_id !== undefined);
        if (hasSpaceIds) {
          const spacePortfolioIds = portfolios
            .filter(p => p.space_id === parseInt(selectedSpace))
            .map(p => p.id);
          sortedAtRiskMetrics = sortedAtRiskMetrics.filter(metric =>
            !metric.portfolioId || spacePortfolioIds.includes(metric.portfolioId)
          );
        }
      }

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

      // Fetch inconsistency report
      try {
        const inconsistencyResponse = await api.get('/inconsistency-report');
        let inconsistencyData = inconsistencyResponse.data;

        // Filter by selected space (defensive: only if portfolios have space_id)
        if (selectedSpace && selectedSpace !== 'all' && inconsistencyData && inconsistencyData.summary && portfolios && portfolios.length > 0) {
          const hasSpaceIds = portfolios.some(p => p.space_id !== undefined);
          if (hasSpaceIds) {
            const spacePortfolioIds = portfolios
              .filter(p => p.space_id === parseInt(selectedSpace))
              .map(p => p.id);

            console.log('Filtering inconsistencies by space:', selectedSpace);
            console.log('Space portfolio IDs:', spacePortfolioIds);
            console.log('Inconsistency data structure:', inconsistencyData);

            // Filter the summary to only include issues for projects in the selected space
            inconsistencyData = {
              ...inconsistencyData,
              summary: inconsistencyData.summary
                .map(pmData => {
                  // Filter issues for this PM
                  const filteredIssues = pmData.issues.filter(issue => {
                    const projectData = projects[issue.project_id];
                    if (!projectData) return false;
                    // Exclude projects without portfolio_id
                    if (!projectData.portfolio_id) return false;
                    return spacePortfolioIds.includes(projectData.portfolio_id);
                  });

                // Recalculate severity counts
                const severityCounts = {
                  high: filteredIssues.filter(i => i.severity === 'high').length,
                  medium: filteredIssues.filter(i => i.severity === 'medium').length,
                  low: filteredIssues.filter(i => i.severity === 'low').length
                };

                // Return filtered PM data
                return {
                  ...pmData,
                  issues: filteredIssues,
                  total: filteredIssues.length,
                  high: severityCounts.high,
                  medium: severityCounts.medium,
                  low: severityCounts.low
                };
              })
              .filter(pmData => pmData.total > 0), // Remove PMs with no issues
            total_inconsistencies: 0 // Recalculate below
          };

            // Recalculate total inconsistencies
            inconsistencyData.total_inconsistencies = inconsistencyData.summary.reduce(
              (sum, pmData) => sum + pmData.total,
              0
            );

            console.log('Filtered inconsistencies:', inconsistencyData.total_inconsistencies);
          }
        }

        setInconsistencies(inconsistencyData);
      } catch (inconsistencyErr) {
        console.log('Could not load inconsistency report:', inconsistencyErr.message);
      }

      // Load project view data for quadrant (top 10 projects by views)
      try {
        const spaceParam = selectedSpace !== 'all' ? `&space_id=${selectedSpace}` : '';
        const viewsResponse = await api.get(`/project-views?days=${viewsDays}${spaceParam}`);
        setPageHeatmap(viewsResponse.data);
      } catch (viewsErr) {
        setPageHeatmap({ by_path: [], error: true }); // Set empty data on error
      }

      // Load recent feedback on user's projects
      try {
        const feedbackResponse = await api.getMyProjectsFeedback({ limit: 5, days: 30 });
        setUserProjectFeedback(feedbackResponse.data || []);
      } catch (feedbackErr) {
        console.log('Could not load project feedback:', feedbackErr.message);
        setUserProjectFeedback([]);
      }

      // Track Home page view first, then load changes since last visit
      // This ensures the page view is recorded before calculating changes
      try {
        await trackPage('Home');
        const spaceParam = selectedSpace !== 'all' ? `?space_id=${selectedSpace}` : '';
        const changesResponse = await api.get(`/changes-since-last-visit${spaceParam}`);
        setChangesSinceLastVisit(changesResponse.data);
      } catch (changesErr) {
        setChangesSinceLastVisit(null);
      }

      // Load admin panel data if user is admin
      // Always load all admin data since toolbar gives access to any panel
      if (isAdmin) {
        // Load audit timeline (for visualization)
        try {
          const timelineResponse = await api.getAuditTimeline(14);
          setAuditTimeline(timelineResponse.data || []);
        } catch (timelineErr) {
          console.log('Could not load audit timeline:', timelineErr.message);
          setAuditTimeline([]);
        }

        // Load audit log (recent entries)
        try {
          const auditResponse = await api.get('/audit?limit=50');
          setAuditLog(auditResponse.data || []);
        } catch (auditErr) {
          console.log('Could not load audit log:', auditErr.message);
          setAuditLog([]);
        }

        // Load database stats
        try {
          const dbStatsResponse = await api.get('/admin/database-stats');
          setDatabaseStats(dbStatsResponse.data);
        } catch (dbErr) {
          console.log('Could not load database stats:', dbErr.message);
          setDatabaseStats({ error: dbErr.message });
        }

        // Load active users
        try {
          const activeUsersResponse = await api.get('/admin/active-users');
          setActiveUsers(activeUsersResponse.data);
        } catch (auErr) {
          console.log('Could not load active users:', auErr.message);
          setActiveUsers({ error: auErr.message });
        }

        // Load user activity data
        try {
          const activityResponse = await api.get(`/admin/user-activity?days=${userActivityDays}`);
          setUserActivity(activityResponse.data);
        } catch (actErr) {
          console.log('Could not load user activity:', actErr.message);
          setUserActivity({ error: actErr.message });
        }
      }
    } catch (err) {
      console.error('Failed to load home page data:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false; // Reset loading flag
    }
  };

  // Get current user's inconsistencies
  const userInconsistencies = React.useMemo(() => {
    if (!inconsistencies || !currentUser?.name) return [];
    const userPmData = inconsistencies.summary?.find(pm => pm.pm_name === currentUser.name);
    return userPmData?.issues || [];
  }, [inconsistencies, currentUser?.name]);

  // Notify parent of attention count changes
  useEffect(() => {
    if (onAttentionCountChange) {
      onAttentionCountChange(userInconsistencies.length + userProjectFeedback.length);
    }
  }, [userInconsistencies.length, userProjectFeedback.length, onAttentionCountChange]);

  // Handle external request to show attention modal
  useEffect(() => {
    if (showAttentionModal) {
      setShowUserInconsistenciesModal(true);
      if (onAttentionModalShown) {
        onAttentionModalShown();
      }
    }
  }, [showAttentionModal, onAttentionModalShown]);

  // Escape key handler for hover preview
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && expandedDockPanel) {
        dismissPreview();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expandedDockPanel]);

  // Fetch audit log entries when a date is selected
  useEffect(() => {
    const fetchAuditEntriesForDate = async () => {
      if (auditSelectedDateIdx === null || auditTimeline.length === 0) {
        // No date selected, load recent entries
        try {
          const response = await api.get('/audit?limit=50');
          setAuditLog(response.data || []);
        } catch (err) {
          console.log('Could not load audit log:', err.message);
        }
        return;
      }

      // Get the date string from timeline data
      const selectedDate = auditTimeline[auditSelectedDateIdx]?.date;
      if (!selectedDate) return;

      try {
        const response = await api.get(`/audit?date=${selectedDate}&limit=200`);
        setAuditLog(response.data || []);
      } catch (err) {
        console.log('Could not load audit log for date:', err.message);
      }
    };

    fetchAuditEntriesForDate();
  }, [auditSelectedDateIdx, auditTimeline]);

  const handleMetricClick = (projectId, metricName) => {
    if (onNavigateToProject) {
      onNavigateToProject(projectId, metricName);
    }
  };

  // Handle dashboard config save
  const handleConfigSave = (newConfig) => {
    // Get panel count for the selected layout
    const layoutConfig = LAYOUT_CONFIG[newConfig.layout] || LAYOUT_CONFIG['2x2'];
    const maxPanels = layoutConfig.panelCount;

    // If more panels selected than layout allows, auto-minimize the excess
    if (newConfig.panels.length > maxPanels) {
      const visiblePanels = newConfig.panels.slice(0, maxPanels);
      const excessPanels = newConfig.panels.slice(maxPanels);

      // Add excess panels to minimized (avoiding duplicates)
      const newMinimized = [...new Set([...minimizedPanels, ...excessPanels])];
      setMinimizedPanels(newMinimized);
      localStorage.setItem('homePageMinimizedPanels', JSON.stringify(newMinimized));

      // Update config with only visible panels
      newConfig = { ...newConfig, panels: visiblePanels };
    }

    setDashboardConfig(newConfig);
    localStorage.setItem('homePageDashboardConfig', JSON.stringify(newConfig));
    setShowConfigModal(false);
    // Reload data to fetch any newly required admin panel data
    // Pass all panels (visible + minimized) since state hasn't updated yet
    loadHomePageData([...newConfig.panels, ...minimizedPanels]);
  };

  // Minimize a panel to the dock
  const minimizePanel = (panelId) => {
    const newMinimized = [...minimizedPanels, panelId];
    setMinimizedPanels(newMinimized);
    localStorage.setItem('homePageMinimizedPanels', JSON.stringify(newMinimized));
  };

  // Restore a panel from the dock to the dashboard
  const restorePanel = (panelId) => {
    // Get current layout's panel count
    const layoutConfig = LAYOUT_CONFIG[dashboardConfig.layout] || LAYOUT_CONFIG['2x2'];
    const maxPanels = layoutConfig.panelCount;
    const currentPanels = dashboardConfig.panels || [];

    // Only add if there's room in the current layout
    if (currentPanels.length < maxPanels) {
      const newPanels = [...currentPanels, panelId];
      const newConfig = { ...dashboardConfig, panels: newPanels };
      setDashboardConfig(newConfig);
      localStorage.setItem('homePageDashboardConfig', JSON.stringify(newConfig));
    }

    // Remove from minimized list if it was there
    const newMinimized = minimizedPanels.filter(id => id !== panelId);
    setMinimizedPanels(newMinimized);
    localStorage.setItem('homePageMinimizedPanels', JSON.stringify(newMinimized));
    setExpandedDockPanel(null);
  };

  // Hover preview handlers with delay
  const handlePanelHoverStart = (panelId) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // Set a delay before showing preview
    hoverTimeoutRef.current = setTimeout(() => {
      setExpandedDockPanel(panelId);
    }, 300);
  };

  const handlePanelHoverEnd = () => {
    // Clear timeout if hovering ended before delay
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setExpandedDockPanel(null);
  };

  const dismissPreview = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setExpandedDockPanel(null);
  };

  // Check if a red metric needs a recovery plan
  const needsRecoveryPlan = (metricId) => {
    return !recoveryPlans.some(plan =>
      plan.metric_id === metricId && plan.status === 'active'
    );
  };

  // Get item display limit based on current layout
  // More space = more items shown
  const getDisplayLimit = () => {
    const layout = dashboardConfig.layout || '2x2';
    switch (layout) {
      case '1x1': return 25;  // Full screen - show many items
      case '1x2':
      case '2x1': return 15;  // Half screen - show more items
      case '3x2': return 8;   // Many panels - show fewer items
      default: return 10;     // 2x2, 2x2-1x1 - default
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

  const formatAuditTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const isToday = date.toDateString() === now.toDateString();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diffMins < 60) return `${diffMins}m ago`;
    if (isToday) return time;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
  };

  // Filter projects by space
  const hasSpaceIds = portfolios && portfolios.length > 0 && portfolios.some(p => p.space_id !== undefined);
  const filteredProjects = Object.entries(projects).filter(([id, project]) => {
    if (selectedSpace === 'all' || !hasSpaceIds) return true;
    const portfolio = portfolios.find(p => p.id === project.portfolio_id);
    return portfolio && portfolio.space_id === parseInt(selectedSpace);
  });

  const projectCount = filteredProjects.length;

  // Calculate metric count from filtered projects only
  const metricCount = filteredProjects.reduce((sum, [id, project]) => {
    const data = projectsData[id];
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
      // Only include if space filter matches or is 'all' (defensive: only check space_id if it exists)
      const matchesSpace = selectedSpace === 'all' ||
        !hasSpaceIds ||
        (portfolio && portfolio.space_id === parseInt(selectedSpace));

      if (matchesSpace) {
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

  // Apply space filter (defensive: only if portfolios have space_id)
  if (selectedSpace !== 'all' && hasSpaceIds) {
    filteredMetrics = filteredMetrics.filter(m => {
      const portfolio = portfolios.find(p => p.id === m.portfolioId);
      return portfolio && portfolio.space_id === parseInt(selectedSpace);
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

  // Get unique portfolios from commentary for filter dropdown
  const portfoliosInCommentary = useMemo(() => {
    const portfolioMap = new Map();
    recentCommentary.forEach(comment => {
      if (comment.portfolioId && !portfolioMap.has(comment.portfolioId)) {
        portfolioMap.set(comment.portfolioId, {
          id: comment.portfolioId,
          name: comment.portfolioName || 'No Portfolio'
        });
      }
    });
    return Array.from(portfolioMap.values());
  }, [recentCommentary]);

  // Helper function to check if a color is grey/gray (inactive)
  const isGreyColor = (color) => {
    if (!color) return false;
    const greyColors = ['#808080', '#888888', '#888', '#6b7280', '#9ca3af', '#gray', '#grey'];
    const lowerColor = color.toLowerCase();
    // Check exact matches
    if (greyColors.includes(lowerColor)) return true;
    // Check if it's a grey hex (R, G, B values are similar)
    if (lowerColor.startsWith('#') && (lowerColor.length === 4 || lowerColor.length === 7)) {
      let r, g, b;
      if (lowerColor.length === 4) {
        r = parseInt(lowerColor[1] + lowerColor[1], 16);
        g = parseInt(lowerColor[2] + lowerColor[2], 16);
        b = parseInt(lowerColor[3] + lowerColor[3], 16);
      } else {
        r = parseInt(lowerColor.slice(1, 3), 16);
        g = parseInt(lowerColor.slice(3, 5), 16);
        b = parseInt(lowerColor.slice(5, 7), 16);
      }
      // Check if values are close to each other (grey) and in the middle range
      const maxDiff = Math.max(r, g, b) - Math.min(r, g, b);
      const avg = (r + g + b) / 3;
      return maxDiff < 30 && avg > 80 && avg < 180; // Grey-ish range
    }
    return false;
  };

  // Calculate project health rankings
  const projectHealthRankings = useMemo(() => {
    if (!projects || !projectsData || Object.keys(projectsData).length === 0) {
      return { top: [], bottom: [] };
    }

    // Convert projects object to array with IDs
    const projectsArray = Object.entries(projects).map(([id, project]) => ({
      ...project,
      id: parseInt(id)
    }));

    // Filter projects by selected space
    let spaceFilteredProjects = [...projectsArray];
    if (selectedSpace !== 'all' && hasSpaceIds) {
      spaceFilteredProjects = projectsArray.filter(p => {
        const portfolio = portfolios.find(pf => pf.id === p.portfolio_id);
        return portfolio && portfolio.space_id === parseInt(selectedSpace);
      });
    }

    // Calculate health score for each project
    const projectsWithHealth = spaceFilteredProjects.map(project => {
      const projectData = projectsData[project.id] || [];

      // Extract unique metrics from the period data
      const metricsMap = {};
      projectData.forEach(period => {
        if (period.metric_id && !metricsMap[period.metric_id]) {
          metricsMap[period.metric_id] = {
            id: period.metric_id,
            name: period.metric,
            description: period.metric_description || ''
          };
        }
      });
      const metrics = Object.values(metricsMap);

      const healthScore = calculateHealthScore(
        project,
        projectData,
        metrics,
        recoveryPlans.filter(rp => rp.project_id === project.id),
        project.link_count || 0
      );

      const portfolioColor = portfolios.find(p => p.id === project.portfolio_id)?.color || '#6b7280';

      return {
        ...project,
        healthScore,
        portfolioName: portfolios.find(p => p.id === project.portfolio_id)?.name || 'No Portfolio',
        portfolioColor,
        isInactive: isGreyColor(portfolioColor)
      };
    });

    // Filter out inactive projects if the filter is enabled
    const filteredProjects = hideInactiveProjects
      ? projectsWithHealth.filter(p => !p.isInactive)
      : projectsWithHealth;

    // Sort by health score
    const sorted = [...filteredProjects].sort((a, b) => b.healthScore - a.healthScore);

    // Dynamic limit based on layout (used for non-fullscreen)
    const layout = dashboardConfig.layout || '2x2';
    const limit = layout === '1x1' ? 25 : (layout === '1x2' || layout === '2x1') ? 15 : layout === '3x2' ? 8 : 10;

    // Get top (highest scores) and bottom (lowest scores)
    const top = sorted.slice(0, limit);
    // Bottom shows lowest scoring projects, reversed so worst is first
    const bottom = sorted.length > 0
      ? [...sorted].reverse().slice(0, limit)
      : [];

    // Also return all sorted for fullscreen view
    const allSorted = sorted;
    const allReversed = [...sorted].reverse();

    return { top, bottom, allSorted, allReversed };
  }, [projects, projectsData, portfolios, selectedSpace, hasSpaceIds, recoveryPlans, hideInactiveProjects, dashboardConfig.layout]);

  // Filter commentary based on portfolio filter
  const filteredCommentary = commentaryPortfolioFilter === 'all'
    ? recentCommentary
    : recentCommentary.filter(c => c.portfolioId === parseInt(commentaryPortfolioFilter));

  // Calculate space-filtered at-risk metrics for stats
  const spaceFilteredAtRisk = selectedSpace !== 'all' && hasSpaceIds
    ? atRiskMetrics.filter(m => {
        const portfolio = portfolios.find(p => p.id === m.portfolioId);
        return portfolio && portfolio.space_id === parseInt(selectedSpace);
      })
    : atRiskMetrics;

  const redCount = spaceFilteredAtRisk.filter(m => m.ragStatus === 'red').length;
  const amberCount = spaceFilteredAtRisk.filter(m => m.ragStatus === 'amber').length;

  // Get current layout configuration
  const currentLayout = LAYOUT_CONFIG[dashboardConfig?.layout] || LAYOUT_CONFIG['2x2'];

  // Render a panel by its ID
  const renderPanel = (panelId, index, forDock = false) => {
    // Skip minimized panels unless rendering for dock
    if (!forDock && minimizedPanels.includes(panelId)) {
      return null;
    }

    switch (panelId) {
      case 'heatmap':
        return (
          <div key={panelId} className={`home-quadrant heatmap-quadrant panel-${index + 1}`}>
            <div className="quadrant-header">
              <MdVisibility className="quadrant-icon" />
              <h2>Most Viewed Projects</h2>
              <Select
                key={`views-days-${darkMode}`}
                className="portfolio-filter-dropdown"
                styles={smallSelectStyles}
                value={{ value: viewsDays, label: viewsDays === 1 ? 'Last 24 hours' : `Last ${viewsDays} days` }}
                onChange={(option) => {
                  setViewsDays(option.value);
                  localStorage.setItem('mostViewedProjectsDays', option.value.toString());
                }}
                options={[
                  { value: 1, label: 'Last 24 hours' },
                  { value: 7, label: 'Last 7 days' },
                  { value: 30, label: 'Last 30 days' },
                  { value: 90, label: 'Last 90 days' }
                ]}
                isSearchable={false}
              />
                          </div>
            <div className="quadrant-content">
              {pageHeatmap && pageHeatmap.by_path ? (
                <div className="heatmap-list">
                  {(() => {
                    const projectItems = pageHeatmap.by_path.filter(item => item.path.startsWith('Project: '));
                    const maxViews = projectItems[0]?.views || 1;
                    const getHeatColor = (ratio) => {
                      if (ratio > 0.75) return '#dc2626';
                      if (ratio > 0.5) return '#f59e0b';
                      if (ratio > 0.25) return '#10b981';
                      return '#60a5fa';
                    };
                    return projectItems.slice(0, forDock ? 50 : getDisplayLimit()).map((item) => {
                      const projectName = item.path.replace('Project: ', '');
                      const ratio = item.views / maxViews;
                      const heatColor = getHeatColor(ratio);
                      return (
                        <div key={item.path} className="heatmap-row" onClick={() => {
                          const projectEntry = Object.entries(projects).find(([id, p]) => p.name === projectName);
                          if (projectEntry && onNavigateToProject) {
                            onNavigateToProject(parseInt(projectEntry[0]));
                          }
                        }}>
                          <span className="heatmap-name" title={projectName}>{projectName}</span>
                          <div className="heatmap-bar-container">
                            <div className="heatmap-bar" style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: heatColor }} />
                          </div>
                          <span className="heatmap-views">{item.views}</span>
                        </div>
                      );
                    });
                  })()}
                  {pageHeatmap.by_path.filter(item => item.path.startsWith('Project: ')).length === 0 && (
                    <div className="empty-state">No project views recorded yet</div>
                  )}
                </div>
              ) : (
                <div className="empty-state">Loading view data...</div>
              )}
              <div className="heatmap-legend">
                <div className="legend-item"><span className="legend-color" style={{ background: '#dc2626' }} /><span>Hot</span></div>
                <div className="legend-item"><span className="legend-color" style={{ background: '#f59e0b' }} /><span>Warm</span></div>
                <div className="legend-item"><span className="legend-color" style={{ background: '#10b981' }} /><span>Cool</span></div>
                <div className="legend-item"><span className="legend-color" style={{ background: '#60a5fa' }} /><span>Cold</span></div>
              </div>
            </div>
          </div>
        );

      case 'metrics':
        return (
          <div key={panelId} className={`home-quadrant metrics-quadrant panel-${index + 1}`}>
            <div className="quadrant-header">
              <MdSpeed className="quadrant-icon warning" />
              <h2>Metrics at Risk</h2>
              <div className="filter-controls">
                <div className="rag-filter-buttons">
                  <button className={`rag-filter-btn ${ragFilter === 'all' ? 'active' : ''}`} onClick={() => setRagFilter('all')}>All ({atRiskMetrics.length})</button>
                  <button className={`rag-filter-btn red ${ragFilter === 'red' ? 'active' : ''}`} onClick={() => setRagFilter('red')}>Red ({redCount})</button>
                  <button className={`rag-filter-btn amber ${ragFilter === 'amber' ? 'active' : ''}`} onClick={() => setRagFilter('amber')}>Amber ({amberCount})</button>
                </div>
                {portfoliosInMetrics.length > 1 && (
                  <Select
                    key={`metrics-portfolio-${darkMode}`}
                    className="portfolio-filter-dropdown"
                    styles={smallSelectStyles}
                    value={portfolioFilter === 'all' ? { value: 'all', label: 'All Portfolios' } : portfoliosInMetrics.find(p => p.id === parseInt(portfolioFilter)) ? { value: portfoliosInMetrics.find(p => p.id === parseInt(portfolioFilter)).id, label: portfoliosInMetrics.find(p => p.id === parseInt(portfolioFilter)).name } : { value: 'all', label: 'All Portfolios' }}
                    onChange={(option) => setPortfolioFilter(option.value.toString())}
                    options={[{ value: 'all', label: 'All Portfolios' }, ...portfoliosInMetrics.map(portfolio => ({ value: portfolio.id, label: portfolio.name }))]}
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
                  <span>No metrics at risk for {selectedSpace === 'all' ? 'All Spaces' : spaces.find(s => s.id === Number(selectedSpace))?.name || 'Unknown Space'}</span>
                </div>
              ) : filteredMetrics.length === 0 ? (
                <div className="empty-state success">
                  <MdTrendingUp className="empty-icon" />
                  <p>No {ragFilter === 'all' ? 'at-risk' : ragFilter} metrics!</p>
                  <span>No {ragFilter === 'all' ? 'at-risk' : ragFilter} metrics for {portfolioFilter === 'all' ? (selectedSpace === 'all' ? 'All Spaces' : spaces.find(s => s.id === Number(selectedSpace))?.name || 'Unknown Space') : portfoliosInMetrics.find(p => p.id === parseInt(portfolioFilter))?.name || 'selected portfolio'}</span>
                </div>
              ) : forDock ? (
                // Fullscreen view: 2 columns for red and amber
                <div className="metrics-columns-container">
                  <div className="metrics-column red-column">
                    <div className="column-header red">
                      <span className="column-status-dot red" />
                      <h3>Red ({filteredMetrics.filter(m => m.ragStatus === 'red').length})</h3>
                    </div>
                    <div className="metrics-list">
                      {filteredMetrics.filter(m => m.ragStatus === 'red').map((item, idx) => (
                        <div key={idx} className={`metric-item ${item.ragStatus}`} onClick={() => handleMetricClick(item.projectId, item.metricName)}>
                          <div className="metric-left">
                            <div className="metric-header">
                              {item.portfolioColor && <span className="metric-portfolio-dot" style={{ backgroundColor: item.portfolioColor }} title={item.portfolioName || 'No Portfolio'} />}
                              <div className="metric-text">
                                <span className="metric-project">{item.projectName}</span>
                                <span className="metric-name">{item.metricName}</span>
                              </div>
                              {needsRecoveryPlan(item.metricId) && (
                                <div className="recovery-plan-indicator" title="Recovery Plan Required"><MdErrorOutline /></div>
                              )}
                            </div>
                          </div>
                          <div className="metric-right">
                            <div className="metric-gauge" title={`${item.complete} of ${item.expected} expected`}>
                              <div className="gauge-track">
                                <div
                                  className={`gauge-fill ${item.ragStatus}`}
                                  style={{ width: `${Math.min((item.complete / item.expected) * 100, 100)}%` }}
                                />
                              </div>
                              <span className="gauge-label">{item.complete}/{item.expected}</span>
                            </div>
                            <div className="metric-target" title={`Final target: ${item.target}`}>
                              <MdTrackChanges className="target-icon" />
                              <span className="target-value">{item.target}</span>
                            </div>
                            <MdArrowForward className="metric-arrow" />
                          </div>
                        </div>
                      ))}
                      {filteredMetrics.filter(m => m.ragStatus === 'red').length === 0 && (
                        <div className="empty-column">No red metrics</div>
                      )}
                    </div>
                  </div>
                  <div className="metrics-column amber-column">
                    <div className="column-header amber">
                      <span className="column-status-dot amber" />
                      <h3>Amber ({filteredMetrics.filter(m => m.ragStatus === 'amber').length})</h3>
                    </div>
                    <div className="metrics-list">
                      {filteredMetrics.filter(m => m.ragStatus === 'amber').map((item, idx) => (
                        <div key={idx} className={`metric-item ${item.ragStatus}`} onClick={() => handleMetricClick(item.projectId, item.metricName)}>
                          <div className="metric-left">
                            <div className="metric-header">
                              {item.portfolioColor && <span className="metric-portfolio-dot" style={{ backgroundColor: item.portfolioColor }} title={item.portfolioName || 'No Portfolio'} />}
                              <div className="metric-text">
                                <span className="metric-project">{item.projectName}</span>
                                <span className="metric-name">{item.metricName}</span>
                              </div>
                            </div>
                          </div>
                          <div className="metric-right">
                            <div className="metric-gauge" title={`${item.complete} of ${item.expected} expected`}>
                              <div className="gauge-track">
                                <div
                                  className={`gauge-fill ${item.ragStatus}`}
                                  style={{ width: `${Math.min((item.complete / item.expected) * 100, 100)}%` }}
                                />
                              </div>
                              <span className="gauge-label">{item.complete}/{item.expected}</span>
                            </div>
                            <div className="metric-target" title={`Final target: ${item.target}`}>
                              <MdTrackChanges className="target-icon" />
                              <span className="target-value">{item.target}</span>
                            </div>
                            <MdArrowForward className="metric-arrow" />
                          </div>
                        </div>
                      ))}
                      {filteredMetrics.filter(m => m.ragStatus === 'amber').length === 0 && (
                        <div className="empty-column">No amber metrics</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // Normal view: single list
                <div className="metrics-list">
                  {filteredMetrics.map((item, idx) => {
                    const showPortfolioHeader = idx === 0 || item.portfolioName !== filteredMetrics[idx - 1].portfolioName;
                    return (
                      <React.Fragment key={idx}>
                        {showPortfolioHeader && (
                          <div className="portfolio-group-header">
                            {item.portfolioColor && <span className="portfolio-header-dot" style={{ backgroundColor: item.portfolioColor }} title={item.portfolioName || 'No Portfolio'} />}
                            <span className="portfolio-header-name">{item.portfolioName || 'No Portfolio'}</span>
                          </div>
                        )}
                        <div className={`metric-item ${item.ragStatus}`} onClick={() => handleMetricClick(item.projectId, item.metricName)}>
                          <div className="metric-left">
                            <div className="metric-header">
                              {item.portfolioColor && <span className="metric-portfolio-dot" style={{ backgroundColor: item.portfolioColor }} title={item.portfolioName || 'No Portfolio'} />}
                              <div className="metric-text">
                                <span className="metric-project">{item.projectName}</span>
                                <span className="metric-name">{item.metricName}</span>
                              </div>
                              {item.ragStatus === 'red' && needsRecoveryPlan(item.metricId) && (
                                <div className="recovery-plan-indicator" title="Recovery Plan Required"><MdErrorOutline /></div>
                              )}
                            </div>
                          </div>
                          <div className="metric-right">
                            <div className="metric-gauge" title={`${item.complete} of ${item.expected} expected`}>
                              <div className="gauge-track">
                                <div
                                  className={`gauge-fill ${item.ragStatus}`}
                                  style={{ width: `${Math.min((item.complete / item.expected) * 100, 100)}%` }}
                                />
                              </div>
                              <span className="gauge-label">{item.complete}/{item.expected}</span>
                            </div>
                            <div className="metric-target" title={`Final target: ${item.target}`}>
                              <MdTrackChanges className="target-icon" />
                              <span className="target-value">{item.target}</span>
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
        );

      case 'commentary':
        return (
          <div key={panelId} className={`home-quadrant commentary-quadrant panel-${index + 1}`}>
            <div className="quadrant-header">
              <MdComment className="quadrant-icon" />
              <h2>Recent Commentary</h2>
              {portfoliosInCommentary.length > 1 && (
                <Select
                  key={`commentary-portfolio-${darkMode}`}
                  className="portfolio-filter-dropdown"
                  styles={smallSelectStyles}
                  value={commentaryPortfolioFilter === 'all' ? { value: 'all', label: 'All Portfolios' } : portfoliosInCommentary.find(p => p.id === parseInt(commentaryPortfolioFilter)) ? { value: portfoliosInCommentary.find(p => p.id === parseInt(commentaryPortfolioFilter)).id, label: portfoliosInCommentary.find(p => p.id === parseInt(commentaryPortfolioFilter)).name } : { value: 'all', label: 'All Portfolios' }}
                  onChange={(option) => setCommentaryPortfolioFilter(option.value.toString())}
                  options={[{ value: 'all', label: 'All Portfolios' }, ...portfoliosInCommentary.map(portfolio => ({ value: portfolio.id, label: portfolio.name }))]}
                  menuPortalTarget={document.body}
                  isSearchable={false}
                />
              )}
                          </div>
            <div className="quadrant-content">
              {loading ? (
                <div className="loading-state">Loading...</div>
              ) : filteredCommentary.length === 0 ? (
                <div className="empty-state">
                  <MdComment className="empty-icon" />
                  <p>No recent commentary</p>
                  <span>No commentary for {commentaryPortfolioFilter === 'all' ? (selectedSpace === 'all' ? 'All Spaces' : spaces.find(s => s.id === Number(selectedSpace))?.name || 'Unknown Space') : portfoliosInCommentary.find(p => p.id === parseInt(commentaryPortfolioFilter))?.name || 'selected portfolio'}</span>
                </div>
              ) : (
                <div className="commentary-list">
                  {filteredCommentary.map((item, idx) => {
                    const showPortfolioHeader = idx === 0 || item.portfolioName !== filteredCommentary[idx - 1].portfolioName;
                    return (
                      <React.Fragment key={idx}>
                        {showPortfolioHeader && (
                          <div className="portfolio-group-header">
                            {item.portfolioColor && <span className="portfolio-header-dot" style={{ backgroundColor: item.portfolioColor }} title={item.portfolioName || 'No Portfolio'} />}
                            <span className="portfolio-header-name">{item.portfolioName || 'No Portfolio'}</span>
                          </div>
                        )}
                        <div className="commentary-item" onClick={() => handleMetricClick(item.projectId, item.metricName)}>
                          <div className="commentary-header">
                            <div className="commentary-context">
                              {item.portfolioColor && <span className="commentary-portfolio-dot" style={{ backgroundColor: item.portfolioColor }} title={item.portfolioName || 'No Portfolio'} />}
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
                            {item.createdBy && <span className="commentary-author">{item.createdBy}</span>}
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
        );

      case 'inconsistencies':
        return (
          <div key={panelId} className={`home-quadrant inconsistency-quadrant panel-${index + 1}`}>
            <div className="quadrant-header">
              <MdBugReport className="quadrant-icon warning" />
              <h2>Inconsistencies</h2>
                          </div>
            <div className="quadrant-content">
              {!inconsistencies ? (
                <div className="loading-text">Loading...</div>
              ) : inconsistencies.total_inconsistencies === 0 ? (
                <div className="no-inconsistencies">
                  <MdCheckCircle style={{ fontSize: '48px', color: '#10b981', marginBottom: '8px' }} />
                  <p>No inconsistencies found</p>
                  <span style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    {selectedSpace === 'all' ? 'All projects across all spaces' : `All projects in ${spaces.find(s => s.id === Number(selectedSpace))?.name || 'this space'}`}
                  </span>
                </div>
              ) : (
                <div className="inconsistency-list">
                  {inconsistencies.summary.map((pmData, pmIdx) => {
                    const isExpanded = expandedPMs[pmData.pm_name];
                    const displayedIssues = isExpanded ? pmData.issues : pmData.issues.slice(0, 3);
                    return (
                      <div key={pmIdx} className="inconsistency-pm-item">
                        <div className="inconsistency-pm-header">
                          <div className="pm-name-wrapper"><MdPeople className="pm-icon" /><span className="pm-name">{pmData.pm_name}</span></div>
                          <div className="inconsistency-counts"><span className="total-count">{pmData.total}</span></div>
                        </div>
                        {displayedIssues.map((issue, issueIdx) => {
                          let issueTitle = '';
                          let targetProjectId = issue.project_id;
                          if (issue.type === 'missing_recovery_plan' && issue.metric_name) {
                            issueTitle = `${issue.metric_name} is ${issue.rag_status?.toUpperCase()} but has No Recovery Plan`;
                          } else if (issue.type === 'missing_metric_description' && issue.metric_name) {
                            issueTitle = `${issue.metric_name} is Missing a Description`;
                          } else if (issue.type === 'missing_project_description' || issue.details === 'Project missing description') {
                            issueTitle = `${issue.project_name} is Missing a Description`;
                          } else if (issue.type === 'missing_documentation') {
                            issueTitle = `${issue.project_name} has No Documentation Links`;
                          } else {
                            issueTitle = issue.details;
                          }
                          return (
                            <div key={issueIdx} className="inconsistency-detail" onClick={() => onNavigateToProject(targetProjectId)} style={{ cursor: 'pointer' }}>
                              {issue.type === 'missing_recovery_plan' && issue.rag_status && <span className={`metric-rag-marker ${issue.rag_status}`} title={issue.rag_status === 'red' ? 'Behind schedule' : 'At risk'} style={{ marginRight: '8px', flexShrink: 0 }} />}
                              <div className="issue-content">
                                <div className="issue-title">{issueTitle}</div>
                                <div className="issue-subtitle">{issue.project_name}{issue.age_days > 0 && <span className="issue-age"> • {issue.age_days}d old</span>}</div>
                              </div>
                            </div>
                          );
                        })}
                        {pmData.issues.length > 3 && (
                          <div className="more-issues" onClick={(e) => { e.stopPropagation(); setExpandedPMs(prev => ({ ...prev, [pmData.pm_name]: !prev[pmData.pm_name] })); }}>
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
        );

      case 'attention':
        return (
          <div key={panelId} className={`home-quadrant attention-quadrant panel-${index + 1}`}>
            <div className="quadrant-header">
              <MdBuild className="quadrant-icon warning" />
              <h2>My Projects Needing Attention</h2>
                          </div>
            <div className="quadrant-content">
              {loading ? (
                <div className="loading-state">Loading...</div>
              ) : userInconsistencies.length === 0 && userProjectFeedback.length === 0 ? (
                <div className="empty-state success">
                  <MdCheckCircle className="empty-icon" />
                  <p>All caught up!</p>
                  <span>No issues or feedback requiring your attention</span>
                </div>
              ) : (
                <div className="attention-list">
                  {userInconsistencies.map((issue, idx) => {
                    let issueTitle = '';
                    if (issue.type === 'missing_recovery_plan' && issue.metric_name) {
                      issueTitle = `${issue.metric_name} is ${issue.rag_status?.toUpperCase()} but has no recovery plan`;
                    } else if (issue.type === 'missing_metric_description' && issue.metric_name) {
                      issueTitle = `${issue.metric_name} is missing a description`;
                    } else if (issue.type === 'missing_project_description') {
                      issueTitle = `${issue.project_name} is missing a description`;
                    } else if (issue.type === 'missing_documentation') {
                      issueTitle = `${issue.project_name} has no documentation links`;
                    } else {
                      issueTitle = issue.details;
                    }
                    return (
                      <div key={`issue-${idx}`} className="attention-item" onClick={() => onNavigateToProject(issue.project_id)}>
                        <div className="attention-icon-wrapper">
                          {issue.type === 'missing_recovery_plan' ? <span className={`metric-rag-marker ${issue.rag_status}`} /> : <MdWarning className="attention-icon" />}
                        </div>
                        <div className="attention-details">
                          <div className="attention-title">{issueTitle}</div>
                          <div className="attention-project">{issue.project_name}{issue.first_detected && <span className="attention-age"> · {formatTimestamp(issue.first_detected)}</span>}</div>
                        </div>
                        <MdArrowForward className="attention-arrow" />
                      </div>
                    );
                  })}
                  {userProjectFeedback.map((fb) => (
                    <div key={`fb-${fb.id}`} className="attention-item feedback-item" onClick={() => onNavigateToProject(fb.project_id)}>
                      <div className="attention-icon-wrapper"><MdFeedback className="attention-icon feedback" /></div>
                      <div className="attention-details">
                        <div className="attention-title">{fb.text}</div>
                        <div className="attention-project">{fb.project_name} - {fb.user_name || 'Anonymous'} - {formatTimestamp(fb.created_at)}</div>
                      </div>
                      <MdArrowForward className="attention-arrow" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'projectHealth':
        const getHealthColor = (score) => {
          if (score >= 80) return '#10b981'; // green
          if (score >= 60) return '#f59e0b'; // amber
          return '#ef4444'; // red
        };

        // Helper function to render a health ranking item
        const renderHealthItem = (project, idx, isTop) => (
          <div
            key={project.id}
            className="health-ranking-item"
            onClick={() => onNavigateToProject(project.id)}
          >
            <span className="health-rank">{idx + 1}</span>
            <div className="health-score-gauge">
              <svg viewBox="0 0 36 36" className="health-gauge-svg">
                <circle
                  className="health-gauge-bg"
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  strokeWidth="3"
                />
                <circle
                  className="health-gauge-progress"
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  strokeWidth="3"
                  stroke={getHealthColor(project.healthScore)}
                  strokeDasharray={`${(project.healthScore / 100) * 97.4} 97.4`}
                  strokeLinecap="round"
                  transform="rotate(-90 18 18)"
                />
              </svg>
              <span className="health-gauge-value">{Math.round(project.healthScore)}<span className="percent-sign">%</span></span>
            </div>
            <div className="health-project-info">
              <span
                className="health-portfolio-dot"
                style={{ backgroundColor: project.portfolioColor }}
                title={project.portfolioName || 'No Portfolio'}
              />
              <span className="health-project-name">{project.name}</span>
              {project.initiative_manager && (
                <span className="health-pm-name">{project.initiative_manager}</span>
              )}
            </div>
            <MdArrowForward className="health-arrow" />
          </div>
        );

        // Fullscreen two-column layout
        if (forDock) {
          const top10 = projectHealthRankings.allSorted.slice(0, 10);
          const bottom10 = [...projectHealthRankings.allSorted].reverse().slice(0, 10);
          return (
            <div key={panelId} className={`home-quadrant health-rankings-quadrant fullscreen-health panel-${index + 1}`}>
              <div className="quadrant-content health-two-columns">
                <div className="health-column">
                  <h3 className="health-column-title top-title">Top 10</h3>
                  <div className="health-rankings-list">
                    {top10.map((project, idx) => renderHealthItem(project, idx, true))}
                  </div>
                </div>
                <div className="health-column">
                  <h3 className="health-column-title bottom-title">Bottom 10</h3>
                  <div className="health-rankings-list">
                    {bottom10.map((project, idx) => renderHealthItem(project, idx, false))}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // Regular panel view with toggle
        const displayProjects = healthRankingView === 'top' ? projectHealthRankings.top : projectHealthRankings.bottom;
        return (
          <div key={panelId} className={`home-quadrant health-rankings-quadrant panel-${index + 1}`}>
            <div className="quadrant-header">
              <MdFavorite className="quadrant-icon" />
              <h2>Project Health</h2>
              <label className="active-filter-switch">
                <span className="switch-label">Active only</span>
                <div className="switch-track">
                  <input
                    type="checkbox"
                    checked={hideInactiveProjects}
                    onChange={(e) => setHideInactiveProjects(e.target.checked)}
                  />
                  <span className="switch-slider"></span>
                </div>
              </label>
              <div className="health-toggle-buttons">
                <button
                  className={`health-toggle-btn ${healthRankingView === 'top' ? 'active' : ''}`}
                  onClick={() => setHealthRankingView('top')}
                >
                  Top 10
                </button>
                <button
                  className={`health-toggle-btn ${healthRankingView === 'bottom' ? 'active' : ''}`}
                  onClick={() => setHealthRankingView('bottom')}
                >
                  Bottom 10
                </button>
              </div>
                          </div>
            <div className="quadrant-content">
              {displayProjects.length === 0 ? (
                <div className="empty-quadrant">
                  <p>No projects to display</p>
                </div>
              ) : (
                <div className="health-rankings-list">
                  {displayProjects.map((project, idx) => renderHealthItem(project, idx, healthRankingView === 'top'))}
                </div>
              )}
            </div>
          </div>
        );

      case 'audit':
        if (!isAdmin) return null;

        // Generate activity summary
        const generateActivitySummary = (logs) => {
          if (!logs || logs.length === 0) return [];

          // Group by user and action type
          const userActivity = {};
          logs.forEach(entry => {
            const userName = entry.user_email?.split('@')[0] || 'System';
            if (!userActivity[userName]) {
              userActivity[userName] = { updates: {}, creates: {}, deletes: {} };
            }

            const tableName = entry.table_name?.replace(/_/g, ' ') || 'records';
            const projectContext = entry.project_name ? ` in ${entry.project_name}` : '';
            const key = `${tableName}${projectContext}`;

            if (entry.action === 'UPDATE') {
              userActivity[userName].updates[key] = (userActivity[userName].updates[key] || 0) + 1;
            } else if (entry.action === 'CREATE') {
              userActivity[userName].creates[key] = (userActivity[userName].creates[key] || 0) + 1;
            } else if (entry.action === 'DELETE') {
              userActivity[userName].deletes[key] = (userActivity[userName].deletes[key] || 0) + 1;
            }
          });

          // Build detailed summaries for each user's activities
          const summaries = [];
          Object.entries(userActivity).forEach(([user, activity]) => {
            const topUpdates = Object.entries(activity.updates).sort((a, b) => b[1] - a[1]);
            const topCreates = Object.entries(activity.creates).sort((a, b) => b[1] - a[1]);
            const topDeletes = Object.entries(activity.deletes).sort((a, b) => b[1] - a[1]);

            topUpdates.slice(0, 2).forEach(([target]) => {
              summaries.push({ user, text: `updating ${target}` });
            });
            topCreates.slice(0, 2).forEach(([target]) => {
              summaries.push({ user, text: `creating ${target}` });
            });
            topDeletes.slice(0, 1).forEach(([target]) => {
              summaries.push({ user, text: `removing ${target}` });
            });
          });

          return summaries.slice(0, forDock ? 10 : 5);
        };

        const activitySummary = generateActivitySummary(auditLog);

        const getActionVerb = (action) => {
          switch(action) {
            case 'CREATE': return 'created';
            case 'UPDATE': return 'updated';
            case 'DELETE': return 'deleted';
            default: return action.toLowerCase();
          }
        };
        const formatTableName = (tableName) => {
          return tableName?.replace(/_/g, ' ').replace(/s$/, '') || 'record';
        };
        const formatValues = (entry) => {
          try {
            const newVals = entry.new_values ? JSON.parse(entry.new_values) : null;
            const oldVals = entry.old_values ? JSON.parse(entry.old_values) : null;
            const changes = [];
            const formatVal = (v) => {
              if (v === null || v === undefined) return '(empty)';
              if (typeof v === 'number') return v.toLocaleString();
              if (typeof v === 'string' && v.trim() === '') return '(empty)';
              return v;
            };

            // Ensure we have actual objects, not strings or other primitives
            const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

            if (entry.action === 'UPDATE' && isObject(newVals) && isObject(oldVals)) {
              Object.keys(newVals).forEach(key => {
                const oldVal = formatVal(oldVals[key]);
                const newVal = formatVal(newVals[key]);
                const changed = oldVal !== newVal;
                changes.push({ field: key, from: oldVal, to: newVal, changed });
              });
              // Sort so changed fields appear first
              changes.sort((a, b) => (b.changed ? 1 : 0) - (a.changed ? 1 : 0));
            } else if (entry.action === 'UPDATE' && isObject(newVals)) {
              Object.keys(newVals).forEach(key => {
                changes.push({ field: key, to: formatVal(newVals[key]), changed: true });
              });
            } else if (entry.action === 'CREATE' && isObject(newVals)) {
              Object.keys(newVals).forEach(key => {
                changes.push({ field: key, value: formatVal(newVals[key]) });
              });
            } else if (entry.action === 'DELETE' && isObject(oldVals)) {
              Object.keys(oldVals).forEach(key => {
                changes.push({ field: key, value: formatVal(oldVals[key]) });
              });
            }
            return changes;
          } catch {
            return [];
          }
        };

        // Group entries by date for timeline
        const groupByDate = (entries) => {
          const groups = {};
          entries.forEach(entry => {
            const date = new Date(entry.created_at);
            const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!groups[dateKey]) {
              groups[dateKey] = [];
            }
            groups[dateKey].push(entry);
          });
          return Object.entries(groups);
        };

        // Use timeline data from backend (more accurate counts)
        const dailyActivity = auditTimeline.map(day => ({
          date: new Date(day.date + 'T00:00:00'), // Parse as local date
          dateKey: new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          dateStr: day.date, // Keep original YYYY-MM-DD format for filtering
          total: day.total
        }));
        const maxDailyActivity = Math.max(...dailyActivity.map(d => d.total), 1);
        const totalChanges = dailyActivity.reduce((sum, d) => sum + d.total, 0);

        // For tooltip/summary: hover takes priority so user can scan dates while maintaining selection
        const displayIdx = auditHoveredDateIdx !== null ? auditHoveredDateIdx : auditSelectedDateIdx;
        const displayDate = displayIdx !== null && displayIdx < dailyActivity.length ? dailyActivity[displayIdx] : null;

        const getActionIcon = (action) => {
          switch(action) {
            case 'CREATE': return <MdAdd className="timeline-action-icon create" />;
            case 'UPDATE': return <MdEdit className="timeline-action-icon update" />;
            case 'DELETE': return <MdRemove className="timeline-action-icon delete" />;
            default: return <MdHistory className="timeline-action-icon" />;
          }
        };

        const timelineEntries = auditLog.slice(0, forDock ? 100 : 50);

        // When a date is selected, entries are already filtered by backend
        // Only do client-side filtering for hover (non-selected) state
        const filteredEntries = (auditSelectedDateIdx === null && displayDate)
          ? timelineEntries.filter(entry => {
              const entryDateStr = new Date(entry.created_at).toISOString().split('T')[0];
              return entryDateStr === displayDate.dateKey;
            })
          : timelineEntries;
        const groupedEntries = groupByDate(filteredEntries);

        return (
          <div key={panelId} className={`home-quadrant audit-quadrant panel-${index + 1}`}>
            <div className="quadrant-header">
              <MdHistory className="quadrant-icon" />
              <h2>Audit Log</h2>
            </div>
            <div className="quadrant-content">
              {auditTimeline.length === 0 && auditLog.length === 0 ? (
                <div className="empty-state">
                  <MdHistory className="empty-icon" />
                  <p>No recent activity</p>
                </div>
              ) : (
                <div className="audit-timeline-container">
                  {/* Horizontal Activity Overview - Line Chart */}
                  <div className="audit-activity-overview" onMouseLeave={() => setAuditHoveredDateIdx(null)}>
                    <svg className="activity-line-chart" viewBox="0 0 200 24" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="activityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                        </linearGradient>
                      </defs>
                      {/* Area fill */}
                      <path
                        d={`M0,24 ${dailyActivity.map((day, idx) => {
                          const x = (idx / (dailyActivity.length - 1)) * 200;
                          const y = 24 - (day.total === 0 ? 1 : Math.max(2, (day.total / maxDailyActivity) * 22));
                          return `L${x},${y}`;
                        }).join(' ')} L200,24 Z`}
                        fill="url(#activityGradient)"
                      />
                      {/* Line */}
                      <path
                        d={`M${dailyActivity.map((day, idx) => {
                          const x = (idx / (dailyActivity.length - 1)) * 200;
                          const y = 24 - (day.total === 0 ? 1 : Math.max(2, (day.total / maxDailyActivity) * 22));
                          return `${idx === 0 ? '' : 'L'}${x},${y}`;
                        }).join(' ')}`}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Hover zones */}
                      {dailyActivity.map((day, idx) => {
                        const segmentWidth = 200 / dailyActivity.length;
                        const x = idx * segmentWidth;
                        return (
                          <rect
                            key={idx}
                            x={x}
                            y={0}
                            width={segmentWidth}
                            height={24}
                            fill="transparent"
                            className="activity-hover-zone"
                            onMouseEnter={() => setAuditHoveredDateIdx(idx)}
                            onClick={() => setAuditSelectedDateIdx(auditSelectedDateIdx === idx ? null : idx)}
                          />
                        );
                      })}
                      {/* Selected date indicator line (solid) */}
                      {auditSelectedDateIdx !== null && (
                        <line
                          x1={(auditSelectedDateIdx / (dailyActivity.length - 1)) * 200}
                          y1={0}
                          x2={(auditSelectedDateIdx / (dailyActivity.length - 1)) * 200}
                          y2={24}
                          stroke="#8b5cf6"
                          strokeWidth={2}
                        />
                      )}
                      {/* Hovered date indicator line (dashed) */}
                      {auditHoveredDateIdx !== null && auditHoveredDateIdx !== auditSelectedDateIdx && (
                        <line
                          x1={(auditHoveredDateIdx / (dailyActivity.length - 1)) * 200}
                          y1={0}
                          x2={(auditHoveredDateIdx / (dailyActivity.length - 1)) * 200}
                          y2={24}
                          stroke="#94a3b8"
                          strokeWidth={1}
                          strokeDasharray="2,2"
                        />
                      )}
                    </svg>
                    <div className="activity-labels">
                      <span>{dailyActivity[0]?.dateKey}</span>
                      <span className={`activity-summary ${auditSelectedDateIdx !== null ? 'selected' : ''}`}>
                        {displayDate ? `${displayDate.dateKey}: ${displayDate.total} changes` : `${totalChanges} changes (14 days)`}
                      </span>
                      <span>Today</span>
                    </div>
                  </div>
                  <div className="audit-timeline">
                    {groupedEntries.map(([dateKey, entries], groupIdx) => (
                      <div key={dateKey} className="timeline-date-group">
                        <div className="timeline-date-marker">
                          <span className="timeline-date">{dateKey}</span>
                        </div>
                        <div className="timeline-events">
                          {entries.map((entry, idx) => {
                            const userName = entry.user_email?.split('@')[0] || 'System';
                            const values = formatValues(entry);
                            const projectContext = entry.project_name || null;
                            const metricContext = entry.metric_name || null;
                            const isLeft = idx % 2 === 0;
                            const time = new Date(entry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                            return (
                              <div key={idx} className={`timeline-event ${isLeft ? 'left' : 'right'} action-${entry.action?.toLowerCase()}`}>
                                <div className="timeline-spur">
                                  <div className="timeline-node">
                                    {getActionIcon(entry.action)}
                                  </div>
                                </div>
                                <details className="timeline-card">
                                  <summary className="timeline-card-summary compact">
                                    <span className="timeline-time">{time}</span>
                                    <span className="timeline-user">{userName}</span>
                                    <span className="timeline-verb">{getActionVerb(entry.action)}</span>
                                    <span className="timeline-table">{formatTableName(entry.table_name)}</span>
                                    {metricContext && <span className="timeline-metric">"{metricContext}"</span>}
                                    {projectContext && <span className="timeline-project">in {projectContext}</span>}
                                  </summary>
                                  <div className="timeline-card-details">
                                    {values.length > 0 ? (
                                      <table className="audit-values-table">
                                        <thead>
                                          <tr>
                                            <th>Field</th>
                                            {entry.action === 'UPDATE' ? (
                                              <>
                                                <th>Before</th>
                                                <th>After</th>
                                              </>
                                            ) : (
                                              <th>Value</th>
                                            )}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {values.map((v, i) => (
                                            <tr key={i} className={v.changed === false ? 'unchanged' : 'changed'}>
                                              <td className="field-name">{v.field}</td>
                                              {entry.action === 'UPDATE' ? (
                                                <>
                                                  <td className={`field-old ${v.changed === false ? 'dimmed' : ''}`}>{v.from || '—'}</td>
                                                  <td className={`field-new ${v.changed === false ? 'dimmed' : ''}`}>{v.to}</td>
                                                </>
                                              ) : (
                                                <td className="field-value">{v.value}</td>
                                              )}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    ) : (
                                      <div className="audit-no-details">No additional details</div>
                                    )}
                                  </div>
                                </details>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'database':
        if (!isAdmin) return null;
        return (
          <div key={panelId} className={`home-quadrant database-quadrant panel-${index + 1}`}>
            <div className="quadrant-header">
              <FaDatabase className="quadrant-icon" />
              <h2>Database Stats</h2>
                          </div>
            <div className="quadrant-content">
              {!databaseStats ? (
                <div className="loading-state">Loading...</div>
              ) : databaseStats.error ? (
                <div className="empty-state">
                  <MdWarning className="empty-icon" />
                  <p>Unable to load database stats</p>
                  <span>{databaseStats.error}</span>
                </div>
              ) : (
                <div className="database-stats-content">
                  {(() => {
                    const sizeGB = databaseStats.totalSizeBytes / 1024 / 1024 / 1024;
                    const sizeMB = databaseStats.totalSizeBytes / 1024 / 1024;
                    const greenLimit = 100; // GB - optimal performance limit
                    const amberLimit = 200 * 1024; // 200 TB in GB
                    const maxLimit = 281 * 1024; // 281 TB in GB - SQLite max
                    let status, statusColor, percentFill, tooltipText;

                    if (sizeGB < greenLimit) {
                      status = 'healthy';
                      statusColor = '#10b981';
                      percentFill = Math.max(1, (sizeGB / greenLimit) * 100);
                      tooltipText = `SQLite performs well up to ~100GB. Current: ${sizeMB.toFixed(2)} MB`;
                    } else if (sizeGB < amberLimit) {
                      status = 'warning';
                      statusColor = '#f59e0b';
                      percentFill = Math.max(1, Math.min(100, (sizeGB / amberLimit) * 100));
                      tooltipText = `Database over 100GB may have performance issues. Max: 281TB`;
                    } else {
                      status = 'critical';
                      statusColor = '#ef4444';
                      percentFill = Math.min(100, (sizeGB / maxLimit) * 100);
                      tooltipText = `Database approaching SQLite maximum (281TB).`;
                    }

                    const displaySize = sizeMB >= 1024 ? `${(sizeMB / 1024).toFixed(2)} GB` : `${sizeMB.toFixed(2)} MB`;
                    const tableCount = databaseStats.tables?.length || 0;
                    const indexCount = databaseStats.indexes?.length || 0;
                    const rightLabel = status === 'healthy' ? '100 GB' : status === 'warning' ? '200 TB' : '281 TB';

                    return (
                      <div className="db-summary-line" title={tooltipText}>
                        <span className="db-size-value">{displaySize}</span>
                        <div className="db-bar-wrapper">
                          <div className="db-size-bar-inline">
                            <div className={`db-size-fill ${status}`} style={{ width: `${percentFill}%`, backgroundColor: statusColor }} />
                          </div>
                          <div className="db-bar-scale">
                            <span>0</span>
                            <span>{rightLabel}</span>
                          </div>
                        </div>
                        <span className="db-counts">{tableCount} tables / {indexCount} indexes</span>
                      </div>
                    );
                  })()}
                  <div className="db-donut-chart">
                    {(() => {
                      const sortedTables = databaseStats.tables
                        ?.slice()
                        .sort((a, b) => (b.estimatedKB || b.rowCount) - (a.estimatedKB || a.rowCount));
                      const colors = ['#00aeef', '#003c71', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

                      const indexesByTable = {};
                      databaseStats.indexes?.forEach(idx => {
                        if (!indexesByTable[idx.tableName]) {
                          indexesByTable[idx.tableName] = [];
                        }
                        indexesByTable[idx.tableName].push(idx.name);
                      });

                      const formatSize = (kb) => {
                        if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
                        if (kb >= 1) return `${kb.toFixed(1)} KB`;
                        return `${(kb * 1024).toFixed(0)} B`;
                      };

                      const chartData = sortedTables?.map((t, idx) => ({
                        name: t.name,
                        displayName: t.name.replace(/^(project_|user_|metric_)/, ''),
                        rows: t.rowCount,
                        value: t.estimatedKB || Math.round(t.rowCount * 0.15) || 0.1,
                        fill: colors[idx % colors.length],
                        sizeLabel: formatSize(t.estimatedKB || Math.round(t.rowCount * 0.15)),
                        indexes: indexesByTable[t.name] || []
                      })) || [];

                      const renderLabel = ({ cx, cy, midAngle, outerRadius, innerRadius, displayName, percent, fill }) => {
                        const RADIAN = Math.PI / 180;
                        const textColor = darkMode ? '#e5e7eb' : '#374151';

                        // Hide labels for tiny slices (less than 3%)
                        if (percent < 0.03) return null;

                        // For large slices (>15%), show label inside the slice
                        if (percent >= 0.15) {
                          const midRadius = (innerRadius + outerRadius) / 2;
                          const x = cx + midRadius * Math.cos(-midAngle * RADIAN);
                          const y = cy + midRadius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text
                              x={x}
                              y={y}
                              fill="#ffffff"
                              fontSize={9}
                              fontWeight="600"
                              textAnchor="middle"
                              dominantBaseline="central"
                              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                            >
                              {displayName}
                            </text>
                          );
                        }

                        // For medium slices (3-15%), show label outside with leader line
                        const outerLabelRadius = outerRadius * 1.15;
                        const lineEndRadius = outerRadius * 1.05;
                        const x = cx + outerLabelRadius * Math.cos(-midAngle * RADIAN);
                        const y = cy + outerLabelRadius * Math.sin(-midAngle * RADIAN);
                        const lineStartX = cx + outerRadius * Math.cos(-midAngle * RADIAN);
                        const lineStartY = cy + outerRadius * Math.sin(-midAngle * RADIAN);
                        const lineEndX = cx + lineEndRadius * Math.cos(-midAngle * RADIAN);
                        const lineEndY = cy + lineEndRadius * Math.sin(-midAngle * RADIAN);

                        return (
                          <g>
                            <line
                              x1={lineStartX}
                              y1={lineStartY}
                              x2={lineEndX}
                              y2={lineEndY}
                              stroke={fill}
                              strokeWidth={1}
                            />
                            <text
                              x={x}
                              y={y}
                              fill={textColor}
                              fontSize={9}
                              textAnchor={x > cx ? 'start' : 'end'}
                              dominantBaseline="central"
                            >
                              {displayName}
                            </text>
                          </g>
                        );
                      };

                      return (
                        <div className="db-main-content">
                          <div className="db-chart-section">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={chartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius="50%"
                                  outerRadius="85%"
                                  dataKey="value"
                                  label={renderLabel}
                                  labelLine={false}
                                >
                                  {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (!active || !payload?.[0]) return null;
                                    const data = payload[0].payload;
                                    return (
                                      <div className="db-table-tooltip">
                                        <div className="tooltip-title">{data.name}</div>
                                        <div className="tooltip-stats">
                                          <span>{data.sizeLabel}</span>
                                          <span>{data.rows?.toLocaleString()} rows</span>
                                        </div>
                                      </div>
                                    );
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="db-tables-section">
                            <div className="db-section-title">Tables</div>
                            <div className="db-data-table">
                              <div className="db-table-header">
                                <span>Name</span>
                                <span>Rows</span>
                                <span>Size</span>
                              </div>
                              {chartData.slice(0, forDock ? 12 : 5).map((table, idx) => (
                                <div key={idx} className="db-table-row">
                                  <span className="db-table-name">
                                    <span className="db-color-dot" style={{ background: table.fill }} />
                                    {table.displayName}
                                  </span>
                                  <span className="db-table-rows">{table.rows?.toLocaleString()}</span>
                                  <span className="db-table-size">{table.sizeLabel}</span>
                                </div>
                              ))}
                            </div>
                            {databaseStats.indexes?.length > 0 && (
                              <>
                                <div className="db-section-title">Indexes</div>
                                <div className="db-data-table db-index-table">
                                  <div className="db-table-header">
                                    <span>Index</span>
                                    <span>Table</span>
                                  </div>
                                  {databaseStats.indexes.slice(0, forDock ? 10 : 4).map((idx, i) => (
                                    <div key={i} className="db-table-row">
                                      <span className="db-index-name">{idx.name}</span>
                                      <span className="db-index-table-name">{idx.tableName?.replace(/^(project_|user_|metric_)/, '')}</span>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'activeUsers':
        if (!isAdmin) return null;

        // Fullscreen view: logged-in users list + activity charts
        if (forDock) {
          // Color palette for activity types
          const activityColors = {
            'CREATE_projects': '#047857', 'UPDATE_projects': '#10b981', 'DELETE_projects': '#6ee7b7',
            'CREATE_project_links': '#4d7c0f', 'UPDATE_project_links': '#84cc16', 'DELETE_project_links': '#bef264',
            'CREATE_metrics': '#1e40af', 'UPDATE_metrics': '#3b82f6', 'DELETE_metrics': '#93c5fd',
            'CREATE_metric_periods': '#4c1d95', 'UPDATE_metric_periods': '#8b5cf6', 'DELETE_metric_periods': '#c4b5fd',
            'CREATE_comments': '#b45309', 'UPDATE_comments': '#f59e0b', 'DELETE_comments': '#fcd34d',
            'CREATE_feedback': '#9d174d', 'UPDATE_feedback': '#ec4899', 'DELETE_feedback': '#f9a8d4',
            'CREATE_portfolios': '#0e7490', 'UPDATE_portfolios': '#06b6d4', 'DELETE_portfolios': '#67e8f9',
            'CREATE_craids': '#991b1b', 'UPDATE_craids': '#ef4444', 'DELETE_craids': '#fca5a5',
            'CREATE_users': '#334155', 'UPDATE_users': '#64748b', 'DELETE_users': '#cbd5e1',
            'IMPORT_projects': '#7e22ce'
          };
          const getActivityColor = (type) => activityColors[type] || '#94a3b8';
          const formatActivityType = (type) => {
            const parts = type.split('_');
            const action = parts[0].toLowerCase();
            const table = parts.slice(1).join('_').replace(/_/g, ' ');
            return `${action} ${table}`;
          };

          // Transform activity data for chart
          const getActivityChartData = () => {
            if (!userActivity?.activityBreakdown) return [];
            return userActivity.activityBreakdown
              .map(user => {
                // Truncate long names to fit on single line
                const displayName = user.user_name.length > 18
                  ? user.user_name.substring(0, 16) + '...'
                  : user.user_name;
                const chartItem = { name: displayName, fullName: user.user_name, total: 0 };
                Object.entries(user.activities).forEach(([type, count]) => {
                  chartItem[type] = count;
                  chartItem.total += count;
                });
                return chartItem;
              })
              .sort((a, b) => b.total - a.total);
          };

          // Timeline chart data - top 10 users + Others
          const getTimelineUsers = () => {
            if (!userActivity?.timeline) return [];
            // Calculate total activity per user
            const userTotals = {};
            userActivity.timeline.forEach(item => {
              userTotals[item.user_name] = (userTotals[item.user_name] || 0) + item.count;
            });
            // Sort users by total activity and get top 10
            const sortedUsers = Object.entries(userTotals)
              .sort((a, b) => b[1] - a[1])
              .map(([name]) => name);
            const top10 = sortedUsers.slice(0, 10);
            const hasOthers = sortedUsers.length > 10;
            return hasOthers ? [...top10, 'Others'] : top10;
          };
          const getTimelineChartData = () => {
            if (!userActivity?.timeline) return [];
            const allUsers = getTimelineUsers();
            const top10Users = allUsers.filter(u => u !== 'Others');
            const hasOthers = allUsers.includes('Others');

            const byDate = {};
            userActivity.timeline.forEach(item => {
              if (!byDate[item.date]) byDate[item.date] = { date: item.date };
              if (top10Users.includes(item.user_name)) {
                byDate[item.date][item.user_name] = item.count;
              } else if (hasOthers) {
                byDate[item.date]['Others'] = (byDate[item.date]['Others'] || 0) + item.count;
              }
            });
            return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
          };
          const userColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

          return (
            <div key={panelId} className={`home-quadrant active-users-quadrant fullscreen-users panel-${index + 1}`}>
              <div className="quadrant-content users-fullscreen-layout">
                {/* Top row: Activity by User (left) + Logged in Users (right) */}
                <div className="users-top-row">
                  {/* Activity by User Chart */}
                  <div className="activity-by-user-section">
                    <div className="section-header">
                      <h3>Activity by User</h3>
                      <select
                        value={userActivityDays}
                        onChange={(e) => {
                          setUserActivityDays(parseInt(e.target.value));
                          api.get(`/admin/user-activity?days=${e.target.value}`)
                            .then(res => setUserActivity(res.data))
                            .catch(err => console.log('Failed to reload activity:', err));
                        }}
                        className="activity-days-select"
                      >
                        <option value={7}>7 days</option>
                        <option value={30}>30 days</option>
                        <option value={90}>90 days</option>
                      </select>
                    </div>
                    {!userActivity ? (
                      <div className="loading-state">Loading...</div>
                    ) : userActivity.error ? (
                      <div className="empty-state compact">
                        <MdWarning className="empty-icon" />
                        <p>Unable to load</p>
                      </div>
                    ) : userActivity.activityTypes?.length > 0 ? (
                      <div className="chart-scroll-container">
                        <ResponsiveContainer width="100%" height={Math.max(200, Math.min(getActivityChartData().length * 22, 280))}>
                          <BarChart
                            data={getActivityChartData().slice(0, 12)}
                            layout="vertical"
                            margin={{ top: 5, right: 15, left: 5, bottom: 5 }}
                            barSize={10}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tick={{ fontSize: 9 }} />
                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 9 }} interval={0} />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const total = payload.reduce((sum, e) => sum + (e.value || 0), 0);
                                const fullName = payload[0]?.payload?.fullName || payload[0]?.payload?.name;
                                return (
                                  <div className="activity-tooltip">
                                    <p className="tooltip-label">{fullName}</p>
                                    <p className="tooltip-total">Total: {total}</p>
                                    <div className="tooltip-breakdown">
                                      {payload.filter(e => e.value > 0).sort((a, b) => b.value - a.value).slice(0, 6).map((e, i) => (
                                        <div key={i} className="tooltip-item">
                                          <span className="tooltip-color" style={{ backgroundColor: e.color }} />
                                          <span className="tooltip-name">{formatActivityType(e.dataKey)}</span>
                                          <span className="tooltip-value">{e.value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            {userActivity.activityTypes.map((type) => (
                              <Bar key={type} dataKey={type} stackId="a" fill={getActivityColor(type)} />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="empty-state compact">No activity data</div>
                    )}
                  </div>

                  {/* Logged in Users list */}
                  <div className="users-list-section">
                    <h3>Logged In <span className="subtitle">Last 30 min</span></h3>
                    {!activeUsers ? (
                      <div className="loading-state">Loading...</div>
                    ) : activeUsers.error ? (
                      <div className="empty-state compact">
                        <MdWarning className="empty-icon" />
                        <p>Unable to load</p>
                      </div>
                    ) : activeUsers.count === 0 ? (
                      <div className="empty-state compact">
                        <MdPeople className="empty-icon" />
                        <p>No active users</p>
                      </div>
                    ) : (
                      <div className="active-users-list">
                        {activeUsers.users?.map((user, idx) => (
                          <div key={idx} className="active-user-item">
                            <div className="active-user-info">
                              <span className="active-user-name">{user.name}</span>
                              <span className="active-user-email">{user.email}</span>
                            </div>
                            <span className="active-user-time">{formatTimestamp(user.lastActivity)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom row: Timeline (full width) */}
                {userActivity && !userActivity.error && getTimelineChartData().length > 0 && (
                  <div className="timeline-section">
                    <h3>Activity Timeline</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={getTimelineChartData()} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" angle={-45} textAnchor="end" height={50} tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const total = payload.reduce((sum, e) => sum + (e.value || 0), 0);
                            return (
                              <div className="activity-tooltip">
                                <p className="tooltip-label">{label}</p>
                                <p className="tooltip-total">Total: {total}</p>
                                <div className="tooltip-breakdown">
                                  {payload.filter(e => e.value > 0).sort((a, b) => b.value - a.value).map((e, i) => (
                                    <div key={i} className="tooltip-item">
                                      <span className="tooltip-color" style={{ background: e.color }} />
                                      <span className="tooltip-name">{e.dataKey}</span>
                                      <span className="tooltip-value">{e.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '9px', paddingLeft: '80px', paddingTop: '12px' }} align="left" />
                        {getTimelineUsers().map((user, idx) => (
                          <Bar key={user} dataKey={user} stackId="timeline" fill={user === 'Others' ? '#9ca3af' : userColors[idx % userColors.length]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          );
        }

        // Normal panel view
        return (
          <div key={panelId} className={`home-quadrant active-users-quadrant panel-${index + 1}`}>
            <div className="quadrant-header">
              <MdPeople className="quadrant-icon" />
              <h2>Active Users</h2>
              <span className="quadrant-subtitle">Last 30 minutes</span>
                          </div>
            <div className="quadrant-content">
              {!activeUsers ? (
                <div className="loading-state">Loading...</div>
              ) : activeUsers.error ? (
                <div className="empty-state">
                  <MdWarning className="empty-icon" />
                  <p>Unable to load active users</p>
                  <span>{activeUsers.error}</span>
                </div>
              ) : activeUsers.count === 0 ? (
                <div className="empty-state">
                  <MdPeople className="empty-icon" />
                  <p>No active users</p>
                  <span>No users active in the last 30 minutes</span>
                </div>
              ) : (
                <div className="active-users-list">
                  <div className="active-users-count">{activeUsers.count} active user{activeUsers.count !== 1 ? 's' : ''}</div>
                  {activeUsers.users?.map((user, idx) => (
                    <div key={idx} className="active-user-item">
                      <div className="active-user-info">
                        <span className="active-user-name">{user.name}</span>
                        <span className="active-user-email">{user.email}</span>
                      </div>
                      <span className="active-user-time">{formatTimestamp(user.lastActivity)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-title">
          <MdHome className="home-icon" />
          <div className="home-title-text">
            <h1>
              {selectedSpace === 'all'
                ? 'All Spaces'
                : spaces.find(s => s.id === Number(selectedSpace))?.name || 'Unknown Space'}
            </h1>
            {changesSinceLastVisit && changesSinceLastVisit.total > 0 && (
              <span className="changes-since-visit">
                {changesSinceLastVisit.total} change{changesSinceLastVisit.total !== 1 ? 's' : ''} since your last visit
              </span>
            )}
          </div>
        </div>
        <div className="home-stats">
          <div className="stat-item">
            <span className="stat-value">{projectCount}</span>
            <span className="stat-label">Projects</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-value">{metricCount}</span>
            <span className="stat-label">Metrics</span>
          </div>
          <div className="stat-item">
            <span className="stat-value green">{metricCount - spaceFilteredAtRisk.length}</span>
            <span className="stat-label">On Track</span>
          </div>
          <div className="stat-item">
            <span className="stat-value red">{spaceFilteredAtRisk.length}</span>
            <span className="stat-label">At Risk</span>
          </div>
          {isAdmin && (
            <button
              className="dashboard-config-btn"
              onClick={() => setShowConfigModal(true)}
              title="Configure Dashboard"
            >
              <MdSettings />
            </button>
          )}
        </div>
      </div>

      <div className={`home-grid ${currentLayout.cssClass}`}>
        {(dashboardConfig.panels || DEFAULT_DASHBOARD_CONFIG.panels).map((panelId, index) => renderPanel(panelId, index))}
      </div>

      {/* Dashboard Config Modal */}
      {showConfigModal && (
        <DashboardConfigModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          onSave={handleConfigSave}
          currentConfig={dashboardConfig}
          isAdmin={isAdmin}
          panelConfig={PANEL_CONFIG}
          layoutConfig={LAYOUT_CONFIG}
        />
      )}

      {/* User Inconsistencies Modal */}
      <UserInconsistenciesModal
        isOpen={showUserInconsistenciesModal}
        onClose={() => {
          setShowUserInconsistenciesModal(false);
          setUserInconsistenciesDismissed(true);
        }}
        inconsistencies={userInconsistencies}
        feedback={userProjectFeedback}
      />


      {/* Hover Tab Bar - shows panel previews on hover */}
      {(() => {
        // Get all panels (show all, but mark locked ones)
        const allPanels = Object.values(PANEL_CONFIG);

        return (
          <div
            className="hover-tab-container"
            onMouseLeave={handlePanelHoverEnd}
          >
            {/* Full-screen preview of hovered panel */}
            {expandedDockPanel && (
              <div className="expanded-panel-fullscreen">
                <div className="expanded-panel-header">
                  {(() => {
                    const panelConfig = PANEL_CONFIG[expandedDockPanel];
                    const PanelIcon = panelConfig?.icon;
                    return PanelIcon ? <PanelIcon className="expanded-panel-icon" /> : null;
                  })()}
                  <h2>{PANEL_CONFIG[expandedDockPanel]?.name}</h2>
                  {/* Space indicator for space-aware panels */}
                  {['heatmap', 'metrics', 'commentary', 'inconsistencies', 'projectHealth'].includes(expandedDockPanel) && (
                    <span className="space-filter-indicator">
                      <MdFilterList className="filter-icon" />
                      {selectedSpace === 'all'
                        ? 'All Spaces'
                        : spaces.find(s => s.id === Number(selectedSpace))?.name || 'Unknown Space'}
                    </span>
                  )}
                  {/* Panel-specific controls for fullscreen */}
                  {expandedDockPanel === 'projectHealth' && (
                    <label className="active-filter-switch fullscreen-switch">
                      <span className="switch-label">Active only</span>
                      <div className="switch-track">
                        <input
                          type="checkbox"
                          checked={hideInactiveProjects}
                          onChange={(e) => setHideInactiveProjects(e.target.checked)}
                        />
                        <span className="switch-slider"></span>
                      </div>
                    </label>
                  )}
                  <button
                    className="preview-close-btn"
                    onClick={dismissPreview}
                    title="Close preview (Esc)"
                  >
                    <MdClose />
                  </button>
                </div>
                <div className="expanded-panel-content">
                  {renderPanel(expandedDockPanel, 0, true)}
                </div>
              </div>
            )}

            {/* Icon tab bar - always visible at bottom */}
            <div className="minimized-tabs">
              {allPanels.map((panel) => {
                const PanelIcon = panel.icon;
                const isLocked = panel.adminOnly && !isAdmin;
                return (
                  <button
                    key={panel.id}
                    className={`minimized-tab ${expandedDockPanel === panel.id ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                    data-panel={panel.id}
                    onMouseEnter={() => !isLocked && handlePanelHoverStart(panel.id)}
                    onMouseLeave={() => {
                      // Only clear timeout, don't dismiss if already showing
                      if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                      }
                    }}
                    disabled={isLocked}
                    title={isLocked ? `${panel.name} (Admin only)` : panel.name}
                  >
                    <PanelIcon />
                    {isLocked && <MdLock className="lock-icon" />}
                    <span className="tab-tooltip">{panel.name}{isLocked ? ' (Admin)' : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Footer Links */}
      <div className="homepage-footer">
        <button className="footer-link" onClick={() => { setShowTipsModal(true); setSelectedTipsCategory('Getting Started'); }}>
          Getting Started
        </button>
        <span className="footer-divider">|</span>
        <a
          className="footer-link"
          href="https://github.com/DataVisuals/progress-tracker/commits/master/"
          target="_blank"
          rel="noopener noreferrer"
        >
          What's New
        </a>
      </div>
    </div>
  );
};

export default HomePage;
