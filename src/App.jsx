import React, { useState, useEffect, useMemo, useRef } from 'react';
import Select from 'react-select';
import Login from './components/Login';
import ProjectSelector from './components/ProjectSelector';
import PortfolioSelector from './components/PortfolioSelector';
import SpaceSelector from './components/SpaceSelector';
import PortfolioManager from './components/PortfolioManager';
import SpaceManager from './components/SpaceManager';
import AdminReport from './components/AdminReport';
import ReportSelector from './components/ReportSelector';
import MetricChart from './components/MetricChart';
import MetricTabs from './components/MetricTabs';
import DataGrid from './components/DataGrid';
import AuditLog from './components/AuditLog';
import UserManagement from './components/UserManagement';
import UserSelector from './components/UserSelector';
import ProjectSetup from './components/ProjectSetup';
import ProjectLinksEditor from './components/ProjectLinksEditor';
import ProjectDependencies from './components/ProjectDependencies';
import AddMetricModal from './components/AddMetricModal';
import UserProfile from './components/UserProfile';
import ImportData from './components/ImportData';
import UserActivityReport from './components/UserActivityReport';
import PageHeatmapReport from './components/PageHeatmapReport';
import HomePage from './components/HomePage';
import { api } from './api/client';
import { selectStyles } from './components/SelectStyles';
import { MdArrowDropDown, MdHelpOutline, MdShare, MdLightMode, MdDarkMode } from 'react-icons/md';
import ProjectHealthModal, { calculateHealthScore } from './components/ProjectHealthModal';
import Lottie from 'lottie-react';
import progressChartAnimation from './assets/progress-chart.json';
import bellNotificationAnimation from './assets/bell-notification.json';
import { trackPage } from './hooks/usePageTracking';
import './App.css';

