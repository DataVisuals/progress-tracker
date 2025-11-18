import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import Login from './components/Login';
import ProjectSelector from './components/ProjectSelector';
import PortfolioSelector from './components/PortfolioSelector';
import PortfolioManager from './components/PortfolioManager';
import PortfolioReport from './components/PortfolioReport';
import MetricChart from './components/MetricChart';
import MetricTabs from './components/MetricTabs';
import DataGrid from './components/DataGrid';
import AuditLog from './components/AuditLog';
import UserManagement from './components/UserManagement';
import UserSelector from './components/UserSelector';
import ProjectSetup from './components/ProjectSetup';
import ProjectLinksEditor from './components/ProjectLinksEditor';
import UserProfile from './components/UserProfile';
import ConsistencyReport from './components/ConsistencyReport';
import ImportData from './components/ImportData';
import FeatureShowreel from './components/FeatureShowreel';
import { api } from './api/client';
import { selectStyles } from './components/SelectStyles';
import { MdShowChart, MdArrowDropDown, MdHelpOutline, MdShare } from 'react-icons/md';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [portfolios, setPortfolios] = useState([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [projectData, setProjectData] = useState([]);
  const [projectMetrics, setProjectMetrics] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('');
  const [showDataGrid, setShowDataGrid] = useState(false);
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
  const [showConsistencyReport, setShowConsistencyReport] = useState(false);
  const [showImportData, setShowImportData] = useState(false);
  const [showPortfolioManager, setShowPortfolioManager] = useState(false);
  const [showPortfolioReport, setShowPortfolioReport] = useState(false);
  const [showFeatureShowreel, setShowFeatureShowreel] = useState(false);

  // Load user on mount and load projects regardless of auth
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      setIsAuthenticated(true);
      setCurrentUser(JSON.parse(userStr));
    }
    loadPortfolios();
    loadProjects();

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
  }, []);

  // Load users for PM selector
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await api.getUsers();
        setUsers(response.data);
      } catch (err) {
        console.error('Failed to load users:', err);
      }
    };
    loadUsers();
  }, []);

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
    }
  }, [selectedProject]);

  // Auto-select first metric when metrics load
  useEffect(() => {
    if (projectMetrics.length > 0 && !selectedMetric) {
      setSelectedMetric(projectMetrics[0].name);
    }
  }, [projectMetrics]);

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
      alert('Failed to delete project');
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

  const handleTargetChange = async (newTarget) => {
    try {
      // Find the metric ID from the currently selected metric
      const metric = projectMetrics.find(m => m.name === selectedMetric);
      if (!metric) return;

      await api.updateMetric(metric.id, {
        final_target: parseFloat(newTarget)
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

  // Convert projects array to object format for ProjectSelector
  const projectsObject = projects.reduce((acc, project) => {
    acc[project.id] = {
      name: project.name,
      portfolio_name: project.portfolio_name,
      portfolio_color: project.portfolio_color
    };
    return acc;
  }, {});

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
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  // Helper functions for role checks
  const isAdmin = () => currentUser?.role === 'admin';
  const canEdit = () => currentUser && (currentUser.role === 'admin' || currentUser.role === 'pm' || currentUser.role === 'editor');

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
            <h1>
              <MdShowChart className="app-logo" />
              Progress Tracker
            </h1>
            <button
              className="help-icon-btn"
              onClick={() => setShowFeatureShowreel(true)}
              title="Learn about features"
            >
              <MdHelpOutline />
            </button>
          </div>
          <div className="header-right">
            <PortfolioSelector
              key={`portfolio-${portfolios.length}`} // Force re-render when portfolios list changes
              portfolios={portfolios}
              selectedPortfolio={selectedPortfolio}
              onPortfolioChange={setSelectedPortfolio}
              onManagePortfolios={isAdmin() ? () => setShowPortfolioManager(true) : null}
            />
            {selectedPortfolio && (
              <button
                className="portfolio-report-btn"
                onClick={() => setShowPortfolioReport(true)}
                title="View Portfolio Status Report"
              >
                <MdShowChart size={18} />
                Portfolio Report
              </button>
            )}
            <ProjectSelector
              key={`project-${projects.length}`} // Force re-render when projects list changes
              projects={projectsObject}
              selectedProject={selectedProject}
              onProjectChange={handleProjectChange}
            />

            {/* Project Actions Dropdown */}
            {canEdit() && (
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
                    <button onMouseDown={() => { setShowNewProject(true); setShowProjectDropdown(false); }}>
                      New Project
                    </button>
                    <button onMouseDown={() => { setShowImportData(true); setShowProjectDropdown(false); }}>
                      Import Data
                    </button>
                    {selectedProject && (
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
                    <button onMouseDown={() => { setShowPortfolioManager(true); setShowAdminDropdown(false); }}>
                      Manage Portfolios
                    </button>
                    <button onMouseDown={() => { setShowUserManagement(true); setShowAdminDropdown(false); }}>
                      Manage Users
                    </button>
                    <button onMouseDown={() => { setShowAuditLog(true); setShowAdminDropdown(false); }}>
                      Audit Log
                    </button>
                    <button onMouseDown={() => { setShowConsistencyReport(true); setShowAdminDropdown(false); }}>
                      Consistency Report
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
              }} />
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
                    {currentProject?.start_date && currentProject?.end_date && (
                      editingProjectDates ? (
                        <div className="project-dates-editor">
                          <input
                            type="date"
                            value={editProjectStartDate}
                            onChange={(e) => setEditProjectStartDate(e.target.value)}
                            autoFocus
                          />
                          <span className="project-timeline-separator">{'\u2192'}</span>
                          <input
                            type="date"
                            value={editProjectEndDate}
                            onChange={(e) => setEditProjectEndDate(e.target.value)}
                          />
                          <button onClick={handleSaveProjectDates} className="save-btn">
                            Save
                          </button>
                          <button onClick={() => setEditingProjectDates(false)} className="cancel-btn">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`project-timeline-display ${canEdit() ? 'editable' : ''}`}
                          onDoubleClick={canEdit() ? () => {
                            setEditProjectStartDate(currentProject.start_date);
                            setEditProjectEndDate(currentProject.end_date);
                            setEditingProjectDates(true);
                          } : undefined}
                          title={canEdit() ? "Double-click to edit dates" : undefined}
                        >
                          <span className="project-timeline-date">{formatDate(currentProject.start_date)}</span>
                          <span className="project-timeline-separator">{'\u2192'}</span>
                          <span className="project-timeline-date">{formatDate(currentProject.end_date)}</span>
                          {projectDuration && (
                            <>
                              <span className="project-timeline-separator">•</span>
                              <span className="project-timeline-duration">
                                {projectDuration.months > 1
                                  ? `${projectDuration.months} months`
                                  : projectDuration.weeks > 1
                                  ? `${projectDuration.weeks} weeks`
                                  : `${projectDuration.days} days`}
                              </span>
                            </>
                          )}
                        </div>
                      )
                    )}
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

                    {/* No portfolio placeholder (when not editing and no portfolio assigned) */}
                    {!editingPortfolio && !currentProject?.portfolio_name && canEdit() && (
                      <div
                        className="portfolio-display-inline editable"
                        onClick={handlePortfolioClick}
                        title="Click to assign portfolio"
                      >
                        <span className="portfolio-none-inline">+ Add Portfolio</span>
                      </div>
                    )}

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

                  </div>
                </div>
                {(currentProject?.description || canEdit() || projectLinks.length > 0) && (
                  <div className="report-header-right">
                    {editingProjectDesc ? (
                      <textarea
                        className="project-desc-input"
                        value={editProjectDescValue}
                        onChange={(e) => setEditProjectDescValue(e.target.value)}
                        onKeyDown={handleProjectDescKeyDown}
                        onBlur={handleSaveProjectDesc}
                        placeholder="Enter project description..."
                        rows={3}
                        autoFocus
                      />
                    ) : (
                      <p
                        className={`project-description ${canEdit() ? 'editable' : ''} ${currentProject?.description ? 'filled' : 'empty'}`}
                        onClick={handleProjectDescClick}
                        title={currentProject?.description ? currentProject.description : (canEdit() ? "Click to edit description" : undefined)}
                      >
                        {currentProject?.description || (canEdit() ? 'Click to add a description...' : '')}
                      </p>
                    )}
                    {/* Links and Share - right aligned under description */}
                    <div className="project-links-inline" style={{ justifyContent: 'flex-end', marginTop: '8px' }}>
                      {projectLinks.map((link) => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="project-link-btn"
                        >
                          {link.label}
                        </a>
                      ))}
                      {canEdit() && (
                        <button
                          onClick={() => setShowLinksEditor(true)}
                          className="edit-links-btn"
                          title="Edit project links"
                        >
                          {projectLinks.length === 0 ? '+ Links' : 'Edit'}
                        </button>
                      )}
                      <button
                        onClick={handleShareLink}
                        className="share-link-btn"
                        title="Copy link to this page"
                      >
                        <MdShare />
                      </button>
                    </div>
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
                selectedMetric={selectedMetric}
                onMetricChange={handleMetricChange}
                onMetricRename={handleMetricRename}
                onMetricDelete={handleMetricDelete}
                canEdit={canEdit()}
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
          <div className="empty-state">
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
            <h3>Select a Project to Begin</h3>
            <p>Choose a project from the dropdown above to view metrics and reports</p>
          </div>
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

      {showAuditLog && (
        <div className="modal-overlay" onClick={() => setShowAuditLog(false)}>
          <div className="modal-content audit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Audit Log</h2>
              <button className="close-btn" onClick={() => setShowAuditLog(false)}>×</button>
            </div>
            <AuditLog />
          </div>
        </div>
      )}

      {showConsistencyReport && (
        <div className="modal-overlay" onClick={() => setShowConsistencyReport(false)}>
          <div className="modal-content audit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <button className="close-btn" onClick={() => setShowConsistencyReport(false)}>×</button>
            </div>
            <ConsistencyReport
              onNavigate={(projectId) => {
                setSelectedProject(projectId);
                setShowConsistencyReport(false);
              }}
            />
          </div>
        </div>
      )}

      {showNewProject && (
        <div className="modal-overlay" onClick={handleProjectSetupCancel}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <ProjectSetup
              onComplete={handleProjectSetupComplete}
              onCancel={handleProjectSetupCancel}
            />
          </div>
        </div>
      )}

      {showLinksEditor && selectedProject && (
        <div className="modal-overlay" onClick={() => setShowLinksEditor(false)}>
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

      {showPortfolioReport && selectedPortfolio && (
        <PortfolioReport
          portfolioId={selectedPortfolio}
          onClose={() => setShowPortfolioReport(false)}
          onMetricClick={(projectId, metricName) => {
            setSelectedProject(projectId.toString());
            setSelectedMetric(metricName);
            updateURL(projectId.toString(), metricName);
            setShowPortfolioReport(false);
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

      {showFeatureShowreel && (
        <FeatureShowreel
          onClose={() => setShowFeatureShowreel(false)}
        />
      )}
    </div>
  );
}

export default App;
