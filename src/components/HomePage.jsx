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
  MdPriorityHigh,
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
import { trackPage, startPageLoadTimer } from '../hooks/usePageTracking';
import { smallSelectStyles } from './SelectStyles';
import DashboardConfigModal from './DashboardConfigModal';
import TipsModal, { getAllTips } from './TipsModal';
import { PANEL_CONFIG, LAYOUT_CONFIG, DEFAULT_DASHBOARD_CONFIG } from './homePageConfig';
import ProjectHealthModal, { calculateHealthScore } from './ProjectHealthModal';
import CommentaryPanel from './panels/CommentaryPanel';
import InconsistenciesPanel from './panels/InconsistenciesPanel';
import DatabasePanel from './panels/DatabasePanel';
import ActiveUsersPanel from './panels/ActiveUsersPanel';
import MetricsAtRiskPanel from './panels/MetricsAtRiskPanel';
import AttentionPanel from './panels/AttentionPanel';
import ProjectHealthPanel from './panels/ProjectHealthPanel';
import ProjectTimelinePanel from './panels/ProjectTimelinePanel';
import ClarityPanel from './panels/ClarityPanel';
import AuditPanel from './panels/AuditPanel';
import HeatmapPanel from './panels/HeatmapPanel';
import PerformancePanel from './panels/PerformancePanel';
import 'react-quill/dist/quill.snow.css';
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
  const [upcomingMetrics, setUpcomingMetrics] = useState([]); // Metrics with upcoming updates needed
  const [ragFilter, setRagFilter] = useState('all'); // 'all', 'red', 'amber'
  const [portfolioFilter, setPortfolioFilter] = useState('all'); // 'all' or portfolio_id for metrics
  const [commentaryPortfolioFilter, setCommentaryPortfolioFilter] = useState('all'); // 'all' or portfolio_id for commentary
  const [randomTips, setRandomTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false); // Track if data is currently being loaded
  const [recoveryPlans, setRecoveryPlans] = useState([]); // Track active recovery plans
  const [inconsistencies, setInconsistencies] = useState(null); // Inconsistency report data
  const [pageHeatmap, setPageHeatmap] = useState(null); // Page heatmap data for quadrant
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
  const [healthRankingView, setHealthRankingView] = useState(() => {
    const stored = localStorage.getItem('healthRankingView');
    return stored === 'top' ? 'top' : 'bottom';
  }); // 'top' or 'bottom' for health rankings panel
  const [healthModalProject, setHealthModalProject] = useState(null); // Project to show in health modal
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
  const [allMilestones, setAllMilestones] = useState({}); // Milestones grouped by project ID
  const [hideInactiveProjects, setHideInactiveProjects] = useState(false); // Filter for active projects only
  const hoverTimeoutRef = useRef(null); // Timeout for hover delay

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'admin';

  // Tips from TipsModal
  const allTips = useMemo(() => getAllTips(), []);

  // Start page load timer and randomize tips on component mount only
  useEffect(() => {
    startPageLoadTimer();
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

  // Load milestones for all projects
  useEffect(() => {
    const loadAllMilestones = async () => {
      if (Object.keys(projects).length === 0) return;

      try {
        const projectIds = Object.keys(projects);
        const milestonePromises = projectIds.map(id =>
          api.get(`/milestones?project_id=${id}`)
            .then(res => ({ projectId: id, milestones: res.data || [] }))
            .catch(() => ({ projectId: id, milestones: [] }))
        );

        const results = await Promise.all(milestonePromises);
        const milestonesById = {};
        results.forEach(({ projectId, milestones }) => {
          if (milestones.length > 0) {
            milestonesById[projectId] = milestones;
          }
        });
        setAllMilestones(milestonesById);
      } catch (err) {
        console.error('Failed to load milestones:', err);
      }
    };

    loadAllMilestones();
  }, [Object.keys(projects).length]); // Re-load when projects change

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

      // Keep comments in date order (already sorted DESC by backend)
      setRecentCommentary(enrichedCommentary);

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

          // Helper to check if a period has ended based on frequency
          const hasPeriodEnded = (reportingDate, frequency) => {
            const startDate = new Date(reportingDate);
            startDate.setHours(0, 0, 0, 0);
            let periodEnd;
            switch (frequency) {
              case 'weekly':
                periodEnd = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                break;
              case 'fortnightly':
                periodEnd = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
                break;
              case 'monthly':
                periodEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
                break;
              case 'quarterly':
                periodEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 3, 1);
                break;
              default:
                periodEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
            }
            return today >= periodEnd;
          };

          const frequency = currentPeriod.frequency || 'monthly';
          const periodHasEnded = hasPeriodEnded(currentPeriod.reporting_date, frequency);

          // Check if complete value has been entered
          // Note: complete defaults to 0 in database, so we treat 0 as "no value" for periods that haven't ended
          const hasCompleteValue = currentPeriod.complete !== null &&
                                   currentPeriod.complete !== undefined &&
                                   currentPeriod.complete !== '' &&
                                   currentPeriod.complete !== 0;

          // Get the final target from the last period (the ultimate goal)
          const lastPeriod = sortedPeriods[sortedPeriods.length - 1];

          // Helper to calculate RAG for a period
          const calculateRAGForPeriod = (period) => {
            const complete = parseFloat(period.complete) || 0;
            const expected = parseFloat(period.expected) || 0;
            if (expected === 0) return { ragStatus: 'grey', complete, expected, variancePercent: 0 };

            const variance = complete - expected;
            const variancePercent = Math.abs((variance / expected) * 100);
            const redTolerance = parseFloat(period.red_tolerance) || 10.0;
            const amberTolerance = parseFloat(period.amber_tolerance) || 5.0;

            let ragStatus = 'green';
            if (variance < 0) {
              if (variancePercent > redTolerance) {
                ragStatus = 'red';
              } else if (variancePercent > amberTolerance) {
                ragStatus = 'amber';
              }
            }
            return { ragStatus, complete, expected, variancePercent };
          };

          let ragResult;
          let usedPeriod = currentPeriod;

          console.log(`${metricName}: DEBUG - currentPeriodIndex=${currentPeriodIndex}, hasCompleteValue=${hasCompleteValue}, periodHasEnded=${periodHasEnded}, reportingDate=${currentPeriod.reporting_date}, frequency=${frequency}`);

          if (hasCompleteValue) {
            // Current period has a value, use it
            console.log(`${metricName}: using current period (has value)`);
            ragResult = calculateRAGForPeriod(currentPeriod);
          } else if (periodHasEnded) {
            // Period ended with no value = calculate based on 0 complete (will be red)
            console.log(`${metricName}: period ended with no value - will be red`);
            ragResult = calculateRAGForPeriod(currentPeriod);
          } else if (currentPeriodIndex > 0) {
            // Period hasn't ended, no value - carry forward previous period's status
            usedPeriod = sortedPeriods[currentPeriodIndex - 1];
            ragResult = calculateRAGForPeriod(usedPeriod);
            console.log(`${metricName}: carrying forward previous period RAG`);
          } else {
            // No previous period, no current value, period not ended = skip (grey)
            console.log(`${metricName}: SKIP - no previous period (idx=0), no value, period not ended`);
            return;
          }

          const { ragStatus, complete, expected, variancePercent } = ragResult;
          const finalTarget = parseFloat(lastPeriod.target) || parseFloat(lastPeriod.expected) || expected;

          console.log(`${metricName}: periods=${sortedPeriods.length}, currentIdx=${currentPeriodIndex}, complete=${complete}, expected=${expected}, periodEnded=${periodHasEnded}, hasValue=${hasCompleteValue}, status=${ragStatus}`);

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
              ragStatus,
              hasActualValue: hasCompleteValue // Track if current period has a value entered
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

      // Calculate upcoming metrics (next period needing update) for PM forward view
      const upcomingList = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      Object.entries(projectsData).forEach(([projectId, data]) => {
        if (!data || !Array.isArray(data)) return;
        const projectInfo = projects[projectId];
        if (!projectInfo) return;

        // Only show projects where user is PM or secondary IM (this is "My Projects" view)
        const isProjectOwner = projectInfo.initiative_manager === currentUser?.name;
        const isSecondaryIM = projectInfo.secondary_pm === currentUser?.name;
        if (!isProjectOwner && !isSecondaryIM) return;

        const metricGroups = {};
        data.forEach(period => {
          if (!metricGroups[period.metric]) {
            metricGroups[period.metric] = [];
          }
          metricGroups[period.metric].push(period);
        });

        Object.entries(metricGroups).forEach(([metricName, periods]) => {
          const sortedPeriods = [...periods].sort((a, b) =>
            new Date(a.reporting_date) - new Date(b.reporting_date)
          );

          // Find the next period that needs an update (complete is null or 0 and date has passed or is soon)
          for (let i = 0; i < sortedPeriods.length; i++) {
            const period = sortedPeriods[i];
            const periodDate = new Date(period.reporting_date);
            periodDate.setHours(0, 0, 0, 0);
            const complete = parseFloat(period.complete) || 0;
            const expected = parseFloat(period.expected) || 0;

            // Skip periods in the past that have been completed
            if (periodDate < today && complete > 0) continue;

            // Calculate days until/since this period
            const daysDiff = Math.ceil((periodDate - today) / (1000 * 60 * 60 * 24));

            // Include periods that are due within the next 7 days or are overdue (up to 14 days)
            if (daysDiff <= 7 && daysDiff >= -14 && !complete && expected > 0) {
              upcomingList.push({
                projectId: parseInt(projectId),
                projectName: projectInfo.name,
                metricId: period.metric_id,
                metricName,
                periodDate: period.reporting_date,
                daysDiff,
                expected,
                target: parseFloat(sortedPeriods[sortedPeriods.length - 1].target) || expected,
                portfolioId: projectInfo.portfolio_id,
                portfolioName: projectInfo.portfolio_name,
                portfolioColor: projectInfo.portfolio_color
              });
              break; // Only show the next upcoming period per metric
            }
          }
        });
      });

      // Sort by days until due (overdue first, then soonest)
      upcomingList.sort((a, b) => a.daysDiff - b.daysDiff);
      console.log('Upcoming metrics found:', upcomingList.length, upcomingList);
      setUpcomingMetrics(upcomingList);

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
      if (currentUser?.role === 'admin') {
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
    if (!inconsistencies || !currentUser?.name) {
      console.log('userInconsistencies: missing data', { hasInconsistencies: !!inconsistencies, currentUserName: currentUser?.name });
      return [];
    }
    console.log('userInconsistencies: looking for PM', currentUser.name, 'in', inconsistencies.summary?.map(pm => pm.pm_name));
    const userPmData = inconsistencies.summary?.find(pm => pm.pm_name === currentUser.name);
    console.log('userInconsistencies: found', userPmData?.issues?.length || 0, 'issues');
    return userPmData?.issues || [];
  }, [inconsistencies, currentUser?.name]);

  // Notify parent of attention count changes
  useEffect(() => {
    if (onAttentionCountChange) {
      onAttentionCountChange(userInconsistencies.length + userProjectFeedback.length);
    }
  }, [userInconsistencies.length, userProjectFeedback.length, onAttentionCountChange]);

  // Handle external request to show attention panel (from bell icon)
  useEffect(() => {
    if (showAttentionModal) {
      setExpandedDockPanel('attention');
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

  // Get projects array for timeline (from object to array)
  const projectsArray = useMemo(() => {
    return Object.entries(projects).map(([id, project]) => ({
      ...project,
      id: parseInt(id, 10)
    }));
  }, [projects]);

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

      const portfolio = portfolios.find(p => p.id === project.portfolio_id);
      const portfolioColor = portfolio?.color || '#6b7280';

      return {
        ...project,
        healthScore,
        portfolioName: portfolio?.name || 'No Portfolio',
        portfolioColor
      };
    });

    // All projects are active - no filtering needed
    const filteredProjects = projectsWithHealth;

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
  }, [projects, projectsData, portfolios, selectedSpace, hasSpaceIds, recoveryPlans, dashboardConfig.layout]);

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
          <HeatmapPanel
            key={panelId}
            panelId={panelId}
            index={index}
            darkMode={darkMode}
            forDock={forDock}
            pageHeatmap={pageHeatmap}
            viewsDays={viewsDays}
            setViewsDays={setViewsDays}
            projects={projects}
            onNavigateToProject={onNavigateToProject}
            getDisplayLimit={getDisplayLimit}
          />
        );

      case 'metrics':
        return (
          <MetricsAtRiskPanel
            key={panelId}
            panelId={panelId}
            index={index}
            darkMode={darkMode}
            loading={loading}
            forDock={forDock}
            atRiskMetrics={atRiskMetrics}
            filteredMetrics={filteredMetrics}
            ragFilter={ragFilter}
            setRagFilter={setRagFilter}
            redCount={redCount}
            amberCount={amberCount}
            portfolioFilter={portfolioFilter}
            setPortfolioFilter={setPortfolioFilter}
            portfoliosInMetrics={portfoliosInMetrics}
            selectedSpace={selectedSpace}
            spaces={spaces}
            needsRecoveryPlan={needsRecoveryPlan}
            onMetricClick={handleMetricClick}
          />
        );

      case 'commentary':
        return (
          <CommentaryPanel
            key={panelId}
            panelId={panelId}
            index={index}
            darkMode={darkMode}
            loading={loading}
            recentCommentary={recentCommentary}
            commentaryPortfolioFilter={commentaryPortfolioFilter}
            setCommentaryPortfolioFilter={setCommentaryPortfolioFilter}
            selectedSpace={selectedSpace}
            spaces={spaces}
            onMetricClick={handleMetricClick}
          />
        );

      case 'inconsistencies':
        return (
          <InconsistenciesPanel
            key={panelId}
            panelId={panelId}
            index={index}
            inconsistencies={inconsistencies}
            expandedPMs={expandedPMs}
            setExpandedPMs={setExpandedPMs}
            selectedSpace={selectedSpace}
            spaces={spaces}
            onNavigateToProject={onNavigateToProject}
          />
        );

      case 'attention':
        return (
          <AttentionPanel
            key={panelId}
            panelId={panelId}
            index={index}
            loading={loading}
            forDock={forDock}
            userInconsistencies={userInconsistencies}
            userProjectFeedback={userProjectFeedback}
            upcomingMetrics={upcomingMetrics}
            onNavigateToProject={onNavigateToProject}
            onMetricClick={handleMetricClick}
          />
        );

      case 'projectHealth':
        return (
          <ProjectHealthPanel
            key={panelId}
            panelId={panelId}
            index={index}
            forDock={forDock}
            projectHealthRankings={projectHealthRankings}
            healthRankingView={healthRankingView}
            setHealthRankingView={setHealthRankingView}
            onNavigateToProject={onNavigateToProject}
            onShowHealthModal={setHealthModalProject}
          />
        );

      case 'timeline':
        return (
          <ProjectTimelinePanel
            key={panelId}
            panelId={panelId}
            index={index}
            forDock={forDock}
            projects={projectsArray}
            portfolios={portfolios}
            selectedSpace={selectedSpace}
            milestones={allMilestones}
            onNavigateToProject={onNavigateToProject}
          />
        );

      case 'clarity':
        return (
          <ClarityPanel
            key={panelId}
            panelId={panelId}
            index={index}
            forDock={forDock}
          />
        );

      case 'audit':
        return (
          <AuditPanel
            key={panelId}
            panelId={panelId}
            index={index}
            isAdmin={isAdmin}
            forDock={forDock}
            auditLog={auditLog}
            auditTimeline={auditTimeline}
            auditHoveredDateIdx={auditHoveredDateIdx}
            setAuditHoveredDateIdx={setAuditHoveredDateIdx}
            auditSelectedDateIdx={auditSelectedDateIdx}
            setAuditSelectedDateIdx={setAuditSelectedDateIdx}
          />
        );

      case 'database':
        return (
          <DatabasePanel
            key={panelId}
            panelId={panelId}
            index={index}
            isAdmin={isAdmin}
            databaseStats={databaseStats}
            darkMode={darkMode}
            forDock={forDock}
          />
        );

      case 'activeUsers':
        return (
          <ActiveUsersPanel
            key={panelId}
            panelId={panelId}
            index={index}
            isAdmin={isAdmin}
            forDock={forDock}
            activeUsers={activeUsers}
            userActivity={userActivity}
            userActivityDays={userActivityDays}
            setUserActivityDays={setUserActivityDays}
            setUserActivity={setUserActivity}
            api={api}
          />
        );

      case 'performance':
        return (
          <PerformancePanel
            key={panelId}
            panelId={panelId}
            index={index}
            darkMode={darkMode}
            forDock={forDock}
            onNavigateToProject={onNavigateToProject}
            projects={projects}
            getDisplayLimit={getDisplayLimit}
          />
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
          <button
            className="dashboard-config-btn"
            onClick={() => setShowConfigModal(true)}
            title="Configure Dashboard"
          >
            <MdSettings />
          </button>
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
                  {['heatmap', 'metrics', 'commentary', 'inconsistencies', 'projectHealth', 'timeline'].includes(expandedDockPanel) && (
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
              {/* Regular panels */}
              {allPanels.filter(p => !p.adminOnly).map((panel) => {
                const PanelIcon = panel.icon;
                return (
                  <button
                    key={panel.id}
                    className={`minimized-tab ${expandedDockPanel === panel.id ? 'active' : ''}`}
                    data-panel={panel.id}
                    onMouseEnter={() => handlePanelHoverStart(panel.id)}
                    onMouseLeave={() => {
                      if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                      }
                    }}
                    title={panel.name}
                  >
                    <PanelIcon />
                    <span className="tab-tooltip">{panel.name}</span>
                  </button>
                );
              })}

              {/* Divider between regular and admin panels */}
              <div className="dock-divider" />

              {/* Admin panels */}
              {allPanels.filter(p => p.adminOnly).map((panel) => {
                const PanelIcon = panel.icon;
                const isLocked = !isAdmin;
                return (
                  <button
                    key={panel.id}
                    className={`minimized-tab ${expandedDockPanel === panel.id ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                    data-panel={panel.id}
                    onMouseEnter={() => !isLocked && handlePanelHoverStart(panel.id)}
                    onMouseLeave={() => {
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

      {/* Project Health Modal */}
      {healthModalProject && (
        <ProjectHealthModal
          project={projects[healthModalProject.id] || healthModalProject}
          projectData={projectsData[healthModalProject.id] || []}
          metrics={(() => {
            // Extract metrics from project data
            const projectData = projectsData[healthModalProject.id] || [];
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
            return Object.values(metricsMap);
          })()}
          recoveryPlans={recoveryPlans.filter(rp => rp.project_id === healthModalProject.id)}
          projectLinks={healthModalProject.link_count || 0}
          onClose={() => setHealthModalProject(null)}
        />
      )}

      {/* Footer Links */}
      <div className="homepage-footer">
        <button className="footer-link" onClick={() => { setShowTipsModal(true); setSelectedTipsCategory('Best Practices'); }}>
          Best Practices
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
