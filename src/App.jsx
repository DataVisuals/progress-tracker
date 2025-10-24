import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import ProjectSelector from './components/ProjectSelector';
import MetricChart from './components/MetricChart';
import MetricTabs from './components/MetricTabs';
import DataGrid from './components/DataGrid';
import CRAIDs from './components/CRAIDs';
import AuditLog from './components/AuditLog';
import UserManagement from './components/UserManagement';
import { api } from './api/client';
import { MdShowChart } from 'react-icons/md';
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
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectManager, setNewProjectManager] = useState('');
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [editProjectNameValue, setEditProjectNameValue] = useState('');
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);

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

  const loadProjectData = async () => {
    try {
      const response = await api.getProjectData(selectedProject);
      setProjectData(response.data);
    } catch (err) {
      console.error('Failed to load project data:', err);
    }
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
          await api.updatePeriod(item.id, {
            complete: item.complete,
            expected: item.expected,
            target: item.final_target
          });
        }
      }
      // Reload project data
      await loadProjectData();
    } catch (err) {
      console.error('Failed to update data:', err);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    try {
      const response = await api.createProject({
        name: newProjectName,
        description: newProjectDesc,
        initiative_manager: newProjectManager
      });
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectManager('');
      setShowNewProject(false);
      await loadProjects();
      // Auto-select the newly created project
      setSelectedProject(response.data.id.toString());
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('Failed to create project');
    }
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

  const projectName = selectedProject
    ? projects.find(p => p.id === parseInt(selectedProject))?.name || ''
    : '';

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

  // Debug logging
  console.log('Current User:', currentUser);
  console.log('Can Edit:', canEdit());
  console.log('Is Admin:', isAdmin());

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
            {canEdit() && (
              <button className="new-project-btn" onClick={() => setShowNewProject(true)}>
                + New Project
              </button>
            )}
            {selectedProject && canEdit() && (
              <>
                <button className="delete-project-btn" onClick={handleDeleteProject}>
                  Delete Project
                </button>
                <button className="edit-data-btn" onClick={() => setShowDataGrid(true)}>
                  Edit Data
                </button>
              </>
            )}
            {isAdmin() && (
              <>
                <button className="manage-users-btn" onClick={() => setShowUserManagement(true)}>
                  Manage Users
                </button>
                <button className="audit-log-btn" onClick={() => setShowAuditLog(true)}>
                  Audit Log
                </button>
              </>
            )}
            {isAuthenticated ? (
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            ) : (
              <Login onLogin={() => {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                  const user = JSON.parse(userStr);
                  setCurrentUser(user);
                  setIsAuthenticated(true);
                }
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
                  <h2
                    onDoubleClick={canEdit() ? handleProjectNameDoubleClick : undefined}
                    title={canEdit() ? "Double-click to rename" : undefined}
                    style={{ cursor: canEdit() ? 'pointer' : 'default' }}
                  >
                    {projectName}
                  </h2>
                )}
              </div>
              <p className="report-meta">
                Generated on {new Date().toLocaleDateString()}
              </p>
            </div>

            {metrics.length > 0 && (
              <MetricTabs
                metrics={metrics}
                selectedMetric={selectedMetric}
                onMetricChange={handleMetricChange}
                onMetricRename={handleMetricRename}
                canEdit={canEdit()}
              />
            )}

            {selectedMetric && (
              <div className="metrics-container">
                <MetricChart
                  key={selectedMetric}
                  metricName={selectedMetric}
                  data={projectData.filter(item => item.metric === selectedMetric)}
                  onCommentaryChange={handleCommentaryChange}
                />
              </div>
            )}

            <CRAIDs projectId={selectedProject} />
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

      {showNewProject && (
        <div className="modal-overlay" onClick={() => setShowNewProject(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Project</h2>
            <div className="form-group">
              <label htmlFor="project-name">Project Name:</label>
              <input
                id="project-name"
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter project name..."
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="project-manager">Project Manager:</label>
              <input
                id="project-manager"
                type="text"
                value={newProjectManager}
                onChange={(e) => setNewProjectManager(e.target.value)}
                placeholder="Enter project manager name..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="project-desc">Description (optional):</label>
              <textarea
                id="project-desc"
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="Enter project description..."
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="save-btn" onClick={handleCreateProject}>
                Create
              </button>
              <button className="cancel-btn" onClick={() => setShowNewProject(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showUserManagement && currentUser && (
        <UserManagement
          currentUser={currentUser}
          onClose={() => setShowUserManagement(false)}
        />
      )}
    </div>
  );
}

export default App;
