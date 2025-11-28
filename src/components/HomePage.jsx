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
  MdStorage,
  MdPieChart,
  MdAccessTime,
  MdFavorite,
  MdRemove,
  MdAdd,
  MdClose
} from 'react-icons/md';
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
  setShowTipsModal
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
  // showTipsModal and setShowTipsModal now passed from App.jsx
  const [selectedTipsCategory, setSelectedTipsCategory] = useState('Getting Started'); // Selected category in tips modal
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
  const [databaseStats, setDatabaseStats] = useState(null); // Database stats for admin panel
  const [activeUsers, setActiveUsers] = useState(null); // Active users for admin panel
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
        // Load audit log
        try {
          const auditResponse = await api.get('/audit?limit=20');
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
        recoveryPlans.filter(rp => rp.project_id === project.id)
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

    // Dynamic limit based on layout
    const layout = dashboardConfig.layout || '2x2';
    const limit = layout === '1x1' ? 25 : (layout === '1x2' || layout === '2x1') ? 15 : layout === '3x2' ? 8 : 10;

    // Get top (highest scores) and bottom (lowest scores)
    const top = sorted.slice(0, limit);
    // Bottom shows lowest scoring projects, reversed so worst is first
    const bottom = sorted.length > 0
      ? [...sorted].reverse().slice(0, limit)
      : [];

    return { top, bottom };
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

    // Helper to render minimize button
    const MinimizeButton = () => (
      <button
        className="panel-minimize-btn"
        onClick={(e) => {
          e.stopPropagation();
          minimizePanel(panelId);
        }}
        title="Minimize to dock"
      >
        <MdRemove />
      </button>
    );

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
              {!forDock && <MinimizeButton />}
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
                    return projectItems.slice(0, getDisplayLimit()).map((item) => {
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
              {!forDock && <MinimizeButton />}
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
              ) : (
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
              {!forDock && <MinimizeButton />}
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
              {!forDock && <MinimizeButton />}
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
              {!forDock && <MinimizeButton />}
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
        const displayProjects = healthRankingView === 'top'
          ? projectHealthRankings.top
          : projectHealthRankings.bottom;
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
              {!forDock && <MinimizeButton />}
            </div>
            <div className="quadrant-content">
              {displayProjects.length === 0 ? (
                <div className="empty-quadrant">
                  <p>No projects to display</p>
                </div>
              ) : (
                <div className="health-rankings-list">
                  {displayProjects.map((project, idx) => (
                    <div
                      key={project.id}
                      className="health-ranking-item"
                      onClick={() => onNavigateToProject(project.id)}
                    >
                      <span className="health-rank">
                        {healthRankingView === 'top' ? idx + 1 : displayProjects.length - idx}
                      </span>
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
                        <span className="health-gauge-value">{Math.round(project.healthScore)}</span>
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
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'audit':
        if (!isAdmin) return null;
        const formatAuditDescription = (entry) => {
          try {
            const newVals = entry.new_values ? JSON.parse(entry.new_values) : null;
            const oldVals = entry.old_values ? JSON.parse(entry.old_values) : null;
            if (entry.action === 'UPDATE' && newVals) {
              const changes = Object.keys(newVals).slice(0, 2).map(k => {
                const val = typeof newVals[k] === 'number' ? newVals[k].toLocaleString() : newVals[k];
                return `${k} to ${val}`;
              });
              return changes.length > 0 ? changes.join(', ') : '';
            } else if (entry.action === 'CREATE' && newVals) {
              if (newVals.name) return `"${newVals.name}"`;
              if (newVals.email) return newVals.email;
              return '';
            } else if (entry.action === 'DELETE' && oldVals) {
              if (oldVals.name) return `"${oldVals.name}"`;
              return '';
            }
            return '';
          } catch {
            return '';
          }
        };
        const getActionVerb = (action) => {
          switch(action) {
            case 'CREATE': return 'created';
            case 'UPDATE': return 'updated';
            case 'DELETE': return 'deleted';
            default: return action.toLowerCase();
          }
        };
        const getContext = (entry) => {
          if (entry.metric_name) return entry.metric_name;
          if (entry.project_name && entry.table_name === 'projects') return entry.project_name;
          return null;
        };
        return (
          <div key={panelId} className={`home-quadrant audit-quadrant panel-${index + 1}`}>
            <div className="quadrant-header">
              <MdHistory className="quadrant-icon" />
              <h2>Audit Log</h2>
              {!forDock && <MinimizeButton />}
            </div>
            <div className="quadrant-content">
              {auditLog.length === 0 ? (
                <div className="empty-state">
                  <MdHistory className="empty-icon" />
                  <p>No recent activity</p>
                </div>
              ) : (
                <div className="audit-console">
                  {auditLog.map((entry, idx) => {
                    const description = formatAuditDescription(entry);
                    const userName = entry.user_email?.split('@')[0] || 'System';
                    const context = getContext(entry);
                    return (
                      <div key={idx} className="audit-line">
                        <span className="audit-prompt">$</span>
                        <span className="audit-user">[{userName}]</span>
                        <span className="audit-verb">{getActionVerb(entry.action)}</span>
                        <span className="audit-table">[{entry.table_name}]</span>
                        {context && <span className="audit-context">{context}</span>}
                        {description && <span className="audit-values">{description}</span>}
                        <span className="audit-time">@ {formatAuditTimestamp(entry.created_at)}</span>
                      </div>
                    );
                  })}
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
              <MdStorage className="quadrant-icon" />
              <h2>Database Stats</h2>
              {!forDock && <MinimizeButton />}
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
                    let status, statusColor, percentFill, tooltipText, rightLabel;

                    if (sizeGB < greenLimit) {
                      status = 'healthy';
                      statusColor = '#10b981';
                      // Scale: 0-100GB fills 0-100% of the bar
                      percentFill = Math.max(1, (sizeGB / greenLimit) * 100);
                      tooltipText = `SQLite performs well up to ~100GB. Current: ${sizeMB.toFixed(2)} MB`;
                      rightLabel = '100 GB';
                    } else if (sizeGB < amberLimit) {
                      status = 'warning';
                      statusColor = '#f59e0b';
                      // Scale: 100GB-200TB, show as percentage of 200TB range
                      percentFill = Math.max(1, Math.min(100, (sizeGB / amberLimit) * 100));
                      tooltipText = `Database over 100GB may have performance issues. Consider optimization. Max: 281TB`;
                      rightLabel = '200 TB';
                    } else {
                      status = 'critical';
                      statusColor = '#ef4444';
                      // Scale: show as percentage of 281TB max
                      percentFill = Math.min(100, (sizeGB / maxLimit) * 100);
                      tooltipText = `Database approaching SQLite maximum (281TB). Consider migrating to PostgreSQL.`;
                      rightLabel = '281 TB';
                    }

                    const displaySize = sizeMB >= 1024 ? `${(sizeMB / 1024).toFixed(2)} GB` : `${sizeMB.toFixed(2)} MB`;

                    return (
                      <div className="db-size-indicator" title={tooltipText}>
                        <div className="db-size-header">
                          <span className="db-size-value">{displaySize}</span>
                          <span className={`db-size-status ${status}`}>{status === 'healthy' ? 'Healthy' : status === 'warning' ? 'Warning' : 'Critical'}</span>
                        </div>
                        <div className="db-size-bar">
                          <div
                            className={`db-size-fill ${status}`}
                            style={{ width: `${percentFill}%`, backgroundColor: statusColor }}
                          />
                        </div>
                        <div className="db-size-limits">
                          <span>0</span>
                          <span>{rightLabel}</span>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="db-summary">
                    <div className="db-stat">
                      <span className="db-stat-value">{databaseStats.tables?.length || 0}</span>
                      <span className="db-stat-label">Tables</span>
                    </div>
                  </div>
                  <div className="db-tables">
                    {databaseStats.tables?.slice().sort((a, b) => b.rowCount - a.rowCount).slice(0, 10).map((table, idx) => (
                      <div key={idx} className="db-table-row">
                        <span className="db-table-name">{table.name}</span>
                        <span className="db-table-count">{table.rowCount.toLocaleString()} rows</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'activeUsers':
        if (!isAdmin) return null;
        return (
          <div key={panelId} className={`home-quadrant active-users-quadrant panel-${index + 1}`}>
            <div className="quadrant-header">
              <MdPeople className="quadrant-icon" />
              <h2>Active Users</h2>
              <span className="quadrant-subtitle">Last 30 minutes</span>
              {!forDock && <MinimizeButton />}
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

      {/* Modals */}
      <TipsModal
        isOpen={showTipsModal}
        onClose={() => { setShowTipsModal(false); setSelectedTipsCategory(null); }}
        selectedCategory={selectedTipsCategory}
        onSelectCategory={setSelectedTipsCategory}
      />

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
        // Get all available panels (filter admin-only if not admin)
        const availableForDock = Object.values(PANEL_CONFIG)
          .filter(panel => !panel.adminOnly || isAdmin);

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
              {availableForDock.map((panel) => {
                const PanelIcon = panel.icon;
                return (
                  <button
                    key={panel.id}
                    className={`minimized-tab ${expandedDockPanel === panel.id ? 'active' : ''}`}
                    onMouseEnter={() => handlePanelHoverStart(panel.id)}
                    onMouseLeave={() => {
                      // Only clear timeout, don't dismiss if already showing
                      if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                      }
                    }}
                  >
                    <PanelIcon />
                    <span className="tab-tooltip">{panel.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Footer Links */}
      <div className="homepage-footer">
        <button className="footer-link" onClick={() => setShowTipsModal(true)}>
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
