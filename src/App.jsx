import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import ProjectSelector from './components/ProjectSelector';
import PortfolioSelector from './components/PortfolioSelector';
import PortfolioManager from './components/PortfolioManager';
import MetricChart from './components/MetricChart';
import MetricTabs from './components/MetricTabs';
import DataGrid from './components/DataGrid';
import AuditLog from './components/AuditLog';
import UserManagement from './components/UserManagement';
import ProjectSetup from './components/ProjectSetup';
import ProjectLinksEditor from './components/ProjectLinksEditor';
import UserProfile from './components/UserProfile';
import ConsistencyReport from './components/ConsistencyReport';
import ImportData from './components/ImportData';
import FeatureShowreel from './components/FeatureShowreel';
import { api } from './api/client';
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

  // Reload projects when portfolio selection changes
  useEffect(() => {
    loadProjects();
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

  const loadProjects = async (portfolioFilter = selectedPortfolio) => {
    try {
      const url = portfolioFilter ? `/projects?portfolio_id=${portfolioFilter}` : '/projects';
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
      // Separate new and existing periods
      for (const item of updatedData) {
        const original = projectData.find(p => p.id === item.id);

        if (!original) {
          // This is a new period - create it
          await api.createPeriod({
            metric_id: item.metric_id,
            reporting_date: item.reporting_date,
            expected: item.expected,
            target: item.final_target,
            complete: item.complete
          });
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
      await loadProjectData();
      await loadProjectMetrics();
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
    setSelectedProject(projectId.toString());
    setShowNewProject(false);
    // Wait a moment for state to update, then load project data
    setTimeout(async () => {
      await loadProjectData();
    }, 100);
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
        initiative_manager: project.initiative_manager
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
          initiative_manager: currentProject.initiative_manager
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
          start_date: editProjectStartDate,
          end_date: editProjectEndDate
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
                    {currentProject?.start_date && currentProject?.end_date && (
                      editingProjectDates ? (
                        <div className="project-dates-editor">
                          <input
                            type="date"
                            value={editProjectStartDate}
                            onChange={(e) => setEditProjectStartDate(e.target.value)}
                            autoFocus
                          />
                          <span className="project-timeline-separator">→</span>
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
                          <span className="project-timeline-label">PROJECT:</span>
                          <span className="project-timeline-date">{formatDate(currentProject.start_date)}</span>
                          <span className="project-timeline-separator">→</span>
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
                  <div className="project-links">
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
                        {projectLinks.length === 0 ? '+ Add Links' : 'Edit Links'}
                      </button>
                    )}
                    <button
                      onClick={handleShareLink}
                      className="share-link-btn"
                      title="Copy link to this page"
                    >
                      <MdShare /> Share
                    </button>
                  </div>
                </div>
                {(currentProject?.description || canEdit()) && (
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
                  timeTravelTimestamp={timeTravelTimestamp}
                  projectId={selectedProject}
                  onTimeTravelChange={handleTimeTravelChange}
                  onRevert={async () => {
                    await loadProjectData();
                    await loadProjectMetrics();
                  }}
                  isAdmin={isAdmin()}
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
