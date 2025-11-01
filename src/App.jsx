import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import ProjectSelector from './components/ProjectSelector';
import MetricChart from './components/MetricChart';
import MetricTabs from './components/MetricTabs';
import DataGrid from './components/DataGrid';
import CRAIDs from './components/CRAIDs';
import AuditLog from './components/AuditLog';
import UserManagement from './components/UserManagement';
import ProjectSetup from './components/ProjectSetup';
import ProjectLinksEditor from './components/ProjectLinksEditor';
import PasswordChange from './components/PasswordChange';
import UserProfile from './components/UserProfile';
import TimeTravel from './components/TimeTravel';
import ConsistencyReport from './components/ConsistencyReport';
import ImportData from './components/ImportData';
import { api } from './api/client';
import { MdShowChart, MdArrowDropDown } from 'react-icons/md';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [projectData, setProjectData] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('');
  const [showDataGrid, setShowDataGrid] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [editProjectNameValue, setEditProjectNameValue] = useState('');
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

  // Load user on mount and load projects regardless of auth
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      setIsAuthenticated(true);
      setCurrentUser(JSON.parse(userStr));
    }
    loadProjects();
  }, []);

  // Load project data when project selected
  useEffect(() => {
    if (selectedProject) {
      loadProjectData();
      loadProjectLinks();
    }
  }, [selectedProject]);

  // Auto-select first metric when project data loads
  useEffect(() => {
    if (projectData.length > 0 && !selectedMetric) {
      const uniqueMetrics = [...new Set(projectData.map(item => item.metric))];
      if (uniqueMetrics.length > 0) {
        setSelectedMetric(uniqueMetrics[0]);
      }
    }
  }, [projectData]);

  const loadProjects = async () => {
    try {
      const response = await api.getProjects();
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
  };

  const handleMetricChange = (metric) => {
    setSelectedMetric(metric);
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
                   original.final_target !== item.final_target) {
          // This is an existing period - update it
          try {
            await api.updatePeriod(item.id, {
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
      // Reload project data
      await loadProjectData();
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
    await loadProjectData();
    setShowNewProject(false);
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

  const handleMetricCreated = async (metricName) => {
    // Reload project data to include the new metric
    await loadProjectData();
    // Select the newly created metric
    setSelectedMetric(metricName);
  };

  const handleMetricRename = async (oldName, newName) => {
    try {
      // Find the metric ID from the project data
      const metricData = projectData.find(item => item.metric === oldName);
      if (!metricData) return;

      await api.updateMetric(metricData.metric_id, { name: newName });

      // Reload project data
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
    acc[project.id] = { name: project.name };
    return acc;
  }, {});

  // Get unique metrics from project data
  const metrics = selectedProject
    ? [...new Set(projectData.map(item => item.metric))]
    : [];

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
  const canEdit = () => currentUser && (currentUser.role === 'admin' || currentUser.role === 'pm');

  return (
    <div className="app">
      <header className="app-header-main">
        <div className="header-content">
          <div className="header-left">
            <h1>
              <MdShowChart className="app-logo" />
              Progress Tracker
            </h1>
          </div>
          <div className="header-right">
            <ProjectSelector
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
                    <button onClick={() => { setShowNewProject(true); setShowProjectDropdown(false); }}>
                      New Project
                    </button>
                    <button onClick={() => { setShowImportData(true); setShowProjectDropdown(false); }}>
                      Import Data
                    </button>
                    {selectedProject && (
                      <>
                        <button onClick={() => { setShowDataGrid(true); setShowProjectDropdown(false); }}>
                          Edit Data
                        </button>
                        <button onClick={() => { handleDeleteProject(); setShowProjectDropdown(false); }}>
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
                    <button onClick={() => { setShowUserManagement(true); setShowAdminDropdown(false); }}>
                      Manage Users
                    </button>
                    <button onClick={() => { setShowAuditLog(true); setShowAdminDropdown(false); }}>
                      Audit Log
                    </button>
                    <button onClick={() => { setShowConsistencyReport(true); setShowAdminDropdown(false); }}>
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
                    <button onClick={() => { setShowPasswordChange(true); setShowUserDropdown(false); }}>
                      Change Password
                    </button>
                    <button onClick={() => { handleLogout(); setShowUserDropdown(false); }}>
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
              <div>
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
                    <h2
                      onDoubleClick={canEdit() ? handleProjectNameDoubleClick : undefined}
                      title={canEdit() ? "Double-click to rename" : undefined}
                      style={{ cursor: canEdit() ? 'pointer' : 'default', margin: 0 }}
                    >
                      {projectName}
                    </h2>
                    {currentProject?.start_date && currentProject?.end_date && (
                      <div className="project-timeline-display" style={{
                        padding: '8px 14px',
                        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                        border: '1px solid #bae6fd',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '13px',
                        boxShadow: '0 1px 3px rgba(0, 174, 239, 0.08)',
                        whiteSpace: 'nowrap'
                      }}>
                        <span style={{ color: '#0c4a6e', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          PROJECT:
                        </span>
                        <span style={{ fontWeight: 600, color: '#003c71' }}>
                          {formatDate(currentProject.start_date)}
                        </span>
                        <span style={{ color: '#0284c7', fontWeight: 600, opacity: 0.6 }}>→</span>
                        <span style={{ fontWeight: 600, color: '#003c71' }}>
                          {formatDate(currentProject.end_date)}
                        </span>
                        {projectDuration && (
                          <>
                            <span style={{ color: '#0284c7', fontWeight: 600, opacity: 0.6 }}>•</span>
                            <span style={{ fontWeight: 700, color: '#00aeef' }}>
                              {projectDuration.months > 1
                                ? `${projectDuration.months} months`
                                : projectDuration.weeks > 1
                                ? `${projectDuration.weeks} weeks`
                                : `${projectDuration.days} days`}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="project-links" style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {projectLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="project-link-btn"
                      style={{
                        backgroundColor: '#00aeef',
                        color: 'white',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontSize: '13px',
                        fontWeight: '500',
                        transition: 'background-color 0.2s',
                        display: 'inline-block'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#003c71'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#00aeef'}
                    >
                      {link.label}
                    </a>
                  ))}
                  {canEdit() && (
                    <button
                      onClick={() => setShowLinksEditor(true)}
                      style={{
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                        border: '1px solid #d1d5db',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                        e.currentTarget.style.borderColor = '#9ca3af';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = '#d1d5db';
                      }}
                      title="Edit project links"
                    >
                      {projectLinks.length === 0 ? '+ Add Links' : 'Edit Links'}
                    </button>
                  )}
                </div>
              </div>
              <p className="report-meta">
                Generated on {new Date().toLocaleDateString()}
              </p>
            </div>

            {metrics.length > 0 && (
              <MetricTabs
                metrics={metrics}
                projectData={projectData}
                selectedMetric={selectedMetric}
                onMetricChange={handleMetricChange}
                onMetricRename={handleMetricRename}
                canEdit={canEdit()}
              />
            )}

            {selectedMetric && (
              <>
                <div className="metrics-container">
                  <MetricChart
                    key={selectedMetric}
                    metricName={selectedMetric}
                    data={projectData.filter(item => item.metric === selectedMetric)}
                    onCommentaryChange={handleCommentaryChange}
                    onDataChange={loadProjectData}
                    canEdit={canEdit() && !timeTravelTimestamp}
                    amberTolerance={amberTolerance}
                    redTolerance={redTolerance}
                    timeTravelTimestamp={timeTravelTimestamp}
                  />
                </div>
                {canEdit() && (
                  <TimeTravel
                    projectId={selectedProject}
                    onTimeTravelChange={handleTimeTravelChange}
                  />
                )}
              </>
            )}

            <CRAIDs projectId={selectedProject} canEdit={canEdit()} />
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
          onDataChange={handleDataGridChange}
          onClose={() => setShowDataGrid(false)}
          projectId={selectedProject}
          onMetricCreated={handleMetricCreated}
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
    </div>
  );
}

export default App;