function App() {
  console.log('=== App Component Rendering ===');

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [portfolios, setPortfolios] = useState([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState('all');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [projectData, setProjectData] = useState([]);
  const [projectMetrics, setProjectMetrics] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('');
  const [showDataGrid, setShowDataGrid] = useState(false);
  const [showAddMetric, setShowAddMetric] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [editProjectNameValue, setEditProjectNameValue] = useState('');
  const [editingProjectDesc, setEditingProjectDesc] = useState(false);
  const [editProjectDescValue, setEditProjectDescValue] = useState('');
  const [editingProjectDates, setEditingProjectDates] = useState(false);
  const [editProjectStartDate, setEditProjectStartDate] = useState('');
  const [editProjectEndDate, setEditProjectEndDate] = useState('');
  const [editingPortfolio, setEditingPortfolio] = useState(false);
  const [editPortfolioValue, setEditPortfolioValue] = useState(null);
  const [editingPMs, setEditingPMs] = useState(false);
  const [editPMValue, setEditPMValue] = useState(null);
  const [editSecondaryPMValue, setEditSecondaryPMValue] = useState(null);
  const [users, setUsers] = useState([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [timeTravelTimestamp, setTimeTravelTimestamp] = useState(null);
  const [projectLinks, setProjectLinks] = useState([]);
  const [showLinksEditor, setShowLinksEditor] = useState(false);
  const [showImportData, setShowImportData] = useState(false);
  const [showPortfolioManager, setShowPortfolioManager] = useState(false);
  const [showSpaceManager, setShowSpaceManager] = useState(false);
  const [showChaserModal, setShowChaserModal] = useState(false);
  const [chaserData, setChaserData] = useState({ emails: '', sections: '', pmCount: 0, issueCount: 0 });
  const [showAdminReport, setShowAdminReport] = useState(false);
  const [adminReportConfig, setAdminReportConfig] = useState({ type: null, id: null, name: null });
  const [showReportSelector, setShowReportSelector] = useState(false);
  const [showUserActivity, setShowUserActivity] = useState(false);
  const [showPageHeatmap, setShowPageHeatmap] = useState(false);
  const [showGridView, setShowGridView] = useState(false);
  const [showTenReasons, setShowTenReasons] = useState(false);
  const [showProjectHealth, setShowProjectHealth] = useState(false);
  const [allProjectsData, setAllProjectsData] = useState({}); // For HomePage red metrics
  const [attentionCount, setAttentionCount] = useState(0); // Count of items needing attention
  const [showAttentionModal, setShowAttentionModal] = useState(false); // Trigger to show attention modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [loginTime, setLoginTime] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('darkMode');
      return saved ? JSON.parse(saved) : false;
    } catch (err) {
      console.error('Failed to parse darkMode from localStorage:', err);
      // Clean up corrupted data
      localStorage.removeItem('darkMode');
      return false;
    }
  });
  // Load user on mount and load projects regardless of auth
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    let parsedUser = null;
    if (token && userStr) {
      try {
        parsedUser = JSON.parse(userStr);
        setIsAuthenticated(true);
        setCurrentUser(parsedUser);
        // Set login time from storage or current time
        const savedLoginTime = localStorage.getItem('loginTime');
        setLoginTime(savedLoginTime ? new Date(savedLoginTime) : new Date());
      } catch (err) {
        console.error('Failed to parse user from localStorage:', err);
        // Clean up corrupted data and log out
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    }
    loadSpaces(parsedUser);
    loadPortfolios();
    // Note: Don't call loadProjects() here - let the selectedPortfolio useEffect handle it

    // Parse URL parameters on initial load
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');
    const metricName = params.get('metric');

    if (projectId) {
      setSelectedProject(projectId);
      if (metricName) {
        setSelectedMetric(metricName);
      }
    }

    // Handle browser back/forward buttons
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const projectId = params.get('project');
      const metricName = params.get('metric');

      setSelectedProject(projectId || '');
      setSelectedMetric(metricName || '');
    };

    window.addEventListener('popstate', handlePopState);

    // What's New is now only opened via footer link, not on first load
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Apply dark mode class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Load users for PM selector (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadUsers = async () => {
      try {
        const response = await api.getUsers();
        setUsers(response.data);
      } catch (err) {
        console.error('Failed to load users:', err);
      }
    };
    loadUsers();
  }, [isAuthenticated]);

  // Load all projects data when projects list changes (for HomePage)
  useEffect(() => {
    if (projects.length > 0) {
      loadAllProjectsData();
    }
  }, [projects.length]);

  // Reload projects when portfolio selection changes
  useEffect(() => {
    const loadAndSelectProject = async () => {
      try {
        const url = selectedPortfolio ? `/projects?portfolio_id=${selectedPortfolio}` : '/projects';
        const response = await api.get(url);
        setProjects(response.data);

        // If we have a portfolio filter and a currently selected project
        if (selectedPortfolio && selectedProject) {
          // Check if the current project is in the filtered list
          const projectInList = response.data.find(p => p.id === parseInt(selectedProject));
          if (!projectInList && response.data.length > 0) {
            // Current project not in this portfolio, select the first one
            setSelectedProject(response.data[0].id.toString());
            setSelectedMetric('');
          } else if (!projectInList) {
            // No projects in this portfolio
            setSelectedProject('');
            setSelectedMetric('');
          }
        } else if (selectedPortfolio && !selectedProject && response.data.length > 0) {
          // Portfolio selected but no project selected - select first project
          setSelectedProject(response.data[0].id.toString());
          setSelectedMetric('');
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    };

    loadAndSelectProject();
  }, [selectedPortfolio]);

  // Load project data when project selected
  useEffect(() => {
    if (selectedProject) {
      loadProjectData();
      loadProjectMetrics();
      loadProjectLinks();

      // Track page view for analytics
      const project = projects.find(p => p.id === parseInt(selectedProject));
      if (project) {
        trackPage(`Project: ${project.name}`);
      }
    }
  }, [selectedProject, projects]);

  // Auto-select first metric when metrics load
  useEffect(() => {
    if (projectMetrics.length > 0 && !selectedMetric) {
      setSelectedMetric(projectMetrics[0].name);
    }
  }, [projectMetrics]);

  const loadSpaces = async (user = null) => {
    try {
      const response = await api.getSpaces();
      const loadedSpaces = response.data || [];
      setSpaces(loadedSpaces);

      // Reset to 'all' if no spaces exist
      if (loadedSpaces.length === 0) {
        setSelectedSpace('all');
        return; // Exit early, no need to check for default space
      }

      // Use passed user or fall back to currentUser state
      const userToCheck = user || currentUser;

      // Only set default space if it exists in loaded spaces
      if (userToCheck && userToCheck.default_space_id) {
        const spaceExists = loadedSpaces.some(s => s.id === userToCheck.default_space_id);
        if (spaceExists) {
          setSelectedSpace(userToCheck.default_space_id.toString());
        }
      }
    } catch (err) {
      console.error('Failed to load spaces:', err);
      // Keep selectedSpace as 'all' on error
    }
  };

  const loadPortfolios = async () => {
    try {
      const response = await api.get('/portfolios');
      setPortfolios(response.data);
    } catch (err) {
      console.error('Failed to load portfolios:', err);
    }
  };

  const loadProjects = async (portfolioFilter) => {
    try {
      // Use provided filter, or fall back to current selectedPortfolio state
      const filterToUse = portfolioFilter !== undefined ? portfolioFilter : selectedPortfolio;
      const url = filterToUse ? `/projects?portfolio_id=${filterToUse}` : '/projects';
      const response = await api.get(url);
      setProjects(response.data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadProjectData = async (timestamp = null) => {
    try {
      const response = timestamp
        ? await api.getProjectDataTimeTravel(selectedProject, timestamp)
        : await api.getProjectData(selectedProject);
      console.log('loadProjectData received', response.data.length, 'periods:', response.data);
      setProjectData(response.data);
    } catch (err) {
      console.error('Failed to load project data:', err);
    }
  };

  const loadProjectMetrics = async () => {
    try {
      const response = await api.getProjectMetrics(selectedProject);
      setProjectMetrics(response.data);
    } catch (err) {
      console.error('Failed to load project metrics:', err);
      setProjectMetrics([]);
    }
  };

  const loadProjectLinks = async () => {
    try {
      const response = await api.getProjectLinks(selectedProject);
      setProjectLinks(response.data);
    } catch (err) {
      console.error('Failed to load project links:', err);
      setProjectLinks([]);
    }
  };

  // Load all projects data for HomePage
  const loadAllProjectsData = async () => {
    try {
      const projectsData = {};
      for (const project of projects) {
        const response = await api.getProjectData(project.id);
        projectsData[project.id] = response.data;
      }
      setAllProjectsData(projectsData);
    } catch (err) {
      console.error('Failed to load all projects data:', err);
    }
  };

  const handleTimeTravelChange = async (timestamp) => {
    setTimeTravelTimestamp(timestamp);
    await loadProjectData(timestamp);
  };

  // No longer blocking on authentication - allow unauthenticated viewing

  const handleProjectChange = (projectId) => {
    setSelectedProject(projectId);
    setSelectedMetric(''); // Reset metric when changing projects
    updateURL(projectId, '');
  };

  const handleMetricChange = (metric) => {
    setSelectedMetric(metric);
    updateURL(selectedProject, metric);
  };

  // Navigate to a specific project and optionally a metric (for HomePage)
  const handleNavigateToProject = (projectId, metricName = '') => {
    setSelectedProject(projectId.toString());
    if (metricName) {
      setSelectedMetric(metricName);
      updateURL(projectId.toString(), metricName);
    } else {
      setSelectedMetric('');
      updateURL(projectId.toString(), '');
    }
  };

  // Update URL without page reload
  const updateURL = (projectId, metricName) => {
    const params = new URLSearchParams();
    if (projectId) {
      params.set('project', projectId);
      if (metricName) {
        params.set('metric', metricName);
      }
    }
    const newURL = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.pushState({}, '', newURL);
  };

  const handleCommentaryChange = async (itemId, newCommentary) => {
    try {
      await api.patchPeriod(itemId, { commentary: newCommentary });
      // Update local state
      setProjectData(prevData =>
        prevData.map(item =>
          item.id === itemId ? { ...item, commentary: newCommentary } : item
        )
      );
    } catch (err) {
      console.error('Failed to update commentary:', err);
    }
  };

  const handleDataGridChange = async (updatedData) => {
    try {
      console.log('handleDataGridChange called with', updatedData.length, 'periods');
      console.log('Current projectData has', projectData.length, 'periods');
      console.log('Updated data:', updatedData.map(d => ({ id: d.id, date: d.reporting_date, metric_id: d.metric_id })));

      // Separate new and existing periods
      for (const item of updatedData) {
        // Match on both ID and metric to avoid matching periods from different metrics
        // Also, IDs generated by DataGrid are temporary (high numbers), so check if this
        // period actually exists in projectData for the SAME metric
        const original = projectData.find(p =>
          p.id === item.id && p.metric_id === item.metric_id
        );

        if (!original) {
          // This is a new period - create it
          console.log('Creating new period:', {
            metric_id: item.metric_id,
            reporting_date: item.reporting_date,
            expected: item.expected,
            target: item.final_target,
            complete: item.complete
          });

          if (!item.metric_id) {
            console.error('Cannot create period without metric_id', item);
            alert('Error: Period is missing metric ID and cannot be saved.');
            throw new Error('Missing metric_id');
          }

          // Check if this period is beyond the metric's end date
          const metric = projectMetrics.find(m => m.id === item.metric_id);
          if (metric && metric.end_date) {
            const periodDate = new Date(item.reporting_date);
            const metricEndDate = new Date(metric.end_date);

            if (periodDate > metricEndDate) {
              // Period is beyond metric's end date - ask user if they want to extend
              const newEndDate = item.reporting_date;
              const confirmed = window.confirm(
                `This period (${item.reporting_date}) is after the metric's current end date (${metric.end_date}).\n\n` +
                `Would you like to extend the metric end date to ${newEndDate}?`
              );

              if (confirmed) {
                // Update the metric's end date
                try {
                  await api.updateMetric(metric.id, {
                    end_date: newEndDate
                  });
                  console.log('Metric end date updated to:', newEndDate);
                } catch (updateErr) {
                  console.error('Failed to update metric end date:', updateErr);
                  alert('Failed to update metric end date. Period will not be created.');
                  throw updateErr;
                }
              } else {
                // User declined - skip this period
                console.log('User declined to extend metric end date. Skipping period creation.');
                continue;
              }
            }
          }

          const response = await api.createPeriod({
            metric_id: item.metric_id,
            reporting_date: item.reporting_date,
            expected: item.expected,
            target: item.final_target,
            complete: item.complete
          });
          console.log('Period created successfully:', response.data);
        } else if (original.complete !== item.complete ||
                   original.expected !== item.expected ||
                   original.final_target !== item.final_target ||
                   original.reporting_date !== item.reporting_date) {
          // This is an existing period - update it
          try {
            await api.updatePeriod(item.id, {
              reporting_date: item.reporting_date,
              complete: item.complete,
              expected: item.expected,
              target: item.final_target
            });
          } catch (updateErr) {
            // Check if this is a historic edit error
            if (updateErr.response?.data?.isHistoricEdit) {
              alert(updateErr.response.data.error + '\n\nOnly administrators can edit completion values for past periods.');
              throw updateErr; // Re-throw to stop processing
            }
            throw updateErr;
          }
        }
      }
      // Reload both project data and metrics list
      console.log('Reloading project data after save...');
      await loadProjectData();
      await loadProjectMetrics();
      console.log('Project data reloaded, new count:', projectData.length);
    } catch (err) {
      console.error('Failed to update data:', err);
      // Don't show generic alert if we already showed specific historic edit message
      if (!err.response?.data?.isHistoricEdit) {
        alert('Failed to update data. Please try again.');
      }
    }
  };

  const handleProjectSetupComplete = async (projectId) => {
    await loadProjects();
    setShowNewProject(false);
    // Reset metric selection and set project (triggers useEffect to load data)
    setSelectedMetric('');
    setSelectedProject(projectId.toString());
  };

  // Track mousedown target to prevent closing modal when drag starts inside
  const modalMouseDownTarget = useRef(null);

  const handleModalMouseDown = (e) => {
    modalMouseDownTarget.current = e.target;
  };

  const handleModalClick = (e, closeHandler) => {
    // Only close if both mousedown and click (mouseup) were on the overlay itself
    if (modalMouseDownTarget.current === e.target && e.target === e.currentTarget) {
      closeHandler();
    }
    modalMouseDownTarget.current = null;
  };

  const handleProjectSetupCancel = () => {
    setShowNewProject(false);
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;

    const project = projects.find(p => p.id === parseInt(selectedProject));
    if (!confirm(`Are you sure you want to delete "${project?.name}"? This will delete all metrics and data.`)) {
      return;
    }

    try {
      await api.deleteProject(selectedProject);
      setSelectedProject('');
      await loadProjects();
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert('Failed to delete project: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleProjectRename = async (projectId, newName) => {
    try {
      const project = projects.find(p => p.id === parseInt(projectId));
      if (!project) return;

      await api.updateProject(projectId, {
        name: newName,
        description: project.description,
        initiative_manager: project.initiative_manager,
        secondary_pm: project.secondary_pm,
        portfolio_id: project.portfolio_id
      });

      // Reload projects to reflect the new name
      await loadProjects();
    } catch (err) {
      console.error('Failed to rename project:', err);
      alert('Failed to rename project');
    }
  };

  const handleProjectNameDoubleClick = () => {
    setEditingProjectName(true);
    setEditProjectNameValue(projectName);
  };

  const handleProjectNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveProjectName();
    } else if (e.key === 'Escape') {
      setEditingProjectName(false);
    }
  };

  const handleSaveProjectName = async () => {
    if (editProjectNameValue.trim() && editProjectNameValue !== projectName) {
      await handleProjectRename(selectedProject, editProjectNameValue.trim());
    }
    setEditingProjectName(false);
  };

  const handleProjectDescClick = () => {
    if (!canEdit()) return;
    setEditingProjectDesc(true);
    setEditProjectDescValue(currentProject?.description || '');
  };

  const handleProjectDescKeyDown = (e) => {
    // Allow Shift+Enter for new lines
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveProjectDesc();
    } else if (e.key === 'Escape') {
      setEditingProjectDesc(false);
    }
  };

  const handleSaveProjectDesc = async () => {
    if (editProjectDescValue !== (currentProject?.description || '')) {
      try {
        await api.updateProject(selectedProject, {
          name: currentProject.name,
          description: editProjectDescValue,
          initiative_manager: currentProject.initiative_manager,
          secondary_pm: currentProject.secondary_pm,
          portfolio_id: currentProject.portfolio_id
        });
        // Reload projects to reflect the new description
        await loadProjects();
      } catch (err) {
        console.error('Failed to update project description:', err);
        alert('Failed to update project description');
      }
    }
    setEditingProjectDesc(false);
  };

  const handleSaveProjectDates = async () => {
    if (editProjectStartDate && editProjectEndDate) {
      // Validate dates
      if (new Date(editProjectStartDate) >= new Date(editProjectEndDate)) {
        alert('End date must be after start date');
        return;
      }

      try {
        await api.updateProject(selectedProject, {
          name: currentProject.name,
          description: currentProject.description,
          initiative_manager: currentProject.initiative_manager,
          secondary_pm: currentProject.secondary_pm,
          start_date: editProjectStartDate,
          end_date: editProjectEndDate,
          portfolio_id: currentProject.portfolio_id
        });
        // Reload projects to reflect the new dates
        await loadProjects();
      } catch (err) {
        console.error('Failed to update project dates:', err);
        alert('Failed to update project dates');
      }
    }
    setEditingProjectDates(false);
  };

  const handlePortfolioClick = () => {
    if (!canEdit()) return;
    setEditingPortfolio(true);
    setEditPortfolioValue(currentProject?.portfolio_id || null);
  };

  const handlePortfolioOptionClick = (portfolioId) => {
    if (portfolioId === '__create__') {
      setShowPortfolioManager(true);
      setEditingPortfolio(false);
      return;
    }
    setEditPortfolioValue(portfolioId);
  };

  const handleSavePortfolio = async () => {
    if (editPortfolioValue !== (currentProject?.portfolio_id || null)) {
      try {
        await api.updateProject(selectedProject, {
          name: currentProject.name,
          description: currentProject.description,
          initiative_manager: currentProject.initiative_manager,
          secondary_pm: currentProject.secondary_pm,
          portfolio_id: editPortfolioValue
        });

        // If we're filtering by a portfolio and the project was moved to a different one,
        // switch to the new portfolio so the project remains visible
        if (selectedPortfolio && editPortfolioValue !== selectedPortfolio) {
          setSelectedPortfolio(editPortfolioValue);
          // loadProjects will be triggered by the useEffect watching selectedPortfolio
        } else {
          // Reload projects to reflect the new portfolio
          await loadProjects();
        }
      } catch (err) {
        console.error('Failed to update project portfolio:', err);
        alert('Failed to update project portfolio');
      }
    }
    setEditingPortfolio(false);
  };

  const handlePMsClick = () => {
    if (!canEdit()) return;
    setEditingPMs(true);
    // Find the user objects by name
    const primaryUser = users.find(u => u.name === currentProject?.initiative_manager);
    const secondaryUser = users.find(u => u.name === currentProject?.secondary_pm);
    setEditPMValue(primaryUser ? { value: primaryUser.id, label: primaryUser.name } : null);
    setEditSecondaryPMValue(secondaryUser ? { value: secondaryUser.id, label: secondaryUser.name } : null);
  };

  const handleSavePMs = async () => {
    const newPMName = editPMValue?.label || '';
    const newSecondaryPMName = editSecondaryPMValue?.label || '';
    const pmChanged = newPMName !== (currentProject?.initiative_manager || '');
    const secondaryPMChanged = newSecondaryPMName !== (currentProject?.secondary_pm || '');

    if (pmChanged || secondaryPMChanged) {
      try {
        await api.updateProject(selectedProject, {
          name: currentProject.name,
          description: currentProject.description,
          initiative_manager: newPMName,
          secondary_pm: newSecondaryPMName,
          portfolio_id: currentProject.portfolio_id
        });
        await loadProjects();
      } catch (err) {
        console.error('Failed to update project managers:', err);
        alert('Failed to update project managers: ' + (err.response?.data?.error || err.message));
      }
    }
    setEditingPMs(false);
  };

  const handleMetricCreated = async (metricName) => {
    // Reload both metrics list and project data
    await loadProjectMetrics();
    await loadProjectData();
    // Select the newly created metric
    setSelectedMetric(metricName);
  };

  const handleMetricRename = async (oldName, newName) => {
    try {
      // Find the metric ID from the project metrics
      const metric = projectMetrics.find(m => m.name === oldName);
      if (!metric) return;

      await api.updateMetric(metric.id, { name: newName });

      // Reload both metrics list and project data
      await loadProjectMetrics();
      await loadProjectData();

      // Update selected metric if it was the one being renamed
      if (selectedMetric === oldName) {
        setSelectedMetric(newName);
      }
    } catch (err) {
      console.error('Failed to rename metric:', err);
      alert('Failed to rename metric');
    }
  };

  const handleMetricDelete = async (metricName) => {
    try {
      const metric = projectMetrics.find(m => m.name === metricName);
      if (!metric) return;

      await api.deleteMetric(metric.id);

      // Reload both metrics list and project data
      await loadProjectMetrics();
      await loadProjectData();

      // If the deleted metric was selected, select the first available metric
      if (selectedMetric === metricName) {
        const remainingMetrics = projectMetrics.filter(m => m.name !== metricName);
        setSelectedMetric(remainingMetrics.length > 0 ? remainingMetrics[0].name : '');
      }
    } catch (err) {
      console.error('Failed to delete metric:', err);
      alert('Failed to delete metric: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleMetricReorder = async (metricIds) => {
    try {
      await api.reorderMetrics(selectedProject, metricIds);
      // Reload metrics to reflect new order
      await loadProjectMetrics();
    } catch (err) {
      console.error('Failed to reorder metrics:', err);
    }
  };

  const handleToleranceChange = async (newAmberTolerance, newRedTolerance) => {
    try {
      // Find the metric ID from the currently selected metric
      const metric = projectMetrics.find(m => m.name === selectedMetric);
      if (!metric) return;

      await api.updateMetric(metric.id, {
        amber_tolerance: newAmberTolerance,
        red_tolerance: newRedTolerance
      });

      // Reload project data to reflect the new tolerance values
      await loadProjectData();
    } catch (err) {
      console.error('Failed to update tolerances:', err);
      alert('Failed to update tolerances: ' + (err.response?.data?.error || err.message));
      throw err; // Re-throw so MetricChart can handle the error
    }
  };

  const handleTargetChange = async (newTarget, isCustomCurve, periodInfo = null) => {
    try {
      // Find the metric ID from the currently selected metric
      const metric = projectMetrics.find(m => m.name === selectedMetric);
      if (!metric) return;

      // No dialog - just update target from the edited period onwards
      // and recalculate expected curve from that period
      await api.updateMetric(metric.id, {
        final_target: parseFloat(newTarget),
        recalculate_expected: 'future',
        from_period_index: periodInfo?.periodIndex ?? 0
      });

      // Reload both project data and metrics to reflect the new target
      await loadProjectData();
      await loadProjectMetrics();
    } catch (err) {
      console.error('Failed to update target:', err);
      alert('Failed to update target: ' + (err.response?.data?.error || err.message));
      throw err;
    }
  };

  const handleProgressionChange = async (newProgression) => {
    try {
      // Find the metric ID from the currently selected metric
      const metric = projectMetrics.find(m => m.name === selectedMetric);
      if (!metric) return;

      await api.updateMetric(metric.id, {
        progression_type: newProgression
      });

      // Reload both project data and metrics to reflect the new progression
      await loadProjectData();
      await loadProjectMetrics();
    } catch (err) {
      console.error('Failed to update progression type:', err);
      alert('Failed to update progression type: ' + (err.response?.data?.error || err.message));
      throw err;
    }
  };

  const handleDescriptionChange = async (newDescription) => {
    try {
      // Find the metric ID from the currently selected metric
      const metric = projectMetrics.find(m => m.name === selectedMetric);
      if (!metric) return;

      await api.updateMetric(metric.id, {
        description: newDescription
      });

      // Reload both project data and metrics to reflect the new description
      await loadProjectData();
      await loadProjectMetrics();
    } catch (err) {
      console.error('Failed to update description:', err);
      alert('Failed to update description: ' + (err.response?.data?.error || err.message));
      throw err;
    }
  };

  const handleMetricDatesChange = async (newStartDate, newEndDate) => {
    try {
      // Find the metric ID from the currently selected metric
      const metric = projectMetrics.find(m => m.name === selectedMetric);
      if (!metric) return;

      await api.updateMetric(metric.id, {
        start_date: newStartDate,
        end_date: newEndDate
      });

      // Reload both project data and metrics to reflect the new dates
      await loadProjectData();
      await loadProjectMetrics();
    } catch (err) {
      console.error('Failed to update metric dates:', err);
      alert('Failed to update metric dates: ' + (err.response?.data?.error || err.message));
      throw err;
    }
  };

  // Convert projects array to object format for ProjectSelector
  const projectsObject = useMemo(() => {
    return projects.reduce((acc, project) => {
      acc[project.id] = {
        name: project.name,
        portfolio_id: project.portfolio_id,
        portfolio_name: project.portfolio_name,
        portfolio_color: project.portfolio_color,
        initiative_manager: project.initiative_manager
      };
      return acc;
    }, {});
  }, [projects]);

  // Get metrics list from projectMetrics state
  const metrics = projectMetrics.map(m => m.name);

  const currentProject = selectedProject
    ? projects.find(p => p.id === parseInt(selectedProject))
    : null;

  const projectName = currentProject?.name || '';

  // Calculate project duration if dates are available
  const getProjectDuration = () => {
    if (!currentProject?.start_date || !currentProject?.end_date) return null;

    const start = new Date(currentProject.start_date);
    const end = new Date(currentProject.end_date);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.round(diffDays / 30.44);
    const diffWeeks = Math.round(diffDays / 7);

    return { days: diffDays, months: diffMonths, weeks: diffWeeks };
  };

  const projectDuration = getProjectDuration();

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Get metric tolerances from the selected metric's data
  const selectedMetricData = selectedMetric
    ? projectData.find(item => item.metric === selectedMetric)
    : null;
  const amberTolerance = selectedMetricData?.amber_tolerance || 5.0;
  const redTolerance = selectedMetricData?.red_tolerance || 10.0;

  const currentProjectData = projectData;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('loginTime');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setLoginTime(null);
  };

  // Helper function to get user initials
  const getUserInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Helper functions for role checks
  const isAdmin = () => currentUser?.role === 'admin';
  const isPMOrHigher = () => currentUser && (currentUser.role === 'admin' || currentUser.role === 'pm');
  const canEdit = () => currentUser && (currentUser.role === 'admin' || currentUser.role === 'pm' || currentUser.role === 'editor');

  // Get chaser report for current space (admin only)
  const handleComposeChaser = async () => {
    try {
      if (selectedSpace === 'all') {
        alert('Please select a specific space first');
        return;
      }
      const response = await api.get(`/chaser-report/${selectedSpace}`);
      setChaserData(response.data);
      setShowChaserModal(true);
    } catch (err) {
      console.error('Failed to get chaser report:', err);
      alert('Failed to get chaser report: ' + (err.response?.data?.error || err.message));
    }
  };

  // Copy current URL to clipboard
  const handleShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback: show the URL in a prompt
      prompt('Copy this link:', window.location.href);
    }
  };

  return (
    <div className="app">
      <header className="app-header-main">
        <div className="header-content">
          <div className="header-left">
            <h1
              onClick={() => {
                setSelectedProject('');
                setSelectedMetric('');
                window.history.pushState({}, '', window.location.pathname);
              }}
              style={{ cursor: 'pointer' }}
              title="Go to Dashboard"
            >
              <Lottie
                animationData={progressChartAnimation}
                loop={true}
                className="app-logo-lottie"
              />
              <div className="header-title-group">
                <span className="header-title-text">Progress Tracker</span>
                <button
                  className="ten-reasons-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTenReasons(true);
                  }}
                >
                  Ten reasons you need this
                </button>
              </div>
            </h1>
          </div>
          <div className="header-right">
            <SpaceSelector
              spaces={spaces}
              selectedSpace={selectedSpace}
              onSpaceChange={async (spaceId) => {
                setSelectedSpace(spaceId);
                // Save user's default space preference (including "all")
                if (currentUser) {
                  try {
                    const spaceIdToSave = spaceId === 'all' ? null : parseInt(spaceId);
                    await api.updateDefaultSpace(spaceIdToSave);
                    // Update currentUser state and localStorage
                    const updatedUser = { ...currentUser, default_space_id: spaceIdToSave };
                    setCurrentUser(updatedUser);
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                  } catch (err) {
                    console.error('Could not save default space:', err);
                  }
                }
              }}
              onManageSpaces={isAdmin() ? () => setShowSpaceManager(true) : null}
            />
            <PortfolioSelector
              key={`portfolio-${portfolios.length}-${selectedSpace}`} // Force re-render when portfolios or space changes
              portfolios={selectedSpace === 'all' ? portfolios : portfolios.filter(p => p.space_id && p.space_id === parseInt(selectedSpace))}
              selectedPortfolio={selectedPortfolio}
              onPortfolioChange={setSelectedPortfolio}
              onManagePortfolios={isAdmin() ? () => setShowPortfolioManager(true) : null}
            />
            <ProjectSelector
              key={`project-${projects.length}`} // Force re-render when projects list changes
              projects={projectsObject}
              selectedProject={selectedProject}
              onProjectChange={handleProjectChange}
            />

            {/* Project Actions Dropdown */}
            {isPMOrHigher() && (
              <div className="dropdown-container">
                <button
                  className="dropdown-btn"
                  onClick={() => {
                    setShowProjectDropdown(!showProjectDropdown);
                    setShowAdminDropdown(false);
                    setShowUserDropdown(false);
                  }}
                  onBlur={() => setTimeout(() => setShowProjectDropdown(false), 200)}
                >
                  Project <MdArrowDropDown />
                </button>
                {showProjectDropdown && (
                  <div className="dropdown-menu">
                    {canEdit() && (
                      <>
                        <button onMouseDown={() => { setShowNewProject(true); setShowProjectDropdown(false); }}>
                          New Project
                        </button>
                        <button onMouseDown={() => { setShowImportData(true); setShowProjectDropdown(false); }}>
                          Import Data
                        </button>
                      </>
                    )}
                    <button onMouseDown={() => { setShowReportSelector(true); setShowProjectDropdown(false); }}>
                      View Reports
                    </button>
                    {selectedProject && canEdit() && (
                      <>
                        <button onMouseDown={() => { setShowDataGrid(true); setShowProjectDropdown(false); }}>
                          Edit Data
                        </button>
                        <button onMouseDown={() => { handleDeleteProject(); setShowProjectDropdown(false); }}>
                          Delete Project
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Admin Dropdown */}
            {isAdmin() && (
              <div className="dropdown-container">
                <button
                  className="dropdown-btn"
                  onClick={() => {
                    setShowAdminDropdown(!showAdminDropdown);
                    setShowProjectDropdown(false);
                    setShowUserDropdown(false);
                  }}
                  onBlur={() => setTimeout(() => setShowAdminDropdown(false), 200)}
                >
                  Admin <MdArrowDropDown />
                </button>
                {showAdminDropdown && (
                  <div className="dropdown-menu">
                    <button onMouseDown={() => { setShowSpaceManager(true); setShowAdminDropdown(false); }}>
                      Manage Spaces
                    </button>
                    <button onMouseDown={() => { setShowPortfolioManager(true); setShowAdminDropdown(false); }}>
                      Manage Portfolios
                    </button>
                    <button onMouseDown={() => { setShowUserManagement(true); setShowAdminDropdown(false); }}>
                      Manage Users
                    </button>
                    <button onMouseDown={() => { setShowAuditLog(true); setShowAdminDropdown(false); }}>
                      Audit Log
                    </button>
                    <button onMouseDown={() => { setShowUserActivity(true); setShowAdminDropdown(false); }}>
                      User Activity Report
                    </button>
                    <button onMouseDown={() => { handleComposeChaser(); setShowAdminDropdown(false); }}>
                      Compose Chaser
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Account Menu Dropdown */}
            {isAuthenticated ? (
              <div className="dropdown-container">
                <button
                  className="dropdown-btn user-menu-btn"
                  onClick={() => {
                    setShowUserDropdown(!showUserDropdown);
                    setShowProjectDropdown(false);
                    setShowAdminDropdown(false);
                  }}
                  onBlur={() => setTimeout(() => setShowUserDropdown(false), 200)}
                >
                  Account <MdArrowDropDown />
                </button>
                {showUserDropdown && (
                  <div className="dropdown-menu">
                    <button onMouseDown={() => { setShowPasswordChange(true); setShowUserDropdown(false); }}>
                      Change Password
                    </button>
                    <button onMouseDown={() => { handleLogout(); setShowUserDropdown(false); }}>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Login onLogin={(user) => {
                setCurrentUser(user);
                setIsAuthenticated(true);
                const now = new Date();
                setLoginTime(now);
                localStorage.setItem('loginTime', now.toISOString());
              }} />
            )}
            {attentionCount > 0 && (
              <button
                className="attention-bell-button"
                onClick={() => setShowAttentionModal(true)}
                title={`${attentionCount} items need attention`}
              >
                <Lottie
                  animationData={bellNotificationAnimation}
                  loop={true}
                  className="attention-bell-animation"
                />
                <span className="attention-badge">
                  {attentionCount}
                </span>
              </button>
            )}
            <button
              className="theme-toggle-btn"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <MdLightMode /> : <MdDarkMode />}
            </button>
            {isAuthenticated && currentUser && (
              <div
                className="user-indicator-container"
                onMouseEnter={() => setShowUserModal(true)}
                onMouseLeave={() => setShowUserModal(false)}
              >
                <span className="user-indicator-circle">
                  {getUserInitials(currentUser.name)}
                </span>
                {showUserModal && (
                  <div className="user-modal">
                    <div className="user-modal-avatar">
                      {getUserInitials(currentUser.name)}
                    </div>
                    <div className="user-modal-info">
                      <div className="user-modal-name">{currentUser.name}</div>
                      <div className="user-modal-email">{currentUser.email}</div>
                      <div className="user-modal-login-time">
                        Logged in: {loginTime ? loginTime.toLocaleString() : 'Unknown'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="app-container">

        {selectedProject && (
          <div className="report-section">
            <div className="report-header">
              <div className="report-header-main">
                <div className="report-header-left">
                  <div className="report-header-title-row">
                    {editingProjectName ? (
                      <input
                        type="text"
                        className="project-name-input"
                        value={editProjectNameValue}
                        onChange={(e) => setEditProjectNameValue(e.target.value)}
                        onKeyDown={handleProjectNameKeyDown}
                        onBlur={handleSaveProjectName}
                        autoFocus
                      />
                    ) : (
                      <h2
                        className={projectName.length > 40 ? 'long-title' : ''}
                        onDoubleClick={canEdit() ? handleProjectNameDoubleClick : undefined}
                        title={projectName.length > 40 ? projectName : (canEdit() ? "Double-click to rename" : undefined)}
                        style={{ cursor: canEdit() ? 'pointer' : 'default' }}
                      >
                        {projectName}
                      </h2>
                    )}
                    {(() => {
                      const healthScore = calculateHealthScore(currentProject, projectData, projectMetrics, []);
                      const getScoreColor = (score) => {
                        if (score >= 80) return '#10b981';
                        if (score >= 60) return '#f59e0b';
                        return '#dc2626';
                      };
                      return (
                        <button
                          className="project-health-btn score-badge"
                          onClick={() => setShowProjectHealth(true)}
                          title="View project health"
                          style={{
                            borderColor: getScoreColor(healthScore),
                            color: getScoreColor(healthScore)
                          }}
                        >
                          {healthScore}
                        </button>
                      );
                    })()}
                    {/* Portfolio badge inline with title */}
                    {!editingPortfolio && currentProject?.portfolio_name && (
                      <div
                        className={`portfolio-display-inline ${canEdit() ? 'editable' : ''}`}
                        onClick={handlePortfolioClick}
                        title={canEdit() ? "Click to change portfolio" : undefined}
                      >
                        <span
                          className="portfolio-badge-inline"
                          style={{
                            backgroundColor: currentProject.portfolio_color || '#888',
                          }}
                        >
                          {currentProject.portfolio_name}
                        </span>
                      </div>
                    )}
                    {/* No portfolio placeholder - shown inline with title */}
                    {!editingPortfolio && !currentProject?.portfolio_name && canEdit() && (
                      <div
                        className="portfolio-display-inline editable"
                        onClick={handlePortfolioClick}
                        title="Click to assign portfolio"
                      >
                        <span className="portfolio-none-inline">+ Add Portfolio</span>
                      </div>
                    )}
                    {editingProjectDates ? (
                      <div className="date-editor">
                        <input
                          type="date"
                          value={editProjectStartDate}
                          onChange={(e) => setEditProjectStartDate(e.target.value)}
                          autoFocus
                        />
                        <span className="date-range-separator">{'\u2192'}</span>
                        <input
                          type="date"
                          value={editProjectEndDate}
                          onChange={(e) => setEditProjectEndDate(e.target.value)}
                        />
                        <button className="save-btn" onClick={handleSaveProjectDates}>
                          Save
                        </button>
                        <button className="cancel-btn" onClick={() => setEditingProjectDates(false)}>
                          Cancel
                        </button>
                      </div>
                    ) : currentProject?.start_date && currentProject?.end_date ? (
                      <div
                        className={`project-timeline-display ${canEdit() ? 'editable' : ''}`}
                        onClick={canEdit() ? () => {
                          setEditProjectStartDate(currentProject.start_date);
                          setEditProjectEndDate(currentProject.end_date);
                          setEditingProjectDates(true);
                        } : undefined}
                        title={canEdit() ? "Click to edit dates" : undefined}
                      >
                        <span className="project-timeline-date">{formatDate(currentProject.start_date)}</span>
                        <span className="project-timeline-separator">{'\u2192'}</span>
                        <span className="project-timeline-date">{formatDate(currentProject.end_date)}</span>
                        {projectDuration && (
                          <>
                            <span className="project-timeline-separator">•</span>
                            <span className="project-timeline-duration">
                              {projectDuration.months >= 2
                                ? `${projectDuration.months} months`
                                : projectDuration.weeks >= 2
                                ? `${projectDuration.weeks} weeks`
                                : `${projectDuration.days} days`}
                            </span>
                          </>
                        )}
                      </div>
                    ) : canEdit() ? (
                      <button
                        className="add-dates-btn"
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                          const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                          setEditProjectStartDate(today);
                          setEditProjectEndDate(oneYearLater);
                          setEditingProjectDates(true);
                        }}
                      >
                        + Add dates
                      </button>
                    ) : null}
                  </div>
                  {/* Second row: IMs and Links combined */}
                  <div className="project-meta-row">
                    {/* Portfolio editor (only when editing) */}
                    {editingPortfolio && (
                      <div className="portfolio-editor-inline">
                        <div className="portfolio-edit-dropdown">
                          <div
                            className="portfolio-option-item"
                            onClick={() => handlePortfolioOptionClick(null)}
                          >
                            <div className="option-content">
                              <span className="no-portfolio-icon">◆</span>
                              <span className="option-name">No Portfolio</span>
                              {editPortfolioValue === null && <span className="selected-check">✓</span>}
                            </div>
                          </div>
                          {portfolios.map(portfolio => (
                            <div
                              key={portfolio.id}
                              className={`portfolio-option-item ${editPortfolioValue === portfolio.id ? 'selected' : ''}`}
                              onClick={() => handlePortfolioOptionClick(portfolio.id)}
                            >
                              <div className="option-content">
                                <span
                                  className="portfolio-color-dot"
                                  style={{ backgroundColor: portfolio.color }}
                                />
                                <span className="option-name">{portfolio.name}</span>
                                {editPortfolioValue === portfolio.id && <span className="selected-check">✓</span>}
                              </div>
                            </div>
                          ))}
                          <div
                            className="portfolio-option-item create-new"
                            onClick={() => handlePortfolioOptionClick('__create__')}
                          >
                            <div className="option-content">
                              <span className="create-icon">+</span>
                              <span className="option-name">Create New Portfolio...</span>
                            </div>
                          </div>
                        </div>
                        <div className="portfolio-editor-actions">
                          <button onClick={handleSavePortfolio} className="save-btn">
                            Save
                          </button>
                          <button onClick={() => setEditingPortfolio(false)} className="cancel-btn">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* IMs and Links stacked vertically */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* IMs section */}
                      {editingPMs ? (
                        <div className="pm-editor">
                          <div className="pm-editor-field">
                            <label>Primary IM:</label>
                            <UserSelector
                              users={users}
                              selectedUser={editPMValue}
                              onUserChange={setEditPMValue}
                              placeholder="Select primary IM..."
                            />
                          </div>
                          <div className="pm-editor-field">
                            <label>Secondary IM:</label>
                            <UserSelector
                              users={users}
                              selectedUser={editSecondaryPMValue}
                              onUserChange={setEditSecondaryPMValue}
                              placeholder="Select secondary IM..."
                            />
                          </div>
                          <div className="pm-editor-actions">
                            <button onClick={handleSavePMs} className="save-btn">Save</button>
                            <button onClick={() => setEditingPMs(false)} className="cancel-btn">Cancel</button>
                          </div>
                        </div>
                      ) : (currentProject?.initiative_manager || currentProject?.secondary_pm || canEdit()) && (
                        <div
                          className={`pm-display-inline ${canEdit() ? 'editable' : ''}`}
                          onClick={handlePMsClick}
                          title={canEdit() ? "Click to edit initiative managers" : undefined}
                        >
                          {currentProject?.initiative_manager ? (
                            <>
                              <span className="pm-info-inline">
                                {currentProject.initiative_manager}
                              </span>
                              {currentProject?.secondary_pm && (
                                <>
                                  <span className="pm-separator">|</span>
                                  <span className="pm-info-inline">
                                    {currentProject.secondary_pm}
                                  </span>
                                </>
                              )}
                            </>
                          ) : canEdit() ? (
                            <span className="pm-placeholder-inline">+ Add IMs</span>
                          ) : null}
                        </div>
                      )}

                      {/* Links and Share - under IMs */}
                      <div className="project-links-inline">
                        {projectLinks.map((link, index) => (
                          <React.Fragment key={link.id}>
                            {index > 0 && <span className="links-separator">|</span>}
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="project-link-btn"
                            >
                              {link.label}
                            </a>
                          </React.Fragment>
                        ))}
                        {canEdit() && (
                          <button
                            onClick={() => setShowLinksEditor(true)}
                            className={`edit-links-btn ${projectLinks.length === 0 ? 'placeholder' : ''}`}
                            title="Edit project links"
                          >
                            {projectLinks.length === 0 ? '+ Links' : 'Edit'}
                          </button>
                        )}
                        <ProjectDependencies
                          projectId={selectedProject}
                          allProjects={projectsObject}
                          canEdit={canEdit()}
                          onNavigateToProject={handleNavigateToProject}
                          showSeparator={true}
                        />
                        <button
                          onClick={handleShareLink}
                          className="share-link-btn"
                          title="Copy link to this page"
                        >
                          <MdShare />
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
                {(currentProject?.description || canEdit()) && (
                  <div className="report-header-right" style={{ flex: 2 }}>
                    {editingProjectDesc ? (
                      <textarea
                        className="project-desc-input"
                        value={editProjectDescValue}
                        onChange={(e) => setEditProjectDescValue(e.target.value)}
                        onKeyDown={handleProjectDescKeyDown}
                        onBlur={handleSaveProjectDesc}
                        placeholder="Add a description of what the project will achieve here..."
                        rows={3}
                        autoFocus
                        style={{ textAlign: 'right' }}
                      />
                    ) : (
                      <p
                        className={`project-description ${canEdit() ? 'editable' : ''} ${currentProject?.description ? 'filled' : 'empty'}`}
                        onClick={handleProjectDescClick}
                        title={currentProject?.description ? currentProject.description : (canEdit() ? "Click to edit description" : undefined)}
                        style={{ textAlign: 'right' }}
                      >
                        {currentProject?.description || (canEdit() ? 'Click to add a description...' : '')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {(metrics.length === 0 || (selectedMetric && projectData.filter(item => item.metric === selectedMetric).length === 0)) && (
              <div className="empty-state" style={{ marginTop: '40px' }}>
                <svg
                  className="empty-state-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <h3>No Schedule Defined</h3>
                <p style={{ maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
                  Establish sensible measures for your project that measure progress continuously throughout the project (lead measures) and demonstrate the goals of the project have been met at the end (lag measures).
                </p>
                {canEdit() && (
                  <button
                    onClick={() => setShowDataGrid(true)}
                    style={{
                      marginTop: '20px',
                      padding: '10px 24px',
                      backgroundColor: '#00aeef',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0095d1'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#00aeef'}
                  >
                    Add Metrics & Schedules
                  </button>
                )}
              </div>
            )}

            {metrics.length > 0 && !(selectedMetric && projectData.filter(item => item.metric === selectedMetric).length === 0) && (
              <MetricTabs
                metrics={metrics}
                projectData={projectData}
                projectMetrics={projectMetrics}
                selectedMetric={selectedMetric}
                onMetricChange={handleMetricChange}
                onMetricRename={handleMetricRename}
                onMetricDelete={handleMetricDelete}
                onMetricReorder={handleMetricReorder}
                canEdit={canEdit()}
                onAddMetric={() => setShowAddMetric(true)}
                onGridView={() => setShowGridView(true)}
              />
            )}

            {selectedMetric && projectData.filter(item => item.metric === selectedMetric).length > 0 && (
              <div className="metrics-container">
                <MetricChart
                  key={selectedMetric}
                  metricName={selectedMetric}
                  data={projectData.filter(item => item.metric === selectedMetric)}
                  onCommentaryChange={handleCommentaryChange}
                  onDataChange={loadProjectData}
                  canEdit={canEdit()}
                  canEditData={canEdit() && !timeTravelTimestamp}
                  amberTolerance={amberTolerance}
                  redTolerance={redTolerance}
                  onToleranceChange={handleToleranceChange}
                  onTargetChange={handleTargetChange}
                  onProgressionChange={handleProgressionChange}
                  onDescriptionChange={handleDescriptionChange}
                  onDatesChange={handleMetricDatesChange}
                  timeTravelTimestamp={timeTravelTimestamp}
                  projectId={selectedProject}
                  onTimeTravelChange={handleTimeTravelChange}
                  onRevert={async () => {
                    await loadProjectData();
                    await loadProjectMetrics();
                  }}
                  isAdmin={isAdmin()}
                  currentUser={currentUser}
                />
              </div>
            )}
          </div>
        )}

        {!selectedProject && (
          <HomePage
            projects={projectsObject}
            projectsData={allProjectsData}
            onNavigateToProject={handleNavigateToProject}
            currentUser={currentUser}
            selectedSpace={selectedSpace}
            spaces={spaces}
            portfolios={portfolios}
            darkMode={darkMode}
            onAttentionCountChange={setAttentionCount}
            showAttentionModal={showAttentionModal}
            onAttentionModalShown={() => setShowAttentionModal(false)}
          />
        )}
      </div>

      {showDataGrid && (
        <DataGrid
          data={currentProjectData}
          metrics={metrics}
          projectMetrics={projectMetrics}
          onDataChange={handleDataGridChange}
          onClose={() => setShowDataGrid(false)}
          projectId={selectedProject}
          onMetricCreated={handleMetricCreated}
          onPeriodDeleted={loadProjectMetrics}
        />
      )}

      {showAddMetric && selectedProject && (
        <AddMetricModal
          projectId={selectedProject}
          onClose={() => setShowAddMetric(false)}
          onMetricCreated={handleMetricCreated}
        />
      )}

      {showAuditLog && (
        <div
          className="modal-overlay"
          onMouseDown={handleModalMouseDown}
          onClick={(e) => handleModalClick(e, () => setShowAuditLog(false))}
        >
          <div className="modal-content audit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Audit Log</h2>
              <button className="modal-close" onClick={() => setShowAuditLog(false)}>×</button>
            </div>
            <AuditLog />
          </div>
        </div>
      )}

      {showUserActivity && (
        <UserActivityReport
          onClose={() => setShowUserActivity(false)}
          selectedSpace={selectedSpace}
          spaces={spaces}
        />
      )}

      {showPageHeatmap && (
        <PageHeatmapReport
          onClose={() => setShowPageHeatmap(false)}
          selectedSpace={selectedSpace}
          spaces={spaces}
        />
      )}

      {showNewProject && (
        <div
          className="modal-overlay"
          onMouseDown={handleModalMouseDown}
          onClick={(e) => handleModalClick(e, handleProjectSetupCancel)}
        >
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <ProjectSetup
              onComplete={handleProjectSetupComplete}
              onCancel={handleProjectSetupCancel}
            />
          </div>
        </div>
      )}

      {showLinksEditor && selectedProject && (
        <div
          className="modal-overlay"
          onMouseDown={handleModalMouseDown}
          onClick={(e) => handleModalClick(e, () => setShowLinksEditor(false))}
        >
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <ProjectLinksEditor
              projectId={selectedProject}
              onClose={() => setShowLinksEditor(false)}
              onUpdate={loadProjectLinks}
            />
          </div>
        </div>
      )}

      {showPortfolioManager && (
        <PortfolioManager
          onClose={() => setShowPortfolioManager(false)}
          onPortfolioCreated={() => {
            loadPortfolios();
            loadProjects();
          }}
        />
      )}

      {showUserManagement && currentUser && (
        <UserManagement
          currentUser={currentUser}
          onClose={() => setShowUserManagement(false)}
        />
      )}

      {showPasswordChange && currentUser && (
        <UserProfile
          currentUser={currentUser}
          onClose={() => setShowPasswordChange(false)}
          onUpdate={(updatedUser) => setCurrentUser(updatedUser)}
        />
      )}

      {showImportData && (
        <ImportData
          onClose={() => setShowImportData(false)}
          onSuccess={() => {
            loadProjects();
            loadProjectData();
            setShowImportData(false);
          }}
        />
      )}


      {showSpaceManager && (
        <SpaceManager
          onClose={() => setShowSpaceManager(false)}
          onSpaceCreated={() => {
            loadSpaces();
            loadPortfolios();
            loadProjects();
          }}
        />
      )}

      {showChaserModal && (
        <div
          className="modal-overlay"
          onMouseDown={handleModalMouseDown}
          onClick={(e) => handleModalClick(e, () => setShowChaserModal(false))}
        >
          <div className="modal-content chaser-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Compose Chaser - {spaces.find(s => s.id === parseInt(selectedSpace))?.name || 'Space'}</h2>
              <button className="modal-close" onClick={() => setShowChaserModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {chaserData.issueCount === 0 ? (
                <p className="chaser-empty">No outstanding issues found for this space.</p>
              ) : (
                <>
                  <div className="chaser-section">
                    <label className="chaser-label">To: ({chaserData.pmCount} initiative owners)</label>
                    <textarea
                      className="chaser-textarea chaser-emails"
                      value={chaserData.emails}
                      readOnly
                      rows={2}
                    />
                  </div>
                  <div className="chaser-section">
                    <label className="chaser-label">Body ({chaserData.issueCount} issues):</label>
                    <textarea
                      className="chaser-textarea chaser-sections"
                      value={`Please take a look at your metric inconsistencies and correct as soon as possible in http://ptracker/\n\nThank You!\n\n${chaserData.sections}`}
                      readOnly
                      rows={Math.min(20, Math.max(8, chaserData.sections.split('\n').length + 3))}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showReportSelector && (
        <ReportSelector
          onClose={() => setShowReportSelector(false)}
          onGenerate={(config) => {
            setAdminReportConfig(config);
            setShowAdminReport(true);
            setShowReportSelector(false);
          }}
          portfolios={portfolios}
          spaces={spaces}
        />
      )}

      {showAdminReport && (
        <AdminReport
          type={adminReportConfig.type}
          id={adminReportConfig.id}
          name={adminReportConfig.name}
          onClose={() => setShowAdminReport(false)}
          onMetricClick={(projectId, metricName) => {
            setSelectedProject(projectId);
            setSelectedMetric(metricName);
            setShowAdminReport(false);
          }}
        />
      )}

      {showGridView && metrics.length > 1 && (
        <div
          className="modal-overlay"
          onMouseDown={handleModalMouseDown}
          onClick={(e) => handleModalClick(e, () => setShowGridView(false))}
        >
          <div className="modal-content grid-view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>All Metrics - {projectName}</h2>
              <button className="modal-close" onClick={() => setShowGridView(false)}>×</button>
            </div>
            <div className="modal-body grid-view-body">
              <div className={`grid-view-container metrics-count-${metrics.length}`}>
                {metrics.map((metric) => {
                  const metricData = projectData.filter(item => item.metric === metric);
                  if (metricData.length === 0) return null;

                  const metricInfo = projectMetrics.find(m => m.name === metric);
                  const metricAmberTolerance = metricData[0]?.amber_tolerance || 5.0;
                  const metricRedTolerance = metricData[0]?.red_tolerance || 10.0;

                  return (
                    <div
                      key={metric}
                      className="grid-view-item"
                      onClick={() => {
                        setSelectedMetric(metric);
                        setShowGridView(false);
                      }}
                    >
                      <MetricChart
                        metricName={metric}
                        data={metricData}
                        onCommentaryChange={() => {}}
                        onDataChange={() => {}}
                        canEdit={false}
                        canEditData={false}
                        amberTolerance={metricAmberTolerance}
                        redTolerance={metricRedTolerance}
                        onToleranceChange={() => {}}
                        onTargetChange={() => {}}
                        onProgressionChange={() => {}}
                        onDescriptionChange={() => {}}
                        onDatesChange={() => {}}
                        timeTravelTimestamp={null}
                        projectId={selectedProject}
                        onTimeTravelChange={() => {}}
                        onRevert={() => {}}
                        isAdmin={false}
                        currentUser={currentUser}
                        compactMode={true}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ten Reasons Modal */}
      {showTenReasons && (
        <div
          className="modal-overlay"
          onMouseDown={handleModalMouseDown}
          onClick={(e) => handleModalClick(e, () => setShowTenReasons(false))}
        >
          <div className="modal-content ten-reasons-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ten Reasons You Need This</h2>
              <button className="modal-close" onClick={() => setShowTenReasons(false)}>×</button>
            </div>
            <div className="modal-body ten-reasons-body">
              <ol className="ten-reasons-list">
                <li>
                  <strong>Track measures that predict success</strong>
                  <p>Focus on leading indicators, not status narratives that describe failure after the fact.</p>
                </li>
                <li>
                  <strong>Course correct early</strong>
                  <p>Identify trends before they become problems and take action while there's still time.</p>
                </li>
                <li>
                  <strong>Take the subjectivity out of status reporting</strong>
                  <p>Numbers don't lie. Replace "I think we're on track" with objective, measurable progress.</p>
                </li>
                <li>
                  <strong>Ensure completeness and consistency</strong>
                  <p>A structured approach means nothing gets forgotten and everyone reports the same way.</p>
                </li>
                <li>
                  <strong>A picture paints a thousand words</strong>
                  <p>Visualise progress at a glance. Spot patterns and issues instantly with clear charts.</p>
                </li>
                <li>
                  <strong>Low maintenance</strong>
                  <p>Happy path is a single number updated for each moving metric. No lengthy status reports to write.</p>
                </li>
                <li>
                  <strong>Focus on what matters</strong>
                  <p>RAG status highlights the metrics that need attention. Green means move on, red means dig in.</p>
                </li>
                <li>
                  <strong>Show the current in the context of the past and the future</strong>
                  <p>See if you're getting better or worse. Has scope changed since original planning? Do we expect a ramp-up? What needs to be true to succeed?</p>
                </li>
                <li>
                  <strong>Augments existing tools</strong>
                  <p>It doesn't duplicate your project management tools—it provides the progress view they lack.</p>
                </li>
                <li>
                  <strong>Automated reporting</strong>
                  <p>Generate consistent, professional reports with a click. Fewer slides!</p>
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Project Health Modal */}
      {showProjectHealth && currentProject && (
        <ProjectHealthModal
          project={currentProject}
          projectData={projectData}
          metrics={projectMetrics}
          recoveryPlans={[]}
          projectLinks={projectLinks}
          onClose={() => setShowProjectHealth(false)}
        />
      )}
    </div>
  );
}

export default App;
